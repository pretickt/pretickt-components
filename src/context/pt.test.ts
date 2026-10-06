import { describe, expect, it } from 'vitest';
import { needKey } from '../api';
import { createPt, methodOf, typologyOf } from './pt';
import { validateParams } from './validate';

const NVDA = { ticker: 'NVDA', window: '1d' } as const;
const keyOf = (t: string, params: unknown) => needKey({ t: t as never, params });

describe('the pt context', () => {
  it('has one method per typology, named after it', () => {
    expect(methodOf('move-breakdown@1')).toBe('moveBreakdown');
    expect(methodOf('price-series@1')).toBe('priceSeries');
    expect(typologyOf('news')).toBe('news@1');
    const pt = createPt({ resolve: async () => null });
    expect(typeof pt.moveBreakdown).toBe('function');
    expect(typeof pt.screen).toBe('function');
    expect((pt as unknown as { then?: unknown }).then).toBeUndefined(); // never mistaken for a promise
  });

  it('build: records every call by the params the component passed (the browser passes the same ones), null included', async () => {
    const asked: unknown[] = [];
    const record: Record<string, unknown> = {};
    const pt = createPt({ resolve: async (t, p) => { asked.push([t, p]); return t === 'news@1' ? null : { ok: 1 }; }, record });
    expect(await pt.moveBreakdown({ ticker: 'NVDA', window: '1d' })).toEqual({ ok: 1 });
    expect(await pt.news({ ticker: 'NVDA' })).toBeNull();
    expect(asked).toEqual([['move-breakdown@1', NVDA], ['news@1', { ticker: 'NVDA' }]]);
    expect(record).toEqual({ [keyOf('move-breakdown@1', NVDA)]: { ok: 1 }, [keyOf('news@1', { ticker: 'NVDA' })]: null });
  });

  it('browser: replays recorded calls (null too) without the network, then fetches new ones and caches them', async () => {
    let calls = 0;
    const replay = { [keyOf('move-breakdown@1', NVDA)]: { from: 'page' }, [keyOf('news@1', { ticker: 'NVDA' })]: null };
    const pt = createPt({ resolve: async () => { calls++; return { from: 'api' }; }, replay });
    expect(await pt.moveBreakdown({ ticker: 'NVDA', window: '1d' })).toEqual({ from: 'page' });
    expect(await pt.news({ ticker: 'NVDA' })).toBeNull();
    expect(calls).toBe(0);
    expect(await pt.moveBreakdown({ ticker: 'NVDA', window: '5d' })).toEqual({ from: 'api' });
    expect(await pt.moveBreakdown({ ticker: 'NVDA', window: '5d' })).toEqual({ from: 'api' });
    expect(calls).toBe(1);
  });

  it('a failed request is data not available (null), and is not cached', async () => {
    let n = 0;
    const pt = createPt({ resolve: async () => { if (n++ === 0) throw new Error('api 502'); return { ok: 1 }; } });
    expect(await pt.news({ ticker: 'NVDA' })).toBeNull();
    expect(await pt.news({ ticker: 'NVDA' })).toEqual({ ok: 1 });
  });

  it('with a validator (build and checks), params the typology rejects are a component bug: the call throws with the reason', async () => {
    const pt = createPt({ resolve: async () => ({}), validate: validateParams });
    await expect(pt.moveBreakdown({ ticker: 'NVDA', window: '2d' as never })).rejects.toThrow(/move-breakdown@1.*window/);
    await expect(createPt({ resolve: async () => ({ ok: 1 }) }).moveBreakdown({ ticker: 'NVDA', window: '2d' as never })).resolves.toEqual({ ok: 1 }); // the browser trusts the API
  });

  it('latest wins: a call superseded by a newer one of the same method (a later click) never settles', async () => {
    const pending: ((v: unknown) => void)[] = [];
    const pt = createPt({ resolve: () => new Promise((r) => pending.push(r)) });
    const settled: string[] = [];
    void pt.moveBreakdown({ ticker: 'NVDA', window: '5d' }).then(() => settled.push('5d'));
    await Promise.resolve(); await Promise.resolve();          // the user clicks again a moment later
    void pt.moveBreakdown({ ticker: 'NVDA', window: '1m' }).then(() => settled.push('1m'));
    pending[1]!({ w: '1m' }); pending[0]!({ w: '5d' });          // the older answer arrives last
    await new Promise((r) => setTimeout(r, 0));
    expect(settled).toEqual(['1m']);
  });

  it('calls started together (Promise.all) do not supersede each other', async () => {
    const pt = createPt({ resolve: async (_t, p) => p });
    const [a, b] = await Promise.all([pt.priceSeries({ tickers: ['NVDA'], range: '1y' }), pt.priceSeries({ tickers: ['SPY'], range: '1y' })]);
    expect([a, b]).toEqual([expect.objectContaining({ tickers: ['NVDA'] }), expect.objectContaining({ tickers: ['SPY'] })]);
  });
});

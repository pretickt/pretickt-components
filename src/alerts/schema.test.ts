import { describe, expect, it } from 'vitest';
import { ruleSchema } from './schema';

const ok = (v: unknown) => ruleSchema.safeParse(v).success;
const romeo = { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'below-average', p: { dir: 'below', pct: 15, days: '50' } },
  { c: 'mega-caps', p: {} }] };

describe('ruleSchema (the server checks every rule it stores)', () => {
  it("accepts the spec's example rule", () => expect(ok(romeo)).toBe(true));
  it('accepts a sector and a ticker', () => {
    expect(ok({ v: 1, all: [{ c: 'news-spike', p: { times: 3 } }, { c: 'sector', p: { sector: 'Energy' } }, { c: 'one-stock', p: { ticker: 'BRK.B' } }] })).toBe(true);
  });
  it('rejects 7 conditions', () => expect(ok({ v: 1, all: Array.from({ length: 7 }, () => romeo.all[0]) })).toBe(false));
  it('rejects a pct above its max', () => expect(ok({ v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 21 } }] })).toBe(false));
  it('rejects a value off its step', () => expect(ok({ v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5.25 } }] })).toBe(false));
  it('rejects an unknown condition', () => expect(ok({ v: 1, all: [{ c: 'moon-phase', p: {} }] })).toBe(false));
  it('rejects a param of another condition', () => expect(ok({ v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5, days: '50' } }] })).toBe(false));
  it('rejects an unknown choice, sector or ticker', () => {
    expect(ok({ v: 1, all: [{ c: 'session-move', p: { dir: 'sideways', pct: 5 } }] })).toBe(false);
    expect(ok({ v: 1, all: [{ c: 'news-spike', p: { times: 3 } }, { c: 'sector', p: { sector: 'Crypto' } }] })).toBe(false);
    expect(ok({ v: 1, all: [{ c: 'news-spike', p: { times: 3 } }, { c: 'one-stock', p: { ticker: 'nvda' } }] })).toBe(false);
  });
  it('rejects a rule of universe conditions only', () => expect(ok({ v: 1, all: [{ c: 'mega-caps', p: {} }] })).toBe(false));
  it('a portfolio: 1 to 100 tickers, each once', () => {
    const rule = (tickers: string) => ({ v: 1, all: [{ c: 'news-spike', p: { times: 3 } }, { c: 'companies', p: { tickers } }] });
    expect(ok(rule('AAPL,MSFT,BRK.B'))).toBe(true);
    const many = Array.from({ length: 101 }, (_, i) => `A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
    expect(ok(rule(many.slice(0, 100).join(',')))).toBe(true);
    for (const t of ['', 'AAPL,,MSFT', 'aapl', 'AAPL,AAPL', many.join(','), 'AAPL MSFT']) expect(ok(rule(t)), t.slice(0, 20)).toBe(false);
  });
  it('rejects another version', () => expect(ok({ ...romeo, v: 2 })).toBe(false));
});

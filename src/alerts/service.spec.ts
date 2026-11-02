import { TestBed } from '@angular/core/testing';
import { MOCK_UNIVERSE } from './mock';
import { RULE_MAX } from './rule';
import { PtAlerts } from './service';
import { PT_ALERTS, type AlertFrom, type AlertsBackend, type SaveResult } from './token';

/** A backend in memory: what it was asked, and a save that answers when the test says. */
function fake(save: () => Promise<SaveResult> = async () => ({ ok: true })) {
  const calls = { save: [] as unknown[], universe: 0 };
  const backend: AlertsBackend = {
    universe: async () => { calls.universe++; return MOCK_UNIVERSE; },
    bars: async () => null,
    save: (req) => { calls.save.push(req); return save(); },
    manage: async () => null,
    landing: () => ({ alert: null, token: null, action: null }),
  };
  return { backend, calls };
}
const mount = (backend?: AlertsBackend) => {
  TestBed.configureTestingModule({ providers: backend ? [{ provide: PT_ALERTS, useValue: backend }] : [] });
  return TestBed.inject(PtAlerts);
};
const from: AlertFrom = { tag: 'pt-why-today', section: 'why', path: '/stocks/nvda/' };
const ids = (a: PtAlerts) => a.draft()?.rule.all.map((rc) => rc.c);

describe('PtAlerts (the alert being built, and the page\'s backend)', () => {
  it('without a backend it is disabled and add does nothing', () => {
    const a = mount();
    expect(a.enabled).toBe(false);
    a.add({ c: 'session-move' }, from);
    expect(a.draft()).toBeNull();
    expect(a.opened()).toBe(false);
  });

  it('add appends the badge, then one-stock, and opens', () => {
    const a = mount(fake().backend);
    a.add({ c: 'session-move', ticker: 'NVDA' }, from);
    expect(ids(a)).toEqual(['session-move', 'one-stock']);
    expect(a.draft()!.prefer).toBe('NVDA');
    expect(a.draft()!.from).toEqual(from);
    expect(a.opened()).toBe(true);
  });

  it('a second bell adds to the same draft without repeating a universe condition', () => {
    const a = mount(fake().backend);
    a.add({ c: 'analyst-upside', ticker: 'AMD' }, { ...from, section: 'targets' });
    a.add({ c: 'news-spike', ticker: 'AMD' }, { ...from, section: 'news' });
    expect(ids(a)).toEqual(['analyst-upside', 'one-stock', 'news-spike']);
    expect(a.draft()!.from!.section).toBe('targets');   // where the alert was started
  });

  it('pressing the same bell again adds nothing (after closing, or a double press while the editor loads)', () => {
    const a = mount(fake().backend);
    a.add({ c: 'session-move', ticker: 'NVDA' }, from);
    a.close();
    a.add({ c: 'session-move', ticker: 'NVDA' }, from);
    expect(ids(a)).toEqual(['session-move', 'one-stock']);
    a.addCondition({ c: 'session-move', p: { dir: 'down', pct: 5 } });
    expect(ids(a)).toEqual(['session-move', 'one-stock']);
  });

  it('a price level is seeded once from the example when the universe arrives; a chosen $100 stays', async () => {
    const a = mount(fake().backend);
    a.add({ c: 'price-crosses', ticker: 'AMD' }, from);
    expect(a.draft()!.rule.all[0]!.p['price']).toBe(100);
    await new Promise((r) => setTimeout(r));
    expect(a.draft()!.rule.all[0]!.p['price']).toBe(143);   // AMD at 151 in the made-up universe: 5% under, rounded
    a.setParam(0, 'price', 100);
    await new Promise((r) => setTimeout(r));
    expect(a.draft()!.rule.all[0]!.p['price']).toBe(100);
    a.addCondition({ c: 'price-crosses', p: { dir: 'above', price: 100 } });
    expect(a.draft()!.rule.all[2]!.p['price']).toBe(100);   // a condition with its own values is never re-seeded
  });

  it('the rule never grows past RULE_MAX', () => {
    const a = mount(fake().backend);
    for (let i = 0; i < RULE_MAX + 2; i++) a.add({ c: 'session-move', p: { dir: 'down', pct: 1 + i } }, from);
    expect(ids(a)).toHaveLength(RULE_MAX);
  });

  it('the universe is asked once, when the editor first opens', async () => {
    const f = fake();
    const a = mount(f.backend);
    expect(f.calls.universe).toBe(0);
    a.add({ c: 'session-move' }, from);
    a.close();
    a.add({ c: 'news-spike' }, from);
    await Promise.resolve();
    expect(f.calls.universe).toBe(1);
    await new Promise((r) => setTimeout(r));
    expect(a.universe()?.rows).toHaveLength(100);
  });

  it('setParam, remove and rename change the draft', () => {
    const a = mount(fake().backend);
    a.add({ c: 'session-move', ticker: 'NVDA' }, from);
    a.setParam(0, 'pct', 7);
    expect(a.draft()!.rule.all[0]!.p['pct']).toBe(7);
    a.remove(1);
    expect(ids(a)).toEqual(['session-move']);
    a.rename('My drop');
    expect(a.draft()!.name).toBe('My drop');
  });

  it('replace swaps a condition for another (a universe card edited into the reader\'s portfolio)', () => {
    const a = mount(fake().backend);
    a.add({ c: 'session-move', mega: true }, from);
    a.replace(1, { c: 'companies', p: { tickers: 'NVDA,MSFT' } });
    expect(a.draft()!.rule.all).toEqual([{ c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'companies', p: { tickers: 'NVDA,MSFT' } }]);
  });

  it('save is single-flight', async () => {
    let answer!: (r: SaveResult) => void;
    const f = fake(() => new Promise((r) => { answer = r; }));
    const a = mount(f.backend);
    a.add({ c: 'session-move', ticker: 'NVDA' }, from);
    const one = a.save('me@example.com', false);
    const two = a.save('me@example.com', false);
    expect(f.calls.save).toHaveLength(1);
    expect(a.saving()).toBe(true);
    answer({ ok: true });
    expect(await one).toEqual({ ok: true });
    expect(await two).toEqual({ ok: true });
    expect(a.saving()).toBe(false);
    expect(a.draft()).toBeNull();
    expect(f.calls.save[0]).toEqual({ email: 'me@example.com', name: 'Drops 5%+ · NVDA', rule: { v: 1, all: [
      { c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'one-stock', p: { ticker: 'NVDA' } }] }, from, weekly: false });
  });

  it('a failed save keeps the draft', async () => {
    const a = mount(fake(async () => ({ ok: false, reason: 'network' })).backend);
    a.add({ c: 'session-move' }, from);
    expect(await a.save('me@example.com', true)).toEqual({ ok: false, reason: 'network' });
    expect(ids(a)).toEqual(['session-move']);
    expect(a.saving()).toBe(false);
  });

  it('a backend that throws is a network failure', async () => {
    const a = mount(fake(() => Promise.reject(new Error('offline'))).backend);
    a.add({ c: 'session-move' }, from);
    expect(await a.save('me@example.com', false)).toEqual({ ok: false, reason: 'network' });
  });

  it("the backend's human check is the editor's; its token goes with the save", async () => {
    const { backend, calls } = fake();
    const check = { mount: () => ({ reset() {}, remove() {} }) };
    const a = mount({ ...backend, check });
    expect(a.check).toBe(check);
    a.add({ c: 'session-move' }, from);
    await a.save('me@example.com', false, 'tok');
    expect(calls.save[0]).toMatchObject({ email: 'me@example.com', turnstile: 'tok' });
  });

  it('a backend without a human check: none, and no token in the save', async () => {
    const { backend, calls } = fake();
    const a = mount(backend);
    expect(a.check).toBeNull();
    a.add({ c: 'session-move' }, from);
    await a.save('me@example.com', false);
    expect(calls.save[0]).not.toHaveProperty('turnstile');
  });

  it('close keeps the draft, discard clears it', () => {
    const a = mount(fake().backend);
    a.add({ c: 'session-move' }, from);
    a.close();
    expect(a.opened()).toBe(false);
    expect(ids(a)).toEqual(['session-move']);
    a.discard();
    expect(a.draft()).toBeNull();
  });
});

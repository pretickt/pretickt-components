import { Component, ErrorHandler, inject, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { needKey } from '../api';
import { Pt, PT_STORE, PtStore, type PtStoreOptions } from './index';

type Move = { asOf: string; ticker: string; window: string };
const move = (window: string): Move => ({ asOf: '2026-09-30', ticker: 'NVDA', window });
const key = (window: string) => needKey({ t: 'move-breakdown@1', params: { ticker: 'NVDA', window } });

@Component({
  selector: 'pt-host',
  providers: [Pt],
  template: `<p>{{ m.value()?.window ?? (m.value() === null ? 'na' : '…') }}|{{ m.loading() }}|{{ m.failed() }}|{{ shown() }}</p>`,
})
class Host {
  pt = inject(Pt);
  win = signal('1d');
  ticker = input('NVDA');
  m = this.pt.moveBreakdown(() => ({ ticker: this.ticker(), window: this.win() as '1d' }));
  shown = () => (this.m.params() as { window?: string } | undefined)?.window ?? '-';
}

/** A resolve that answers when told: `calls` records each request, `answer(i, v)` settles request i (v = Error rejects). */
function deferred() {
  const calls: { t: string; params: unknown; settle: (v: unknown) => void }[] = [];
  const resolve = (t: string, params: unknown) => new Promise<unknown>((ok, fail) => {
    calls.push({ t, params, settle: (v) => (v instanceof Error ? fail(v) : ok(v)) });
  });
  return { calls, resolve };
}

function mount(o: PtStoreOptions) {
  const store = new PtStore(o);
  TestBed.configureTestingModule({ providers: [{ provide: PT_STORE, useValue: store }] });
  const f = TestBed.createComponent(Host);
  const text = () => (f.nativeElement as HTMLElement).textContent!.trim();
  return { f, store, text };
}

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); TestBed.tick(); };

describe('Pt resources', () => {
  it('answers a replayed call on the first render, without asking', async () => {
    const d = deferred();
    const { f, text } = mount({ server: false, resolve: d.resolve, replay: { [key('1d')]: move('1d') } });
    f.detectChanges();
    expect(text()).toBe('1d|false|false|1d');
    await flush();
    expect(d.calls).toHaveLength(0);
  });

  it('on the server: asks, holds the render until answered, records the answer', async () => {
    const d = deferred();
    const record: Record<string, unknown> = {};
    const { f, text } = mount({ server: true, resolve: d.resolve, record });
    f.detectChanges();
    expect(text()).toBe('…|true|false|-');
    await flush();
    expect(d.calls.map((c) => c.params)).toEqual([{ ticker: 'NVDA', window: '1d' }]);
    let stable = false;
    void f.whenStable().then(() => { stable = true; });
    await flush();
    expect(stable).toBe(false); // the open call keeps the app unstable (the render waits)
    d.calls[0]!.settle(move('1d'));
    await f.whenStable();
    expect(text()).toBe('1d|false|false|1d');
    expect(record).toEqual({ [key('1d')]: move('1d') });
  });

  it('records "not available" (null) too, and shows it', async () => {
    const record: Record<string, unknown> = {};
    const { f, text } = mount({ server: true, resolve: async () => null, record });
    f.detectChanges();
    await f.whenStable();
    expect(text()).toBe('na|false|false|1d');
    expect(record).toEqual({ [key('1d')]: null });
  });

  it('in the browser a failed request keeps the value shown and flags the placement; retry asks again', async () => {
    const d = deferred();
    const { f, text } = mount({ server: false, resolve: d.resolve, replay: { [key('1d')]: move('1d') } });
    f.detectChanges();
    f.componentInstance.win.set('5d');
    await flush();
    expect(text()).toBe('1d|true|false|1d');
    d.calls[0]!.settle(new Error('429'));
    await flush();
    expect(text()).toBe('1d|false|true|1d');
    expect(f.componentInstance.pt.failed()).toBe(true);
    f.componentInstance.m.retry();
    await flush();
    expect(d.calls).toHaveLength(2);
    d.calls[1]!.settle(move('5d'));
    await flush();
    expect(text()).toBe('5d|false|false|5d');
    expect(f.componentInstance.pt.failed()).toBe(false);
  });

  it('the latest params win, whatever order the answers arrive in', async () => {
    const d = deferred();
    const { f, text } = mount({ server: false, resolve: d.resolve, replay: { [key('1d')]: move('1d') } });
    f.detectChanges();
    f.componentInstance.win.set('5d');
    await flush();
    f.componentInstance.win.set('1m');
    await flush();
    expect(d.calls.map((c) => (c.params as Move).window)).toEqual(['5d', '1m']);
    d.calls[1]!.settle(move('1m'));
    await flush();
    expect(text()).toBe('1m|false|false|1m');
    d.calls[0]!.settle(move('5d')); // the older answer lands last: cached, not shown
    await flush();
    expect(text()).toBe('1m|false|false|1m');
  });

  it('server: a call whose params the typology rejects never holds the render; the error reaches the error handler', async () => {
    const errors: unknown[] = [];
    const store = new PtStore({ server: true, resolve: async () => null, validate: () => { throw new Error('params rejected'); } });
    TestBed.configureTestingModule({ rethrowApplicationErrors: false, providers: [{ provide: PT_STORE, useValue: store }, { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } }] });
    const f = TestBed.createComponent(Host);
    let thrown: unknown;
    try { f.detectChanges(); } catch (e) { thrown = e; }
    const stable = await Promise.race([f.whenStable().then(() => true), new Promise((r) => setTimeout(() => r(false), 500))]);
    expect(stable).toBe(true);
    expect(String(thrown ?? errors[0])).toContain('params rejected');
  });

  it('server: params a typology rejects throw (a component bug)', () => {
    const store = new PtStore({ server: true, resolve: async () => null, validate: () => { throw new Error('params rejected'); } });
    expect(() => store.ask('move-breakdown@1', { ticker: 1 })).toThrow('params rejected');
  });

  it('equal params share one request across resources (the page cache)', async () => {
    const d = deferred();
    const cache = new Map<string, Promise<unknown>>();
    const a = new PtStore({ server: false, resolve: d.resolve, cache });
    const b = new PtStore({ server: false, resolve: d.resolve, cache });
    void a.ask('move-breakdown@1', { ticker: 'NVDA', window: '1d' });
    void b.ask('move-breakdown@1', { window: '1d', ticker: 'NVDA' });
    expect(d.calls).toHaveLength(1);
  });
});

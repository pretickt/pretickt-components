import { Component, inject, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PT_PICKS, PtPicks, type PickStore } from './index';

@Component({ selector: 'pt-pick-host', template: `{{ picks.ready() }}|{{ mine() ?? '-' }}` })
class Host {
  readonly picks = inject(PtPicks);
  readonly key = input<string | null>('ep:earnings:NVDA:2026-11-19');
  readonly mine = this.picks.of(() => this.key());
}

/** A store in memory: what it holds and every write it received. */
function memory(init: Record<string, string> = {}) {
  const data: Record<string, string> = { ...init };
  const writes: [string, string | null][] = [];
  const store: PickStore = {
    read: () => ({ ...data }),
    write: (k, v) => { writes.push([k, v]); if (v === null) delete data[k]; else data[k] = v; },
  };
  return { data, writes, store };
}

function mount(store?: PickStore) {
  TestBed.configureTestingModule({ providers: store ? [{ provide: PT_PICKS, useValue: store }] : [] });
  const f = TestBed.createComponent(Host);
  const text = () => (f.nativeElement as HTMLElement).textContent!.trim();
  return { f, text, picks: f.componentInstance.picks };
}

describe('PtPicks (the reader\'s calls, remembered by the page)', () => {
  it('without a store (the server, the harnesses): never ready, no pick, and setting one does nothing', () => {
    const { f, text, picks } = mount();
    f.detectChanges();
    TestBed.tick();
    expect(text()).toBe('false|-');
    picks.set('ep:earnings:NVDA:2026-11-19', 'beat');
    TestBed.tick();
    expect(text()).toBe('false|-');
  });

  it('with a store: nothing before the first render (the view hydrates without a pick), the stored pick after it', () => {
    const m = memory({ 'ep:earnings:NVDA:2026-11-19': 'beat' });
    TestBed.configureTestingModule({ providers: [{ provide: PT_PICKS, useValue: m.store }] });
    const picks = TestBed.inject(PtPicks);
    const early = TestBed.runInInjectionContext(() => picks.of(() => 'ep:earnings:NVDA:2026-11-19'));
    expect([picks.ready(), early()]).toEqual([false, null]);
    const f = TestBed.createComponent(Host);
    f.detectChanges(); // creates the view, then runs the after-render hooks
    expect((f.nativeElement as HTMLElement).textContent!.trim()).toBe('true|beat');
    expect(early()).toBe('beat');
  });

  it('set writes through the store and shows at once; null clears', () => {
    const m = memory();
    const { f, text, picks } = mount(m.store);
    f.detectChanges();
    TestBed.tick();
    picks.set('ep:earnings:NVDA:2026-11-19', 'miss');
    TestBed.tick();
    expect(text()).toBe('true|miss');
    expect(m.data).toEqual({ 'ep:earnings:NVDA:2026-11-19': 'miss' });
    picks.set('ep:earnings:NVDA:2026-11-19', null);
    TestBed.tick();
    expect(text()).toBe('true|-');
    expect(m.writes).toEqual([['ep:earnings:NVDA:2026-11-19', 'miss'], ['ep:earnings:NVDA:2026-11-19', null]]);
  });

  it('a store that throws on read leaves no picks and no error', () => {
    const { f, text } = mount({ read: () => { throw new Error('denied'); }, write: () => undefined });
    f.detectChanges();
    TestBed.tick();
    expect(text()).toBe('true|-');
  });

  it('a null key has no pick', () => {
    const m = memory({ x: 'beat' });
    const { f, text } = mount(m.store);
    f.componentRef.setInput('key', null);
    f.detectChanges();
    TestBed.tick();
    expect(text()).toBe('true|-');
  });
});

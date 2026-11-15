import { Component, EnvironmentInjector, inject, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { FollowAlert } from '../typologies';
import { PtFollow } from './follow';
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState, type FollowStore } from './index';

const alert = (session: string): FollowAlert => ({ kind: 'rsi', session, tone: 'flat', label: 'RSI', value: '72', line: 'RSI at 72', pic: null });
const ALERTS = [alert('2026-11-13'), alert('2026-11-12'), alert('2026-11-10')];

@Component({ selector: 'pt-follow-host', template: `{{ follow.ready() }}|{{ on() }}|{{ n() }}` })
class Host {
  readonly follow = inject(PtFollow);
  readonly on = this.follow.following(() => 'NVDA');
  readonly n = this.follow.unseen(() => 'NVDA', () => ALERTS);
}

function memory(init: FollowState) {
  let data = init;
  const writes: FollowState[] = [];
  const store: FollowStore = { read: () => data, write: (s) => { writes.push(s); data = s; } };
  return { store, writes };
}

function mount(providers: unknown[]) {
  TestBed.configureTestingModule({ providers: providers as never[] });
  const f = TestBed.createComponent(Host);
  const text = () => (f.nativeElement as HTMLElement).textContent!.trim();
  return { f, text, follow: f.componentInstance.follow };
}

describe('PtFollow (the companies this browser follows, and the alerts it has seen)', () => {
  it("before the first render nothing is followed and the count is every recent alert; after it, the store's follows and seen apply", () => {
    const { store } = memory({ follows: ['NVDA'], seen: { NVDA: '2026-11-12' } });
    const { f, text, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    expect(follow.on).toBe(true);
    expect(follow.ready()).toBe(false);
    expect(follow.following(() => 'NVDA')()).toBe(false);
    expect(follow.unseen(() => 'NVDA', () => ALERTS)()).toBe(3);
    f.detectChanges();
    TestBed.tick();
    expect(text()).toBe('true|true|1');
  });
  it('toggle and markSeen write through the store; press hands the panel the company', () => {
    const { store, writes } = memory({ follows: [], seen: {} });
    const { f, text, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    follow.toggle('NVDA');
    follow.markSeen('NVDA', '2026-11-13');
    TestBed.tick();
    expect(text()).toBe('true|true|0');
    expect(writes.at(-1)).toEqual({ follows: ['NVDA'], seen: { NVDA: '2026-11-13' } });
    expect(follow.follows()).toEqual(['NVDA']);
    follow.press({ ticker: 'NVDA', name: 'Nvidia', alerts: ALERTS, rect: { left: 1, right: 2, top: 3, bottom: 4 } });
    expect([follow.pressed()?.ticker, follow.pressed()?.at]).toEqual(['NVDA', 1]);
    const heard: string[] = [];
    follow.listen((p) => heard.push(`${p.ticker}#${p.at}`));
    follow.press({ ticker: 'AAPL', name: 'Apple', alerts: [], rect: { left: 1, right: 2, top: 3, bottom: 4 } });
    expect(heard).toEqual(['AAPL#2']);
  });
  it('without PT_FOLLOW (server, checks) toggle and markSeen do nothing and on is false', () => {
    const { f, text, follow } = mount([]);
    expect(follow.on).toBe(false);
    f.detectChanges();
    TestBed.tick();
    follow.toggle('NVDA');
    TestBed.tick();
    expect(text()).toBe('false|false|3');
  });
  it('a tab left open never erases what another tab followed: each change starts from the store', () => {
    const { store } = memory({ follows: [], seen: {} });
    const { f, follow: a } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    const b = Injector.create({ providers: [{ provide: PtFollow, useClass: PtFollow, deps: [] }], parent: TestBed.inject(EnvironmentInjector) }).get(PtFollow);
    f.detectChanges();
    TestBed.tick();
    a.toggle('AAPL');            // tab A
    b.toggle('NVDA');            // tab B, opened before A followed AAPL
    b.markSeen('AAPL', '2026-11-13');
    expect(store.read()).toEqual({ follows: ['AAPL', 'NVDA'], seen: { AAPL: '2026-11-13' } });
    expect(b.follows()).toEqual(['AAPL', 'NVDA']);
  });
  it('a toggle that changes the list is heard once, with on; the link and a replaced list go through the store', () => {
    const { store, writes } = memory({ follows: [], seen: {} });
    const { f, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    const heard: string[] = [];
    follow.listenChanges((c) => heard.push(`${c.ticker}:${c.on}`));
    follow.toggle('NVDA');
    follow.toggle('NVDA');
    expect(heard).toEqual(['NVDA:true', 'NVDA:false']);
    const link = { token: 'a.b', email: 'r•••@gmail.com', cadence: 'day' as const };
    follow.setLink(link);
    expect(follow.link()).toEqual(link);
    follow.replaceFollows(['KO', 'AAPL']);
    expect(follow.follows()).toEqual(['KO', 'AAPL']);
    expect(writes.at(-1)).toMatchObject({ follows: ['KO', 'AAPL'], link });
    follow.setLink(null);
    expect(follow.link()).toBeNull();
    expect(heard).toEqual(['NVDA:true', 'NVDA:false']); // replacing is not a reader's toggle
  });
  it("a toggle is heard as the store's list changed, not this page's copy: another tab's unfollow, and at 200 the oldest that goes (first)", () => {
    const { store } = memory({ follows: ['NVDA'], seen: {} });
    const { f, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    const heard: string[] = [];
    follow.listenChanges((c) => heard.push(`${c.ticker}:${c.on}`));
    store.write({ follows: [], seen: {} });   // another tab stopped following NVDA
    follow.toggle('NVDA');                      // this page still showed it followed: the store's list gains it
    expect(heard).toEqual(['NVDA:true']);
    expect(follow.follows()).toEqual(['NVDA']);
    store.write({ follows: Array.from({ length: 200 }, (_, i) => `T${i}`), seen: {} });
    heard.length = 0;
    follow.toggle('NEW');
    expect(heard).toEqual(['T0:false', 'NEW:true']);   // the server makes room before it adds
  });
  it('a change made before the store arrives waits for it, and is heard', async () => {
    let data: FollowState = { follows: ['NVDA'], seen: {} };
    let arrive!: () => void;
    const came = new Promise<void>((r) => { arrive = r; });
    const store: FollowStore = { read: () => came.then(() => data), write: (s) => { data = s; } };
    const { f, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    const heard: string[] = [];
    follow.listenChanges((c) => heard.push(`${c.ticker}:${c.on}`));
    follow.toggle('AAPL');
    expect(heard).toEqual([]);
    arrive();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(follow.follows()).toEqual(['NVDA', 'AAPL']);
    expect(data.follows).toEqual(['NVDA', 'AAPL']);
    expect(heard).toEqual(['AAPL:true']);
  });
  it("many at once (a portfolio's companies): the missing ones join in order, heard once with what came and went; again, nothing; off, they go", () => {
    const { store } = memory({ follows: ['NVDA'], seen: {} });
    const { f, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    const heard: string[] = [], lists: { added: readonly string[]; removed: readonly string[] }[] = [];
    follow.listenChanges((c) => heard.push(`${c.ticker}:${c.on}`));
    follow.listenLists((d) => lists.push(d));
    const all = follow.followingAll(() => ['AAPL', 'NVDA']);
    expect(all()).toBe(false);
    follow.setMany(['AAPL', 'NVDA', 'MSFT'], true);
    expect(follow.follows()).toEqual(['NVDA', 'AAPL', 'MSFT']);
    expect(all()).toBe(true);
    follow.setMany(['AAPL', 'MSFT'], true);
    follow.setMany(['AAPL', 'NVDA'], false);
    expect(follow.follows()).toEqual(['MSFT']);
    expect(lists).toEqual([{ added: ['AAPL', 'MSFT'], removed: [] }, { added: [], removed: ['NVDA', 'AAPL'] }]);
    expect(heard).toEqual([]);   // one change, not a request a company
    expect(follow.followingAll(() => [])()).toBe(false);
  });
  it('many at once at the limit (200): the companies outside the group make room, never one of the group already followed (the review, 2026-11-15)', () => {
    const { store } = memory({ follows: ['AAPL', ...Array.from({ length: 199 }, (_, i) => `T${i}`)], seen: {} });
    const { f, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    const lists: { added: readonly string[]; removed: readonly string[] }[] = [];
    follow.listenLists((d) => lists.push(d));
    follow.setMany(['AAPL', 'NEW'], true);
    expect(follow.follows()).toHaveLength(200);
    expect(follow.followingAll(() => ['AAPL', 'NEW'])()).toBe(true);
    expect([follow.follows()[0], follow.follows().at(-1)]).toEqual(['AAPL', 'NEW']);   // the followed stay where they were
    expect(lists).toEqual([{ added: ['NEW'], removed: ['T0'] }]);
  });
  it('many at once before the store arrives waits for it', async () => {
    let data: FollowState = { follows: ['NVDA'], seen: {} };
    let arrive!: () => void;
    const came = new Promise<void>((r) => { arrive = r; });
    const store: FollowStore = { read: () => came.then(() => data), write: (s) => { data = s; } };
    const { f, follow } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    follow.setMany(['AAPL'], true);
    arrive();
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(data.follows).toEqual(['NVDA', 'AAPL']);
  });
  it('a store whose first read is a promise (the site loads it on first use) applies when it arrives', async () => {
    let data: FollowState = { follows: ['NVDA'], seen: { NVDA: '2026-11-12' } };
    const store: FollowStore = { read: () => Promise.resolve(data), write: (s) => { data = s; } };
    const { f, text } = mount([{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }]);
    f.detectChanges();
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
    f.detectChanges();
    expect(text()).toBe('true|true|1');
  });
});

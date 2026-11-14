import { Component, inject } from '@angular/core';
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
});

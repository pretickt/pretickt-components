import { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState, type FollowStore } from '@pretickt/components/context';
import { PtFollow } from '@pretickt/components/follow';
import type { FollowAlert } from '@pretickt/components/typologies';
import { PT_FOLLOW_FILE } from './following';
import { startFollow } from './follow-start';
import type { FollowBackend } from './follow-backend';

const alert: FollowAlert = { kind: 'rsi', session: '2026-11-13', tone: 'flat', label: 'RSI', value: '72', line: 'RSI (14 days) at 72', pic: null };
const rect = { left: 10, right: 42, top: 10, bottom: 42 };
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); TestBed.tick(); };

function setup(html = '', o: { init?: FollowState; backend?: FollowBackend } = {}) {
  let data: FollowState = o.init ?? { follows: [], seen: {} };
  const store: FollowStore = { read: () => data, write: (s) => { data = s; } };
  TestBed.configureTestingModule({ providers: [{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true },
    { provide: PT_FOLLOW_FILE, useValue: async () => ({ v: 1, asOf: '2026-11-13', companies: {} }) }] });
  document.body.innerHTML = `<button type="button" id="bell">bell</button>${html}`;
  const follow = TestBed.inject(PtFollow);
  startFollow(document, TestBed.inject(ApplicationRef), TestBed.inject(EnvironmentInjector), { buildId: 'b', api: '', sections: [] }, o.backend);
  TestBed.tick();
  const bell = document.getElementById('bell')!;
  const press = (ticker = 'NVDA', name = 'Nvidia') => { bell.focus(); follow.press({ ticker, name, alerts: [alert], rect }); };
  const panel = () => document.querySelector<HTMLElement>('.pt-follow-panel[role="dialog"]');
  return { follow, bell, press, panel };
}

describe("the bell's panel on the page (follow-start)", () => {
  afterEach(() => { document.body.innerHTML = ''; });
  it('a press opens the panel under the bell, with the focus on its switch; the same bell again closes it', async () => {
    const { press, panel } = setup();
    press();
    await flush();
    expect(panel()!.getAttribute('aria-label')).toBe('Alerts for Nvidia');
    expect(panel()!.textContent).toContain('RSI (14 days) at 72');
    expect(panel()!.style.top).toBe('50px'); // under the bell (bottom 42 + 8)
    expect(document.activeElement?.classList.contains('pt-follow-switch')).toBe(true);
    press();
    await flush();
    expect(panel()).toBeNull();
  });
  it('Escape closes it and the focus goes back to the bell; a click outside closes it; another bell replaces it', async () => {
    const { press, panel, bell } = setup();
    press();
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(bell);
    press();
    await flush();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel()).toBeNull();
    press();
    await flush();
    press('AAPL', 'Apple');
    await flush();
    expect(document.querySelectorAll('.pt-follow-panel')).toHaveLength(1);
    expect(panel()!.getAttribute('aria-label')).toBe('Alerts for Apple');
  });
  it('a click inside the panel keeps it open', async () => {
    const { press, panel } = setup();
    press();
    await flush();
    panel()!.querySelector<HTMLElement>('.pt-follow-title')!.click();
    expect(panel()).not.toBeNull();
  });
  it("/alerts/: the following list goes in the page's place for it", async () => {
    setup('<div data-pt-following><p class="pt-na">needs JavaScript</p></div>');
    await flush();
    const host = document.querySelector('[data-pt-following]')!;
    expect(host.querySelector('pt-following')).not.toBeNull();
    expect(host.querySelector('.pt-na')).toBeNull();
  });
  it("a browser linked to an email tells the server each follow it changes; one whose link no longer works forgets it", async () => {
    const ops: unknown[] = [];
    let alive = true;
    const backend: FollowBackend = { signup: async () => 'ok', manage: async (t, op) => { ops.push([t, op]); return alive ? ({} as never) : null; } };
    const { follow } = setup('', { init: { follows: [], seen: {}, link: { token: 'a.b', email: 'r•••@example.com', cadence: 'day' } }, backend });
    await flush();
    follow.toggle('NVDA');
    await flush();
    expect(ops).toEqual([['a.b', { op: 'follow', ticker: 'NVDA', on: true }]]);
    alive = false;
    follow.toggle('NVDA');
    await flush();
    expect(follow.link()).toBeNull();
  });
  it('a change that does not reach the server marks the link: /alerts/ sends the whole list next time', async () => {
    const backend: FollowBackend = { signup: async () => 'ok', manage: async () => { throw new Error('offline'); } };
    const { follow } = setup('', { init: { follows: [], seen: {}, link: { token: 'a.b', email: 'r•••@example.com', cadence: 'day' } }, backend });
    await flush();
    follow.toggle('NVDA');
    await flush();
    expect(follow.link()?.dirty).toBe(true);
  });
});

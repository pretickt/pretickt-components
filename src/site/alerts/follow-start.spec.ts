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
  it("a linked browser asks the server about its link when a panel first opens: an unsubscribe made elsewhere forgets it; once a page", async () => {
    const ops: unknown[] = [];
    const backend: FollowBackend = { signup: async () => 'ok', manage: async (t, op) => { ops.push([t, op]); return { email: 'r•••@example.com', status: 'unsubscribed', weekly: false, digest: false, rules: [], manage: 'c.d' }; } };
    const { follow, press, panel } = setup('', { init: { follows: ['NVDA'], seen: {}, link: { token: 'a.b', email: 'r•••@example.com', cadence: 'day' } }, backend });
    await flush();
    expect(ops).toEqual([]);
    press();
    await flush();
    expect(ops).toEqual([['a.b', { op: 'list' }]]);
    expect(follow.link()).toBeNull();
    expect(panel()!.textContent).not.toContain('Emails to');
    press();
    press();
    await flush();
    expect(ops).toHaveLength(1);
  });
  it("a live link takes the server's address and rhythm", async () => {
    const backend: FollowBackend = { signup: async () => 'ok', manage: async () => ({ email: 'n•••@example.com', status: 'active', weekly: false, digest: false, rules: [], cadence: 'week', manage: 'c.d' }) };
    const { follow, press } = setup('', { init: { follows: ['NVDA'], seen: {}, link: { token: 'a.b', email: 'r•••@example.com', cadence: 'day' } }, backend });
    press();
    await flush();
    expect(follow.link()).toEqual({ token: 'c.d', email: 'n•••@example.com', cadence: 'week' });
  });
  it('«Check your inbox» stays when the panel opens again', async () => {
    const { press, panel } = setup('', { backend: { signup: async () => 'ok', manage: async () => null } });
    press();
    await flush();
    const input = panel()!.querySelector<HTMLInputElement>('#pt-follow-email')!;
    input.value = 'me@example.com';
    input.dispatchEvent(new Event('input'));
    panel()!.querySelector<HTMLButtonElement>('.pt-follow-mail-row button')!.click();
    await flush();
    expect(panel()!.textContent).toContain('Check your inbox');
    press();
    await flush();
    press();
    await flush();
    expect(panel()!.textContent).toContain('Check your inbox');
  });
  it("a group's press (a portfolio's companies) opens the same panel for the group", async () => {
    const { follow, panel } = setup();
    follow.press({ ticker: 'group:example', name: 'Mega caps', alerts: [], rect, tickers: ['AAPL', 'MSFT'] });
    await flush();
    expect(panel()!.getAttribute('aria-label')).toBe('Alerts for Mega caps');
    expect(panel()!.querySelector('.pt-follow-title')!.textContent).toBe('Alerts for Mega caps · 2 companies');
  });
  it("many followed at once on a linked browser: the change goes onto the server's list (another device's changes stay), which this browser then takes", async () => {
    const ops: unknown[] = [];
    let server = ['NVDA', 'AMD'];   // another device unfollowed TSLA and followed AMD
    const state = () => ({ email: 'r•••@example.com', status: 'active' as const, weekly: false, digest: false, rules: [], follows: [...server], cadence: 'day' as const, manage: 'a.b' });
    const backend: FollowBackend = { signup: async () => 'ok', manage: async (t, op) => { ops.push([t, op]); if (op.op === 'follows') server = op.tickers; return state(); } };
    const { follow } = setup('', { init: { follows: ['NVDA', 'TSLA'], seen: {}, link: { token: 'a.b', email: 'r•••@example.com', cadence: 'day' } }, backend });
    await flush();
    follow.setMany(['AAPL', 'MSFT'], true);
    await flush();
    expect(ops).toEqual([['a.b', { op: 'list' }], ['a.b', { op: 'follows', tickers: ['NVDA', 'AMD', 'AAPL', 'MSFT'] }]]);
    expect(follow.follows()).toEqual(['NVDA', 'AMD', 'AAPL', 'MSFT']);
    ops.length = 0;
    follow.setMany(['AAPL', 'MSFT'], false);
    await flush();
    expect(server).toEqual(['NVDA', 'AMD']);
    expect(follow.follows()).toEqual(['NVDA', 'AMD']);
  });
  it('many at once that does not reach the server marks the link; a marked link sends this browser\'s whole list, then is clean', async () => {
    const ops: unknown[] = [];
    let up = false;
    const backend: FollowBackend = { signup: async () => 'ok', manage: async (t, op) => { ops.push([t, op]); if (!up) throw new Error('offline'); return { email: 'r•••@example.com', status: 'active', weekly: false, digest: false, rules: [], follows: [], cadence: 'day', manage: 'a.b' }; } };
    const { follow } = setup('', { init: { follows: ['NVDA'], seen: {}, link: { token: 'a.b', email: 'r•••@example.com', cadence: 'day' } }, backend });
    await flush();
    follow.setMany(['KO'], true);
    await flush();
    expect(follow.link()?.dirty).toBe(true);
    up = true;
    ops.length = 0;
    follow.setMany(['PEP'], true);
    await flush();
    expect(ops).toEqual([['a.b', { op: 'follows', tickers: ['NVDA', 'KO', 'PEP'] }]]);
    expect(follow.link()?.dirty).toBeUndefined();
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

import { TestBed } from '@angular/core/testing';
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState, type FollowStore } from '@pretickt/components/context';
import { PtFollow } from '@pretickt/components/follow';
import type { FollowAlert } from '@pretickt/components/typologies';
import { PT_FOLLOW_EMAIL, PT_FOLLOW_FLOAT, type FollowBackend } from './follow-backend';
import { PtFollowPanel } from './follow-panel';

const alert = (kind: string, session: string, o: Partial<FollowAlert> = {}): FollowAlert =>
  ({ kind, session, tone: 'flat', label: 'Support', value: '2.1% below', line: 'Closed 2.1% above its $182.40 support', pic: { c: [190, 186, 184], lv: [182.4] }, ...o });

function mount(alerts: FollowAlert[], init: FollowState = { follows: [], seen: {} }, email?: FollowBackend) {
  let data = init;
  const writes: FollowState[] = [];
  const store: FollowStore = { read: () => data, write: (s) => { writes.push(s); data = s; } };
  TestBed.configureTestingModule({ providers: [{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true },
    ...(email ? [{ provide: PT_FOLLOW_EMAIL, useValue: { backend: email, check: null } }] : [])] });
  const f = TestBed.createComponent(PtFollowPanel);
  f.componentRef.setInput('ticker', 'NVDA');
  f.componentRef.setInput('name', 'Nvidia');
  f.componentRef.setInput('alerts', alerts);
  f.detectChanges();
  TestBed.tick();
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, writes, follow: TestBed.inject(PtFollow) };
}

describe('the bell\'s panel (follow, 2026-11-14)', () => {
  it('lists each alert with its badge, line and day; its switch follows the company; opening it marks the alerts seen', () => {
    const { f, el, writes, follow } = mount([alert('near-support', '2026-11-13'), alert('results', '2026-11-12', { tone: 'pos', label: 'Beat', value: 'EPS $1.05', line: 'EPS 4% above the estimate' })]);
    expect(el.querySelector('.pt-follow-title')!.textContent).toBe('Alerts for Nvidia · last 5 sessions');
    const rows = [...el.querySelectorAll('.pt-follow-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector('.pt-follow-chip')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Support 2.1% below');
    expect(rows[0]!.textContent).toContain('Closed 2.1% above its $182.40 support');
    expect(rows[0]!.textContent).toContain('Nov 13');
    expect(rows[1]!.querySelector('.pt-follow-chip')!.className).toContain('pt-follow-pos');
    expect(rows[0]!.querySelector('svg.pt-follow-pic')).not.toBeNull();
    expect(writes.at(-1)!.seen).toEqual({ NVDA: '2026-11-13' });
    const sw = el.querySelector<HTMLButtonElement>('.pt-follow-switch')!;
    expect([sw.textContent!.trim(), sw.getAttribute('aria-pressed')]).toEqual(['Follow', 'false']);
    sw.click();
    TestBed.tick();
    f.detectChanges();
    expect(follow.following(() => 'NVDA')()).toBe(true);
    expect([sw.textContent!.trim(), sw.getAttribute('aria-pressed')]).toEqual(['Following', 'true']);
    expect(el.querySelector('a[href="/alerts/"]')!.textContent).toContain('All your alerts');
    expect(el.textContent).toContain('Followed companies stay in this browser.');
  });
  it('an alert of a kind this build does not know is a row like the others', () => {
    const { el } = mount([alert('brand-new', '2026-11-13', { label: 'Something', value: null, line: 'Something with 1 number', pic: null })]);
    expect(el.querySelectorAll('.pt-follow-row')).toHaveLength(1);
    expect(el.querySelector('.pt-follow-row')!.textContent).toContain('Something with 1 number');
  });
  it('no alerts: the empty sentence and the switch', () => {
    const { el, writes } = mount([]);
    expect(el.querySelector('.pt-follow-empty')!.textContent).toBe('No alerts in the last 5 sessions.');
    expect(el.querySelector('.pt-follow-switch')).not.toBeNull();
    expect(writes).toEqual([]);
  });
  it('without the email alerts there is no email row; with them, the address goes with the follows (this company included) and the reader is told to confirm', async () => {
    expect(mount([]).el.querySelector('.pt-follow-mail')).toBeNull();
    TestBed.resetTestingModule();
    const sent: [string, string[]][] = [];
    const backend: FollowBackend = { signup: async (e, f) => { sent.push([e, f]); return 'ok'; }, manage: async () => null };
    const { f, el } = mount([], { follows: ['AAPL'], seen: {} }, backend);
    const input = el.querySelector<HTMLInputElement>('.pt-follow-mail input[type="email"]')!;
    const send = el.querySelector<HTMLButtonElement>('.pt-follow-mail button')!;
    input.value = 'not an email'; input.dispatchEvent(new Event('input'));
    send.click();
    await Promise.resolve();
    expect(sent).toEqual([]);
    input.value = 'r@example.com'; input.dispatchEvent(new Event('input'));
    send.click();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    f.detectChanges();
    expect(sent).toEqual([['r@example.com', ['AAPL', 'NVDA']]]);
    expect(el.querySelector('.pt-follow-mail')!.textContent).toContain('Check your inbox, and open the link on this browser to send its follows too.');
  });
  it('a browser linked to an email says so, with how often', () => {
    const backend: FollowBackend = { signup: async () => 'ok', manage: async () => null };
    const { el } = mount([], { follows: ['NVDA'], seen: {}, link: { token: 'a.b', email: 'r•••@example.com', cadence: 'week' } }, backend);
    expect(el.querySelector('.pt-follow-mail')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Emails to r•••@example.com · weekly · Manage');
    expect(el.querySelector('.pt-follow-foot')!.textContent).toContain('Your follows also go to r•••@example.com. All your alerts');
  });
  it('the foot: a space between its sentence and the link (seen on www, 2026-11-15)', () => {
    expect(mount([]).el.querySelector('.pt-follow-foot')!.textContent).toBe('Followed companies stay in this browser. All your alerts');
  });
  it('the floating window: a button only where the browser can open one', () => {
    expect(mount([]).el.querySelector('.pt-follow-float')).toBeNull();
    TestBed.resetTestingModule();
    let opened = 0;
    TestBed.configureTestingModule({ providers: [{ provide: PT_FOLLOW_FLOAT, useValue: { open: async () => { opened++; } } }] });
    const { el } = mount([], { follows: ['NVDA'], seen: {} });
    el.querySelector<HTMLButtonElement>('.pt-follow-float')!.click();
    expect(opened).toBe(1);
  });
});

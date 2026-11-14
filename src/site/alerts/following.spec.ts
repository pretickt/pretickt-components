import { TestBed } from '@angular/core/testing';
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState, type FollowStore } from '@pretickt/components/context';
import { PtFollow } from '@pretickt/components/follow';
import type { FollowAlert, FollowFile } from '@pretickt/components/typologies';
import { FOLLOW_FILE_URL, fetchFollowFile, PT_FOLLOW_FILE, PT_FOLLOW_SEARCH, PtFollowing } from './following';
import { PT_FOLLOW_EMAIL, type FollowBackend } from './follow-backend';

const alert = (kind: string, session: string): FollowAlert => ({ kind, session, tone: 'flat', label: 'RSI', value: '72', line: `${kind} at 72`, pic: null });
const FILE: FollowFile = { v: 1, asOf: '2026-11-13', companies: {
  NVDA: { name: 'NVIDIA Corporation', alerts: [alert('rsi', '2026-11-13')] }, AAPL: { name: 'Apple Inc.', alerts: [] }, KO: { name: 'The Coca-Cola Company', alerts: [alert('dates', '2026-11-12')] } } };

async function mount(init: FollowState, file: () => Promise<FollowFile | null>, o: { backend?: FollowBackend; search?: string } = {}) {
  let data = init;
  const store: FollowStore = { read: () => data, write: (s) => { data = s; } };
  TestBed.configureTestingModule({ providers: [{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }, { provide: PT_FOLLOW_FILE, useValue: file },
    { provide: PT_FOLLOW_SEARCH, useValue: o.search ?? '' }, ...(o.backend ? [{ provide: PT_FOLLOW_EMAIL, useValue: { backend: o.backend, check: null } }] : [])] });
  const f = TestBed.createComponent(PtFollowing);
  f.detectChanges();
  TestBed.tick();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, follow: TestBed.inject(PtFollow) };
}

describe('/alerts/: what this browser follows (follow, 2026-11-14)', () => {
  it('it lists the followed companies with their alerts from the night file, in follow order, and × stops following', async () => {
    const { f, el, follow } = await mount({ follows: ['KO', 'NVDA', 'AAPL'], seen: {} }, async () => FILE);
    const cos = [...el.querySelectorAll('.pt-following-co')];
    expect(cos.map((c) => c.querySelector('a')!.textContent!.trim())).toEqual(['Coca-Cola', 'Nvidia', 'Apple']);
    expect(cos[0]!.querySelector('a')!.getAttribute('href')).toBe('/stocks/ko/');
    expect(cos[1]!.textContent).toContain('rsi at 72');
    expect(cos[2]!.textContent).toContain('No alerts in the last 5 sessions.');
    const x = cos[1]!.querySelector<HTMLButtonElement>('button.pt-following-x')!;
    expect(x.getAttribute('aria-label')).toBe('Stop following Nvidia');
    x.click();
    TestBed.tick();
    f.detectChanges();
    expect(follow.follows()).toEqual(['KO', 'AAPL']);
    expect(el.querySelectorAll('.pt-following-co')).toHaveLength(2);
  });
  it('nothing followed: the sentence', async () => {
    const { el } = await mount({ follows: [], seen: {} }, async () => FILE);
    expect(el.querySelector('.pt-following-none')!.textContent).toBe('Tap the bell on a company to follow it here.');
  });
  it('the file fails: the sentence, no throw', async () => {
    const { el } = await mount({ follows: ['NVDA'], seen: {} }, async () => { throw new Error('offline'); });
    expect(el.querySelector('.pt-following-none')!.textContent).toBe('Your alerts could not be loaded. Try again later.');
  });
  it('it asks for the whole file only', async () => {
    const urls: string[] = [];
    const got = await fetchFollowFile(async (u) => { urls.push(u); return new Response(JSON.stringify(FILE)); });
    expect(urls).toEqual([FOLLOW_FILE_URL]);
    expect(FOLLOW_FILE_URL).toBe('/data/alerts-v1.json');
    expect(got?.companies.NVDA?.name).toBe('NVIDIA Corporation');
    expect(await fetchFollowFile(async () => new Response('', { status: 404 }))).toBeNull();
  });
  const server = (ops: unknown[], st: Partial<import('../../alerts/token').ManageState> = {}): FollowBackend => ({ signup: async () => 'ok',
    manage: async (t, op) => { ops.push([t, op]); return { email: 'r•••@example.com', status: 'active', weekly: false, digest: false, rules: [],
      follows: ['NVDA'], cadence: 'day', manage: 'm.n', ...st } as never; } });
  it("arriving from an email's link: the server's follows join this browser's, the link is kept, the union goes back once", async () => {
    const ops: unknown[] = [];
    const { follow } = await mount({ follows: ['KO'], seen: {} }, async () => FILE, { backend: server(ops), search: '?t=a.b' });
    expect(follow.follows()).toEqual(['NVDA', 'KO']);
    expect(follow.link()).toEqual({ token: 'm.n', email: 'r•••@example.com', cadence: 'day' });
    expect(ops).toEqual([['a.b', { op: 'list' }], ['m.n', { op: 'follows', tickers: ['NVDA', 'KO'] }]]);
  });
  it('a confirmation link confirms first', async () => {
    const ops: unknown[] = [];
    await mount({ follows: ['NVDA'], seen: {} }, async () => FILE, { backend: server(ops), search: '?do=confirm&t=a.b' });
    expect(ops).toEqual([['a.b', { op: 'confirm' }]]);
  });
  it('with a link: how often, switched; the emails stopped forget the link (the follows stay in the browser)', async () => {
    const ops: unknown[] = [];
    const link = { token: 'a.b', email: 'r•••@example.com', cadence: 'day' as const };
    const { f, el, follow } = await mount({ follows: ['NVDA'], seen: {}, link }, async () => FILE, { backend: server(ops, { cadence: 'week' }) });
    expect(el.querySelector('.pt-following-mail')!.textContent).toContain('Emails to r•••@example.com');
    const button = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('.pt-following-mail button')].find((b) => b.textContent!.trim() === label)!;
    button('Weekly').click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    f.detectChanges();
    expect(ops.at(-1)).toEqual(['m.n', { op: 'cadence', value: 'week' }]);
    expect(follow.link()?.cadence).toBe('week');
    button('Stop the emails').click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    f.detectChanges();
    expect(ops.at(-1)).toEqual(['m.n', { op: 'unsubscribe' }]);
    expect(follow.link()).toBeNull();
    expect(follow.follows()).toEqual(['NVDA']);
  });
});

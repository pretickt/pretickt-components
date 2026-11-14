import { TestBed } from '@angular/core/testing';
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState, type FollowStore } from '@pretickt/components/context';
import { PtFollow } from '@pretickt/components/follow';
import type { FollowAlert, FollowFile } from '@pretickt/components/typologies';
import { FOLLOW_FILE_URL, fetchFollowFile, PT_FOLLOW_FILE, PtFollowing } from './following';

const alert = (kind: string, session: string): FollowAlert => ({ kind, session, tone: 'flat', label: 'RSI', value: '72', line: `${kind} at 72`, pic: null });
const FILE: FollowFile = { v: 1, asOf: '2026-11-13', companies: {
  NVDA: { name: 'NVIDIA Corporation', alerts: [alert('rsi', '2026-11-13')] }, AAPL: { name: 'Apple Inc.', alerts: [] }, KO: { name: 'The Coca-Cola Company', alerts: [alert('dates', '2026-11-12')] } } };

async function mount(init: FollowState, file: () => Promise<FollowFile | null>) {
  let data = init;
  const store: FollowStore = { read: () => data, write: (s) => { data = s; } };
  TestBed.configureTestingModule({ providers: [{ provide: PT_FOLLOW, useValue: store }, { provide: PT_FOLLOW_ON, useValue: true }, { provide: PT_FOLLOW_FILE, useValue: file }] });
  const f = TestBed.createComponent(PtFollowing);
  f.detectChanges();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
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
});

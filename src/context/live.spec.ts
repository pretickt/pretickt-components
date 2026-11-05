import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BARS_EVERY_MS, mayRefresh, PT_LIVE, PtLive, type LiveBars, type LiveSource } from './live';

const line = (o: Partial<LiveBars> = {}): LiveBars => ({ session: '2026-11-03', prev: '2026-11-02', asOf: '2026-11-03T15:30:00.000Z', time: '10:30 AM ET', closed: false, bars: { NVDA: [100, 101] }, ...o });
// 2026-11-03 is a Tuesday; New York is UTC−5 that day
const at = (iso: string) => new Date(iso);

describe('when the session\'s lines are read again', () => {
  it('in session, with the tab in front', () => expect(mayRefresh(at('2026-11-03T15:00:00Z'), line(), true)).toBe(true));
  it('not with the tab hidden', () => expect(mayRefresh(at('2026-11-03T15:00:00Z'), line(), false)).toBe(false));
  it('not before the open', () => expect(mayRefresh(at('2026-11-03T14:00:00Z'), line(), true)).toBe(false));
  it('from the open, and until the job\'s last run', () => {
    expect(mayRefresh(at('2026-11-03T14:30:00Z'), line(), true)).toBe(true);
    expect(mayRefresh(at('2026-11-03T21:19:00Z'), line(), true)).toBe(true);
    expect(mayRefresh(at('2026-11-03T21:20:00Z'), line(), true)).toBe(false);
  });
  it('not on a Saturday', () => expect(mayRefresh(at('2026-11-07T15:00:00Z'), line(), true)).toBe(false));
  it('not once today\'s session has closed', () => expect(mayRefresh(at('2026-11-03T21:10:00Z'), line({ closed: true }), true)).toBe(false));
  it('yes the morning after a closed session: a tab left open overnight', () => expect(mayRefresh(at('2026-11-04T15:00:00Z'), line({ closed: true }), true)).toBe(true));
  it('with no line yet', () => expect(mayRefresh(at('2026-11-03T15:00:00Z'), null, true)).toBe(true));
});

@Component({ template: '{{ bars()?.time }}' })
class BarsHost { readonly bars = inject(PtLive).bars(); }
@Component({ template: '{{ day()?.session }}' })
class DayHost { readonly day = inject(PtLive).after(() => '2026-01-01'); }

describe('PtLive', () => {
  afterEach(() => vi.useRealTimers());
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  function mount<T>(host: new () => T, source: LiveSource) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PT_LIVE, useValue: source }] });
    const f = TestBed.createComponent(host);
    f.detectChanges();
    return f;
  }
  const source = (answers: (LiveBars | null)[], poll: LiveSource['poll'] | null = { everyMs: 1000, anyTime: true }) => {
    const calls = { load: 0, bars: 0 };
    const src: LiveSource = { ...(poll ? { poll } : {}), load: async () => { calls.load++; return null; }, bars: async () => answers[Math.min(calls.bars++, answers.length - 1)]! };
    return { src, calls };
  };

  it('reads the lines at once, again every turn, and shows the newest', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { src, calls } = source([line(), line({ time: '10:32 AM ET' })]);
    const f = mount(BarsHost, src);
    await flush(); f.detectChanges();
    expect(calls.bars).toBe(1);
    expect(f.nativeElement.textContent).toBe('10:30 AM ET');
    vi.advanceTimersByTime(1000);
    await flush(); f.detectChanges();
    expect(calls.bars).toBe(2);
    expect(f.nativeElement.textContent).toBe('10:32 AM ET');
  });
  it('a failed or garbled read keeps the last values, and the next turn tries again', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { src, calls } = source([line(), null, line({ time: '10:34 AM ET' })]);
    const f = mount(BarsHost, src);
    await flush(); f.detectChanges();
    vi.advanceTimersByTime(1000);
    await flush(); f.detectChanges();
    expect(f.nativeElement.textContent).toBe('10:30 AM ET');
    vi.advanceTimersByTime(1000);
    await flush(); f.detectChanges();
    expect(calls.bars).toBe(3);
    expect(f.nativeElement.textContent).toBe('10:34 AM ET');
  });
  it('turns every 2 minutes unless told otherwise', () => expect(BARS_EVERY_MS).toBe(120_000));
  it('a hidden tab reads nothing; when it comes back it reads at once', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: new Date('2026-11-03T15:00:00Z') });
    const state = (v: string) => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    try {
      state('visible');
      const { src, calls } = source([line()], null);
      mount(BarsHost, src);
      await flush();
      expect(calls.bars).toBe(1);
      state('hidden');
      vi.advanceTimersByTime(BARS_EVERY_MS * 3);
      await flush();
      expect(calls.bars).toBe(1);
      state('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(calls.bars).toBe(2);
      vi.advanceTimersByTime(BARS_EVERY_MS);
      await flush();
      expect(calls.bars).toBe(3);
    } finally { delete (document as unknown as { visibilityState?: string }).visibilityState; }
  });
  it('stops when the page goes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { src, calls } = source([line()]);
    mount(BarsHost, src);
    await flush();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(5000);
    expect(calls.bars).toBe(1);
  });
  it('a box that reads only the lines does not download the day\'s file', async () => {
    const { src, calls } = source([line()]);
    mount(BarsHost, src);
    await flush();
    expect(calls.load).toBe(0);
  });
  it('the day\'s file is read for whoever asks for it', async () => {
    const { src, calls } = source([line()]);
    mount(DayHost, src);
    await flush();
    expect(calls.load).toBe(1);
    expect(calls.bars).toBe(0);
  });
  it('no source, or a source without lines: nothing, and no error', async () => {
    const f = mount(BarsHost, { load: async () => null });
    await flush(); f.detectChanges();
    expect(f.nativeElement.textContent).toBe('');
  });
});

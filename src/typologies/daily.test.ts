import { describe, expect, it } from 'vitest';
import { needKey } from '../api';
import { DailyParams, DailyPayload, dailyDemo, dailyWatchDemo, type DailyVisual, type DailyWatch } from './daily';
import { getTypology } from './index';

describe('daily@1: a company\'s card of the day — what changed since the session before — or, without one, the session\'s own facts', () => {
  it('asks for one company by its ticker', () => {
    expect(DailyParams.parse({ ticker: 'NVDA' })).toEqual({ ticker: 'NVDA' });
    expect(DailyParams.safeParse({ ticker: 'nvda' }).success).toBe(false);
    expect(DailyParams.safeParse({}).success).toBe(false);
    expect(needKey({ t: 'daily@1', params: { ticker: 'NVDA' } })).toBe('daily@1|{"ticker":"NVDA"}');
  });
  it('the demo: a card of the session with its cited facts, one of them changed with what it was — a valid payload, the same twice', () => {
    const d = dailyDemo(DailyParams.parse({ ticker: 'NVDA' }));
    expect(DailyPayload.safeParse(d).success).toBe(true);
    expect(d).toEqual(dailyDemo({ ticker: 'NVDA' }));
    expect(d.card!.session).toBe(d.asOf);
    expect(d.card!.message.length).toBeLessThanOrEqual(90);
    expect(d.card!.body.length).toBeLessThanOrEqual(320);
    expect(d.card!.facts).toHaveLength(2);
    expect(d.card!.facts.filter((f) => f.was)).toHaveLength(1);
    expect(d.facts).toEqual([]);
    expect(getTypology('daily@1')).toBeTruthy();
  });
  it('no card is a valid answer: the facts alone, or nothing at all', () => {
    const d = dailyDemo({ ticker: 'MSFT' });
    expect(DailyPayload.safeParse({ ...d, card: null, facts: d.card!.facts }).success).toBe(true);
    expect(DailyPayload.safeParse({ ...d, card: null, facts: [] }).success).toBe(true);
    expect(DailyPayload.safeParse({ ...d, card: undefined }).success).toBe(false);
  });
});

describe('daily@1 grows by optional fields (spec 2026-11-14 what-to-watch, step 3): chips, a picture per half, the "What to watch" half', () => {
  const d0 = dailyDemo({ ticker: 'NVDA' });
  it('a payload of pt-daily 1.0.0 is still valid: no chip, no visual, no watch', () => {
    const old = { ...d0, card: { ...d0.card!, facts: d0.card!.facts.map(({ kind, date, text, was }) => ({ kind, date, text, ...(was ? { was } : {}) })) } };
    delete (old.card as { visual?: unknown }).visual;
    expect(DailyPayload.safeParse(old).success).toBe(true);
    expect('watch' in d0).toBe(false);
  });
  it('each picture\'s kind parses, and an unknown one is refused', () => {
    const pics: DailyVisual[] = [
      { v: 'level', close: 100, level: 97.9, distPct: -2.1, closes: [99, 100] },
      { v: 'range', lo: 80, hi: 120, close: 118.5 },
      { v: 'rsi', values: [31, 28, 25] },
      { v: 'ma', fast: [10, 11], slow: [11, 11], crossAgo: null },
      { v: 'ma200', close: 101, ma200: 100, closes: [99, 101] },
      { v: 'date', date: '2026-10-05', sessions: 3 },
      { v: 'split', ret: -0.043, market: -0.004, sector: -0.008, specific: -0.031 },
      { v: 'target', before: 208.1, after: 212.4 },
      { v: 'ratings', before: { buy: 30, hold: 6, sell: 0 }, after: { buy: 31, hold: 5, sell: 0 } },
      { v: 'event', date: '2026-09-30', closes: [{ t: '2026-09-29', c: 180 }, { t: '2026-09-30', c: 188.2 }] },
      { v: 'crossed', level: 100, close: 98, closes: [101, 98] },
    ];
    for (const visual of pics) expect(DailyPayload.safeParse({ ...d0, card: { ...d0.card!, visual } }).success, visual.v).toBe(true);
    expect(DailyPayload.safeParse({ ...d0, card: { ...d0.card!, visual: { v: 'pie', parts: [] } } }).success).toBe(false);
  });
  it('the three kinds of half parse; watch absent, null and present are all valid', () => {
    const w = dailyWatchDemo('NVDA');
    expect(w.kind).toBe('half');
    expect(DailyPayload.safeParse({ ...d0, watch: w }).success).toBe(true);
    expect(DailyPayload.safeParse({ ...d0, watch: null }).success).toBe(true);
    const fact = (w as Extract<DailyWatch, { kind: 'half' }>).facts[0]!;
    expect(DailyPayload.safeParse({ ...d0, watch: { kind: 'fact', fact, visual: { v: 'rsi', values: [25] } } }).success).toBe(true);
    expect(DailyPayload.safeParse({ ...d0, watch: { kind: 'nothing', text: 'Nothing close as of Sep 30: …' } }).success).toBe(true);
    expect(DailyPayload.safeParse({ ...d0, watch: { kind: 'maybe' } }).success).toBe(false);
  });
  it('the watch demo is deterministic and its bold is well formed', () => {
    const w = dailyWatchDemo('NVDA') as Extract<DailyWatch, { kind: 'half' }>;
    expect(w).toEqual(dailyWatchDemo('NVDA'));
    expect(w.message).not.toContain('**');
    const marks = w.body.match(/\*\*/g) ?? [];
    expect(marks.length % 2).toBe(0);
    expect(marks.length / 2).toBeGreaterThanOrEqual(1);
    expect(marks.length / 2).toBeLessThanOrEqual(2);
    expect(w.facts).toHaveLength(2);
    expect(w.visual?.v).toBe('level');
    expect(w.facts.every((f) => f.chip)).toBe(true);
    expect(d0.card!.facts.every((f) => f.chip)).toBe(true);
    expect(d0.card!.visual).toBeTruthy();
  });
});

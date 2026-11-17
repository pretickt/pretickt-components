import { describe, expect, it } from 'vitest';
import { rsi, smaLast, supportResistance } from '../indicators';
import { needKey } from '../api';
import { getTypology } from './index';
import { demoSeries, technicalsDemo, TechnicalsPayload } from './technicals';
import { computeTechnicals, episodesOf, outcome, summarize, TECH, TECH_CARDS, TECH_STATES } from './technicals-math';

const T = true, F = false;
const flat = (n: number, f: (i: number) => number) => {
  const dates = Array.from({ length: n }, (_, i) => new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10));
  const closes = dates.map((_, i) => f(i));
  return { dates, closes, highs: closes.map(() => null) };
};

describe('technicals@1: a stock\'s technical cards and what happened the other times', () => {
  it('is registered, keyed by its ticker', () => {
    expect(getTypology('technicals@1')).toBeTruthy();
    expect(needKey({ t: 'technicals@1', params: { ticker: 'NVDA' } })).toBe('technicals@1|{"ticker":"NVDA"}');
  });

  it('the demo parses, every card once in order, each in one of its states', () => {
    const d = technicalsDemo({ ticker: 'NVDA' });
    expect(TechnicalsPayload.safeParse(d).success).toBe(true);
    expect(d.cards.map((c) => c.key)).toEqual([...TECH_CARDS]);
    for (const c of d.cards) expect(TECH_STATES[c.key] as readonly string[]).toContain(c.state);
    expect(TechnicalsPayload.safeParse({ ...d, cards: [] }).success).toBe(true);
  });

  it('an episode is the entry into a state after at least 10 sessions out', () => {
    expect(episodesOf([F, T, T, F, F, F, T, T], 0)).toEqual([1]);
    expect(episodesOf([F, T, ...Array(11).fill(F), T], 0)).toEqual([1, 13]);
    expect(episodesOf([T, T, F, T], 1)).toEqual([]); // in the state before the window: not a new entry
  });

  it('the outcome: the close 21 and 63 sessions later, SPY over the same dates; too recent is null', () => {
    const s = flat(100, (i) => (i < 21 ? 100 : 110));
    const spy = new Map(s.dates.map((d, i) => [d, i < 21 ? 400 : 408]));
    expect(outcome(s, spy, 0)).toEqual({ r: [0.1, 0.1], m: [0.02, 0.02] });
    expect(outcome(s, spy, 90)).toEqual({ r: [null, null], m: [null, null] });
    expect(outcome(s, null, 0).m).toEqual([null, null]);
  });

  it('the counts: higher, the median, the market and net; no market for SPY', () => {
    const e = (r: number, m: number) => ({ r: [r, r] as [number, number], m: [m, m] as [number, number] });
    expect(summarize([e(0.1, 0.02), e(-0.05, 0.01), e(0.2, 0.03)], 0, true)).toEqual({ n: 3, up: 2, med: 0.1, mkt: 0.02, net: 0.08 });
    expect(summarize([e(0.1, 0.02)], 1, false)).toEqual({ n: 1, up: 1, med: 0.1, mkt: null, net: null });
  });

  it('today agrees with the hub\'s badges: RSI on 300 closes, the levels on 504, the averages', () => {
    const { s, spy } = demoSeries('NVDA');
    const r = computeTechnicals(s, { asOf: s.dates.at(-1)!, spy })!;
    const card = (k: string) => r.payload.cards.find((c) => c.key === k)!;
    expect(card('rsi').now['rsi']).toBeCloseTo(rsi(s.closes.slice(-300)).at(-1)!, 2);
    const sr = supportResistance(s.closes.slice(-504));
    expect(sr.resistances[0]).toBeTruthy();
    expect(card('resistance').now['level']).toBeCloseTo(sr.resistances[0]!.price, 1);
    expect(card('support').now['level'] ?? null).toBe(sr.supports[0] ? card('support').now['level'] : null);
    expect(card('support').state).toBe(sr.supports[0] ? (sr.supports[0].near ? 'near' : 'far') : 'none');
    expect(card('ma200').now['ma']).toBeCloseTo(smaLast(s.closes, 200)!, 1);
  });

  it('the past levels are point in time: changing every later close leaves the earlier states alone', () => {
    const { s, spy } = demoSeries('KO');
    const k = s.closes.length - 300;
    const later = { ...s, closes: s.closes.map((c, i) => (i > k ? c * (1 + ((i * 7) % 13) / 20) : c)) };
    const before = (x: typeof s) => computeTechnicals(x, { asOf: x.dates.at(-1)!, spy })!.pool;
    const a = before(s), b = before(later), early = (eps: { t: string }[]) => eps.filter((e) => e.t <= s.dates[k - TECH.H[1]]!).map((e) => e.t);
    for (const key of ['support:near', 'resistance:near', 'rsi:below30']) expect(early(b[key]!)).toEqual(early(a[key]!));
  });

  it('a year and a half of closes: no 200-day episode before the average exists, no NaN', () => {
    const { s, spy } = demoSeries('NEW', 300);
    const r = computeTechnicals(s, { asOf: s.dates.at(-1)!, spy })!;
    expect(JSON.stringify(r.payload)).not.toContain('NaN');
    const ma200 = r.payload.cards.find((c) => c.key === 'ma200');
    for (const st of ma200?.states ?? []) for (const e of st.episodes) expect(s.dates.indexOf(e.t)).toBeGreaterThanOrEqual(199 + TECH.GAP);
    expect(TechnicalsPayload.safeParse({ ...r.payload, ticker: 'NEW', name: 'New', kind: 'stock', cards: r.payload.cards }).success).toBe(true);
  });

  it('a weekly chart marks every time on its week: each mark is a date of the chart (review: 79% were dropped)', () => {
    const { s, spy } = demoSeries('NVDA');
    const r = computeTechnicals(s, { asOf: s.dates.at(-1)!, spy })!;
    const weekly = new Set(r.payload.weekly.t);
    const marks = r.payload.cards.filter((c) => c.chart.range === 'weekly').flatMap((c) => c.chart.marks);
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) expect(weekly.has(m.t), m.t).toBe(true);
  });

  it('MACD: the sessions it has been on its side, today included', () => {
    const { s, spy } = demoSeries('NVDA');
    const c = computeTechnicals(s, { asOf: s.dates.at(-1)!, spy })!.payload.cards.find((x) => x.key === 'macd')!;
    expect(c.now['ago']).toBeGreaterThanOrEqual(1);
  });

  it('under a year of closes: nothing', () => {
    const { s, spy } = demoSeries('NEW', 200);
    expect(computeTechnicals(s, { asOf: s.dates.at(-1)!, spy })).toBeNull();
  });
});

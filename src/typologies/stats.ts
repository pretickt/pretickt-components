import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, demoName, IsoDate, Month, prng, round, sessionsBack, Ticker } from './common';

/**
 * A stock's last five years (pt-stats, the history page), computed every night from its daily closes adjusted for splits and dividends:
 * how much it moves (a typical day, days beyond ±5% a year, beta against SPY over two years, a typical month), each calendar year's change
 * (the current one "so far") and the window's total, its falls and rises beyond its own threshold — 1.5 × its typical month, rounded to
 * 5%, never under 10% — with the deepest fall from a high and the largest rise from a low, and how often it went up: closed months, one-year
 * stretches, days. With less than five years the window is its whole history (`fullWindow` false, `since` its first close). `spy` is
 * the market's same figures over the same window. Fractions throughout; the past, never a forecast.
 */
export const StatsParams = z.object({ ticker: Ticker });
export const StatsSwing = z.object({
  kind: z.enum(['fall', 'rise']), from: IsoDate, to: IsoDate, fromClose: z.number(), toClose: z.number(), size: z.number(), sessions: z.int(),
  /** A fall: the first close back at its starting level, or null (not back yet). */
  back: z.nullable(IsoDate),
  /** It starts at the window's first close, not at a high or a low. */
  first: z.boolean(),
  /** Its end is the latest extreme, not yet confirmed by a move of the threshold back. */
  open: z.boolean(),
});
export const StatsExtreme = z.object({ size: z.number(), from: IsoDate, to: IsoDate, back: z.nullable(IsoDate) });
const Year = z.object({ year: z.int(), change: z.number(), soFar: z.boolean() });
const MonthChange = z.object({ month: Month, change: z.number() });
const Level = z.object({ close: z.number(), date: IsoDate });
export const StatsPayload = z.object({
  ticker: Ticker, name: z.string(),
  asOf: IsoDate, since: IsoDate, fullWindow: z.boolean(), sessions: z.int(),
  typicalDay: z.number(), bigDaysPerYear: z.number(), upDays: z.number(), month80: z.number(), beta: z.nullable(z.number()),
  years: z.array(Year), total: z.number(), months: z.array(MonthChange),
  stretches: z.object({ n: z.int(), up: z.int() }),
  bestMonth: z.nullable(MonthChange), worstMonth: z.nullable(MonthChange),
  high: z.object({ close: z.number(), date: IsoDate, allTime: z.boolean() }), high52: Level, low52: Level,
  threshold: z.number(), swings: z.array(StatsSwing),
  /** The stretch after the latest extreme (drawn in plain ink), or null when the latest close is that extreme. */
  last: z.nullable(z.object({ kind: z.enum(['fall', 'rise']), from: IsoDate, fromClose: z.number(), size: z.number() })),
  deepestFall: StatsExtreme, largestRise: StatsExtreme,
  /** The chart: each week's last close and every swing's ends, oldest first. */
  path: z.array(z.object({ t: IsoDate, c: z.number() })),
  spy: z.nullable(z.object({
    typicalDay: z.number(), bigDaysPerYear: z.number(), upDays: z.number(), years: z.array(Year), total: z.number(), months: z.array(MonthChange),
    stretches: z.object({ n: z.int(), up: z.int() }), deepestFall: StatsExtreme,
  })),
});
export type StatsParams = z.output<typeof StatsParams>;
export type StatsSwing = z.infer<typeof StatsSwing>;
export type Stats = z.infer<typeof StatsPayload>;

export const statsSamples: z.input<typeof StatsParams>[] = [{ ticker: 'NVDA' }];

/** Made up: five years of a company that fell and rose three times by 30% or more, its last rise still open, and a calm market beside it. */
export function statsDemo(p: StatsParams): Stats {
  const t = p.ticker, name = DEMO_COMPANIES.find(([x]) => x === t)?.[1] ?? demoName(t);
  const dates = sessionsBack(DEMO_ASOF, 1260), rand = prng(`stats:${t}`);
  const legs = [100, 64, 104, 66, 118, 78, 142], at = [0, 160, 330, 520, 760, 930, 1200];
  const closes = dates.map((_, i) => {
    const k = Math.max(0, at.findIndex((x, j) => i >= x && i <= (at[j + 1] ?? 1259)));
    const a = at[k]!, b = at[k + 1] ?? 1259, la = legs[k]!, lb = legs[k + 1] ?? 136;
    const v = la + ((lb - la) * (i - a)) / (b - a);
    return round(at.includes(i) ? v : v * (1 + (rand() - 0.5) * 0.02), 2);
  });
  const n = closes.length;
  const swings: StatsSwing[] = at.slice(0, -1).map((a, k) => {
    const b = at[k + 1]!, size = closes[b]! / closes[a]! - 1, fall = size < 0;
    const j = fall ? closes.findIndex((c, i) => i > b && c >= closes[a]!) : -1;
    return { kind: fall ? 'fall' : 'rise', from: dates[a]!, to: dates[b]!, fromClose: closes[a]!, toClose: closes[b]!, size: round(size, 4), sessions: b - a,
      back: j > 0 ? dates[j]! : null, first: a === 0, open: k === at.length - 2 };
  });
  const lastIdx = (key: (d: string) => string) => dates.map((d, i) => [key(d), i] as const).filter(([k], i, all) => all[i + 1]?.[0] !== k);
  const months = lastIdx((d) => d.slice(0, 7)), years = lastIdx((d) => d.slice(0, 4));
  const monthly = months.slice(1).map(([m, i], k) => ({ month: m, change: round(closes[i]! / closes[months[k]![1]]! - 1, 4) })).filter((m) => m.month !== DEMO_ASOF.slice(0, 7));
  const yearly = years.slice(1).map(([y, i], k) => ({ year: Number(y), change: round(closes[i]! / closes[years[k]![1]]! - 1, 4), soFar: y === DEMO_ASOF.slice(0, 4) }));
  const sorted = [...monthly].sort((a, b) => b.change - a.change);
  const hi = closes.indexOf(Math.max(...closes)), y52 = closes.slice(-252);
  const hi52 = n - 252 + y52.indexOf(Math.max(...y52)), lo52 = n - 252 + y52.indexOf(Math.min(...y52));
  const spyYears = yearly.map((y, k) => ({ ...y, change: [-0.18, 0.26, 0.25, 0.18, 0.12][k] ?? 0.1 }));
  return {
    ticker: t, name, asOf: DEMO_ASOF, since: dates[0]!, fullWindow: true, sessions: n,
    typicalDay: 0.021, bigDaysPerYear: 38, upDays: 0.51, month80: 0.2, beta: 2.2,
    years: yearly, total: round(closes[n - 1]! / closes[0]! - 1, 4), months: monthly,
    stretches: { n: n - 252, up: 595 }, bestMonth: sorted[0] ?? null, worstMonth: sorted.at(-1) ?? null,
    high: { close: closes[hi]!, date: dates[hi]!, allTime: false }, high52: { close: closes[hi52]!, date: dates[hi52]! }, low52: { close: closes[lo52]!, date: dates[lo52]! },
    threshold: 0.3, swings, last: { kind: 'fall', from: dates[1200]!, fromClose: closes[1200]!, size: round(closes[n - 1]! / closes[1200]! - 1, 4) },
    deepestFall: { size: -0.36, from: dates[0]!, to: dates[160]!, back: swings[0]!.back }, largestRise: { size: round(142 / 66 - 1, 4), from: dates[520]!, to: dates[1200]!, back: null },
    path: dates.map((d, i) => ({ t: d, c: closes[i]! })).filter((_, i) => i % 5 === 0 || at.includes(i) || i === n - 1),
    spy: { typicalDay: 0.006, bigDaysPerYear: 0.6, upDays: 0.53, years: spyYears, total: 0.73,
      months: monthly.map((m, k) => ({ month: m.month, change: round(((k * 7) % 11) / 100 - 0.035, 4) })), stretches: { n: n - 252, up: 885 },
      deepestFall: { size: -0.245, from: dates[40]!, to: dates[230]!, back: dates[520]! } },
  };
}

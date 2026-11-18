import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, demoName, IsoDate, prng, round, sessionsBack, Ticker } from './common';
import { computeTechnicals, medianPath, TECH_CARDS, type TechSeries } from './technicals-math';


/**
 * A stock's or a fund's technicals (pt-technicals, the technicals page; spec pretickt/docs/superpowers/specs/2026-11-17-technicals-page-design.md),
 * computed every night from its daily closes adjusted for splits and dividends: one card per technical aspect (RSI, support, resistance, the
 * 200-day average, the 20/50/100-day averages, the 50/200 cross, Bollinger Bands, MACD, the distance from the 52-week high), each with today's
 * figures, the series of its "now" chart, and every state's past episodes — the first session in the state after at least 10 sessions out
 * of it — with where the stock was 21 and 63 sessions later, SPY over the same dates, and the same counts pooled over every listed stock
 * (`all`). Fractions throughout; the past, never a forecast.
 */
export const TechnicalsParams = z.object({ ticker: Ticker });
const R = z.nullable(z.number());
export const TechSum = z.object({ n: z.int(), up: z.int(), med: R, mkt: R, net: R });
export const TechEpisode = z.object({
  t: IsoDate,
  /** The return 21 and 63 sessions later; null = too recent. */
  r: z.tuple([R, R]),
  /** SPY's over the same dates; null for SPY itself or a date it lacks. */
  m: z.tuple([R, R]),
  /** A level's episode: held (support) or not broken (resistance) over the next 21 sessions; null elsewhere or too recent. */
  held: z.nullable(z.boolean()),
});
export const TechState = z.object({
  key: z.string(),
  /** Episodes in the window; `episodes` keeps the last 20, oldest first. */
  total: z.int(),
  episodes: z.array(TechEpisode),
  /** The states the card shows: each of the last episodes' path, every 3rd session from 0 to 63 (null past the latest close). */
  paths: z.nullable(z.array(z.array(R))),
  held: z.nullable(z.int()),
  stock: z.tuple([TechSum, TechSum]),
  all: z.nullable(z.tuple([TechSum, TechSum])),
  /** The shown states: the median path and the middle half (25th, 75th percentile; null under four) over every time, as `paths` steps. */
  medPath: z.optional(z.array(R)),
  half: z.optional(z.tuple([z.array(R), z.array(R)])),
  /** Every listed stock's median path, every 3rd session from 0 to 63 (all companies' line on the "after" chart); absent on older rows. */
  allPath: z.optional(z.nullable(z.array(R))),
});
const Line = z.object({ k: z.string(), v: z.array(R) });
export const TechCard = z.object({
  key: z.enum(TECH_CARDS),
  state: z.string(),
  now: z.record(z.string(), R),
  chart: z.object({
    range: z.enum(['daily', 'weekly']),
    /** The chart starts at this index of its range's arrays; `lines` are aligned from there. */
    from: z.int(),
    lines: z.array(Line),
    levels: z.array(z.object({ k: z.string(), v: z.number() })),
    /** `v`: where the mark sits when not on the close (support/resistance: the close the price turned at). */
    marks: z.array(z.object({ t: IsoDate, k: z.string(), v: z.optional(z.number()) })),
    pane: z.nullable(z.object({ k: z.enum(['rsi', 'macd']), lines: z.array(Line), bars: z.nullable(z.array(R)), guides: z.array(z.number()) })),
  }),
  states: z.array(TechState),
});
const Series = z.object({ t: z.array(IsoDate), c: z.array(z.number()) });
export const TechnicalsPayload = z.object({
  ticker: Ticker, name: z.string(), kind: z.enum(['stock', 'etf']),
  asOf: IsoDate, since: IsoDate, fullWindow: z.boolean(), close: z.number(),
  /** The last 252 sessions; each week's last close over the window. */
  daily: Series, weekly: Series,
  cards: z.array(TechCard),
});
export type TechnicalsParams = z.output<typeof TechnicalsParams>;
export type TechSum = z.infer<typeof TechSum>;
export type TechEpisode = z.infer<typeof TechEpisode>;
export type TechState = z.infer<typeof TechState>;
export type TechCard = z.infer<typeof TechCard>;
export type Technicals = z.infer<typeof TechnicalsPayload>;

export const technicalsSamples: z.input<typeof TechnicalsParams>[] = [{ ticker: 'NVDA' }];

/** Made up: seven years of a stock that rose, fell hard twice and is falling again now, its market a calm climb; the pooled figures invented. */
export function demoSeries(ticker: string, sessions = 1800): { s: TechSeries; spy: Map<string, number> } {
  const dates = sessionsBack(DEMO_ASOF, sessions), rand = prng(`technicals:${ticker}`);
  const closes: number[] = [], spy = new Map<string, number>();
  let c = 40, m = 300;
  for (let i = 0; i < dates.length; i++) {
    const drift = Math.sin(i / 140) * 0.004 + (i > dates.length - 40 ? -0.012 : 0.0006);
    c = Math.max(1, c * (1 + drift + (rand() - 0.5) * 0.05));
    m *= 1 + 0.0004 + (rand() - 0.5) * 0.012;
    closes.push(round(c, 2));
    spy.set(dates[i]!, round(m, 2));
  }
  return { s: { dates, closes, highs: closes.map((x) => round(x * 1.01, 2)) }, spy };
}

export function technicalsDemo(p: TechnicalsParams): Technicals {
  const t = p.ticker, name = DEMO_COMPANIES.find(([x]) => x === t)?.[1] ?? demoName(t);
  const { s, spy } = demoSeries(t);
  const r = computeTechnicals(s, { asOf: DEMO_ASOF, spy: t === 'SPY' ? null : spy });
  const fake = (k: string, h: number) => ({ n: 900 + k.length * 37 + h * 11, up: 520 + k.length * 19 + h * 9, med: round(0.008 + k.length / 1000 + h * 0.01, 4),
    mkt: round(0.006 + h * 0.008, 4), net: round(0.002 + k.length / 2000, 4) });
  return {
    ticker: t, name, kind: t === 'SPY' ? 'etf' : 'stock', ...r!.payload,
    // the pooled path: this stock's own median path, flattened toward the invented pooled medians
    cards: r!.payload.cards.map((c) => ({ ...c, states: c.states.map((st) => ({ ...st, all: [fake(st.key, 0), fake(st.key, 1)] as [TechSum, TechSum],
      allPath: st.paths ? medianPath(st.paths).map((v, i) => (v == null ? null : round(v * 0.4 + (fake(st.key, 1).med! * i) / 21, 4))) : null })) })),
  };
}

import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, HttpUrl, IsoDate, Num, prng, round, Ticker } from './common';
import { priceSeriesDemo } from './price-series';
import { VALUE_KEYS, ValueFaq } from './value';
import { BASKET_MIN_COVERAGE, BASKET_MOVERS } from './values';

export { BASKET_MIN_COVERAGE, BASKET_MOVERS };

/**
 * "What does the whole fund say?": one ETF's basket, in the language of a company page, as the nightly computed it (table basket_payloads). Every
 * figure says how much of the fund it rests on. Weights, shares and returns are fractions: 0.205 is 20.5%, and `points` 0.0076 is 0.76 points of
 * the fund's move. `state: 'low'`: the fund is under 80% on the site, or no good file was read in 7 days, and no basket figure exists.
 */
const Text = z.string().check(z.minLength(1));
const Share = z.number().check(z.gte(0), z.lte(1));
const Who = { ticker: Ticker, name: Text, logo: z.nullable(z.string()) };

export const BasketParams = z.object({ ticker: Ticker });
export const BasketMover = z.object({ ...Who, weight: z.number(), ret: z.number(), points: z.number(), headline: z.nullable(z.object({ title: Text, url: HttpUrl })) });
export const BasketContributor = z.object({ ...Who, weight: z.number(), upside: z.number(), points: z.number() });
export const BasketQuestion = z.object({ key: z.enum(VALUE_KEYS), pos: Share, flat: Share, neg: Share, share: Share, comparable: z.boolean() })
  .check(z.refine((q) => !q.comparable || Math.abs(q.pos + q.flat + q.neg - 1) < 0.01, 'the shares add up to the whole'));
export const BasketHolding = z.object({ ticker: z.nullable(Ticker), name: Text, logo: z.nullable(z.string()), weight: z.number().check(z.gte(-1), z.lte(1)), ret: Num, upside: Num, label: z.nullable(z.string()) });

const atMost = (n: number) => (rows: unknown[]) => rows.length <= n;
/** What analysts' targets add up to over the basket: `price` is what they would put it at, `top` its three largest contributors. */
export const BasketTarget = z.object({ upside: z.number(), price: z.number(), share: Share, median: Num, top: z.array(BasketContributor).check(z.refine(atMost(3), 'at most three')) });
export const BasketConsensus = z.object({ buy: Share, hold: Share, sell: Share, n: z.number(), label: Text, share: Share });
export const BasketPe = z.object({ value: z.number(), share: Share });
export const BasketMoves = z.object({ sum: Num, up: z.array(BasketMover).check(z.refine(atMost(BASKET_MOVERS), 'at most five a side')), down: z.array(BasketMover).check(z.refine(atMost(BASKET_MOVERS), 'at most five a side')) });
/**
 * One week of the year (Romeo, 2026-11-07: the company pages' target chart on a basket): the basket's price that week and the target its holdings'
 * analysts put on it, with today's weights; `share` the weight with a target. Null target: no company had targets from 3 firms that week.
 */
/** How many of its largest companies a week names: the chart's panel on a dot (Romeo, 2026-11-07: «the surrounding companies with logos»). */
export const WEEK_TOP = 6;
/** A company of the week: its upside that week (its analysts' targets over its close then); a company's share classes count once. */
export const WeekCompany = z.object({ ticker: Ticker, upside: z.number() });
export const TargetWeek = z.object({ t: IsoDate, price: z.number(), target: Num, share: Share,
  /** Its largest companies by today's weight with a target that week, largest first (absent in a payload written before them). */
  top: z.optional(z.array(WeekCompany).check(z.refine((t) => t.length <= WEEK_TOP, 'at most six'))) });
const ascending = (s: readonly { t: string }[]) => s.every((p, i) => i === 0 || s[i - 1]!.t < p.t);
export const TargetHistory = z.array(TargetWeek).check(z.refine(ascending, 'oldest first, one point a week'));
export const BasketPayload = z.object({
  asOf: IsoDate, ticker: Ticker, name: Text, logo: z.nullable(z.string()),
  /** Finishes the sentence "SMH …": "tracks the MVIS US Listed Semiconductor 25 Index". */
  tracks: Text,
  group: Text,
  /** The other funds holding this basket. */
  same: z.array(Ticker),
  /** What the figures cannot see in this fund (JEPI's options), or null. */
  note: z.nullable(Text),
  close: z.number(), ret: Num,
  coverage: Share,
  state: z.enum(['ok', 'low']),
  /** The fund publishes rarely: the list may be a few weeks old. */
  stale: z.boolean(),
  fund: z.object({ expenseRatio: Num, assets: Num, holdings: Num, top10: Num, ret1y: Num, ret5y: Num, spy1y: Num, spy5y: Num, yield: Num }),
  target: z.nullable(BasketTarget),
  consensus: z.nullable(BasketConsensus),
  pe: z.nullable(BasketPe),
  questions: z.nullable(z.array(BasketQuestion)),
  moves: BasketMoves,
  /** Every covered company and the 50 largest others, largest first. */
  holdings: z.array(BasketHolding),
  /** The target week by week over the year, the last one today's (absent in a payload written before 2026-11-07, and on a fund under 80%). */
  targetHistory: z.optional(TargetHistory),
  faq: z.array(ValueFaq),
}).check(
  z.refine((b) => b.state === 'low' ? b.target === null && b.consensus === null && b.pe === null && b.questions === null && !b.targetHistory?.length : b.coverage >= BASKET_MIN_COVERAGE, 'no basket figure on a fund under 80%'),
);
export type BasketParams = z.output<typeof BasketParams>;
export type BasketMover = z.infer<typeof BasketMover>;
export type BasketContributor = z.infer<typeof BasketContributor>;
export type BasketQuestion = z.infer<typeof BasketQuestion>;
export type BasketHolding = z.infer<typeof BasketHolding>;
export type BasketTarget = z.infer<typeof BasketTarget>;
export type TargetWeek = z.infer<typeof TargetWeek>;
export type WeekCompany = z.infer<typeof WeekCompany>;

/**
 * A made-up year of weekly targets on the demo's own price line (every 5th point back from its last, as the nightly takes its weeks): the target follows
 * the price at about `upside`, the last week is today's `target`.
 */
export function demoTargetHistory(seed: string, points: readonly { t: string; c: number }[], target: number, upside: number, cos: readonly string[]): TargetWeek[] {
  const r = prng(`${seed}:weeks`), q = prng(`${seed}:week-top`), out: TargetWeek[] = [];
  for (let i = points.length - 1; i >= 0 && out.length < 52; i -= 5) out.push({ t: points[i]!.t, price: round(points[i]!.c, 2), target: 0, share: 0.97 });
  out.reverse();
  const named = cos.slice(0, WEEK_TOP), base = named.map(() => q() * 0.5 - 0.1);
  return out.map((w, k) => ({ ...w, target: k === out.length - 1 ? target : round(w.price * (1 + upside * (0.7 + r() * 0.6)), 2),
    top: named.map((ticker, i) => ({ ticker, upside: round(base[i]! + (q() - 0.5) * 0.1, 3) })) }));
}
export type BasketConsensus = z.infer<typeof BasketConsensus>;
export type BasketPe = z.infer<typeof BasketPe>;
export type BasketMoves = z.infer<typeof BasketMoves>;
export type Basket = z.infer<typeof BasketPayload>;

export const basketSamples: z.input<typeof BasketParams>[] = [{ ticker: 'SMH' }, { ticker: 'SPY' }];

/** A made-up fund: ARKW is the one under 80%. The numbers never appear on the site as anyone's. */
export function basketDemo(p: BasketParams): Basket {
  const r = prng(`${p.ticker}:basket`), low = p.ticker === 'ARKW', coverage = low ? 0.72 : 0.99;
  const w = [0.2, 0.15, 0.12, 0.1, 0.09, 0.08, 0.07, 0.06, 0.04, 0.03, 0.03, 0.02].map((x) => x * coverage);
  const rows = DEMO_COMPANIES.slice(0, 12).map(([ticker, name], i) => ({ ticker, name, logo: null, weight: round(w[i]!, 4), ret: round((r() - 0.5) * 0.08, 4), upside: round(r() * 0.5 - 0.05, 3), label: ['Buy', 'Strong Buy', 'Hold'][i % 3]! }));
  const movers = (list: typeof rows) => list.map((h) => ({ ticker: h.ticker, name: h.name, logo: h.logo, weight: h.weight, ret: h.ret, points: round(h.weight * h.ret, 5), headline: { title: `${h.ticker} demo headline`, url: `https://example.com/${h.ticker.toLowerCase()}` } }));
  const sorted = [...rows].sort((a, b) => b.weight * b.ret - a.weight * a.ret);
  // the fund's close is its demo price line's last (price-series@1), so the target chart's weeks sit on the line it draws
  const line = priceSeriesDemo({ tickers: [p.ticker], range: '1y', interval: '1d', rebase: false })[0]!.points;
  r(); // the draw the close once took: the figures after it keep their values
  const upside = round(rows.reduce((s, h) => s + h.weight * h.upside, 0) / rows.reduce((s, h) => s + h.weight, 0), 3), close = round(line.at(-1)!.c, 2);
  return {
    asOf: DEMO_ASOF, ticker: p.ticker, name: `${p.ticker} Demo ETF`, logo: null, tracks: 'tracks a made-up index', group: 'Market', same: [], note: null, close, ret: round((r() - 0.5) * 0.04, 4),
    coverage, state: low ? 'low' : 'ok', stale: false,
    fund: { expenseRatio: 0.0035, assets: 5e10, holdings: 27, top10: 0.74, ret1y: 0.31, ret5y: 1.42, spy1y: 0.18, spy5y: 0.92, yield: 0.004 },
    target: low ? null : { upside, price: round(close * (1 + upside)), share: 0.97, median: round(upside * 0.8, 3), top: rows.slice(0, 3).map((h) => ({ ticker: h.ticker, name: h.name, logo: h.logo, weight: h.weight, upside: h.upside, points: round(h.weight * h.upside, 4) })) },
    consensus: low ? null : { buy: 0.57, hold: 0.37, sell: 0.06, n: 1204, label: 'Buy', share: 0.98 },
    pe: low ? null : { value: 28.4, share: 0.94 },
    questions: low ? null : VALUE_KEYS.map((key, i) => ({ key, pos: [0.67, 0.5, 0.62, 0.55, 0.2, 0.3][i]!, flat: [0.2, 0.3, 0.2, 0.3, 0.4, 0.3][i]!, neg: [0.13, 0.2, 0.18, 0.15, 0.4, 0.4][i]!, share: 0.98, comparable: true })),
    moves: { sum: round(rows.reduce((s, h) => s + h.weight * h.ret, 0), 5), up: movers(sorted.filter((h) => h.ret > 0).slice(0, BASKET_MOVERS)), down: movers(sorted.filter((h) => h.ret < 0).reverse().slice(0, BASKET_MOVERS)) },
    holdings: [...rows, { ticker: null, name: 'A Private Holding', logo: null, weight: 0.01, ret: null, upside: null, label: null }],
    ...(low ? {} : { targetHistory: demoTargetHistory(p.ticker, line, round(close * (1 + upside)), upside, rows.map((h) => h.ticker)) }),
    faq: [{ q: `What does ${p.ticker} hold?`, a: `${p.ticker} holds 27 stocks; the largest is ${rows[0]!.name}.` }],
  };
}

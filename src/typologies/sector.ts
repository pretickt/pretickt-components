import * as z from 'zod/mini';
import { BasketConsensus, BasketHolding, BasketMoves, BasketPe, BasketQuestion, BasketTarget, BASKET_MOVERS } from './basket';
import { addDays, DEMO_ASOF, DEMO_COMPANIES, demoName, IsoDate, Num, prng, round, Ticker } from './common';
import { MetricItem, metricDemo } from './metric';
import { VALUE_KEYS, ValueFaq, type ValueKey } from './value';
import { SECTOR_FUNDS, SECTORS, type Sector } from './values';

export { SECTOR_FUNDS };

/**
 * "What does the whole sector say?": every company of one sector on the site, weighted by its market value at the last close, in the language of
 * a fund's page (basket@1), as the nightly computed it (table sector_payloads). The basket is the whole sector, so coverage is 1 and the day's
 * move is exact. `value` is what the companies are worth, `series` that sum over the year (today's shares at each day's adjusted close: our own
 * sum, not an index), `badges` the header's only badges. Weights, shares and returns are fractions. Design 2026-11-07, Part A.
 */
const Text = z.string().check(z.minLength(1));

/** The badges a sector's header shows: the basket's own, no technicals (its line is no traded price). */
export const SECTOR_BADGES = ['pt_upside', 'consensus', 'pe', 'earnings_in', 'news', 'market_cap'] as const;
/** The questions whose rule does not read a sector's business: banks get no Advantage and a Fragility of holders only (design 2026-11-07). */
export const SECTOR_NOT_COMPARABLE: Readonly<Partial<Record<Sector, readonly ValueKey[]>>> = { 'Financial Services': ['advantage', 'fragility'] };
/** Who Fragility's base leaves out (the Altman score reads their normal debt as distress): a sector made of them reads it not comparable. */
export const FRAGILITY_NOT_READ: readonly Sector[] = ['Utilities', 'Real Estate'];

export const SectorParams = z.object({ sector: z.enum(SECTORS) });
/** A company of the sector, with its close at `asOf`: the browser draws the sector's line of the session from the companies' bars. */
export const SectorHolding = z.extend(BasketHolding, { close: Num });
const Point = z.object({ t: IsoDate, c: z.number() });
const ascending = (s: readonly { t: string }[]) => s.every((p, i) => i === 0 || s[i - 1]!.t < p.t);
const badgesOnly = (b: readonly { key: string }[]) => b.every((m) => (SECTOR_BADGES as readonly string[]).includes(m.key));

export const SectorBasketPayload = z.object({
  kind: z.literal('sector'), asOf: IsoDate, sector: z.enum(SECTORS), name: Text,
  /** The fund that holds the sector's S&P 500 companies (SECTOR_FUNDS): named and linked, never its price. */
  tracker: Ticker,
  companies: z.int().check(z.gte(0)),
  /** What the sector's companies are worth at the close, dollars. */
  value: z.number(),
  /** That value's move on the day, exact: the sum of the companies' points. */
  ret: Num,
  coverage: z.literal(1), state: z.literal('ok'),
  target: z.nullable(BasketTarget), consensus: z.nullable(BasketConsensus), pe: z.nullable(BasketPe), questions: z.nullable(z.array(BasketQuestion)),
  moves: BasketMoves,
  /** Every company of the sector, largest first; one with no market value at weight 0. */
  holdings: z.array(SectorHolding),
  series: z.array(Point).check(z.refine(ascending, 'oldest first, one point a session')),
  badges: z.array(MetricItem).check(z.refine(badgesOnly, 'only the basket badges')),
  faq: z.array(ValueFaq),
});
export type SectorParams = z.output<typeof SectorParams>;
export type SectorHolding = z.infer<typeof SectorHolding>;
export type SectorBasket = z.infer<typeof SectorBasketPayload>;

export const sectorSamples: z.input<typeof SectorParams>[] = [{ sector: 'Technology' }, { sector: 'Financial Services' }];

/** The year's sessions before `end`, weekdays only, oldest first. */
function weekdays(end: string, n: number): string[] {
  const out: string[] = [];
  for (let d = end; out.length < n; d = addDays(d, -1)) if (![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) out.push(d);
  return out.reverse();
}

/** A made-up sector: 30 companies, a year of its value, its badges. The numbers never appear on the site as anyone's. */
export function sectorDemo(p: SectorParams): SectorBasket {
  const r = prng(`${p.sector}:sector`), tracker = SECTOR_FUNDS[p.sector];
  const made = Array.from({ length: 18 }, (_, i) => `DM${String.fromCharCode(65 + i)}`).map((t) => [t, demoName(t)] as const);
  const cos = [...DEMO_COMPANIES, ...made];
  const raw = cos.map((_, i) => 1 / (i + 1) ** 1.2), total = raw.reduce((s, x) => s + x, 0);
  const value = round(1e12 + r() * 2e13, 0);
  const holdings = cos.map(([ticker, name], i) => ({ ticker, name, logo: null, weight: round(raw[i]! / total, 5), ret: round((r() - 0.5) * 0.06, 4),
    upside: round(r() * 0.4 - 0.05, 3), label: ['Buy', 'Strong Buy', 'Hold'][i % 3]!, close: round(20 + r() * 480, 2) }));
  const movers = (list: typeof holdings) => list.map((h) => ({ ticker: h.ticker, name: h.name, logo: h.logo, weight: h.weight, ret: h.ret, points: round(h.weight * h.ret, 6),
    headline: { title: `${h.ticker} demo headline`, url: `https://example.com/${h.ticker.toLowerCase().replace('.', '-')}` } }));
  const byPoints = [...holdings].sort((a, b) => b.weight * b.ret - a.weight * a.ret);
  const sum = round(holdings.reduce((s, h) => s + h.weight * h.ret, 0), 6);
  const upside = round(holdings.reduce((s, h) => s + h.weight * h.upside, 0), 4);
  const off = new Set<ValueKey>([...(SECTOR_NOT_COMPARABLE[p.sector] ?? []), ...(FRAGILITY_NOT_READ.includes(p.sector) ? ['fragility' as const] : [])]);
  const sessions = weekdays(DEMO_ASOF, 252);
  let c = value / (1 + r() * 0.3);
  const series = sessions.map((t, i) => {
    if (i === sessions.length - 1) return { t, c: value };
    c *= 1 + (r() - 0.48) * 0.02;
    return { t, c: round(c, 0) };
  });
  return {
    kind: 'sector', asOf: DEMO_ASOF, sector: p.sector, name: p.sector, tracker, companies: holdings.length, value, ret: sum, coverage: 1, state: 'ok',
    target: { upside, price: round(value * (1 + upside), 0), share: 0.97, median: round(upside * 0.8, 3),
      top: holdings.slice(0, 3).map((h) => ({ ticker: h.ticker, name: h.name, logo: h.logo, weight: h.weight, upside: h.upside, points: round(h.weight * h.upside, 4) })) },
    consensus: { buy: 0.61, hold: 0.33, sell: 0.06, n: 2140, label: 'Buy', share: 0.99 },
    pe: { value: 31.2, share: 0.93 },
    questions: VALUE_KEYS.map((key, i) => off.has(key) ? { key, pos: 0, flat: 0, neg: 0, share: 0.2, comparable: false }
      : { key, pos: [0.62, 0.5, 0.58, 0.55, 0.3, 0.25][i]!, flat: [0.25, 0.3, 0.22, 0.3, 0.4, 0.35][i]!, neg: [0.13, 0.2, 0.2, 0.15, 0.3, 0.4][i]!, share: 0.97, comparable: true }),
    moves: { sum, up: movers(byPoints.filter((h) => h.ret > 0).slice(0, BASKET_MOVERS)), down: movers(byPoints.filter((h) => h.ret < 0).reverse().slice(0, BASKET_MOVERS)) },
    holdings, series,
    badges: metricDemo({ ticker: tracker, metrics: [...SECTOR_BADGES] }),
    faq: [{ q: `What are the largest ${p.sector} stocks?`, a: `The largest of the ${holdings.length} ${p.sector} companies on pretickt are ${holdings[0]!.name} and ${holdings[1]!.name}.` }],
  };
}

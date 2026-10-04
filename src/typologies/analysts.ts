import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, DEMO_FIRMS, IsoDate, prng, round, Ticker, cmp } from './common';

export const AnalystsParams = z.object({ ticker: Ticker, window: z._default(z.enum(['1y', '2y']), '1y') });
const Counts = z.object({ strongBuy: z.number(), buy: z.number(), hold: z.number(), sell: z.number(), strongSell: z.number(), period: IsoDate });
export const AnalystsPayload = z.object({
  asOf: IsoDate,
  /** Last close (raw, not dividend-adjusted). */
  price: z.nullable(z.number()),
  /** Computed in our own basis from the latest target of each firm in the last 12 months. */
  summary: z.nullable(z.object({ low: z.number(), mean: z.number(), median: z.number(), high: z.number(), n: z.int() })),
  consensus: z.nullable(Counts),
  history: z.array(Counts),
  /** Every target published in the window, oldest first. */
  targets: z.array(z.object({ date: IsoDate, firm: z.string(), target: z.number(), priceWhenPosted: z.nullable(z.number()) })),
  /** Per-firm hit rate. Empty until the accuracy job ships (a later catalogue addition). */
  accuracy: z.array(z.object({ firm: z.string(), hits: z.int(), total: z.int() })),
});
export type AnalystsParams = z.output<typeof AnalystsParams>;
export type Analysts = z.infer<typeof AnalystsPayload>;

export const analystsSamples: z.input<typeof AnalystsParams>[] = [{ ticker: 'NVDA' }];

/** Median of a non-empty list (the analysts@1 summary, wherever it is computed). */
export function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length / 2;
  return v.length % 2 ? v[Math.floor(mid)]! : (v[mid - 1]! + v[mid]!) / 2;
}

export function analystsDemo(p: AnalystsParams): Analysts {
  const r = prng(`${p.ticker}:analysts`);
  const price = round(100 + r() * 200);
  const days = p.window === '1y' ? 360 : 720;
  const targets = Array.from({ length: 16 }, (_, i) => {
    const date = addDays(DEMO_ASOF, -Math.floor(r() * days));
    const pwp = round(price * (0.8 + r() * 0.3));
    return { date, firm: DEMO_FIRMS[i % DEMO_FIRMS.length]!, target: round(pwp * (0.9 + r() * 0.5)), priceWhenPosted: pwp };
  }).sort((a, b) => cmp(a.date, b.date) || cmp(a.firm, b.firm));
  const latest = new Map<string, number>();
  for (const t of targets) latest.set(t.firm, t.target);
  const vals = [...latest.values()].sort((a, b) => a - b);
  const counts = (period: string) => ({ strongBuy: Math.floor(r() * 30), buy: Math.floor(r() * 15), hold: Math.floor(r() * 8), sell: Math.floor(r() * 2), strongSell: 0, period });
  const history = Array.from({ length: 12 }, (_, i) => counts(`${addDays(DEMO_ASOF, -30 * (11 - i)).slice(0, 7)}-01`));
  return {
    asOf: DEMO_ASOF, price,
    summary: { low: vals[0]!, mean: round(vals.reduce((s, v) => s + v, 0) / vals.length), median: round(median(vals)), high: vals.at(-1)!, n: vals.length },
    consensus: history.at(-1)!, history, targets, accuracy: [],
  };
}

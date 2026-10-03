import * as z from 'zod/mini';
import { DEMO_ASOF, IsoDate, prng, round, Ticker } from './common';

/** Ranked lists of companies (market movers, 52-week extremes, undervalued, insider buying) and peer groups. */
export const SCREEN_LISTS = ['biggest_losers', 'biggest_gainers', '52w_low', '52w_high', 'undervalued', 'insider_buying', 'most_active'] as const;
export type ScreenList = (typeof SCREEN_LISTS)[number];

export const ScreenParams = z.object({
  scope: z.union([z.object({ list: z.enum(SCREEN_LISTS) }), z.object({ peersOf: Ticker })]),
  limit: z._default(z.int().check(z.minimum(1), z.maximum(50)), 25),
});
const n = z.nullable(z.number());
export const ScreenRow = z.object({
  ticker: Ticker, name: z.string(), sector: z.nullable(z.string()), logo: z.nullable(z.string()),
  close: n, chg1d: n, offHigh: n, pe: n, ptUpside: n, marketCap: n, insiderNet: n, volumeRatio: n,
  /** Last 20 adjusted closes, oldest first, for a sparkline. */
  spark: z.array(z.number()),
  /** True for the subject of a peer list. */
  self: z.boolean(),
});
export const ScreenPayload = z.object({ asOf: IsoDate, rows: z.array(ScreenRow) });
export type ScreenRow = z.infer<typeof ScreenRow>;
export type Screen = z.infer<typeof ScreenPayload>;

const DEMO = [['AAPL', 'Apple Inc.'], ['MSFT', 'Microsoft Corporation'], ['NVDA', 'NVIDIA Corporation'], ['AMZN', 'Amazon.com, Inc.'],
  ['META', 'Meta Platforms, Inc.'], ['AVGO', 'Broadcom Inc.'], ['AMD', 'Advanced Micro Devices, Inc.'], ['INTC', 'Intel Corporation'],
  ['KO', 'The Coca-Cola Company'], ['BRK.B', 'Berkshire Hathaway Inc.']] as const;

export function screenDemo(p: z.infer<typeof ScreenParams>): Screen {
  const seed = 'list' in p.scope ? p.scope.list : `peers:${p.scope.peersOf}`;
  const r = prng(`screen:${seed}`);
  const rows = DEMO.slice(0, Math.min(p.limit, DEMO.length)).map(([ticker, name], i) => {
    let c = 100 + r() * 300;
    const spark = Array.from({ length: 20 }, () => (c = round(c * (1 + (r() - 0.5) * 0.04))));
    return { ticker: 'peersOf' in p.scope && i === 0 ? p.scope.peersOf : ticker, name, sector: 'Technology', logo: null, close: spark.at(-1)!,
      chg1d: round((r() - 0.5) * 0.1, 4), offHigh: round(-r() * 0.4, 4), pe: round(10 + r() * 40, 1), ptUpside: round(r() * 0.4 - 0.05, 4),
      marketCap: round(1e10 + r() * 3e12, 0), insiderNet: round((r() - 0.5) * 1e8, 0), volumeRatio: round(0.5 + r() * 2, 2), spark,
      self: 'peersOf' in p.scope && i === 0 };
  });
  return { asOf: DEMO_ASOF, rows };
}

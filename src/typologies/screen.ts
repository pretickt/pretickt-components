import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, intParam, IsoDate, Num as n, prng, round, Ticker } from './common';
import { SECTORS } from './values';

/** Ranked lists of companies (market movers, 52-week extremes, undervalued, insider buying, the largest) and peer groups. */
export const SCREEN_LISTS = ['biggest_losers', 'biggest_gainers', '52w_low', '52w_high', 'undervalued', 'insider_buying', 'most_active', 'largest'] as const;
export type ScreenList = (typeof SCREEN_LISTS)[number];

/** Up to every company of the universe (518 today): "Show 20 more" grows a list to its end. */
export const SCREEN_MAX = 600;
export const ScreenParams = z.object({
  // a list may keep to one sector (sector pages); peers already share their subject's sector
  scope: z.union([z.strictObject({ list: z.enum(SCREEN_LISTS), sector: z.optional(z.enum(SECTORS)) }), z.strictObject({ peersOf: Ticker })]),
  limit: intParam(1, SCREEN_MAX, 25),
});
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
export type ScreenParams = z.output<typeof ScreenParams>;
export type Screen = z.infer<typeof ScreenPayload>;

export const screenSamples: z.input<typeof ScreenParams>[] = [{ scope: { list: 'biggest_losers' } }, { scope: { peersOf: 'NVDA' }, limit: 8 }, { scope: { list: 'undervalued' }, limit: 25 }];

export function screenDemo(p: ScreenParams): Screen {
  const seed = 'list' in p.scope ? `${p.scope.list}:${p.scope.sector ?? ''}` : `peers:${p.scope.peersOf}`;
  const sector = ('list' in p.scope && p.scope.sector) || 'Technology';
  const r = prng(`screen:${seed}`);
  const rows = DEMO_COMPANIES.slice(0, Math.min(p.limit, 10)).map(([ticker, name], i) => {
    let c = 100 + r() * 300;
    const spark = Array.from({ length: 20 }, () => (c = round(c * (1 + (r() - 0.5) * 0.04))));
    return { ticker: 'peersOf' in p.scope && i === 0 ? p.scope.peersOf : ticker, name, sector, logo: null, close: spark.at(-1)!,
      chg1d: round((r() - 0.5) * 0.1, 4), offHigh: round(-r() * 0.4, 4), pe: round(10 + r() * 40, 1), ptUpside: round(r() * 0.4 - 0.05, 4),
      marketCap: round(1e10 + r() * 3e12, 0), insiderNet: round((r() - 0.5) * 1e8, 0), volumeRatio: round(0.5 + r() * 2, 2), spark,
      self: 'peersOf' in p.scope && i === 0 };
  });
  return { asOf: DEMO_ASOF, rows };
}

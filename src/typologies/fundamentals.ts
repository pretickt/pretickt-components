import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, intParam, IsoDate, Num as n, prng, round, Ticker } from './common';

/** Quarterly fundamentals, oldest first: raw material for derived badges (growth, margins, valuation history). */
export const FundamentalsParams = z.object({ ticker: Ticker, periods: intParam(1, 40, 12) });
export const FundamentalsPayload = z.object({
  asOf: IsoDate,
  periods: z.array(z.object({
    period: IsoDate, // fiscal period end
    fiscal: z.string(), // e.g. "Q2 FY27"
    revenue: n, eps: n, fcf: n,
    grossMargin: n, operatingMargin: n, netMargin: n,
    pe: n, shares: n,
  })),
});
export type FundamentalsParams = z.output<typeof FundamentalsParams>;
export type Fundamentals = z.infer<typeof FundamentalsPayload>;

export const fundamentalsSamples: z.input<typeof FundamentalsParams>[] = [{ ticker: 'NVDA' }, { ticker: 'BRK.B', periods: 4 }];

export function fundamentalsDemo(p: FundamentalsParams): Fundamentals {
  const r = prng(`${p.ticker}:fundamentals`);
  let rev = 1e9 + r() * 4e10;
  const periods = Array.from({ length: p.periods }, (_, i) => {
    rev *= 1 + (r() - 0.4) * 0.1;
    const q = ((i % 4) + 1);
    return {
      period: addDays(DEMO_ASOF, -91 * (p.periods - i)), fiscal: `Q${q} FY${26 + Math.floor(i / 4)}`,
      revenue: round(rev, 0), eps: round(0.5 + r() * 3), fcf: round(rev * (0.05 + r() * 0.25), 0),
      grossMargin: round(0.3 + r() * 0.5, 4), operatingMargin: round(0.1 + r() * 0.3, 4), netMargin: round(0.05 + r() * 0.25, 4),
      pe: round(10 + r() * 40, 2), shares: round(1e9 + r() * 1e10, 0),
    };
  });
  return { asOf: DEMO_ASOF, periods };
}

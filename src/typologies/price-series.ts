import * as z from 'zod/mini';
import { DEMO_ASOF, IsoDate, prng, Range, RANGE_SESSIONS, round, sessionsBack, Ticker } from './common';

export const PriceSeriesParams = z.object({
  tickers: z.array(Ticker).check(z.minLength(1), z.maxLength(8)),
  range: Range,
  /** Only daily bars until FMP confirms the licence for intraday (spec §11.1). */
  interval: z._default(z.literal('1d'), '1d'),
  /** Divide every price by the first close of the window (1.0 = start). */
  rebase: z._default(z.boolean(), false),
});
export const Bar = z.object({ t: IsoDate, o: z.number(), h: z.number(), l: z.number(), c: z.number(), v: z.number() });
/** Per ticker, its last N sessions (N from the range), oldest first. */
export const PriceSeriesPayload = z.array(z.object({ ticker: Ticker, points: z.array(Bar) }));
export type PriceSeriesParams = z.output<typeof PriceSeriesParams>;
/** One adjusted daily bar. Points are oldest first. */
export type PriceBar = z.infer<typeof Bar>;
export type PriceSeries = z.infer<typeof PriceSeriesPayload>;

export const priceSeriesSamples: z.input<typeof PriceSeriesParams>[] = [{ tickers: ['NVDA'], range: '1y' }, { tickers: ['AAPL', 'MSFT'], range: '1m', rebase: true }];

export function priceSeriesDemo(p: PriceSeriesParams): PriceSeries {
  const days = sessionsBack(DEMO_ASOF, RANGE_SESSIONS[p.range]);
  return p.tickers.map((ticker) => {
    const r = prng(`${ticker}:series`);
    let c = 50 + r() * 300;
    const points = days.map((t) => {
      const o = c;
      c = Math.max(1, c * (1 + (r() - 0.48) * 0.04));
      const h = Math.max(o, c) * (1 + r() * 0.01);
      const l = Math.min(o, c) * (1 - r() * 0.01);
      return { t, o: round(o), h: round(h), l: round(l), c: round(c), v: Math.round(1e6 + r() * 5e7) };
    });
    if (!p.rebase) return { ticker, points };
    const base = points[0]!.c;
    return { ticker, points: points.map((b) => ({ ...b, o: round(b.o / base, 4), h: round(b.h / base, 4), l: round(b.l / base, 4), c: round(b.c / base, 4) })) };
  });
}

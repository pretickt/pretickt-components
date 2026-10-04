import * as z from 'zod/mini';
import { DEMO_ASOF, demoName, HttpUrl, IsoDate, prng, round, Ticker } from './common';

/**
 * Why did the stock move: the stock's return split into market (SPY), sector excess and stock-specific parts.
 * market + sector + specific = ret, by construction. Answers "why is X down today" (spec §4).
 */
export const MoveWindow = z.enum(['1d', '5d', '1m']);
export const MoveBreakdownParams = z.object({ ticker: Ticker, window: z._default(MoveWindow, '1d') });
export const MoveBreakdownPayload = z.object({
  asOf: IsoDate,
  ticker: Ticker,
  name: z.string(),
  sectorName: z.nullable(z.string()),
  window: MoveWindow,
  from: IsoDate,
  /** Fractions: 0.012 = +1.2%. */
  ret: z.number(), marketRet: z.number(), sectorRet: z.nullable(z.number()),
  market: z.number(), sector: z.number(), specific: z.number(),
  /** Which part explains most of the move. */
  driver: z.enum(['market', 'sector', 'stock']),
  /** Stories on the as-of day versus the 30-day daily average. */
  news: z.object({ today: z.int(), avg30: z.number(), spike: z.boolean(),
    top: z.array(z.object({ title: z.string(), site: z.string(), url: HttpUrl, sentiment: z.nullable(z.number()) })) }),
});
export type MoveBreakdownParams = z.output<typeof MoveBreakdownParams>;
export type MoveBreakdown = z.infer<typeof MoveBreakdownPayload>;

export const moveBreakdownSamples: z.input<typeof MoveBreakdownParams>[] = [{ ticker: 'NVDA' }, { ticker: 'BRK.B', window: '5d' }];

export function driverOf(market: number, sector: number, specific: number): 'market' | 'sector' | 'stock' {
  const a = [Math.abs(market), Math.abs(sector), Math.abs(specific)];
  const i = a.indexOf(Math.max(...a));
  return i === 0 ? 'market' : i === 1 ? 'sector' : 'stock';
}

export function moveBreakdownDemo(p: MoveBreakdownParams): MoveBreakdown {
  const r = prng(`${p.ticker}:move:${p.window}`);
  const k = p.window === '1d' ? 1 : p.window === '5d' ? 2.2 : 4.5;
  const marketRet = round((r() - 0.5) * 0.02 * k, 5);
  const sectorRet = round(marketRet + (r() - 0.5) * 0.02 * k, 5);
  const ret = round(sectorRet + (r() - 0.5) * 0.03 * k, 5);
  const market = marketRet, sector = round(sectorRet - marketRet, 5);
  const specific = ret - market - sector;
  const today = Math.floor(r() * 12);
  return {
    asOf: DEMO_ASOF, ticker: p.ticker, name: demoName(p.ticker), sectorName: 'Technology', window: p.window, from: '2026-09-29',
    ret, marketRet, sectorRet, market, sector, specific, driver: driverOf(market, sector, specific),
    news: { today, avg30: round(2 + r() * 3, 1), spike: today >= 4,
      top: Array.from({ length: Math.min(today, 3) }, (_, i) => ({ title: `${p.ticker} demo story ${i + 1}`, site: 'Reuters', url: `https://example.com/${i}`, sentiment: round(r() * 2 - 1, 2) })) },
  };
}

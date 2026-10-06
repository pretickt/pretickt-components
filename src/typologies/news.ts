import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, HttpUrl, intParam, IsoDate, prng, round, Ticker } from './common';

/** Recent headlines, newest first. `sentiment` (−1…+1) is classified by AI per story; never prose. */
export const NewsParams = z.object({ ticker: Ticker, limit: intParam(1, 50, 20) });
export const NewsPayload = z.object({
  asOf: IsoDate,
  items: z.array(z.object({
    publishedAt: z.string(), title: z.string(), site: z.string(), url: HttpUrl, sentiment: z.nullable(z.number()),
  })),
});
export type NewsParams = z.output<typeof NewsParams>;
export type News = z.infer<typeof NewsPayload>;

/** |sentiment| at or below this reads as neutral: no coloured dot, a flat tone (badge, headlines, why-today). */
export { SENTIMENT_FLAT } from './values';

export const newsSamples: z.input<typeof NewsParams>[] = [{ ticker: 'NVDA' }, { ticker: 'AAPL', limit: 5 }];

export function newsDemo(p: NewsParams): News {
  const r = prng(`${p.ticker}:news`);
  const items = Array.from({ length: Math.min(p.limit, 8) }, (_, i) => ({
    publishedAt: `${addDays(DEMO_ASOF, -Math.floor(i / 3))}T${String(13 + (i % 8)).padStart(2, '0')}:00:00Z`,
    title: `${p.ticker} demo headline ${i + 1}`, site: ['Reuters', 'Barrons', 'TheFly'][i % 3]!,
    url: `https://example.com/${p.ticker.toLowerCase()}/${i + 1}`, sentiment: round(r() * 2 - 1, 2),
  }));
  return { asOf: DEMO_ASOF, items };
}

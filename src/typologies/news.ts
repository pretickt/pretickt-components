import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, HttpUrl, IsoDate, prng, round, Ticker } from './common';

/** Recent headlines, newest first. `sentiment` (−1…+1) is classified by AI per story; never prose. */
export const NewsParams = z.object({ ticker: Ticker, limit: z._default(z.int().check(z.minimum(1), z.maximum(50)), 20) });
export const NewsPayload = z.object({
  asOf: IsoDate,
  items: z.array(z.object({
    publishedAt: z.string(), title: z.string(), site: z.string(), url: HttpUrl, sentiment: z.nullable(z.number()),
  })),
});
export type News = z.infer<typeof NewsPayload>;

export function newsDemo(p: z.infer<typeof NewsParams>): News {
  const r = prng(`${p.ticker}:news`);
  const items = Array.from({ length: Math.min(p.limit, 8) }, (_, i) => ({
    publishedAt: `${addDays(DEMO_ASOF, -Math.floor(i / 3))}T${String(13 + (i % 8)).padStart(2, '0')}:00:00Z`,
    title: `${p.ticker} demo headline ${i + 1}`, site: ['Reuters', 'Barrons', 'TheFly'][i % 3]!,
    url: `https://example.com/${p.ticker.toLowerCase()}/${i + 1}`, sentiment: round(r() * 2 - 1, 2),
  }));
  return { asOf: DEMO_ASOF, items };
}

import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, intParam, IsoDate, Num as n, prng, round, Ticker } from './common';

/**
 * How much a company was talked about on the session's day, against its usual day, with the day's move and its size: a heat map's
 * tiles sized by attention instead of market value (pt-logo-map). "news": its news stories on the session's day (New York time)
 * against its average over the 20 weekdays before.
 */
export const ATTENTION_LENSES = ['news'] as const;
export type AttentionLens = (typeof ATTENTION_LENSES)[number];

export const AttentionParams = z.object({ lens: z.enum(ATTENTION_LENSES), limit: intParam(1, 100, 40) });
export const AttentionRow = z.object({
  ticker: Ticker, name: z.string(), sector: z.nullable(z.string()), logo: z.nullable(z.string()),
  /** Its stories on the day. */
  count: z.int(),
  /** Its average day over the weekdays before; null without one. */
  usual: n,
  chg1d: n, marketCap: n,
});
/** The most talked about first (ties by ticker); `asOf` is the day counted. */
export const AttentionPayload = z.object({ asOf: IsoDate, lens: z.enum(ATTENTION_LENSES), rows: z.array(AttentionRow) });
export type AttentionRow = z.infer<typeof AttentionRow>;
export type AttentionParams = z.output<typeof AttentionParams>;
export type Attention = z.infer<typeof AttentionPayload>;

export const attentionSamples: z.input<typeof AttentionParams>[] = [{ lens: 'news' }, { lens: 'news', limit: 10 }];

export function attentionDemo(p: AttentionParams): Attention {
  const r = prng(`attention:${p.lens}`);
  const sectors = ['Technology', 'Communication Services', 'Consumer Cyclical', 'Financial Services', 'Healthcare'];
  const rows = DEMO_COMPANIES.slice(0, Math.min(p.limit, DEMO_COMPANIES.length)).map(([ticker, name], i) => {
    const usual = round(2 + r() * 10, 1);
    return { ticker, name, sector: sectors[i % sectors.length]!, logo: null, count: Math.round(usual * (0.6 + r() * 3)) + 1, usual,
      chg1d: round((r() - 0.5) * 0.08, 4), marketCap: round(5e10 + r() * 3e12, 0) };
  });
  return { asOf: DEMO_ASOF, lens: p.lens, rows: rows.sort((a, b) => b.count - a.count || (a.ticker < b.ticker ? -1 : 1)) };
}

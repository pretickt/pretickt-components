import * as z from 'zod/mini';

/** US tickers as the platform stores them: uppercase, share classes with a dot (BRK.B). Never '^'. */
export const Ticker = z.string().check(z.regex(/^[A-Z][A-Z0-9]{0,5}(\.[A-Z])?$/, 'invalid ticker'));
export const IsoDate = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
export const Month = z.string().check(z.regex(/^\d{4}-(0[1-9]|1[0-2])$/));
export const Range = z.enum(['1m', '3m', '6m', '1y', '2y', '5y']);
export type Range = z.infer<typeof Range>;
export const RANGE_SESSIONS: Record<Range, number> = { '1m': 21, '3m': 63, '6m': 126, '1y': 252, '2y': 504, '5y': 1260 };
export const ToneSchema = z.enum(['pos', 'neg', 'flat', 'na']);

/** Demo data is anchored to a fixed session so it never depends on the clock. */
export const DEMO_ASOF = '2026-09-30';

/** Deterministic PRNG (FNV-1a seed → mulberry32). */
export function prng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dayMs = 86_400_000;
export const addDays = (iso: string, n: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** The `count` weekday sessions ending at `asOf` (inclusive), oldest first. Holidays are ignored in demo data. */
export function sessionsBack(asOf: string, count: number): string[] {
  const out: string[] = [];
  for (let d = asOf; out.length < count; d = addDays(d, -1)) if (weekday(d) % 6 !== 0) out.push(d);
  return out.reverse();
}

export const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

/** An absolute http(s) URL: links in payloads come from third parties, and no other scheme may reach an href. */
export const HttpUrl = z.string().check(z.regex(/^https?:\/\/[^\s"'<>]+$/i));

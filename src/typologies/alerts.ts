import * as z from 'zod/mini';
import { CONDITION_IDS, type ConditionId } from '../alerts/catalog';
import { MOCK_UNIVERSE } from '../alerts/mock';
import { DEMO_ASOF, IsoDate, Num, Ticker } from './common';

/**
 * The email alerts' data (spec pretickt/docs/superpowers/specs/2026-11-01-email-alerts-design.md §3, §7).
 * `alert-universe@1`: every company of the site with its last two closes and the numbers each condition of the catalog tests (the
 * editor's "Today: N of M" and its cards; the check on the VM reads the same rows) — once a day, cached at the edge.
 * `alert-event@1`: an alert that fired, by the id its email carries — the alert's name, the company, the session and the time, each
 * condition's value then; never who set it (alerts.public_events).
 */
export const AlertUniverseParams = z.object({});
export const AlertUniverseRow = z.object({
  ticker: Ticker, name: z.string(), logo: z.nullable(z.string()), sector: z.nullable(z.string()), marketCap: Num,
  close: z.number(), prevClose: Num,
  ma20: Num, ma50: Num, ma100: Num, ma200: Num,
  low52: Num, high52: Num, volumeRatio: Num,
  /** P/E ÷ the sector's median − 1 */
  peVsSector: Num,
  undervalued: z.boolean(), ptUpside: Num, piotroski: Num,
  /** the 9 Piotroski checks, F-score order (PIOTROSKI_CHECKS) */
  checks: z.nullable(z.array(z.nullable(z.boolean()))),
  /** EPS surprise of the last ≤ 4 reports, oldest first */
  surprises: z.nullable(z.array(z.number())),
  /** the date of the newest of those reports */
  lastReport: z.nullable(IsoDate),
  insiderNet90: Num, earningsDate: z.nullable(IsoDate),
  grade: z.nullable(z.object({ dir: z.enum(['up', 'down']), date: IsoDate, firm: z.string() })),
  news: Num, newsUsual: Num, social: Num, socialUsual: Num,
});
export const AlertUniversePayload = z.object({ asOf: IsoDate, rows: z.array(AlertUniverseRow) });
export type AlertUniverseParams = z.output<typeof AlertUniverseParams>;
export const alertUniverseSamples: z.input<typeof AlertUniverseParams>[] = [{}];
/** The made-up universe of the stories (src/alerts/mock.ts). */
export const alertUniverseDemo = (_p: AlertUniverseParams): z.infer<typeof AlertUniversePayload> => MOCK_UNIVERSE;

/** The id an alert's email carries: random, URL-safe, not guessable. */
export const AlertEventParams = z.object({ id: z.string().check(z.regex(/^[A-Za-z0-9_-]{16,40}$/, 'invalid alert id')) });
export const AlertEventPayload = z.object({
  id: z.string(), name: z.string(), ticker: Ticker, companyName: z.string(), logo: z.nullable(z.string()),
  /** the New York session it fired in, and the time in the reader's words ("3:45 PM ET") */
  session: IsoDate, firedAt: z.string(),
  conditions: z.array(z.object({
    c: z.enum(CONDITION_IDS as [ConditionId, ...ConditionId[]]), p: z.record(z.string(), z.union([z.string(), z.number()])), value: Num,
  })),
});
export type AlertEventParams = z.output<typeof AlertEventParams>;
export type AlertEvent = z.infer<typeof AlertEventPayload>;
export const alertEventSamples: z.input<typeof AlertEventParams>[] = [{ id: 'AbCdEf0123456789_-xy' }];
/** Romeo's example (2026-11-01): a mega cap fell more than 5% in a session, far under its 50-day average. */
export function alertEventDemo(p: AlertEventParams): AlertEvent {
  return { id: p.id, name: 'Mega-cap drops', ticker: 'AMD', companyName: 'Advanced Micro Devices, Inc.', logo: null, session: DEMO_ASOF,
    firedAt: '3:45 PM ET', conditions: [
      { c: 'session-move', p: { dir: 'down', pct: 5 }, value: -0.079 },
      { c: 'below-average', p: { dir: 'below', pct: 15, days: '50' }, value: -0.24 },
      { c: 'mega-caps', p: {}, value: 310e9 },
    ] };
}

import { CONDITIONS } from './catalog';
import { matches, type Rule } from './rule';
import type { AlertRow, AlertUniverseRow } from './rows';

/** A company on a past session as the nightly saw it (`alerts.universe_days`, platform), with the session's low and high. */
export interface AlertHistoryRow extends AlertUniverseRow { low: number | null; high: number | null }
export interface AlertHistoryDay { session: string; rows: AlertHistoryRow[] }
/** The last sessions, oldest first. */
export type AlertHistory = AlertHistoryDay[];
/** The emails a rule would have sent over the sessions replayed, and that pace over a month of 21 sessions. */
export interface Estimate { emails: number; sessions: number; perMonth: number }

export const MONTH_SESSIONS = 21;
/** an alert's emails a day before the rest waits for the evening summary (the check's CAPS.perRule, platform) */
const PER_RULE = 3;
const WEEK = 7 * 86_400_000;

const at = (day: AlertHistoryDay, pick: (r: AlertHistoryRow) => number | null): AlertRow[] => day.rows.map((r) => {
  const price = pick(r) ?? r.close;
  return { ...r, session: day.session, live: false, price, move: r.prevClose ? price / r.prevClose - 1 : null };
});
const tickers = (rule: Rule, rows: AlertRow[]) => new Set(matches(rule, rows).map((r) => r.ticker));

/**
 * The editor's "Last month it would have sent about N emails" (spec §5): the rule replayed on whole sessions with the check's rules.
 * The first session only says who met it before. A stock comes in when, at the session's low, high or close, it meets the rule and
 * did not at the close before — or it met it then, fell out during the session and closed in again; a condition on the session's own
 * numbers starts again each session. At most once a day per stock, once a week with `once: 'week'`. A rule with a condition read
 * during the session sends an email per stock that comes in, up to 3, plus the evening summary for the rest (the worst case: the
 * check's 5-minute rounds may put several in one email); a rule of the nightly's numbers alone, one email after the nightly.
 * Null without two sessions.
 */
export function estimate(rule: Rule, history: AlertHistory): Estimate | null {
  if (history.length < 2) return null;
  const intraday = rule.all.some((rc) => CONDITIONS[rc.c]?.freq === 'intraday');
  const perSession = rule.all.some((rc) => CONDITIONS[rc.c]?.perSession);
  const last = new Map<string, number>();
  let before = tickers(rule, at(history[0]!, (r) => r.close));
  let emails = 0;
  for (const day of history.slice(1)) {
    const close = tickers(rule, at(day, (r) => r.close));
    const low = intraday ? tickers(rule, at(day, (r) => r.low)) : close;
    const high = intraday ? tickers(rule, at(day, (r) => r.high)) : close;
    const t = Date.parse(day.session);
    let came = 0;
    for (const s of new Set([...close, ...low, ...high])) {
      const out = !close.has(s) || !low.has(s) || !high.has(s);
      const comes = perSession || !before.has(s) || (out && close.has(s));
      if (!comes) continue;
      const prev = last.get(s);
      if (rule.once === 'week' && prev !== undefined && t - prev < WEEK) continue;
      last.set(s, t);
      came++;
    }
    emails += !came ? 0 : intraday ? Math.min(came, PER_RULE) + (came > PER_RULE ? 1 : 0) : 1;
    before = close;
  }
  const sessions = history.length - 1;
  return { emails, sessions, perMonth: Math.round((emails * MONTH_SESSIONS) / sessions) };
}

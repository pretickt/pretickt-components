// Made-up sessions for the stories' estimate: never real data. The made-up universe walked back 21 sessions, seeded per ticker.
import { prng, round } from '../typologies/common';
import type { AlertHistory, AlertHistoryRow } from './estimate';
import { MOCK_UNIVERSE } from './mock';

const SESSIONS = 22;

/** The weekdays up to the universe's session, oldest first. */
function sessions(asOf: string, n: number): string[] {
  const out: string[] = [];
  for (let t = Date.parse(asOf); out.length < n; t -= 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) out.unshift(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Each made-up company's last 22 sessions ending on the universe's own (its close and previous close): moves of about 2% a session,
 * a low and a high around them, its averages and 52-week range as the universe has them, stories and posts that jump on some days.
 */
function build(): AlertHistory {
  const days = sessions(MOCK_UNIVERSE.asOf, SESSIONS);
  const paths = MOCK_UNIVERSE.rows.map((r) => {
    const rnd = prng(`history-${r.ticker}`);
    const n = () => (rnd() + rnd() + rnd() - 1.5) * 2;   // about normal, sd 1
    const close: number[] = Array(SESSIONS).fill(r.close);
    close[SESSIONS - 2] = r.prevClose ?? r.close;
    for (let d = SESSIONS - 3; d >= 0; d--) close[d] = close[d + 1]! / (1 + 0.02 * n());
    return { r, rnd, n, close };
  });
  return days.map((session, d) => ({
    session,
    rows: paths.map(({ r, rnd, n, close }): AlertHistoryRow => {
      const c = close[d]!, prev = d ? close[d - 1]! : null, last = d === SESSIONS - 1;
      const lo = Math.min(c, prev ?? c) * (1 - 0.008 * Math.abs(n())), hi = Math.max(c, prev ?? c) * (1 + 0.008 * Math.abs(n()));
      const spike = rnd() < 0.06 ? 3 + 4 * rnd() : 0.5 + rnd();
      return { ...r, close: round(c, 2), prevClose: prev === null ? null : round(prev, 2), low: round(lo, 2), high: round(hi, 2),
        news: last ? r.news : Math.round((r.newsUsual ?? 2) * spike), social: last ? r.social : Math.round((r.socialUsual ?? 10) * spike),
        volumeRatio: last ? r.volumeRatio : round(spike * 0.9, 2), grade: last ? r.grade : null };
    }),
  }));
}

let memo: AlertHistory | null = null;
export const mockHistory = (): AlertHistory => (memo ??= build());

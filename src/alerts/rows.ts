import type { LiveDay } from '../context/live';

/**
 * One company as the alerts read it from the nightly (typology `alert-universe@1`, platform): the last close and the numbers each
 * condition of the catalog tests. Missing numbers are null: a condition on them never passes.
 */
export interface AlertUniverseRow {
  ticker: string; name: string; logo: string | null; sector: string | null; marketCap: number | null;
  close: number; prevClose: number | null;
  ma20: number | null; ma50: number | null; ma100: number | null; ma200: number | null;
  low52: number | null; high52: number | null; volumeRatio: number | null;
  /** P/E ÷ the sector's median − 1 (fraction) */
  peVsSector: number | null;
  undervalued: boolean; ptUpside: number | null; piotroski: number | null;
  /** the 9 Piotroski checks, F-score order */
  checks: (boolean | null)[] | null;
  /** EPS surprise of the last ≤ 4 reports, oldest first, fractions */
  surprises: number[] | null;
  /** the date of the newest of those reports: the live file's result counts only when it is newer */
  lastReport: string | null;
  insiderNet90: number | null; earningsDate: string | null;
  grade: { dir: 'up' | 'down'; date: string; firm: string } | null;
  news: number | null; newsUsual: number | null; social: number | null; socialUsual: number | null;
}
export interface AlertUniverse { asOf: string; rows: AlertUniverseRow[] }
/** A company as the conditions test it: the last session's numbers, or today's (15-min delayed) when a newer live day has them. */
export interface AlertRow extends AlertUniverseRow { session: string; live: boolean; price: number; move: number | null }
export type LiveInput = Pick<LiveDay, 'session' | 'q' | 'news' | 'earnings'>;

const SURPRISES = 4;

/** The rows the conditions test: a live day counts only when its session is newer than the universe's. */
export function rowsOf(u: AlertUniverse, live: LiveInput | null): AlertRow[] {
  const day = live && live.session > u.asOf ? live : null;
  return u.rows.map((r) => {
    const q = day?.q[r.ticker];
    if (!day || !q) {
      return { ...r, session: u.asOf, live: false, price: r.close, move: r.prevClose ? r.close / r.prevClose - 1 : null };
    }
    // a result reported since the previous close, unless the nightly has it already (an after-close report, read the next morning)
    const e = day.earnings[r.ticker];
    const fresh = e && e.eps != null && e.epsEst && (!r.lastReport || e.date > r.lastReport);
    const surprises = fresh ? [...(r.surprises ?? []), (e.eps! - e.epsEst!) / Math.abs(e.epsEst!)].slice(-SURPRISES) : r.surprises;
    const lastReport = fresh ? e.date : r.lastReport;
    // the previous close the live move is measured from (the nightly's is a session older once the day is live)
    return { ...r, session: day.session, live: true, price: q.p, prevClose: q.pc, move: q.r, news: day.news[r.ticker]?.n ?? 0, surprises, lastReport };
  });
}

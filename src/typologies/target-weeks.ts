/**
 * The average target week by week, and each target's previous one (analysts@1 `weekly`, `targets[].prev`): one implementation for the
 * platform's resolver and the demo. Server side only: the page receives the numbers (Romeo, 2026-11-14: «sotto il price target, metti un
 * grafico per visualizzare il price target trend»). The rules are today's figure's: each firm's latest target in the 365 days up to a day.
 */
export interface PostedTarget { date: string; firm: string; target: number }
export interface AverageWeek { t: string; mean: number | null; n: number }

/** A week's mean needs targets from at least this many firms (the funds' and sectors' weeks: basket.ts MIN_FIRMS). */
const MIN_FIRMS = 3;
const WEEKS = 52;
const yearBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
const byDate = (a: PostedTarget, b: PostedTarget) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.firm < b.firm ? -1 : a.firm > b.firm ? 1 : 0);
/** Rows in date then firm order: as given when they already are (the resolver's query orders them), else a sorted copy. */
const inOrder = <T extends PostedTarget>(rows: readonly T[]): readonly T[] => (rows.every((r, i) => !i || byDate(rows[i - 1]!, r) <= 0) ? rows : [...rows].sort(byDate));

/** Every 5th session back from the last one, oldest first, 52 at most: the weeks of the target charts. */
export function weeksOf(sessions: readonly string[], n = WEEKS): string[] {
  const out: string[] = [];
  for (let i = sessions.length - 1; i >= 0 && out.length < n; i -= 5) out.push(sessions[i]!);
  return out.reverse();
}

/**
 * Each target with the same firm's previous one while it still stands (published in the 365 days before), else null: a firm's first
 * target, or one after its last had expired, is neither a raise nor a cut. Rows in date then firm order, the same order out.
 */
export function withPrev<T extends PostedTarget>(rows: readonly T[]): (T & { prev: number | null })[] {
  const last = new Map<string, { day: number; target: number }>();
  return inOrder(rows).map((r) => {
    const before = last.get(r.firm), day = Date.parse(`${r.date}T00:00:00Z`) / 86_400_000;
    last.set(r.firm, { day, target: r.target });
    return { ...r, prev: before && day - before.day < 365 ? before.target : null };
  });
}

/**
 * Each week: its firms' latest targets in the 365 days up to it, averaged (to the cent), and how many firms; null under 3 firms. One pass
 * over the targets for weeks oldest first (the resolver also runs in the Worker on a cache miss: weeks × firms, not weeks × targets).
 */
export function targetWeeks(rows: readonly PostedTarget[], weeks: readonly string[]): AverageWeek[] {
  const sorted = inOrder(rows), latest = new Map<string, PostedTarget>();
  let k = 0, prev = '';
  return weeks.map((t) => {
    if (t < prev) { latest.clear(); k = 0; } // weeks out of order: start over
    prev = t;
    for (; k < sorted.length && sorted[k]!.date <= t; k++) latest.set(sorted[k]!.firm, sorted[k]!);
    const from = yearBefore(t);
    let n = 0, sum = 0;
    for (const r of latest.values()) if (r.date > from) { n++; sum += r.target; }
    return { t, mean: n >= MIN_FIRMS ? Math.round((sum / n) * 100) / 100 : null, n };
  });
}

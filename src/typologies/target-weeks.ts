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
  const last = new Map<string, PostedTarget>();
  return [...rows].sort(byDate).map((r) => {
    const before = last.get(r.firm);
    last.set(r.firm, r);
    return { ...r, prev: before && before.date > yearBefore(r.date) ? before.target : null };
  });
}

/** Each week: its firms' latest targets in the 365 days up to it, averaged (to the cent), and how many firms; null under 3 firms. */
export function targetWeeks(rows: readonly PostedTarget[], weeks: readonly string[]): AverageWeek[] {
  const sorted = [...rows].sort(byDate);
  return weeks.map((t) => {
    const from = yearBefore(t), latest = new Map<string, number>();
    for (const r of sorted) if (r.date > from && r.date <= t) latest.set(r.firm, r.target);
    const n = latest.size;
    return { t, mean: n >= MIN_FIRMS ? Math.round(([...latest.values()].reduce((s, v) => s + v, 0) / n) * 100) / 100 : null, n };
  });
}

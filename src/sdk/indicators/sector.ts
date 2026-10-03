import type { Bar } from './types';

/** Simple moving average of the last `n` closes; null when there are fewer than `n`. */
export function movingAverage(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  const slice = closes.slice(closes.length - n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

/**
 * Equal-weighted, rebased sector index from member price series (each rebased to
 * the first common date, then averaged). Returns [] when too few members/history
 * to be meaningful. Ported from beta (ma-crossover/engine.ts).
 */
export function buildSectorIndex(members: Bar[][], minMembers = 4, minHistory = 200): Bar[] {
  const withHistory = members.filter((m) => m.length >= minHistory);
  if (withHistory.length < minMembers) return [];
  const maps = withHistory.map((m) => new Map(m.map((b) => [b.date, b.close] as [string, number])));
  const common = withHistory[0]!.map((b) => b.date).filter((d) => maps.every((s) => s.has(d))).sort();
  if (common.length < minHistory) return [];
  const base = common[0]!;
  return common.map((d) => {
    const avg = maps.reduce((sum, s) => sum + s.get(d)! / s.get(base)!, 0) / maps.length;
    return { date: d, close: avg * 100 };
  });
}

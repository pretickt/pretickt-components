/** Pure threshold-zigzag segmentation of a close series into drawdowns and drawups. Ported from beta (pretickt-backend/src/companies/swings.ts). */

export interface SwingEpisode {
  kind: 'drawdown' | 'drawup';
  start: string;
  end: string;
  /** Signed % move trough→peak (drawup, positive) or peak→trough (drawdown, negative), in percent (2.5 = +2.5%). */
  magnitude: number;
  days: number;
  /** True for the last episode, still unconfirmed by a θ reversal. */
  ongoing: boolean;
}

interface Pt { date: string; close: number }

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/**
 * Alternating swings with a reversal threshold θ (%): a drawup ends when the price retreats ≥θ from its running peak, a drawdown
 * when it rebounds ≥θ from its running trough. The trailing unconfirmed swing is returned with ongoing=true.
 */
export function zigzag(points: Pt[], thresholdPct = 10): SwingEpisode[] {
  const pts = points.filter((p) => p.close > 0);
  if (pts.length < 2) return [];
  const up = 1 + thresholdPct / 100;
  const dn = 1 - thresholdPct / 100;

  const episodes: SwingEpisode[] = [];
  let dir: 1 | -1 | null = null;
  let pivot = pts[0]!; // confirmed start of the current swing
  let hi = pts[0]!; // running extremes since the pivot
  let lo = pts[0]!;

  const close = (kind: SwingEpisode['kind'], from: Pt, to: Pt, ongoing: boolean) => {
    episodes.push({ kind, start: from.date, end: to.date, magnitude: (to.close / from.close - 1) * 100, days: days(from.date, to.date), ongoing });
  };

  for (const p of pts.slice(1)) {
    if (p.close > hi.close) hi = p;
    if (p.close < lo.close) lo = p;

    if (dir === null) {
      // first confirmation: which extreme got left behind by ≥θ?
      if (p.close >= lo.close * up) { dir = 1; pivot = lo; hi = p; }
      else if (p.close <= hi.close * dn) { dir = -1; pivot = hi; lo = p; }
      continue;
    }
    if (dir === 1 && p.close <= hi.close * dn) {
      close('drawup', pivot, hi, false);
      dir = -1; pivot = hi; lo = p;
    } else if (dir === -1 && p.close >= lo.close * up) {
      close('drawdown', pivot, lo, false);
      dir = 1; pivot = lo; hi = p;
    }
  }

  // trailing unconfirmed swing
  if (dir === 1 && hi.close > pivot.close) close('drawup', pivot, hi, true);
  else if (dir === -1 && lo.close < pivot.close) close('drawdown', pivot, lo, true);
  return episodes;
}

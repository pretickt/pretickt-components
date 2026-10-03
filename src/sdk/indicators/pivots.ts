/**
 * The price line as a sequence of directional vectors: `(duration, signed %)`.
 *
 * Two things make this layer different from `companies/swings.ts::zigzag`, and both are required
 * before anything downstream may be backtested:
 *
 *  1. The reversal threshold is scaled by the ticker's own volatility (θ = k · σ_daily), estimated
 *     on a TRAILING window and frozen per epoch. A fixed 10% yields two legs in five years on KO
 *     and dozens on TSLA, so a pattern would not mean the same thing across the universe.
 *  2. Every pivot carries `knowableFrom`: a zigzag extreme is only recognised once price has moved
 *     θ away from it, days later. A consumer that uses a pivot before that date is reading the
 *     future — the class of look-ahead that once inflated our cross-sectional IC from 0.035 to
 *     0.058. `vectors.spec.ts` pins this down with a prefix-stability property: what this layer
 *     says about the past must never change as more bars arrive.
 */
import type { Bar } from './types';

export interface Pivot {
  idx: number;
  date: string;
  price: number;
  /** Bar on which the θ reversal confirmed this extreme — the first day it could be acted on. */
  knowableIdx: number;
  knowableFrom: string;
  kind: 'peak' | 'trough';
}

export interface Leg {
  from: Pivot;
  to: Pivot;
  /** Sessions between the two pivots. */
  days: number;
  /** Signed % move, negative for a down leg. */
  pct: number;
  up: boolean;
}

export interface VectorSeries {
  pivots: Pivot[];
  legs: Leg[];
}

/** k multipliers on daily σ. Provisional until `npm run vectors:calibrate` fixes them. */
export const SCALES = { fast: 1.5, mid: 3.0, slow: 6.0 } as const;
export type ScaleName = keyof typeof SCALES;

const SIGMA_WINDOW = 252;
const EPOCH_LEN = 126;
/**
 * Shortest history that may carry a σ estimate. The full window is a year; insisting on it before
 * the FIRST estimate meant a company had to be listed a year before the layer would call a single
 * pivot — CoreWeave, 347 sessions since its 2025 IPO, produced zero. Half a year is a noisier
 * estimate of the same quantity, and it is still computed strictly from past bars.
 */
const MIN_SIGMA_WINDOW = 126;

/** Stdev of daily log returns over the `window` bars ending at `endIdx`, in %. */
export function dailySigmaPct(bars: Bar[], endIdx: number, window = SIGMA_WINDOW): number | null {
  const from = endIdx - window + 1;
  if (from < 1) return null;
  const rets: number[] = [];
  for (let i = from; i <= endIdx; i++) {
    const a = bars[i - 1]!.close;
    const b = bars[i]!.close;
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < window / 2) return null;
  const m = rets.reduce((x, y) => x + y, 0) / rets.length;
  const v = rets.reduce((x, y) => x + (y - m) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(v) * 100;
}

/**
 * θ for every bar: recomputed at each epoch boundary from the bars BEFORE it, then held. NaN until
 * `MIN_SIGMA_WINDOW` bars exist, which is what keeps the early series free of pivots rather than
 * pivoting on a threshold borrowed from later data. The estimate uses the full window as soon as
 * there is one, and whatever shorter history there is before that — never anything ahead of `i`,
 * so the prefix-stability property still holds.
 */
function thetaSchedule(bars: Bar[], k: number, window: number, epochLen: number): Float64Array {
  const theta = new Float64Array(bars.length).fill(NaN);
  const first = Math.min(window, MIN_SIGMA_WINDOW);
  let current = NaN;
  for (let i = 0; i < bars.length; i++) {
    if (i >= first && (i - first) % epochLen === 0) {
      // `i - 1` bars of return history exist behind bar i, and dailySigmaPct needs its first
      // return to have a predecessor — asking for the full window at the very first boundary
      // silently returned null, which is why θ used to appear one whole epoch late.
      const s = dailySigmaPct(bars, i - 1, Math.min(window, i - 1));
      if (s != null && s > 0) current = k * s;
    }
    theta[i] = current;
  }
  return theta;
}

export function vectorise(
  bars: Bar[],
  opts: { k: number; sigmaWindow?: number; epochLen?: number },
): VectorSeries {
  const window = opts.sigmaWindow ?? SIGMA_WINDOW;
  const epochLen = opts.epochLen ?? EPOCH_LEN;
  const pts = bars.filter((b) => b.close > 0);
  if (pts.length < Math.min(window, MIN_SIGMA_WINDOW) + 2) return { pivots: [], legs: [] };
  const theta = thetaSchedule(pts, opts.k, window, epochLen);

  const pivots: Pivot[] = [];
  const push = (idx: number, knowableIdx: number, kind: Pivot['kind']) => {
    pivots.push({
      idx,
      date: pts[idx]!.date,
      price: pts[idx]!.close,
      knowableIdx,
      knowableFrom: pts[knowableIdx]!.date,
      kind,
    });
  };

  let dir: 1 | -1 | null = null;
  // Before a direction is confirmed we do not know which extreme will turn out to matter, so BOTH
  // are tracked; the first θ move in either direction settles it.
  let hiIdx = -1;
  let loIdx = -1;

  for (let i = 0; i < pts.length; i++) {
    const th = theta[i];
    if (!Number.isFinite(th) || th! <= 0) continue;
    if (hiIdx < 0) {
      hiIdx = i;
      loIdx = i;
      continue;
    }
    const c = pts[i]!.close;
    if (c > pts[hiIdx]!.close) hiIdx = i;
    if (c < pts[loIdx]!.close) loIdx = i;

    const fellFromHigh = c <= pts[hiIdx]!.close * (1 - th! / 100);
    const roseFromLow = c >= pts[loIdx]!.close * (1 + th! / 100);

    if (dir === null) {
      // whichever extreme got left behind by θ first tells us which way we had been going
      if (roseFromLow) {
        dir = 1;
        hiIdx = i;
      } else if (fellFromHigh) {
        dir = -1;
        loIdx = i;
      }
      continue;
    }
    if (dir === 1 && fellFromHigh) {
      push(hiIdx, i, 'peak'); // that high was a peak, and we learn it only now
      dir = -1;
      loIdx = i;
    } else if (dir === -1 && roseFromLow) {
      push(loIdx, i, 'trough');
      dir = 1;
      hiIdx = i;
    }
  }

  const legs: Leg[] = [];
  for (let i = 1; i < pivots.length; i++) {
    const from = pivots[i - 1]!;
    const to = pivots[i]!;
    legs.push({
      from,
      to,
      days: to!.idx - from!.idx,
      pct: (to!.price / from!.price - 1) * 100,
      up: to!.price > from!.price,
    });
  }
  return { pivots, legs };
}

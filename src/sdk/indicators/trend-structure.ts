/**
 * Trend as market STRUCTURE: higher highs and higher lows, or lower highs and lower lows.
 *
 * The definition has no tuned parameter — no threshold, no volatility scaling, no window length
 * beyond the swing detection itself. It reads the price the way Dow described it a century ago,
 * off the pivots the vector layer already produces.
 *
 * Two rules govern it.
 *
 * **A pivot only counts when it extends its own side.** A peak below the last high is not a new
 * high — it is a failed rally inside the range, and the reference high stays where it is. A trough
 * above the last low is not a new low. The extremes in between change nothing, which is why an
 * uptrend reads as higher highs AND higher lows: when price finally takes out the high, the
 * pullback that preceded it becomes the new reference low, and in an uptrend that low is above the
 * previous one. The mirror gives lower highs with lower lows.
 *
 * **A state change needs two consecutive breaks the same way.** One break the other way only
 * demotes the trend to `sideways`. That hysteresis is the whole point: a label that flips on every
 * other swing is not a context.
 */
import type { Pivot } from './pivots';

export type Trend = 'bullish' | 'bearish' | 'sideways';

export interface TrendState {
  trend: Trend;
  /** Date the current state was entered; null while nothing has been established yet. */
  since: string | null;
  /** The two most recent confirmed highs and lows, oldest first — the evidence on screen. */
  highs: { date: string; price: number }[];
  lows: { date: string; price: number }[];
  /** Confirmed pivots the verdict rests on. */
  pivots: number;
  /** Set when the live price has already taken out the pivot the state rested on. */
  broken: 'above' | 'below' | null;
}

const EMPTY: TrendState = { trend: 'sideways', since: null, highs: [], lows: [], pivots: 0, broken: null };

/**
 * Walk the pivots and return the state as of the last one.
 *
 * `before` restricts the walk to pivots that were KNOWABLE before that date — not merely that
 * happened before it. A zigzag extreme is only recognised once price has moved away from it, so
 * for any as-of question the two are different and only the first is honest.
 */
export function structuralTrend(pivots: Pivot[], before?: string): TrendState {
  const usable = before ? pivots.filter((p) => p.knowableFrom < before) : pivots;
  if (usable.length < 3) return { ...EMPTY, pivots: usable.length };

  type Level = { date: string; price: number };
  // The structure is a pair of reference levels. Only a pivot that EXTENDS its side updates them;
  // the peaks and troughs in between are noise inside the range and change nothing.
  let refHigh: Level | null = null;
  let refLow: Level | null = null;
  // The extreme reached on the other side since the last break — it becomes the new reference
  // when this side breaks, and that is where "higher lows" and "lower highs" come from.
  let pendingLow: Level | null = null;
  let pendingHigh: Level | null = null;

  const highs: Level[] = [];
  const lows: Level[] = [];
  let state: Trend = 'sideways';
  let since: string | null = null;
  let run = 0;
  let runDir = 0;

  for (const p of usable) {
    const level: Level = { date: p.date, price: p.price };
    if (p.kind === 'peak') {
      if (refHigh == null) {
        refHigh = level;
        highs.push(level);
        continue;
      }
      if (p.price <= refHigh.price) {
        // a rally that failed to take out the high: it is not a high, it is the ceiling of the range
        if (pendingHigh == null || p.price > pendingHigh.price) pendingHigh = level;
        continue;
      }
      // BREAK UP: a genuinely higher high. The pullback low that preceded it becomes the new
      // reference low — in an uptrend that low is above the previous one, which is the "higher low".
      refHigh = level;
      highs.push(level);
      if (pendingLow) {
        refLow = pendingLow;
        lows.push(pendingLow);
        pendingLow = null;
      }
      pendingHigh = null;
      run = runDir === 1 ? run + 1 : 1;
      runDir = 1;
    } else {
      if (refLow == null) {
        refLow = level;
        lows.push(level);
        continue;
      }
      if (p.price >= refLow.price) {
        if (pendingLow == null || p.price < pendingLow.price) pendingLow = level;
        continue;
      }
      // BREAK DOWN: a genuinely lower low, and the rally high before it is the new lower high.
      refLow = level;
      lows.push(level);
      if (pendingHigh) {
        refHigh = pendingHigh;
        highs.push(pendingHigh);
        pendingHigh = null;
      }
      pendingLow = null;
      run = runDir === -1 ? run + 1 : 1;
      runDir = -1;
    }

    // Same hysteresis as before: two consecutive breaks the same way establish a trend, one break
    // the other way only demotes it to sideways.
    const next: Trend =
      run >= 2 ? (runDir > 0 ? 'bullish' : 'bearish') : state === 'sideways' ? 'sideways' : sidewaysIfContradicted(state, runDir);
    if (next !== state) {
      state = next;
      since = p.date;
    }
  }

  return {
    trend: state,
    since,
    highs: highs.slice(-2),
    lows: lows.slice(-2),
    pivots: usable.length,
    broken: null,
  };
}

/**
 * Demote a structure the live price has already invalidated.
 *
 * A zigzag pivot is only confirmed once price turns away from it, so between the turn and the
 * confirmation the label describes a market that no longer exists: NVDA on 2026-08-17 read
 * "downtrend" off a lower high at 212.50 while trading at 225.16, six percent above it. The
 * sequence of lower highs ended the moment that level was taken out — waiting for the pivot adds
 * lag, not evidence.
 *
 * This only ever DEMOTES to sideways. Promoting a trend still needs the two confirming pivots:
 * exceeding one high says the old structure is over, not that a new one has formed.
 */
export function applyPrice(s: TrendState, price: number | null): TrendState {
  if (price == null || !Number.isFinite(price)) return s;
  const lastHigh = s.highs.at(-1)?.price ?? null;
  const lastLow = s.lows.at(-1)?.price ?? null;
  if (s.trend === 'bearish' && lastHigh != null && price > lastHigh) {
    return { ...s, trend: 'sideways', broken: 'above' };
  }
  if (s.trend === 'bullish' && lastLow != null && price < lastLow) {
    return { ...s, trend: 'sideways', broken: 'below' };
  }
  return s;
}

/** A single contrary pivot costs you the trend but does not hand it to the other side. */
function sidewaysIfContradicted(state: Trend, ev: number): Trend {
  if (state === 'bullish' && ev < 0) return 'sideways';
  if (state === 'bearish' && ev > 0) return 'sideways';
  return state;
}

/** Human sentence for the badge tooltip — the evidence, not the label. */
export function explainTrend(s: TrendState): string {
  if (s.highs.length < 2 || s.lows.length < 2) return 'Not enough confirmed swings to read a structure yet.';
  const dir = (a: number, b: number) => (b > a ? 'higher' : b < a ? 'lower' : 'equal');
  const h = dir(s.highs[0]!.price, s.highs[1]!.price);
  const l = dir(s.lows[0]!.price, s.lows[1]!.price);
  const label =
    s.broken === 'above'
      ? 'No trend — the price has taken out the last lower high, so the downtrend structure is over'
      : s.broken === 'below'
        ? 'No trend — the price has broken the last higher low, so the uptrend structure is over'
        : s.trend === 'bullish'
          ? 'Uptrend'
          : s.trend === 'bearish'
            ? 'Downtrend'
            : 'No trend — the structure is mixed or broken';
  return (
    `${label}. Last two highs: ${h} (${s.highs[0]!.price.toFixed(2)} → ${s.highs[1]!.price.toFixed(2)}). ` +
    `Last two lows: ${l} (${s.lows[0]!.price.toFixed(2)} → ${s.lows[1]!.price.toFixed(2)}).` +
    (s.since ? ` In this state since ${s.since}.` : '')
  );
}

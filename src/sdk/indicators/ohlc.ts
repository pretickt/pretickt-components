/** OHLCV indicators. Same contract as technical-signals/indicators.ts: pure functions over number
 *  arrays returning an array aligned to the input, `null` during warm-up. */

type A = (number | null)[];

/** max(high−low, |high−prevClose|, |low−prevClose|); bar 0 falls back to high−low. */
export function trueRange(highs: number[], lows: number[], closes: number[]): A {
  const out: A = Array(closes.length).fill(null);
  if (!closes.length) return out;
  out[0] = highs[0]! - lows[0]!;
  for (let i = 1; i < closes.length; i++) {
    out[i] = Math.max(
      highs[i]! - lows[i]!,
      Math.abs(highs[i]! - closes[i - 1]!),
      Math.abs(lows[i]! - closes[i - 1]!),
    );
  }
  return out;
}

/** Wilder's ATR: SMA-seeded over bars 1…period, then smoothed. */
export function atr(highs: number[], lows: number[], closes: number[], period = 14): A {
  const out: A = Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  const tr = trueRange(highs, lows, closes);
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i]!;
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < closes.length; i++) {
    prev = (prev * (period - 1) + tr[i]!) / period;
    out[i] = prev;
  }
  return out;
}


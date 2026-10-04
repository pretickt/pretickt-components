/** Close-only indicators. Each returns an array aligned to the input, `null` during the warm-up period. */

type A = (number | null)[];

/** Exponential moving average, SMA-seeded. */
export function ema(closes: number[], period: number): A {
  const out: A = Array(closes.length).fill(null);
  if (closes.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += closes[i]!;
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < closes.length; i++) {
    prev = closes[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/**
 * Wilder's smoothing of `xs` from index 1: the first value (at `period`) is the mean of xs[1..period], then
 * prev·(period−1)+x over period. RSI smooths gains and losses with it, ATR the true range.
 */
export function wilder(xs: number[], period: number): A {
  const out: A = Array(xs.length).fill(null);
  if (xs.length <= period) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += xs[i]!;
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < xs.length; i++) {
    prev = (prev * (period - 1) + xs[i]!) / period;
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(closes: number[], period = 14): A {
  const d = closes.map((c, i) => (i ? c - closes[i - 1]! : 0));
  const gains = wilder(d.map((x) => (x > 0 ? x : 0)), period);
  const losses = wilder(d.map((x) => (x < 0 ? -x : 0)), period);
  return gains.map((g, i) => (g == null ? null : losses[i] === 0 ? 100 : 100 - 100 / (1 + g / losses[i]!)));
}

export interface Macd {
  macd: A;
  signal: A;
}
/** MACD line (EMAfast − EMAslow) and its signal EMA. */
export function macd(closes: number[], fast = 12, slow = 26, sig = 9): Macd {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line: A = closes.map((_, i) => (ef[i] != null && es[i] != null ? ef[i]! - es[i]! : null));
  const first = line.findIndex((v) => v != null);
  const signal: A = Array(closes.length).fill(null);
  if (first >= 0) {
    const dense = line.slice(first).map((v) => v as number);
    const se = ema(dense, sig);
    for (let i = 0; i < se.length; i++) signal[first + i] = se[i]!;
  }
  return { macd: line, signal };
}

export interface Bollinger {
  lower: A;
  upper: A;
  mid: A;
}
/** Bollinger bands: SMA(period) ± mult·stdev(period). */
export function bollinger(closes: number[], period = 20, mult = 2): Bollinger {
  const lower: A = Array(closes.length).fill(null);
  const upper: A = Array(closes.length).fill(null);
  const mid: A = Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const w = closes.slice(i - period + 1, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / period);
    mid[i] = m;
    lower[i] = m - mult * sd;
    upper[i] = m + mult * sd;
  }
  return { lower, upper, mid };
}

/** SMA at each index (null during warm-up). For the last value only, use `smaLast`. */
export function sma(closes: number[], period: number): A {
  const out: A = Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i]!;
    if (i >= period) sum -= closes[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}


/** Simple moving average of the last `n` closes; null when there are fewer than `n`. */
export function smaLast(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  let sum = 0;
  for (let i = closes.length - n; i < closes.length; i++) sum += closes[i]!;
  return sum / n;
}

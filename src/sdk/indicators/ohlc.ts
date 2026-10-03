/** OHLCV indicators. Same contract as technical-signals/indicators.ts: pure functions over number
 *  arrays returning an array aligned to the input, `null` during warm-up. */

type A = (number | null)[];

export interface Stochastic {
  k: A;
  d: A;
}

/** True stochastic: %K over highs/lows, %D = SMA(%K, dPeriod). */
export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3,
): Stochastic {
  const k: A = Array(closes.length).fill(null);
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const hi = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const lo = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
    k[i] = hi === lo ? 50 : ((closes[i]! - lo) / (hi - lo)) * 100;
  }
  const d: A = Array(closes.length).fill(null);
  for (let i = dPeriod - 1; i < k.length; i++) {
    const w = k.slice(i - dPeriod + 1, i + 1);
    if (w.some((v) => v == null)) continue;
    d[i] = (w as number[]).reduce((a, b) => a + b, 0) / dPeriod;
  }
  return { k, d };
}

/** On-balance volume: cumulative signed volume, seeded at 0 on the first bar. */
export function obv(closes: number[], volumes: number[]): A {
  const out: A = Array(closes.length).fill(null);
  if (!closes.length) return out;
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i]! > closes[i - 1]!) acc += volumes[i]!;
    else if (closes[i]! < closes[i - 1]!) acc -= volumes[i]!;
    out[i] = acc;
  }
  return out;
}

/** Least-squares slope of the trailing `period` values (x = 0…period-1). */
export function slope(values: A, period: number): A {
  const out: A = Array(values.length).fill(null);
  if (period < 2) return out;
  const xs = Array.from({ length: period }, (_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / period;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  for (let i = period - 1; i < values.length; i++) {
    const w = values.slice(i - period + 1, i + 1);
    if (w.some((v) => v == null)) continue;
    const ys = w as number[];
    const my = ys.reduce((a, b) => a + b, 0) / period;
    let sxy = 0;
    for (let j = 0; j < period; j++) sxy += (xs[j]! - mx) * (ys[j]! - my);
    out[i] = sxy / sxx;
  }
  return out;
}

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

/** Annualised σ of daily log returns over the trailing `period` bars (√252, sample stdev). */
export function realizedVol(closes: number[], period = 20): A {
  const out: A = Array(closes.length).fill(null);
  const r: A = Array(closes.length).fill(null);
  for (let i = 1; i < closes.length; i++) {
    r[i] = closes[i]! > 0 && closes[i - 1]! > 0 ? Math.log(closes[i]! / closes[i - 1]!) : null;
  }
  for (let i = period; i < closes.length; i++) {
    const w = r.slice(i - period + 1, i + 1);
    if (w.some((v) => v == null)) continue;
    const ys = w as number[];
    const m = ys.reduce((a, b) => a + b, 0) / period;
    const varr = ys.reduce((a, b) => a + (b - m) ** 2, 0) / (period - 1);
    out[i] = Math.sqrt(varr) * Math.sqrt(252);
  }
  return out;
}

/** Mean of close × volume over the trailing `period` bars (dollar volume). */
export function avgDollarVolume(closes: number[], volumes: number[], period = 20): A {
  const out: A = Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j]! * volumes[j]!;
    out[i] = sum / period;
  }
  return out;
}

/** First index of the unbroken non-null volume run that ends at the last bar. */
export function volumeStart(volumes: (number | null)[]): number {
  let start = 0;
  for (let i = 0; i < volumes.length; i++) if (volumes[i] == null) start = i + 1;
  return start;
}

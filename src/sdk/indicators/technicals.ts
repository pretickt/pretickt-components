import { atr } from './ohlc';
import { bollinger, macd, rsi, sma } from './series';

export interface TechnicalBar {
  date: string;
  /** Nullable because the OHLCV table carries close-only rows from before the widening. */
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export interface TechnicalSnapshot {
  /** Session these values are computed on — the last CLOSED bar we hold, not an intraday quote. */
  asOf: string;
  close: number;
  movingAverages: { period: number; value: number | null; distPct: number | null }[];
  bollinger: {
    period: number;
    mult: number;
    lower: number | null;
    mid: number | null;
    upper: number | null;
    /** Where the close sits across the band: 0 = lower, 1 = upper, outside means a pierce. */
    percentB: number | null;
    /** Band width as a % of the middle band — the squeeze/expansion reading. */
    widthPct: number | null;
    /** Plain-language position, including whether the last two closes pierced or came back in. */
    state: 'above upper' | 'upper half' | 'lower half' | 'below lower' | null;
    /** True when the previous close was outside the band and this one is back inside. */
    reentered: boolean;
  };
  rsi14: number | null;
  macd: { line: number | null; signal: number | null; histogram: number | null };
  atr14: number | null;
  atrPct: number | null;
  range20: { high: number | null; low: number | null };
  volume: { last: number | null; avg20: number | null; ratio: number | null };
}

const last = <T>(xs: (T | null)[]): T | null => {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null) return xs[i] as T;
  return null;
};

const pct = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? ((a - b) / b) * 100 : null;

/**
 * Today's technical state of one symbol, from the same indicator code the TA chart draws with.
 *
 * The chat used to have no access to any of this — it could name a Bollinger squeeze in the
 * abstract but not say where price actually sat in the bands — so every technical answer ended in
 * the same disclaimer. Values here are point-in-time by construction: the last closed bar.
 */
export function technicalSnapshot(bars: TechnicalBar[], bbPeriod = 20, bbMult = 2): TechnicalSnapshot | null {
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  // Close-only rows predate the OHLCV widening; treating the close as the whole bar keeps ATR and
  // the 20-day range defined instead of dropping the snapshot.
  const highs = bars.map((b) => b.high ?? b.close);
  const lows = bars.map((b) => b.low ?? b.close);
  const close = closes[closes.length - 1]!;
  const bb = bollinger(closes, bbPeriod, bbMult);
  const m = macd(closes);
  const a = atr(highs, lows, closes, 14);

  const lower = last(bb.lower);
  const mid = last(bb.mid);
  const upper = last(bb.upper);
  const span = lower != null && upper != null ? upper - lower : null;
  const percentB = span != null && span !== 0 && lower != null ? (close! - lower) / span : null;

  const prevClose = closes[closes.length - 2];
  const prevLo = bb.lower[bb.lower.length - 2];
  const prevUp = bb.upper[bb.upper.length - 2];
  const wasOutside = prevLo != null && prevUp != null && (prevClose! < prevLo || prevClose! > prevUp);
  const isInside = lower != null && upper != null && close! >= lower && close! <= upper;

  const line = last(m.macd);
  const signal = last(m.signal);
  const window20 = bars.slice(-20);
  const vols = bars.slice(-20).map((b) => b.volume).filter((v): v is number => v != null);
  const avg20 = vols.length ? vols.reduce((x, y) => x + y, 0) / vols.length : null;
  const lastVol = bars[bars.length - 1]!.volume ?? null;
  const atr14 = last(a);

  return {
    asOf: bars[bars.length - 1]!.date,
    close,
    movingAverages: [20, 50, 100, 200].map((period) => {
      const value = last(sma(closes, period));
      return { period, value, distPct: pct(close, value) };
    }),
    bollinger: {
      period: bbPeriod,
      mult: bbMult,
      lower,
      mid,
      upper,
      percentB,
      widthPct: span != null && mid != null && mid !== 0 ? (span / mid) * 100 : null,
      state:
        upper == null || lower == null || mid == null
          ? null
          : close! > upper
            ? 'above upper'
            : close! < lower
              ? 'below lower'
              : close! >= mid
                ? 'upper half'
                : 'lower half',
      reentered: Boolean(wasOutside && isInside),
    },
    rsi14: last(rsi(closes, 14)),
    macd: {
      line,
      signal,
      histogram: line != null && signal != null ? line - signal : null,
    },
    atr14,
    atrPct: atr14 != null && close !== 0 ? (atr14 / close!) * 100 : null,
    range20: {
      high: Math.max(...window20.map((b) => b.high ?? b.close)),
      low: Math.min(...window20.map((b) => b.low ?? b.close)),
    },
    volume: {
      last: lastVol,
      avg20,
      ratio: lastVol != null && avg20 ? lastVol / avg20 : null,
    },
  };
}

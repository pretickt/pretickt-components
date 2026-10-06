import { sma } from './series';

export interface MaCross {
  fast: number;
  slow: number;
  /** fast − slow, in price units. */
  gap: number;
  /** Direction of the NEXT cross: 'up' when the fast average is below and has to rise through. */
  direction: 'up' | 'down';
  /** Sessions until the averages meet at the drift of the last `driftWindow` sessions; null when the gap is not closing. */
  inSessions: number | null;
  /** The most recent cross inside the lookback, if any. */
  lastCross: { direction: 'up' | 'down'; sessionsAgo: number } | null;
}

const MAX_ETA = 60;

/**
 * "MA20 back above MA50 in ~10 sessions": how far apart two moving averages are, whether the gap is
 * closing, and when they meet at the current drift. New for production (the shorts computed it by hand).
 */
export function maCrossEta(closes: number[], fastN = 20, slowN = 50, driftWindow = 5, lookback = 20): MaCross | null {
  const n = closes.length;
  if (n < slowN + driftWindow) return null;
  const f = sma(closes, fastN);
  const s = sma(closes, slowN);
  const gapAt = (i: number): number | null => (f[i] != null && s[i] != null ? f[i]! - s[i]! : null);
  const g = gapAt(n - 1);
  const g0 = gapAt(n - 1 - driftWindow);
  if (g == null || g0 == null) return null;

  let lastCross: MaCross['lastCross'] = null;
  for (let i = n - 1; i > n - 1 - lookback && i > 0; i--) {
    const a = gapAt(i - 1), b = gapAt(i);
    if (a != null && b != null && a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b)) {
      lastCross = { direction: b > 0 ? 'up' : 'down', sessionsAgo: n - 1 - i };
      break;
    }
  }
  const rate = (g - g0) / driftWindow;
  const closing = g !== 0 && rate !== 0 && Math.sign(rate) === -Math.sign(g);
  const eta = closing ? Math.ceil(Math.abs(g / rate)) : null;
  const inSessions = eta != null && eta <= MAX_ETA ? eta : null;
  if (inSessions == null && !lastCross) return null;
  return { fast: f[n - 1]!, slow: s[n - 1]!, gap: g, direction: g < 0 ? 'up' : 'down', inSessions, lastCross };
}

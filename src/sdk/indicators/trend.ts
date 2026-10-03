import { movingAverage } from './sector';

export type Regime = 'up' | 'down' | 'mixed';
export interface TrendPoint {
  changePct: number | null;
  regime: Regime | null;
}

const DAY = 86_400_000;

/** 3-month % change + MA50/MA200 regime for an ascending {date, close} series. */
/** `now` is explicit (ms since epoch, normally the as-of session): indicators never read the clock. */
export function trend(series: { date: string; close: number }[], now: number): TrendPoint {
  if (!series.length) return { changePct: null, regime: null };
  const pts = series
    .map((p) => ({ ts: Date.parse(p.date), close: p.close }))
    .sort((a, b) => a.ts - b.ts);
  const last = pts[pts.length - 1]!.close;

  const cutoff = now - 90 * DAY;
  let ref: number | null = null;
  for (const p of pts) {
    if (p.ts <= cutoff) ref = p.close;
    else break;
  }
  const changePct = ref != null && ref !== 0 ? ((last - ref) / ref) * 100 : null;

  const closes = pts.map((p) => p.close);
  const ma50 = movingAverage(closes, 50);
  const ma200 = movingAverage(closes, 200);
  let regime: Regime | null = null;
  if (ma50 != null && ma200 != null) {
    if (last >= ma200 && ma50 >= ma200) regime = 'up';
    else if (last < ma200 && ma50 < ma200) regime = 'down';
    else regime = 'mixed';
  }
  return { changePct, regime };
}

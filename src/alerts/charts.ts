import { dayMonth, num, pct } from '../ds/format';
import { CONDITIONS, price, type Params } from './catalog';
import type { RuleCondition } from './rule';
import type { AlertRow } from './rows';

/**
 * Version A of the alert cards (Romeo, 2026-11-01, mockup `condizioni-A.png`): the measure, the alert level dashed, the values on
 * the right with what they are under them (as pt-price-target), the part past the level in its zone. Geometry only: the editor's
 * card and the email's image draw the same models.
 */
export const CHART_W = 300, PLOT_L = 4, PLOT_R = 226, LABEL_X = 262;
const W = PLOT_R - PLOT_L, SLOTS = 78;   // 5-minute bars of a full session, 9:35 to 4:00 PM ET
const LINE = { h: 106, top: 10, bottom: 92 } as const, BARS = { h: 92, top: 10, bottom: 76 } as const;

export type Tone = 'ink' | 'neg' | 'pos';
export interface Level { y: number; labelY: number; label: string; caption: string; tone: Tone; now?: true }
export interface Bar { x: number; y: number; w: number; h: number; tone: 'base' | 'hit' | 'neg' | 'pos'; label?: string }
export interface LevelChart {
  kind: 'level'; h: number; line: string | null; past: string | null; bars: Bar[]; levels: Level[];
  zone: { y: number; h: number; tone: 'neg' | 'pos' } | null; cross: { x: number; y: number } | null; ticks: { x: number; y: number; label: string }[];
}
export interface RangeChart { kind: 'range'; low: number; high: number; price: number; band: [number, number]; side: 'low' | 'high' }
export interface ChecksChart { kind: 'checks'; marks: (boolean | null)[]; score: number | null; threshold: number }
export interface CountdownChart { kind: 'countdown'; days: number | null; limit: number; date: string | null }
export interface GradeChart { kind: 'grade'; dir: 'up' | 'down' | null; firm: string | null; date: string | null }
export interface LogosChart { kind: 'logos'; rows: Pick<AlertRow, 'ticker' | 'logo' | 'name'>[]; more: number }
export interface FlagChart { kind: 'flag'; on: boolean }
export type ChartModel = LevelChart | RangeChart | ChecksChart | CountdownChart | GradeChart | LogosChart | FlagChart;
/** What a card draws from: the example's row, every row (logos), the session's 5-minute closes, the daily closes (oldest first). */
export interface ChartData { row: AlertRow | null; rows: AlertRow[]; bars?: number[] | null; closes?: { t: string; c: number }[] | null }

/** Labels on the right never overlap: each at least `gap` below the one above, all inside [top, bottom]; the input order is kept. */
export function placeLabels(ys: number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = order.map((o) => Math.max(o.y, top));
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k]!, out[k - 1]! + gap);
  if (out.length && out[out.length - 1]! > bottom) {
    out[out.length - 1] = bottom;
    for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k]!, out[k + 1]! - gap);
  }
  const res = new Array<number>(ys.length);
  order.forEach((o, k) => { res[o.i] = out[k]!; });
  return res;
}

/** A signed move or distance: whole percents bare (-5%), from 10% whole (-24%), under it one decimal (-7.9%). */
const sig = (v: number) => {
  const a = Math.abs(v) * 100;
  return pct(v, Math.abs(a - Math.round(a)) < 1e-9 || a >= 10 ? 0 : 1);
};
const fmt = (v: number) => num(v, Number.isInteger(v) ? 0 : 1);
/** a price the chart shows (now, a target, the 52-week range): whole dollars from $100 */
export const dollars = (v: number) => `$${num(v, v >= 100 ? 0 : 2)}`;
const compactUsd = (v: number) => (Math.abs(v) >= 1e6 ? `$${num(v / 1e6, 1)}M` : Math.abs(v) >= 1e3 ? `$${num(v / 1e3, 0)}K` : `$${num(v, 0)}`);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const n = (p: Params, k: string) => Number(p[k]);
const s = (p: Params, k: string) => String(p[k]);
const path = (pts: { x: number; y: number }[]) => (pts.length ? pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('') : null);

interface LevelIn { v: number; label: string; caption: string; tone: Tone; now?: true }
/** The scale of a line chart: every value and level inside the plot, 8% to spare. */
function scale(values: number[], frame: { top: number; bottom: number }) {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  return (v: number) => frame.top + ((hi - v) / (hi - lo)) * (frame.bottom - frame.top);
}
function levelsOf(ins: LevelIn[], y: (v: number) => number, frame: { top: number; bottom: number }): Level[] {
  const ys = ins.map((l) => y(l.v));
  const labelYs = placeLabels(ys, 16, frame.top - 4, frame.bottom + 6);
  return ins.map((l, i) => ({ y: ys[i]!, labelY: labelYs[i]!, label: l.label, caption: l.caption, tone: l.tone, ...(l.now ? { now: true as const } : {}) }));
}
function zoneOf(level: number, below: boolean, tone: 'neg' | 'pos', frame: { top: number; bottom: number }) {
  return below ? { y: level, h: frame.bottom - level, tone } : { y: frame.top, h: level - frame.top, tone };
}
/** The first point past the level after one that was not, interpolated on the segment. */
function crossOf(pts: { x: number; v: number }[], thr: number, below: boolean, y: (v: number) => number) {
  const past = (v: number) => (below ? v <= thr : v >= thr);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (!past(a.v) && past(b.v)) {
      const f = (thr - a.v) / (b.v - a.v);
      return { x: a.x + f * (b.x - a.x), y: y(thr) };
    }
  }
  return null;
}

function sessionChart(rc: RuleCondition, row: AlertRow, bars: number[] | null | undefined): LevelChart {
  const crosses = rc.c === 'price-crosses';
  const ref = row.prevClose ?? bars?.[0] ?? row.price;
  const below = crosses ? s(rc.p, 'dir') !== 'above' : s(rc.p, 'dir') !== 'up';
  const tone = below ? 'neg' : 'pos';
  const val = (c: number) => (crosses ? c : c / ref - 1);
  const thr = crosses ? n(rc.p, 'price') : (below ? -1 : 1) * n(rc.p, 'pct') / 100;
  const now = crosses ? row.price : row.move ?? row.price / ref - 1;
  const pts = (bars ?? []).map((c, i) => ({ x: PLOT_L + ((i + 1) / SLOTS) * W, v: val(c) }));
  const ins: LevelIn[] = crosses
    ? [{ v: thr, label: price(thr), caption: 'ALERT', tone }, { v: now, label: dollars(now), caption: 'NOW', tone: 'ink', now: true }]   // the level as its pill says it
    : [{ v: 0, label: '0%', caption: 'PREV CLOSE', tone: 'ink' }, { v: thr, label: sig(thr), caption: 'ALERT', tone },
      { v: now, label: sig(now), caption: 'NOW', tone: 'ink', now: true }];
  const y = scale([...pts.map((q) => q.v), ...ins.map((l) => l.v)], LINE);
  const line = path(pts.map((q) => ({ x: q.x, y: y(q.v) })));
  return {
    kind: 'level', h: LINE.h, line, past: line, bars: [], levels: levelsOf(ins, y, LINE), zone: zoneOf(y(thr), below, tone, LINE),
    cross: crossOf(pts, thr, below, y),
    ticks: [{ x: PLOT_L, y: LINE.h - 3, label: '9:30' }, { x: PLOT_L + (30 / SLOTS) * W, y: LINE.h - 3, label: '12:00' },
      { x: PLOT_R, y: LINE.h - 3, label: '4:00' }],
  };
}

function averageChart(rc: RuleCondition, row: AlertRow, closes: { t: string; c: number }[] | null | undefined): LevelChart | null {
  const days = Number(s(rc.p, 'days')), below = s(rc.p, 'dir') !== 'above', tone = below ? 'neg' : 'pos';
  const ma = days === 20 ? row.ma20 : days === 100 ? row.ma100 : days === 200 ? row.ma200 : row.ma50;
  if (!ma) return null;
  const thr = (below ? -1 : 1) * n(rc.p, 'pct') / 100, now = row.price / ma - 1;
  const cs = closes ?? [];
  const dists: { t: string; v: number }[] = [];
  let sum = 0;
  for (let i = 0; i < cs.length; i++) {
    sum += cs[i]!.c;
    if (i >= days) sum -= cs[i - days]!.c;
    if (i >= days - 1 && i >= cs.length - 63) dists.push({ t: cs[i]!.t, v: cs[i]!.c / (sum / days) - 1 });
  }
  const pts = dists.map((d, i) => ({ x: PLOT_L + (dists.length > 1 ? i / (dists.length - 1) : 1) * W, v: d.v, t: d.t }));
  const ins: LevelIn[] = [{ v: 0, label: `MA${days}`, caption: 'AVERAGE', tone: 'ink' }, { v: thr, label: sig(thr), caption: 'ALERT', tone },
    { v: now, label: sig(now), caption: 'NOW', tone: 'ink', now: true }];
  const y = scale([...pts.map((q) => q.v), ...ins.map((l) => l.v)], LINE);
  const ticks: LevelChart['ticks'] = [];
  pts.forEach((q, i) => {
    if (i && q.t.slice(0, 7) !== pts[i - 1]!.t.slice(0, 7)) ticks.push({ x: q.x, y: LINE.h - 3, label: MONTHS[Number(q.t.slice(5, 7)) - 1] ?? '' });
  });
  const line = path(pts.map((q) => ({ x: q.x, y: y(q.v) })));
  return { kind: 'level', h: LINE.h, line, past: line, bars: [], levels: levelsOf(ins, y, LINE), zone: zoneOf(y(thr), below, tone, LINE),
    cross: crossOf(pts, thr, below, y), ticks };
}

/** Bars against a level: two counts (usual and the session's), P/E against the sector's, surprises, insider buying, the target. */
function barsChart(bars: { v: number; label: string; tone?: Bar['tone'] }[], ins: LevelIn[], zoneBelow: boolean | null, zoneTone: 'neg' | 'pos'): LevelChart {
  const y = scale([0, ...bars.map((b) => b.v), ...ins.map((l) => l.v)], BARS);
  const slot = W / Math.max(bars.length, 1), bw = Math.min(56, slot * 0.6);
  const out: Bar[] = bars.map((b, i) => {
    const x = PLOT_L + slot * i + (slot - bw) / 2, y0 = y(0), y1 = y(b.v);
    return { x, y: Math.min(y0, y1), w: bw, h: Math.max(1, Math.abs(y1 - y0)), tone: b.tone ?? 'base', label: b.label };
  });
  const alert = ins.find((l) => l.caption === 'ALERT');
  return { kind: 'level', h: BARS.h, line: null, past: null, bars: out, levels: levelsOf(ins, y, BARS),
    zone: alert && zoneBelow !== null ? zoneOf(y(alert.v), zoneBelow, zoneTone, BARS) : null, cross: null, ticks: [] };
}

function versusChart(rc: RuleCondition, row: AlertRow): LevelChart | null {
  const volume = rc.c === 'volume-spike', news = rc.c === 'news-spike';
  const now = volume ? row.volumeRatio : news ? row.news : row.social;
  const usual = volume ? 1 : news ? row.newsUsual : row.socialUsual;
  if (now === null || usual === null) return null;
  const level = Math.max(volume ? 0 : news ? 4 : 10, n(rc.p, 'times') * usual);
  const show = (v: number) => (volume ? `${fmt(Math.round(v * 10) / 10)}×` : fmt(Math.round(v * 10) / 10));
  return barsChart(
    [{ v: usual, label: 'USUAL' }, { v: now, label: dayMonth(row.session).toUpperCase(), tone: now >= level ? 'hit' : 'base' }],
    [{ v: level, label: show(level), caption: 'ALERT', tone: 'pos' }, { v: now, label: show(now), caption: 'NOW', tone: 'ink', now: true }],
    false, 'pos');
}

/** The rows a universe condition keeps, the largest first: the first 12 drawn, the rest counted. */
function logosChart(rc: RuleCondition, rows: AlertRow[]): LogosChart {
  const keep = rows.filter((r) => CONDITIONS[rc.c].test(r, rc.p).pass).sort((a, b) => (b.marketCap ?? -1) - (a.marketCap ?? -1));
  return { kind: 'logos', rows: keep.slice(0, 12).map(({ ticker, logo, name }) => ({ ticker, logo, name })), more: Math.max(0, keep.length - 12) };
}

/** The model of a card's chart; null when the example lacks what it needs (the card says "No data"). */
export function chartOf(rc: RuleCondition, d: ChartData): ChartModel | null {
  const chart = CONDITIONS[rc.c].chart;
  if (chart === 'logos') return logosChart(rc, d.rows);
  const row = d.row;
  if (!row) return null;
  const p = rc.p;
  switch (chart) {
    case 'session': return sessionChart(rc, row, d.bars);
    case 'average': return averageChart(rc, row, d.closes);
    case 'range': {
      if (row.low52 === null || row.high52 === null) return null;
      const t = n(p, 'pct') / 100, side = s(p, 'side') === 'high' ? 'high' : 'low';
      return { kind: 'range', low: row.low52, high: row.high52, price: row.price, side,
        band: side === 'low' ? [row.low52, row.low52 * (1 + t)] : [row.high52 * (1 - t), row.high52] };
    }
    case 'versus': return versusChart(rc, row);
    case 'pe': {
      if (row.peVsSector === null) return null;
      const below = s(p, 'dir') !== 'above', thr = (below ? -1 : 1) * n(p, 'pct') / 100, stock = 1 + row.peVsSector;
      return barsChart([{ v: 1, label: 'SECTOR' }, { v: stock, label: row.ticker, tone: CONDITIONS[rc.c].test(row, p).pass ? 'hit' : 'base' }],
        [{ v: 1 + thr, label: sig(thr), caption: 'ALERT', tone: 'pos' }, { v: stock, label: sig(row.peVsSector), caption: 'NOW', tone: 'ink', now: true }],
        below, 'pos');
    }
    case 'target': {
      if (row.ptUpside === null) return null;
      const target = row.price * (1 + row.ptUpside), alert = row.price * (1 + n(p, 'pct') / 100);
      return barsChart([{ v: target - row.price, label: 'UPSIDE', tone: target >= alert ? 'hit' : 'base' }],
        [{ v: target - row.price, label: dollars(target), caption: 'TARGET', tone: 'ink' }, { v: alert - row.price, label: dollars(alert), caption: 'ALERT', tone: 'pos' },
          { v: 0, label: dollars(row.price), caption: 'NOW', tone: 'ink', now: true }], false, 'pos');
    }
    case 'surprises': {
      const ss = row.surprises ?? [];
      if (!ss.length) return null;
      const miss = s(p, 'dir') === 'miss', thr = (miss ? -1 : 1) * n(p, 'pct') / 100, last = ss[ss.length - 1]!;
      return barsChart(ss.map((v, i) => ({ v, label: i === ss.length - 1 ? 'LAST' : '', tone: v >= 0 ? 'pos' : 'neg' })),
        [{ v: thr, label: sig(thr), caption: 'ALERT', tone: miss ? 'neg' : 'pos' }, { v: last, label: sig(last), caption: 'NOW', tone: 'ink', now: true }],
        miss, miss ? 'neg' : 'pos');
    }
    case 'insiders': {
      if (row.insiderNet90 === null) return null;
      const v = row.insiderNet90;
      return barsChart([{ v, label: '90 DAYS', tone: v >= n(p, 'usd') ? 'hit' : v >= 0 ? 'base' : 'neg' }],
        [{ v: n(p, 'usd'), label: compactUsd(n(p, 'usd')), caption: 'ALERT', tone: 'pos' }, { v, label: compactUsd(v), caption: 'NOW', tone: 'ink', now: true }],
        false, 'pos');
    }
    case 'checks': return { kind: 'checks', marks: row.checks ?? Array.from({ length: 9 }, () => null), score: row.piotroski, threshold: n(p, 'score') };
    case 'countdown': {
      const t = CONDITIONS[rc.c].test(row, p);
      return { kind: 'countdown', days: row.earningsDate ? t.value : null, limit: n(p, 'days'), date: row.earningsDate };
    }
    case 'grade': return { kind: 'grade', dir: row.grade?.dir ?? null, firm: row.grade?.firm ?? null, date: row.grade?.date ?? null };
    case 'flag': return { kind: 'flag', on: row.undervalued };
    default: return null;
  }
}

/**
 * Where do analysts think this stock is going, and how spread out are they? On a fund's or a sector's page: where its holdings' analysts put it, week by week.
 * @version 2.7.0
 * @evidence Romeo, 2026-11-07: «for the price target, both in ETFs and sectors, I would like a chart similar to the one in companies, with dots and the lines to see recents and visually» (2.5: `basket`, `sector`)
 * @evidence Romeo, 2026-11-07, on a basket dot's panel: «do not show weighted target, but the surrounding companies with logos» (2.6: the week, then its largest companies)
 * @evidence DataForSEO: "{ticker} price target" ~103k searches/month, "{ticker} stock forecast" ~151k (launch/data, public-site spec §4)
 * @evidence beta: pt-chart (pretickt-frontend/src/app/companies/pt-chart.ts) — geometry, clustering, hover animations and zoom/pan ported 1:1
 * @evidence Romeo, 2026-10-26: "togliamo la linea verticale e mettiamo dei prezzi sull'asse a destra del prezzo, con linee tratteggiate orizzontali di colore opportuno"
 * @evidence Romeo, 2026-10-26: "sotto al ptarget deve essere un piccolo grafico con stessi valori dell'asse x price target, ma con rendering come in beta … nella sezione consensus, ma meno alta, diciamo la metà circa" (beta: consensus-history)
 * @evidence Romeo, 2026-10-26: the upright summary of 2.3 goes ("questo va tolto") — high, average, low and today are on the price axis now —
 *   and the legend sits above the chart, so the consensus follows the chart it shares an axis with
 * @evidence Romeo, 2026-11-14: «sotto il price target, metti un grafico per visualizzare il price target trend» — «l'idea è che se il price target è
 *   salito sempre e negli ultimi mesi mostra una discesa, forse il trend di prezzo sta cambiando?» — «Vai con A» (2.7: the average target week by
 *   week under the chart, its last turn, the raises and cuts since in a sentence; what analysts did, never a forecast)
 */
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { applyXViewport, applyYViewport, closeAt, FULL_VIEWPORT, isoDay, linePath, monthTicks, padTime, PtChart, PtLogo, PtSay, PtTimeAxis, type Viewport } from '@pretickt/components/ds';
import { date, dayMonth, mention, money, month, pct, plainName, say, svgId, tip, usd, type Mention, type Said } from '@pretickt/components/format';
import { cmp, type Analysts, type PriceBar, type Sector } from '@pretickt/components/typologies';

type Target = Analysts['targets'][number];
/** The targets the price axis names: the summary's high, average and low (a basket's: today's target alone). */
export type LevelSummary = { mean: number; low?: number; high?: number };
/** A basket's chart: its money in its own format (a sector's trillions), and its one target named for what it is. */
export interface PtChartWords { fmt?: (v: number) => string; meanName?: string; meanWhat?: string; nowWhat?: string; fromNow?: string }

// Geometry, ported from beta pt-chart.geometry.ts (targets already arrive on our adjusted basis). x unit: days (isoDay). ─────
const W = 800, H = 340, ML = 6, MR = 46, MT = 12, MB = 22;
const START_DAYS = 15;   // start points within a fortnight merge
const END_PCT = 0.2;     // targets within 20% (value) …
const END_DAYS = 45;     // … and ~45 days apart merge
const MAX_MEMBER_ROWS = 6;
const LABEL_W = 30;      // room a "+139%" label needs right of its dot
/** The price axis' labels — a price and, small under it, what it is — stay this far apart (chart units): an average beside the last close
 *  keeps both readable. */
export const LEVEL_GAP = 22;
/** How far under its price a label's name sits, and so how much room the last one needs above the time axis. */
const NAME_DY = 13;

export interface PtSegment { up: boolean; line: string; x1: number; x2: number; endIdx: number }
export interface PtCluster {
  x: number; y: number; r: number; up: boolean; pctLabel: string; members: Target[]; meanTarget: number;
  /** no room right of the dot */ labelLeft: boolean;
}
/** A price marked across the plot — the last close, the high, average and low targets — and named on the price axis. */
export interface PtLevel {
  key: 'high' | 'mean' | 'now' | 'low'; v: number; y: number;
  /** where its label sits on the axis: its own price, or nudged off a neighbour's */ labelY: number;
  tone: 'pos' | 'neg' | 'flat' | 'now'; label: string;
  /** what the price is, small under it: HIGH, AVERAGE, LOW, TODAY */ name: string; tip: string;
}
export interface PtTargetChart {
  w: number; h: number; pricePath: string;
  /** top to bottom; a level outside the visible prices is left out */ levels: PtLevel[];
  xTicks: { x: number; label: string }[];
  /** the days the plot shows (the viewport applied): the consensus under the chart reads the same time axis */ x: { min: number; max: number };
  segments: PtSegment[]; startDots: { x: number; y: number; r: number }[]; clusters: PtCluster[];
}

const f = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** The day a target expires: twelve months after it was published (Feb 29 rolls to Mar 1, like the beta chart). */
const plus12m = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Math.floor(Date.UTC(y! + 1, m! - 1, d!) / 86_400_000); };

/** Greedy clustering in input order: an item joins the first group it is `near`, or starts a new one. */
function clusterGreedy<T>(items: T[], near: (item: T, group: T[]) => boolean): { groups: T[][]; of: number[] } {
  const groups: T[][] = [], of: number[] = [];
  for (const it of items) {
    let g = groups.findIndex((grp) => near(it, grp));
    if (g < 0) g = groups.push([]) - 1;
    groups[g]!.push(it);
    of.push(g);
  }
  return { groups, of };
}

/**
 * The real price line; per target a segment from its (fortnight-grouped) start on the price line to its target at the
 * +12-month horizon. Nearby targets (within 20% and ~45 days) merge into one dot sized by count and labelled with its %
 * versus the current price. The price axis names the last close and the summary's high, average and low targets, each a dashed
 * line across the plot in the tone of its side. "Today" is `asOf` (the end of the time axis): a component never reads the clock.
 */
export function buildPtChart(points: PriceBar[], targets: Target[], asOf: string, current: number, viewport: Viewport = FULL_VIEWPORT,
  summary: LevelSummary | null = null, words: PtChartWords = {}): PtTargetChart | null {
  const cash = words.fmt ?? money, axis = words.fmt ?? axisPrice;
  if (!points.length || !targets.length || !(current > 0)) return null;
  const items = targets
    .filter((t) => t.target > 0)
    .map((t) => { const startY = closeAt(points, t.date); return { t, start: isoDay(t.date), startY, end: plus12m(t.date), targetY: t.target, up: t.target > startY }; })
    .sort((a, b) => a.start - b.start);
  if (!items.length) return null;
  type Item = (typeof items)[number];

  const starts = clusterGreedy(items, (it, g) => Math.abs(it.start - mean(g.map((x) => x.start))) <= START_DAYS);
  const ends = clusterGreedy(items, (it, g) => {
    const cy = mean(g.map((x) => x.targetY));
    return Math.abs(it.targetY - cy) / Math.max(cy, 1) <= END_PCT && Math.abs(it.end - mean(g.map((x) => x.end))) <= END_DAYS;
  });
  const at = (g: Item[], side: 'start' | 'end') => side === 'start'
    ? { day: mean(g.map((x) => x.start)), y: mean(g.map((x) => x.startY)) }
    : { day: mean(g.map((x) => x.end)), y: mean(g.map((x) => x.targetY)) };
  const upOf = (g: Item[]) => g.filter((x) => x.up).length > g.length / 2;

  let yLo = Math.min(...points.map((p) => p.c), ...items.map((t) => t.targetY));
  let yHi = Math.max(...points.map((p) => p.c), ...items.map((t) => t.targetY));
  const pad = (yHi - yLo) * 0.05 || 1;
  // The user's lens on top of the natural ranges (beta: same viewport object as the event map).
  ({ lo: yLo, hi: yHi } = applyYViewport(yLo - pad, yHi + pad, viewport));
  const today = isoDay(asOf);
  // the time pad after the furthest 12-month target: its dot and its % label stand clear of the price axis
  const span = padTime(Math.min(isoDay(points[0]!.t), ...items.map((t) => t.start)), Math.max(isoDay(points.at(-1)!.t), today, ...items.map((t) => t.end)));
  const { min: xMin, max: xMax } = applyXViewport(span.min, span.max, viewport);
  const sx = (day: number) => ML + ((day - xMin) / (xMax - xMin || 1)) * (W - ML - MR);
  const sy = (v: number) => H - MB - ((v - yLo) / (yHi - yLo || 1)) * (H - MT - MB);

  const clusters: PtCluster[] = ends.groups.map((g) => {
    const e = at(g, 'end');
    const pct = (e.y / current - 1) * 100;
    const x = f(sx(e.day)), r = f(2.4 + Math.min(Math.sqrt(g.length) * 1.5, 8));
    return { x, y: f(sy(e.y)), r, up: upOf(g), labelLeft: x + r + LABEL_W > W - MR, meanTarget: e.y,
      pctLabel: `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`,
      members: g.map((x) => x.t).sort((a, b) => cmp(b.date, a.date) || cmp(a.firm, b.firm)) };
  });
  const segments = new Map<string, PtSegment>();
  items.forEach((_, i) => {
    const si = starts.of[i]!, ei = ends.of[i]!;
    if (segments.has(`${si}:${ei}`)) return;
    const s = at(starts.groups[si]!, 'start'), e = at(ends.groups[ei]!, 'end');
    const x1 = f(sx(s.day)), x2 = f(sx(e.day));
    segments.set(`${si}:${ei}`, { up: clusters[ei]!.up, line: linePath([[x1, sy(s.y)], [x2, sy(e.y)]]), x1, x2, endIdx: ei });
  });

  const marks: [PtLevel['key'], string, string, number | undefined][] = summary
    ? [['high', 'HIGH', 'High target', summary.high], ['mean', words.meanName ?? 'AVERAGE', words.meanWhat ?? 'Average target', summary.mean], ['low', 'LOW', 'Low target', summary.low]] : [];
  const named = [
    ...marks.flatMap(([key, name, what, v]) => (v == null ? [] : [{ key, v, name, tone: levelTone(v, current), tip: `${what} ${cash(v)} · ${pct(v / current - 1)} ${words.fromNow ?? 'from the last close'}` }])),
    { key: 'now' as const, v: current, name: 'TODAY', tone: 'now' as const, tip: `${words.nowWhat ?? 'Last close'} ${cash(current)}` },
  ];
  const levels = placeLevels(named.map((l) => ({ ...l, y: f(sy(l.v)), label: axis(l.v) })).filter((l) => l.y >= MT && l.y <= H - MB));

  return {
    w: W, h: H, levels, x: { min: xMin, max: xMax },
    pricePath: linePath(points.map((p) => [sx(isoDay(p.t)), sy(p.c)])),
    xTicks: monthTicks(xMin, xMax).map((t) => ({ x: f(sx(t.day)), label: t.label })),
    segments: [...segments.values()],
    startDots: starts.groups.map((g) => { const s = at(g, 'start'); return { x: f(sx(s.day)), y: f(sy(s.y)), r: f(1.8 + Math.min(Math.sqrt(g.length) * 0.8, 3.5)) }; }),
    clusters,
  };
}

const tone = (up: boolean) => (up ? 'pt-pos' : 'pt-neg');

// The consensus by month under the chart (beta's consensus-history, half as tall): same width and margins, so a month sits under its days.
const CH = 84, CT = 6, CB = 4;
const BANDS = ['strongSell', 'sell', 'hold', 'buy', 'strongBuy'] as const;
type Band = (typeof BANDS)[number];
export interface PtConsensusChart {
  w: number; h: number; y0: number; yMax: number; maxTotal: number;
  /** stacked bottom to top: strong sell … strong buy (on top) */ layers: { band: Band; path: string }[];
  /** oldest first: the month's place on the time axis, the strip its tooltip covers */ months: { period: string; x: number; x0: number; w: number; tip: string }[];
  label: string;
}
/**
 * The analysts' ratings month by month as stacked areas, on the target chart's time axis (`x`: the days its plot shows, the viewport
 * applied); null with fewer than two months or no analysts. A month outside the window is clipped by the template.
 */
export function buildConsensusHistory(history: Analysts['history'], x: { min: number; max: number }): PtConsensusChart | null {
  const rows = history.filter((r) => r.period).sort((a, b) => cmp(a.period, b.period));
  const total = (r: Analysts['history'][number]) => BANDS.reduce((n, b) => n + (r[b] ?? 0), 0);
  const maxTotal = Math.max(0, ...rows.map(total));
  if (rows.length < 2 || !(maxTotal > 0)) return null;
  const sx = (day: number) => ML + ((day - x.min) / (x.max - x.min || 1)) * (W - ML - MR);
  const sy = (v: number) => CT + ((maxTotal - v) / maxTotal) * (CH - CT - CB);
  const xs = rows.map((r) => f(sx(isoDay(r.period))));
  const lower = rows.map(() => 0);
  const layers = BANDS.map((band) => {
    const upper = rows.map((r, i) => lower[i]! + (r[band] ?? 0));
    const top = upper.map((v, i) => `${i ? 'L' : 'M'}${xs[i]} ${f(sy(v))}`).join(' ');
    const back = [...lower.keys()].reverse().map((i) => `L${xs[i]} ${f(sy(lower[i]!))}`).join(' ');
    upper.forEach((v, i) => (lower[i] = v));
    return { band, path: `${top} ${back} Z` };
  });
  const months = rows.map((r, i) => {
    const a = i ? (xs[i - 1]! + xs[i]!) / 2 : xs[0]! - (xs[1]! - xs[0]!) / 2;
    const b = i < rows.length - 1 ? (xs[i]! + xs[i + 1]!) / 2 : xs[i]! + (xs[i]! - xs[i - 1]!) / 2;
    return { period: r.period, x: xs[i]!, x0: f(a), w: f(b - a),
      tip: tip({ [month(r.period.slice(0, 7))]: `${total(r)} analysts`, 'Strong buy': r.strongBuy, Buy: r.buy, Hold: r.hold, Sell: r.sell, 'Strong sell': r.strongSell }) };
  });
  return { w: W, h: CH, y0: f(sy(0)), yMax: f(sy(maxTotal)), maxTotal, layers, months,
    label: `Analysts' ratings by month, ${month(rows[0]!.period.slice(0, 7))} to ${month(rows.at(-1)!.period.slice(0, 7))}: strong buy on top` };
}
/** The price axis' format: whole dollars from $100, cents below. */
const axisPrice = (v: number) => usd(v, { digits: Math.abs(v) >= 100 ? 0 : 2 });
const levelTone = (v: number, current: number): PtLevel['tone'] => (Math.abs(v / current - 1) < FLAT_PCT ? 'flat' : v > current ? 'pos' : 'neg');
const LEVEL_ORDER = { high: 0, mean: 1, now: 2, low: 3 } as const;
/**
 * Top to bottom; each label at least LEVEL_GAP below the one above it. When that runs the last one off the bottom, it goes back to
 * the bottom and the labels above it move up only as far as the gap needs: a label with room stays on its line.
 */
function placeLevels(ls: Omit<PtLevel, 'labelY'>[]): PtLevel[] {
  const out: PtLevel[] = [...ls].sort((a, b) => a.y - b.y || LEVEL_ORDER[a.key] - LEVEL_ORDER[b.key]).map((l) => ({ ...l, labelY: l.y }));
  for (let i = 1; i < out.length; i++) out[i]!.labelY = f(Math.max(out[i]!.labelY, out[i - 1]!.labelY + LEVEL_GAP));
  const bottom = H - MB - NAME_DY - 1;
  if (out.length && out.at(-1)!.labelY > bottom) {
    out.at(-1)!.labelY = bottom;
    for (let i = out.length - 2; i >= 0; i--) out[i]!.labelY = f(Math.min(out[i]!.labelY, out[i + 1]!.labelY - LEVEL_GAP));
  }
  return out;
}

/** A target within 0.05% of the last close is on neither side of it. */
const FLAT_PCT = 0.0005;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/**
 * The consensus in a sentence — text the page carries for search engines, templated from the numbers: the latest month's split
 * (buys with their share, then holds and sells when there are any), and the share of buys a year earlier when that month is known.
 */
export function consensusText(history: Analysts['history']): string | null {
  const rows = history.filter((r) => r.period).sort((a, b) => cmp(a.period, b.period));
  const counts = (r: Analysts['history'][number]) => ({ total: BANDS.reduce((n, b) => n + (r[b] ?? 0), 0), buy: (r.strongBuy ?? 0) + (r.buy ?? 0),
    hold: r.hold ?? 0, sell: (r.sell ?? 0) + (r.strongSell ?? 0) });
  const last = rows.at(-1), k = last ? counts(last) : null;
  if (!last || !k || !(k.total > 0)) return null;
  const share = (x: { total: number; buy: number }) => Math.round((x.buy / x.total) * 100);
  const [y, m] = last.period.split('-').map(Number) as [number, number];
  const parts = [`${k.buy} rate${k.buy === 1 ? 's' : ''} it a buy or strong buy (${share(k)}%)`, ...(k.hold ? [`${k.hold} a hold`] : []), ...(k.sell ? [`${k.sell} a sell or strong sell`] : [])];
  const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]!;
  const before = rows.find((r) => r.period === `${y - 1}-${String(m).padStart(2, '0')}-01`), b = before ? counts(before) : null;
  return `${k.total} analyst${k.total === 1 ? '' : 's'} in ${MONTH_NAMES[m - 1]} ${y}: ${said}.` + (b && b.total > 0 ? ` A year earlier, ${share(b)}% rated it a buy or strong buy.` : '');
}

// The average target week by week (Romeo, 2026-11-14: «se il price target è salito sempre e negli ultimi mesi mostra una discesa…», variant A):
// a third strip on the chart's time axis, between the chart and the consensus, as wide; its line in legs between turns.
/** The strip's height; its plot leaves room above a peak's label or under a low's (MARGIN_LABEL), else a little (MARGIN). */
const TH = 120, MARGIN = 8, MARGIN_LABEL = 26;
/** A turn's label sits this far above a peak (its baseline) or under a low. */
const ABOVE = 10, UNDER = 17;
/** A high or low is a turn once the average has moved this far from it. */
const TURN = 0.03;
const MAX_TIP_ROWS = 6;
type Weekly = NonNullable<Analysts['weekly']>;
export interface PtTrendLeg { i0: number; i1: number; dir: 'up' | 'down' | 'flat' }
export interface PtTrendChart {
  w: number; h: number;
  /** oldest first, one path a leg */ legs: { dir: PtTrendLeg['dir']; path: string }[];
  /** the price axis' lines, about three */ grid: { y: number; label: string }[];
  /** the last turn ("$332 peak · Aug 28", its baseline at labelY); null with one leg */ turn: { x: number; y: number; peak: boolean; label: string; labelY: number; anchor: 'start' | 'middle' | 'end'; tip: string } | null;
  end: { x: number; y: number; dir: PtTrendLeg['dir']; label: string; tip: string };
  /** a hover strip a week, its tip null when the week has no average */ weeks: { t: string; x0: number; w: number; tip: string | null }[];
  label: string;
}

/**
 * The legs of the weekly averages between their turns (indices into `means`; a week without one is skipped): a zigzag that counts a
 * high or a low once the average has moved `threshold` away from it. Fewer than two averages: none.
 */
export function trendLegs(means: readonly (number | null)[], threshold = TURN): PtTrendLeg[] {
  const idx = means.flatMap((v, i) => (v == null ? [] : [i]));
  if (idx.length < 2) return [];
  const v = (i: number) => means[i]!;
  const piv = [idx[0]!];
  let dir: 'up' | 'down' | null = null, ext = idx[0]!;
  for (const i of idx.slice(1)) {
    if (dir === null) {
      if (v(i) >= v(piv[0]!) * (1 + threshold)) { dir = 'up'; ext = i; } else if (v(i) <= v(piv[0]!) * (1 - threshold)) { dir = 'down'; ext = i; }
    } else if (dir === 'up') {
      if (v(i) > v(ext)) ext = i; else if (v(i) <= v(ext) * (1 - threshold)) { piv.push(ext); dir = 'down'; ext = i; }
    } else if (v(i) < v(ext)) ext = i; else if (v(i) >= v(ext) * (1 + threshold)) { piv.push(ext); dir = 'up'; ext = i; }
  }
  piv.push(idx.at(-1)!);
  return piv.slice(1).map((i1, k) => {
    const i0 = piv[k]!, r = v(i1) / v(i0);
    return { i0, i1, dir: r > 1.001 ? 'up' : r < 0.999 ? 'down' : 'flat' };
  });
}

/** Half a turn's label, about (chart units): nearer an edge of the plot than this, it is anchored inside it, never cut in half. */
const HALF_LABEL = 52;
const edgeAnchor = (x: number): 'start' | 'middle' | 'end' => (x < ML + HALF_LABEL ? 'start' : x > W - MR - HALF_LABEL ? 'end' : 'middle');
/** A round step for about `n` lines over `span`: 1, 2 or 5 × 10ⁿ. */
function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw)), k = raw / p;
  return (k < 1.5 ? 1 : k < 3.5 ? 2 : k < 7.5 ? 5 : 10) * p;
}
const minusWeek = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);

/** Each week's tip: its average and firms, then who raised or cut in it (after the week before), newest first, one row a firm. */
function weekTips(weekly: Weekly, targets: Analysts['targets']): (string | null)[] {
  return weekly.map((w, i) => {
    if (w.mean == null) return null;
    const from = i ? weekly[i - 1]!.t : minusWeek(w.t), byFirm = new Map<string, Analysts['targets'][number]>();
    for (const t of targets) {
      if (!(t.date > from && t.date <= w.t && t.prev != null && t.target !== t.prev)) continue;
      const had = byFirm.get(t.firm);
      if (!had || had.date <= t.date) byFirm.set(t.firm, t);
    }
    const rows = [...byFirm.values()].sort((a, b) => cmp(b.date, a.date) || cmp(a.firm, b.firm));
    const o: Record<string, string | number> = { [`Week to ${date(w.t)}`]: `average ${axisPrice(w.mean)}`, Firms: w.n };
    for (const t of rows.slice(0, MAX_TIP_ROWS)) o[`${t.target > t.prev! ? '▲' : '▼'} ${t.firm}`] = `${axisPrice(t.prev!)} → ${axisPrice(t.target)}`;
    if (rows.length > MAX_TIP_ROWS) o['…'] = `${rows.length - MAX_TIP_ROWS} more`;
    return tip(o);
  });
}

/**
 * The average target week by week as a line on the target chart's time axis (`x`, the viewport applied), green where it rises and red
 * where it falls, its last turn marked; null with fewer than two weeks with an average.
 */
export function buildTrend(weekly: Weekly, targets: Analysts['targets'], x: { min: number; max: number }): PtTrendChart | null {
  const legs = trendLegs(weekly.map((w) => w.mean));
  if (!legs.length) return null;
  const ms = weekly.flatMap((w) => (w.mean == null ? [] : [w.mean]));
  // at least 4% of the average from bottom to top, around the line's middle: a 1% move looks like one (review, 2026-11-14)
  const top = Math.max(...ms), bottom = Math.min(...ms), mid = (top + bottom) / 2, rangeHalf = Math.max(top - bottom, top * 0.04) / 2;
  const span = 2 * rangeHalf, a = mid - rangeHalf - span * 0.12, b = mid + rangeHalf + span * 0.12;
  const turned = legs.length > 1, peak = turned && legs.at(-2)!.dir === 'up';
  const TT = turned && peak ? MARGIN_LABEL : MARGIN, TB = turned && !peak ? MARGIN_LABEL : MARGIN;
  const sx = (t: string) => f(ML + ((isoDay(t) - x.min) / (x.max - x.min || 1)) * (W - ML - MR));
  const sy = (v: number) => f(TT + (1 - (v - a) / (b - a)) * (TH - TT - TB));
  const pts = weekly.map((w) => (w.mean == null ? null : `${sx(w.t)} ${sy(w.mean)}`));
  const step = niceStep((b - a) / 3), grid: PtTrendChart['grid'] = [];
  for (let k = Math.ceil(a / step); k * step <= b; k++) grid.push({ y: sy(k * step), label: axisPrice(k * step) });
  const tips = weekTips(weekly, targets), xs = weekly.map((w) => sx(w.t));
  const half = (i: number, j: number) => (xs[j] !== undefined ? Math.abs(xs[j]! - xs[i]!) / 2 : 4);
  const weeks = weekly.map((w, i) => {
    const x0 = xs[i]! - (i ? half(i, i - 1) : half(i, i + 1)), x1 = xs[i]! + (i < xs.length - 1 ? half(i, i + 1) : half(i, i - 1));
    return { t: w.t, x0: f(x0), w: f(x1 - x0), tip: tips[i]! };
  });
  const last = legs.at(-1)!, endW = weekly[last.i1]!;
  const tw = turned ? weekly[last.i0]! : null;
  return {
    w: W, h: TH, grid, weeks,
    legs: legs.map((l) => ({ dir: l.dir, path: pts.slice(l.i0, l.i1 + 1).filter((p) => p != null).map((p, k) => `${k ? 'L' : 'M'}${p}`).join(' ') })),
    turn: tw ? { x: sx(tw.t), y: sy(tw.mean!), peak, label: `${axisPrice(tw.mean!)} ${peak ? 'peak' : 'low'} · ${dayMonth(tw.t)}`,
      labelY: f(sy(tw.mean!) + (peak ? -ABOVE : UNDER)), anchor: edgeAnchor(sx(tw.t)), tip: tips[last.i0]! } : null,
    end: { x: sx(endW.t), y: sy(endW.mean!), dir: last.dir, label: `${axisPrice(endW.mean!)} average target`, tip: tips[last.i1]! },
    label: `Average analyst price target, week by week, ${month(weekly[legs[0]!.i0]!.t.slice(0, 7))} to ${month(endW.t.slice(0, 7))}`,
  };
}

/**
 * What the analysts did since the average target's last turn, in a sentence for search engines (no forecast: what they did, never what
 * the price will do): the turn, the change since, and the raises and cuts since it — the larger count first; with no turn, the year's
 * change and its raises and cuts. Null with fewer than two weeks with an average.
 */
export function trendText(who: Mention, weekly: Weekly, targets: Analysts['targets']): Said | null {
  const legs = trendLegs(weekly.map((w) => w.mean));
  if (!legs.length) return null;
  const first = weekly[legs[0]!.i0]!, last = weekly[legs.at(-1)!.i1]!;
  const counted = (since: string | null) => {
    let up = 0, down = 0;
    for (const t of targets) if (t.prev != null && (since == null || t.date > since)) { if (t.target > t.prev) up++; else if (t.target < t.prev) down++; }
    const parts = ([[down, 'cut'], [up, 'raise']] as const).filter(([k]) => k > 0).sort((p, q) => q[0] - p[0]);
    return parts.map(([k, w]) => `${k} ${w}${k === 1 ? '' : 's'}`).join(' and ');
  };
  if (legs.length > 1) {
    const tw = weekly[legs.at(-1)!.i0]!, peak = legs.at(-2)!.dir === 'up', ch = last.mean! / tw.mean! - 1, c = counted(tw.t);
    const since = Math.abs(ch) < 0.005 ? `is at ${axisPrice(last.mean!)} now` : `has ${ch < 0 ? 'fallen' : 'risen'} ${Math.round(Math.abs(ch) * 100)}% since, to ${axisPrice(last.mean!)}`;
    return say`The average price target for ${who} ${peak ? 'peaked' : 'bottomed'} at ${axisPrice(tw.mean!)} in the week to ${date(tw.t)} and ${since}${c ? `: ${c} since then` : ''}.`;
  }
  const year = isoDay(last.t) - isoDay(first.t) >= 350, ch = last.mean! / first.mean! - 1, c = counted(year ? null : first.t), tail = c ? `: ${c}` : '';
  // an average that did not move is not «rose» (review, 2026-11-14: «rose from $50.00 to $50.00 (0%)» on a new listing)
  if (Math.abs(ch) < 0.005) return say`The average price target for ${who} has held at about ${axisPrice(last.mean!)} ${year ? 'over the last 12 months' : `since the week to ${date(first.t)}`}${tail}.`;
  const moved = year ? `${ch < 0 ? 'fell' : 'rose'} from ${axisPrice(first.mean!)} to ${axisPrice(last.mean!)} in 12 months`
    : `${ch < 0 ? 'has fallen' : 'has risen'} from ${axisPrice(first.mean!)} to ${axisPrice(last.mean!)} since the week to ${date(first.t)}`;
  return say`The average price target for ${who} ${moved} (${pct(ch, 0)})${tail}.`;
}

@Component({
  selector: 'pt-price-target',
  imports: [PtChart, PtLogo, PtSay, PtTimeAxis],
  template: `
    @let a = data();
    @if (hidden()) {<p class="pt-na">No weekly target for this {{ mode() === 'sector' ? 'sector' : 'fund' }}</p>}
    @else if (a === null) {<p class="pt-na">Data not available</p>}
    @else if (a && (!a.summary || !a.targets.length)) {<p class="pt-na">No analyst targets in the last 12 months</p>}
    @else if (a && a.summary && ready()) {
      <figure class="pt-chart pt-pt">
        @if (mode() === 'company') {<p class="pt-lede">{{ a.summary.n }} firm{{ a.summary.n === 1 ? '' : 's' }} with a target in the last 12 months · last close {{ money(a.price) }} · as of {{ date(a.asOf) }}</p>}
        @else {<p class="pt-lede">Analysts' targets on its {{ mode() === 'sector' ? 'companies, weighted by their value today' : 'holdings, weighted as it holds them today' }}, week by week over the last 12 months · {{ mode() === 'sector' ? 'its value' : 'last close' }} {{ cash(a.price) }} · as of {{ date(a.asOf) }}</p>}
        @if (c(); as c) {
          <div class="pt-legend">
            @if (mode() === 'company') {<span class="pt-lg-price">— actual price</span><span class="pt-lg-up">● bullish target</span><span class="pt-lg-down">● bearish target</span><span class="pt-lg-lvl">┄ last close, high, average and low target</span>}
            @else {<span class="pt-lg-price">— {{ mode() === 'sector' ? 'its companies\\' value' : 'actual price' }}</span><span class="pt-lg-up">● a week's target above it</span><span class="pt-lg-down">● below it</span><span class="pt-lg-lvl">┄ {{ mode() === 'sector' ? 'its value' : 'last close' }} and today's target</span>}
            <span class="pt-lg-hint">hover a dot to see {{ mode() === 'company' ? 'the analysts behind it' : 'its largest companies that week' }} ·wheel or drag to move through time · drag the price axis on the right to stretch it · double-click resets</span>
          </div>
          <div ptChart [w]="c.w" [h]="c.h" [plotW]="c.w - MR" [plotH]="c.h - MB" [id]="id()" [label]="'Analyst price targets over time'" [(view)]="view">
            <svg:g ptDefs>
              @for (sg of c.segments; track $index) {
                <linearGradient [attr.id]="id() + 'g' + $index" gradientUnits="userSpaceOnUse" [attr.x1]="sg.x1" y1="0" [attr.x2]="sg.x2" y2="0">
                  <stop offset="0" class="pt-grad-from" /><stop offset="1" [attr.class]="sg.up ? 'pt-grad-up' : 'pt-grad-down'" />
                </linearGradient>
              }
            </svg:g>
            <svg:g ptAxes>
              @for (l of c.levels; track l.key) {
                @if (l.tone === 'now') {<rect class="pt-lvl-pill" [attr.x]="f(c.w - 9 - textW(l.label))" [attr.y]="f(l.labelY - 7)" [attr.width]="f(textW(l.label) + 8)" height="14" rx="3" />}
                <text [attr.class]="'pt-lvl-t pt-lvl-t-' + l.tone" [attr.x]="c.w - 5" [attr.y]="f(l.labelY + 3.5)" text-anchor="end" [attr.data-tip]="l.tip">{{ l.label }}</text>
                <text [attr.class]="'pt-lvl-n pt-lvl-n-' + l.tone" [attr.x]="f(c.w - 5 - textW(l.label) / 2)" [attr.y]="f(l.labelY + NAME_DY)" text-anchor="middle">{{ l.name }}</text>
              }
              <svg:g ptTimeAxis [h]="c.h" [plotW]="c.w - MR" [ticks]="c.xTicks"></svg:g>
            </svg:g>
            <svg:g ptPlot>
              @for (l of c.levels; track l.key) {<line [attr.class]="'pt-lvl pt-lvl-' + l.tone" x1="0" [attr.x2]="c.w - MR" [attr.y1]="l.y" [attr.y2]="l.y" />}
              <path class="pt-price" [attr.d]="c.pricePath" />
              <!-- one group per target dot: its segments, the dot, its % label and its orbit ring, so CSS hover lights them together -->
              @for (g of groups(); track g.i) {
                <g class="pt-cl">
                  @for (s of g.segs; track s.k) {
                    <g class="pt-sg"><path class="pt-seg" [attr.stroke]="'url(#' + id() + 'g' + s.k + ')'" [attr.d]="s.sg.line" /><path class="pt-seg-hit" [attr.d]="s.sg.line" /></g>
                  }
                  <circle [attr.class]="'pt-dot ' + tone(g.cl.up)" [attr.data-i]="g.i" [attr.tabindex]="0" [attr.cx]="g.cl.x" [attr.cy]="g.cl.y" [attr.r]="g.cl.r" [attr.aria-label]="g.label"
                    (pointerover)="open.set(g.i)" (pointerout)="open.set(null)" (focusin)="open.set(g.i)" (focusout)="open.set(null)" />
                  <text [attr.class]="'pt-pct ' + tone(g.cl.up)" [attr.x]="g.pctX" [attr.y]="f(g.cl.y + 3)" [attr.text-anchor]="g.cl.labelLeft ? 'end' : null">{{ g.cl.pctLabel }}</text>
                  <circle [attr.class]="'pt-orbit ' + tone(g.cl.up)" [attr.cx]="g.cl.x" [attr.cy]="g.cl.y" [attr.r]="f(g.cl.r + 4)" [style.transform-origin]="g.cl.x + 'px ' + g.cl.y + 'px'" />
                </g>
              }
              @for (d of c.startDots; track $index) {<circle class="pt-start" [attr.cx]="d.x" [attr.cy]="d.y" [attr.r]="d.r" />}
            </svg:g>
            <ng-container ngProjectAs="[ptAfter]">
              @for (g of groups(); track g.i) {
                <div [class]="g.panel.above ? 'pt-members pt-members-above' : 'pt-members'" [attr.data-i]="g.i" [hidden]="open() !== g.i" [style.--pt-x]="g.panel.left" [style.top]="g.panel.top">
                  @if (mode() === 'company') {
                    @for (r of g.rows; track r.m.firm + r.m.date + r.m.target) {
                      <div class="pt-mem" [style.animation-delay]="r.delay">
                        <span class="pt-mem-analyst">{{ r.m.firm }}</span><span [class]="'pt-mem-target ' + tone(g.cl.up)">{{ cash(r.m.target, 0) }}</span>
                        <span class="pt-mem-date">{{ r.m.date }}</span>@if (r.acc) {<span [class]="'pt-mem-acc ' + r.acc.cls">{{ r.acc.text }}</span>}
                      </div>
                    }
                    @if (g.more > 0) {<div class="pt-mem pt-mem-more" [style.animation-delay]="moreDelay">+{{ g.more }} more</div>}
                  } @else {
                    <div class="pt-mem pt-mem-week">{{ g.week }}</div>
                    @for (x of g.cos; track x.ticker) {
                      <div class="pt-mem pt-mem-co" [style.animation-delay]="x.delay"><pt-logo [ticker]="x.ticker" [src]="x.logo" [size]="16" /><span class="pt-mem-analyst">{{ x.name }}</span><span [class]="'pt-mem-target ' + x.tone">{{ x.up }}</span></div>
                    }
                  }
                </div>
              }
            </ng-container>
          </div>
          @if (trend(); as k) {
            <p class="pt-legend pt-trend-legend"><span>Average target, week by week</span><span class="pt-lg-up">— rising</span><span class="pt-lg-down">— falling</span><span class="pt-lg-hint">hover a week to see who raised or cut</span></p>
            <svg class="pt-trend" [attr.viewBox]="'0 0 ' + k.w + ' ' + k.h" role="img" [attr.aria-label]="k.label">
              <defs><clipPath [attr.id]="id() + 'tc'"><rect x="0" y="0" [attr.width]="k.w - MR" [attr.height]="k.h" /></clipPath></defs>
              @for (g of k.grid; track g.y) {
                <line class="pt-grid" x1="0" [attr.x2]="k.w - MR" [attr.y1]="g.y" [attr.y2]="g.y" /><text class="pt-axis" [attr.x]="k.w - 4" [attr.y]="f(g.y + 3)" text-anchor="end">{{ g.label }}</text>
              }
              <g [attr.clip-path]="'url(#' + id() + 'tc)'">
                @for (l of k.legs; track $index) {<path [attr.class]="'pt-trend-leg pt-trend-' + l.dir" [attr.d]="l.path" />}
                @for (w of k.weeks; track w.t) {@if (w.tip) {<rect class="pt-trend-hit" [attr.x]="w.x0" y="0" [attr.width]="w.w" [attr.height]="k.h" [attr.data-tip]="w.tip" />}}
                @if (k.turn; as t) {
                  <circle [attr.class]="'pt-trend-dot pt-trend-turn pt-trend-dot-' + (t.peak ? 'up' : 'down')" [attr.cx]="t.x" [attr.cy]="t.y" r="5" tabindex="0" [attr.aria-label]="t.label" [attr.data-tip]="t.tip" />
                  <text class="pt-trend-t" [attr.x]="t.x" [attr.y]="t.labelY" [attr.text-anchor]="t.anchor" pointer-events="none">{{ t.label }}</text>
                }
                <circle [attr.class]="'pt-trend-dot pt-trend-end pt-trend-dot-' + k.end.dir" [attr.cx]="k.end.x" [attr.cy]="k.end.y" r="4.5" tabindex="0" [attr.aria-label]="k.end.label" [attr.data-tip]="k.end.tip" />
                <text class="pt-trend-t" [attr.x]="f(k.end.x + 9)" [attr.y]="f(k.end.y + 4)" pointer-events="none">{{ k.end.label }}</text>
              </g>
            </svg>
            @if (trendSay(); as s) {<p class="pt-lede pt-trend-say"><pt-say [parts]="s" /></p>}
          }
          @if (cons(); as k) {
            <svg class="pt-cons" [attr.viewBox]="'0 0 ' + k.w + ' ' + k.h" role="img" [attr.aria-label]="k.label">
              <defs><clipPath [attr.id]="id() + 'cc'"><rect x="0" y="0" [attr.width]="k.w - MR" [attr.height]="k.h" /></clipPath></defs>
              <line class="pt-grid" x1="0" [attr.x2]="k.w - MR" [attr.y1]="k.yMax" [attr.y2]="k.yMax" />
              <text class="pt-axis" [attr.x]="k.w - 4" [attr.y]="f(k.yMax + 3)" text-anchor="end">{{ k.maxTotal }}</text>
              <g [attr.clip-path]="'url(#' + id() + 'cc)'">
                @for (l of k.layers; track l.band) {<path [attr.class]="'pt-cons-band pt-cons-' + l.band" [attr.d]="l.path" />}
                @for (m of k.months; track m.period) {<rect class="pt-cons-hit" [attr.x]="m.x0" y="0" [attr.width]="m.w" [attr.height]="k.h" [attr.data-tip]="m.tip" />}
              </g>
              <line class="pt-cons-base" x1="0" [attr.x2]="k.w - MR" [attr.y1]="k.y0" [attr.y2]="k.y0" />
            </svg>
          }
        }
        @if (consensus(); as k) {
          @if (!cons()) {<div class="pt-consensus" aria-hidden="true">@for (b of k.bars; track b.cls) {<span [class]="b.cls" [style.width]="b.width"></span>}</div>}
          <p class="pt-cons-keys">@for (x of k.keys; track x.cls) {<span [class]="x.cls">{{ x.text }}</span>}</p>
        }
        @if (consensusLine(); as t) {<p class="pt-lede">{{ t }}</p>}
      </figure>
    }`,
})
export class PtPriceTarget {
  private readonly pt = inject(Pt);
  readonly ticker = input<string | null>(null);
  /** On a fund's page, with its ticker: its holdings' targets, weighted, week by week (basket@1), on the fund's price. */
  readonly basket = input(false);
  /** On a sector's page: its companies' targets, weighted, week by week (sector@1), on its value line. */
  readonly sector = input<Sector | null>(null);

  protected readonly mode = computed(() => (this.sector() ? 'sector' : this.basket() ? 'fund' : 'company'));
  private readonly own = () => (this.mode() === 'company' ? this.ticker() : null);
  protected readonly analysts = this.pt.analysts(() => { const t = this.own(); return t ? { ticker: t, window: '1y' as const } : null; });
  private readonly fundCall = this.pt.basket(() => { const t = this.ticker(); return this.mode() === 'fund' && t ? { ticker: t } : null; });
  private readonly sectorCall = this.pt.sector(() => { const s = this.sector(); return s ? { sector: s } : null; });
  protected readonly series = this.pt.priceSeries(() => { const t = this.ticker(); return this.mode() !== 'sector' && t ? { tickers: [t], range: '1y' as const, interval: '1d' as const, rebase: false } : null; });
  private readonly bk = computed(() => (this.mode() === 'fund' ? this.fundCall.value() : this.mode() === 'sector' ? this.sectorCall.value() : undefined));
  /**
   * The analysts in one shape: a company's own, or a basket's weeks as its targets, each from that week's price (Romeo, 2026-11-07: the company pages'
   * chart on ETFs and sectors). A basket has no consensus by month here: its figures below the chart carry it.
   */
  protected readonly data = computed<Analysts | null | undefined>(() => {
    if (this.mode() === 'company') return this.own() ? this.analysts.value() : null;
    const b = this.bk();
    if (!b) return b;
    const weeks = (b.targetHistory ?? []).filter((w) => w.target != null), t = b.target?.price;
    return { asOf: b.asOf, price: 'kind' in b ? b.value : b.close, history: [], consensus: null, accuracy: [],
      summary: t != null && weeks.length ? { low: t, mean: t, median: t, high: t, n: weeks.length } : null,
      targets: weeks.map((w) => ({ date: w.t, firm: 'Week', target: w.target!, priceWhenPosted: w.price })) };
  });
  /** A basket's dot names its newest week's largest companies (Romeo, 2026-11-07: «the surrounding companies with logos»): their names and logos from the page's holdings. */
  private readonly weekOf = computed(() => new Map((this.bk()?.targetHistory ?? []).map((w) => [w.t, w])));
  private readonly holdingOf = computed(() => new Map((this.bk()?.holdings ?? []).flatMap((h) => (h.ticker ? [[h.ticker, h] as const] : []))));
  /** A basket with no weeks (a fund under 80%, a payload of before them): no chart, one line saying so. */
  protected readonly hidden = computed(() => { const b = this.bk(); return !!b && !b.targetHistory?.some((w) => w.target != null); });
  protected readonly ready = computed(() => this.mode() === 'sector' || this.series.value() !== undefined);
  /** A sector's money in compact dollars ($28.2T): its value, its targets, its axis. */
  protected readonly cash = (v: number | null, digits = 2) => (v == null ? '' : this.mode() === 'sector' ? usd(v, { compact: true }) : money(v, digits));
  protected readonly view = linkedSignal<unknown, Viewport>({ source: () => this.series.params(), computation: () => FULL_VIEWPORT });
  /** The dot whose analysts are shown (hover or keyboard focus). */
  protected readonly open = signal<number | null>(null);
  protected readonly MR = MR;
  protected readonly MB = MB;
  protected readonly tone = tone;
  protected readonly money = money;
  protected readonly f = f;
  protected readonly date = date;
  protected readonly NAME_DY = NAME_DY;
  /** About how wide a price label is on the axis (its pill's width): digits and "$" of the axis' small type. */
  protected readonly textW = (s: string) => s.length * 5.4;
  protected readonly moreDelay = `${(MAX_MEMBER_ROWS * 0.13).toFixed(2)}s`;
  protected readonly id = computed(() => svgId(`pt${this.ticker() ?? this.sector() ?? ''}`));

  private readonly pts = computed((): PriceBar[] => (this.mode() === 'sector'
    ? (this.sectorCall.value()?.series ?? []).map(({ t, c }) => ({ t, o: c, h: c, l: c, c, v: 0 })) : this.series.value()?.[0]?.points ?? []));
  protected readonly c = computed(() => {
    const a = this.data(), m = this.mode();
    if (!a || !this.pts().length) return null;
    // a basket names one target, today's; a company its analysts' high, average and low
    const summary = a.summary && m !== 'company' ? { mean: a.summary.mean } : a.summary;
    const words = m === 'company' ? {} : { meanName: 'TARGET', meanWhat: `Today's target on its ${m === 'sector' ? 'companies' : 'holdings'}`,
      ...(m === 'sector' ? { fmt: (v: number) => usd(v, { compact: true }), nowWhat: 'Its value', fromNow: 'from its value' } : {}) };
    return buildPtChart(this.pts(), a.targets, a.asOf, a.price ?? this.pts().at(-1)?.c ?? 0, this.view(), summary, words);
  });
  protected readonly consensus = computed(() => {
    const k = this.data()?.consensus;
    if (!k) return null;
    const parts = [['sb', 'Strong buy', k.strongBuy], ['b', 'Buy', k.buy], ['h', 'Hold', k.hold], ['s', 'Sell', k.sell], ['ss', 'Strong sell', k.strongSell]] as const;
    const total = parts.reduce((n, [, , v]) => n + v, 0);
    if (!total) return null;
    return { bars: parts.filter(([, , v]) => v > 0).map(([key, , v]) => ({ cls: `pt-consensus-${key}`, width: `${((v / total) * 100).toFixed(1)}%` })),
      keys: parts.map(([key, label, v]) => ({ cls: `pt-cons-k pt-cons-k-${key}`, text: `${label} ${v}` })) };
  });
  /** The consensus in a sentence: the month by month history, or the latest month alone when the answer has no history. */
  protected readonly consensusLine = computed(() => {
    const a = this.data();
    return a ? consensusText(a.history.length ? a.history : a.consensus ? [a.consensus] : []) : null;
  });
  /** The ratings month by month under the chart, on its time axis (zoom and pan included). */
  protected readonly cons = computed(() => {
    const a = this.data(), ch = this.c();
    return a && ch ? buildConsensusHistory(a.history, ch.x) : null;
  });
  /** The page's company (the card at the top of every company page asks for it too: the same call), named in the trend's sentence. */
  private readonly company = this.pt.company(() => { const t = this.own(); return t ? { ticker: t } : null; });
  /** The average target week by week under the chart, on its time axis (zoom and pan included); a company's only, from a payload with weeks. */
  protected readonly trend = computed(() => {
    const a = this.data(), ch = this.c();
    return this.mode() === 'company' && a?.weekly && ch ? buildTrend(a.weekly, a.targets, ch.x) : null;
  });
  /** What the analysts did since the last turn, in a sentence; none while the company's name is on its way. */
  protected readonly trendSay = computed(() => {
    const a = this.data(), t = this.own(), co = this.company.value();
    return a?.weekly && t && co !== undefined ? trendText(mention(t, co?.name ?? null, co?.logo ?? null), a.weekly, a.targets) : null;
  });
  private readonly accuracy = computed(() => new Map((this.data()?.accuracy ?? []).filter((x) => x.total > 0).map((x) => [x.firm, x])));
  protected readonly groups = computed(() => {
    const ch = this.c();
    if (!ch) return [];
    const acc = this.accuracy(), basket = this.mode() !== 'company', weekOf = this.weekOf(), holdingOf = this.holdingOf();
    return ch.clusters.map((cl, i) => {
      const one = cl.members[0]!;
      const cos = basket ? (weekOf.get(one.date)?.top ?? []).flatMap((c, k) => { const h = holdingOf.get(c.ticker);
        return h ? [{ ticker: c.ticker, name: plainName(h.name), logo: h.logo, up: pct(c.upside, 0), tone: tone(c.upside >= 0), delay: `${(k * 0.13).toFixed(2)}s` }] : []; }) : [];
      const week = `Week of ${date(one.date)}`;
      // % coordinates in the responsive wrapper; x clamped so the panel stays inside, flipped above the dot in the bottom third.
      const above = cl.y > ch.h * 0.62;
      const left = Math.min(85, Math.max(15, (cl.x / ch.w) * 100));
      const top = above ? ((cl.y - cl.r - 5) / ch.h) * 100 : ((cl.y + cl.r + 5) / ch.h) * 100;
      return {
        cl, i,
        segs: ch.segments.map((sg, k) => ({ sg, k })).filter(({ sg }) => sg.endIdx === i),
        label: basket ? [week, ...cos.map((x) => `${x.name} ${x.up}`)].join(', ')
          : cl.members.length > 1 ? `${cl.members.length} targets, about ${this.cash(cl.meanTarget, 0)}` : `${one.firm}, ${this.cash(one.target, 0)}, ${one.date}`,
        week, cos,
        pctX: f(cl.labelLeft ? cl.x - cl.r - 3 : cl.x + cl.r + 3),
        panel: { above, left: `${f(left)}%`, top: `${f(top)}%` },
        rows: cl.members.slice(0, MAX_MEMBER_ROWS).map((m, k) => {
          const hit = acc.get(m.firm);
          return { m, delay: `${(k * 0.13).toFixed(2)}s`,
            acc: hit ? { cls: hit.hits / hit.total >= 0.5 ? 'pt-acc-good' : 'pt-acc-bad', text: `${Math.round((hit.hits / hit.total) * 100)}% · ${hit.total}` } : null };
        }),
        more: cl.members.length - MAX_MEMBER_ROWS,
      };
    });
  });
}

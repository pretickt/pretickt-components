/**
 * Where do analysts think this stock is going, and how spread out are they?
 * @version 2.4.1
 * @evidence DataForSEO: "{ticker} price target" ~103k searches/month, "{ticker} stock forecast" ~151k (launch/data, public-site spec §4)
 * @evidence beta: pt-chart (pretickt-frontend/src/app/companies/pt-chart.ts) — geometry, clustering, hover animations and zoom/pan ported 1:1
 * @evidence Romeo, 2026-10-26: "togliamo la linea verticale e mettiamo dei prezzi sull'asse a destra del prezzo, con linee tratteggiate orizzontali di colore opportuno"
 * @evidence Romeo, 2026-10-26: "sotto al ptarget deve essere un piccolo grafico con stessi valori dell'asse x price target, ma con rendering come in beta … nella sezione consensus, ma meno alta, diciamo la metà circa" (beta: consensus-history)
 * @evidence Romeo, 2026-10-26: the upright summary of 2.3 goes ("questo va tolto") — high, average, low and today are on the price axis now —
 *   and the legend sits above the chart, so the consensus follows the chart it shares an axis with
 */
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { applyXViewport, applyYViewport, closeAt, FULL_VIEWPORT, isoDay, linePath, monthTicks, padTime, PtChart, PtTimeAxis, type Viewport } from '@pretickt/components/ds';
import { date, money, month, pct, svgId, tip, usd } from '@pretickt/components/format';
import { cmp, type Analysts, type PriceBar } from '@pretickt/components/typologies';

type Target = Analysts['targets'][number];
/** The targets the price axis names: the summary's high, average and low. */
export type LevelSummary = Pick<NonNullable<Analysts['summary']>, 'low' | 'mean' | 'high'>;

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
  summary: LevelSummary | null = null): PtTargetChart | null {
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

  const named = [
    ...(summary ? ([['high', 'HIGH', 'High target', summary.high], ['mean', 'AVERAGE', 'Average target', summary.mean], ['low', 'LOW', 'Low target', summary.low]] as const) : [])
      .map(([key, name, what, v]) => ({ key, v, name, tone: levelTone(v, current), tip: `${what} ${money(v)} · ${pct(v / current - 1)} from the last close` })),
    { key: 'now' as const, v: current, name: 'TODAY', tone: 'now' as const, tip: `Last close ${money(current)}` },
  ];
  const levels = placeLevels(named.map((l) => ({ ...l, y: f(sy(l.v)), label: axisPrice(l.v) })).filter((l) => l.y >= MT && l.y <= H - MB));

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

@Component({
  selector: 'pt-price-target',
  imports: [PtChart, PtTimeAxis],
  template: `
    @let a = analysts.value();
    @if (a === null) {<p class="pt-na">Data not available</p>}
    @else if (a && (!a.summary || !a.targets.length)) {<p class="pt-na">No analyst targets in the last 12 months</p>}
    @else if (a && a.summary && series.value() !== undefined) {
      <figure class="pt-chart pt-pt">
        <p class="pt-lede">{{ a.summary.n }} firm{{ a.summary.n === 1 ? '' : 's' }} with a target in the last 12 months · last close {{ money(a.price) }} · as of {{ date(a.asOf) }}</p>
        @if (c(); as c) {
          <div class="pt-legend">
            <span class="pt-lg-price">— actual price</span><span class="pt-lg-up">● bullish target</span><span class="pt-lg-down">● bearish target</span><span class="pt-lg-lvl">┄ last close, high, average and low target</span>
            <span class="pt-lg-hint">hover a dot to see the analysts behind it · wheel or drag to move through time · drag the price axis on the right to stretch it · double-click resets</span>
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
                <div [class]="g.panel.above ? 'pt-members pt-members-above' : 'pt-members'" [attr.data-i]="g.i" [hidden]="open() !== g.i" [style.left]="g.panel.left" [style.top]="g.panel.top">
                  @for (r of g.rows; track r.m.firm + r.m.date + r.m.target) {
                    <div class="pt-mem" [style.animation-delay]="r.delay">
                      <span class="pt-mem-analyst">{{ r.m.firm }}</span><span [class]="'pt-mem-target ' + tone(g.cl.up)">{{ money(r.m.target, 0) }}</span>
                      <span class="pt-mem-date">{{ r.m.date }}</span>@if (r.acc) {<span [class]="'pt-mem-acc ' + r.acc.cls">{{ r.acc.text }}</span>}
                    </div>
                  }
                  @if (g.more > 0) {<div class="pt-mem pt-mem-more" [style.animation-delay]="moreDelay">+{{ g.more }} more</div>}
                </div>
              }
            </ng-container>
          </div>
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
  readonly ticker = input.required<string>();

  protected readonly analysts = this.pt.analysts(() => ({ ticker: this.ticker(), window: '1y' }));
  protected readonly series = this.pt.priceSeries(() => ({ tickers: [this.ticker()], range: '1y', interval: '1d', rebase: false }));
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
  protected readonly id = computed(() => svgId(`pt${this.ticker()}`));

  private readonly pts = computed(() => this.series.value()?.[0]?.points ?? []);
  protected readonly c = computed(() => {
    const a = this.analysts.value(), s = this.series.value();
    return a && s ? buildPtChart(this.pts(), a.targets, a.asOf, a.price ?? this.pts().at(-1)?.c ?? 0, this.view(), a.summary) : null;
  });
  protected readonly consensus = computed(() => {
    const k = this.analysts.value()?.consensus;
    if (!k) return null;
    const parts = [['sb', 'Strong buy', k.strongBuy], ['b', 'Buy', k.buy], ['h', 'Hold', k.hold], ['s', 'Sell', k.sell], ['ss', 'Strong sell', k.strongSell]] as const;
    const total = parts.reduce((n, [, , v]) => n + v, 0);
    if (!total) return null;
    return { bars: parts.filter(([, , v]) => v > 0).map(([key, , v]) => ({ cls: `pt-consensus-${key}`, width: `${((v / total) * 100).toFixed(1)}%` })),
      keys: parts.map(([key, label, v]) => ({ cls: `pt-cons-k pt-cons-k-${key}`, text: `${label} ${v}` })) };
  });
  /** The consensus in a sentence: the month by month history, or the latest month alone when the answer has no history. */
  protected readonly consensusLine = computed(() => {
    const a = this.analysts.value();
    return a ? consensusText(a.history.length ? a.history : a.consensus ? [a.consensus] : []) : null;
  });
  /** The ratings month by month under the chart, on its time axis (zoom and pan included). */
  protected readonly cons = computed(() => {
    const a = this.analysts.value(), ch = this.c();
    return a && ch ? buildConsensusHistory(a.history, ch.x) : null;
  });
  private readonly accuracy = computed(() => new Map((this.analysts.value()?.accuracy ?? []).filter((x) => x.total > 0).map((x) => [x.firm, x])));
  protected readonly groups = computed(() => {
    const ch = this.c();
    if (!ch) return [];
    const acc = this.accuracy();
    return ch.clusters.map((cl, i) => {
      const one = cl.members[0]!;
      // % coordinates in the responsive wrapper; x clamped so the panel stays inside, flipped above the dot in the bottom third.
      const above = cl.y > ch.h * 0.62;
      const left = Math.min(85, Math.max(15, (cl.x / ch.w) * 100));
      const top = above ? ((cl.y - cl.r - 5) / ch.h) * 100 : ((cl.y + cl.r + 5) / ch.h) * 100;
      return {
        cl, i,
        segs: ch.segments.map((sg, k) => ({ sg, k })).filter(({ sg }) => sg.endIdx === i),
        label: cl.members.length > 1 ? `${cl.members.length} targets, about ${money(cl.meanTarget, 0)}` : `${one.firm}, ${money(one.target, 0)}, ${one.date}`,
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

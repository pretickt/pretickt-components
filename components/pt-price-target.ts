import * as z from 'zod/mini';
import {
  applyXViewport, applyYViewport, closeAt, defineComponent, FULL_VIEWPORT, isoDay, linePath, monthTicks, ViewportParam, type DataFor, type Helpers, type Kit, type Viewport,
} from '../src/sdk';
import { cmp, Ticker, type Analysts, type PriceBar, type PriceSeries } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-price-target',
  version: '1.3.0',
  need: {
    question: 'Where do analysts think this stock is going, and how spread out are they?',
    evidence: [
      'DataForSEO: "{ticker} price target" ~103k searches/month, "{ticker} stock forecast" ~151k (launch/data, public-site spec §4)',
      'beta: pt-chart (pretickt-frontend/src/app/companies/pt-chart.ts) — geometry, clustering, hover animations and zoom/pan ported 1:1',
    ],
  },
  params: z.object({ ticker: Ticker, view: z.optional(ViewportParam) }),
  user: [],
  uses: [],
  needs: (p) => ({
    analysts: { t: 'analysts@1', params: { ticker: p.ticker, window: '1y' } },
    series: { t: 'price-series@1', params: { tickers: [p.ticker], range: '1y', interval: '1d', rebase: false } },
  }),
});

export const samples = [{ ticker: 'NVDA' }, { ticker: 'BRK.B' }];

type Data = DataFor<{ analysts: Analysts; series: PriceSeries }>;
type Target = Analysts['targets'][number];

// ── Geometry, ported from beta pt-chart.geometry.ts (targets already arrive on our adjusted basis). x unit: days (isoDay). ─────
const W = 800, H = 340, ML = 6, MR = 46, MT = 12, MB = 22;
const START_DAYS = 15;   // start points within a fortnight merge
const END_PCT = 0.2;     // targets within 20% (value) …
const END_DAYS = 45;     // … and ~45 days apart merge
const MAX_MEMBER_ROWS = 6;
const LABEL_W = 30;      // room a "+139%" label needs right of its dot

export interface PtSegment { up: boolean; line: string; x1: number; x2: number; endIdx: number }
export interface PtCluster {
  x: number; y: number; r: number; up: boolean; pctLabel: string; members: Target[]; meanTarget: number;
  /** no room right of the dot */ labelLeft: boolean;
}
export interface PtChart {
  w: number; h: number; pricePath: string; todayX: number;
  yTicks: { y: number; v: number }[]; xTicks: { x: number; label: string }[];
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
 * versus the current price. "Today" is `asOf`: a component never reads the clock.
 */
export function buildPtChart(points: PriceBar[], targets: Target[], asOf: string, current: number, viewport: Viewport = FULL_VIEWPORT): PtChart | null {
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
  const { min: xMin, max: xMax } = applyXViewport(Math.min(isoDay(points[0]!.t), ...items.map((t) => t.start)),
    Math.max(isoDay(points.at(-1)!.t), today, ...items.map((t) => t.end)), viewport);
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

  return {
    w: W, h: H, todayX: f(sx(today)),
    pricePath: linePath(points.map((p) => [sx(isoDay(p.t)), sy(p.c)])),
    yTicks: [0, 1, 2, 3, 4].map((i) => { const v = yLo + ((yHi - yLo) * i) / 4; return { y: f(sy(v)), v }; }),
    xTicks: monthTicks(xMin, xMax).map((t) => ({ x: f(sx(t.day)), label: t.label })),
    segments: [...segments.values()],
    startDots: starts.groups.map((g) => { const s = at(g, 'start'); return { x: f(sx(s.day)), y: f(sy(s.y)), r: f(1.8 + Math.min(Math.sqrt(g.length) * 0.8, 3.5)) }; }),
    clusters,
  };
}

// ── Markup ─────────────────────────────────────────────────────────────────────────────────────────────────────
function stats(a: Analysts, h: Helpers): string {
  const s = a.summary!;
  const up = a.price ? s.mean / a.price - 1 : null;
  const cell = (k: string, v: string) => `<div class="pt-pt-stat"><span>${k}</span><b>${h.esc(v)}</b></div>`;
  return `<div class="pt-pt-summary">${cell('Low', h.money(s.low))}${cell('Average', h.money(s.mean))}${cell('Median', h.money(s.median))}` +
    `${cell('High', h.money(s.high))}${cell('Upside', h.pct(up))}</div>` +
    `<p class="pt-lede">${s.n} firm${s.n === 1 ? '' : 's'} with a target in the last 12 months · last close ${h.money(a.price)} · as of ${h.date(a.asOf)}</p>`;
}

function consensus(a: Analysts): string {
  const c = a.consensus;
  if (!c) return '';
  const parts: [string, string, number][] = [['sb', 'Strong buy', c.strongBuy], ['b', 'Buy', c.buy], ['h', 'Hold', c.hold], ['s', 'Sell', c.sell], ['ss', 'Strong sell', c.strongSell]];
  const total = parts.reduce((n, [, , v]) => n + v, 0);
  if (!total) return '';
  const bar = parts.filter(([, , v]) => v > 0).map(([k, , v]) => `<span class="pt-consensus-${k}" style="width:${((v / total) * 100).toFixed(1)}%"></span>`).join('');
  return `<div class="pt-consensus" aria-hidden="true">${bar}</div><p class="pt-lede">${parts.map(([, label, v]) => `${label} ${v}`).join(' · ')}</p>`;
}

const tone = (up: boolean) => (up ? 'pt-pos' : 'pt-neg');
type Accuracy = Map<string, Analysts['accuracy'][number]>;

/** Rows revealed one by one under a hovered dot (beta's member panel); hidden until the element shows them. */
function members(c: PtChart, cl: PtCluster, i: number, acc: Accuracy, h: Helpers): string {
  const rows = cl.members.slice(0, MAX_MEMBER_ROWS).map((m, k) => {
    const hit = acc.get(m.firm);
    const accCell = hit
      ? `<span class="pt-mem-acc ${hit.hits / hit.total >= 0.5 ? 'pt-acc-good' : 'pt-acc-bad'}">${Math.round((hit.hits / hit.total) * 100)}% · ${hit.total}</span>`
      : '';
    return `<div class="pt-mem" style="animation-delay:${(k * 0.13).toFixed(2)}s"><span class="pt-mem-analyst">${h.esc(m.firm)}</span>` +
      `<span class="pt-mem-target ${tone(cl.up)}">${h.money(m.target, 0)}</span><span class="pt-mem-date">${h.esc(m.date)}</span>${accCell}</div>`;
  }).join('');
  const more = cl.members.length - MAX_MEMBER_ROWS;
  const extra = more > 0 ? `<div class="pt-mem pt-mem-more" style="animation-delay:${(MAX_MEMBER_ROWS * 0.13).toFixed(2)}s">+${more} more</div>` : '';
  // % coordinates in the responsive wrapper; x clamped so the panel stays inside, flipped above the dot in the bottom third.
  const above = cl.y > c.h * 0.62;
  const left = Math.min(85, Math.max(15, (cl.x / c.w) * 100));
  const top = above ? ((cl.y - cl.r - 5) / c.h) * 100 : ((cl.y + cl.r + 5) / c.h) * 100;
  return `<div class="pt-members${above ? ' pt-members-above' : ''}" data-i="${i}" hidden style="left:${f(left)}%;top:${f(top)}%">${rows}${extra}</div>`;
}

function chart(a: Analysts, s: PriceSeries, ticker: string, view: Viewport | undefined, h: Helpers): string {
  const pts = s[0]?.points ?? [];
  const c = buildPtChart(pts, a.targets, a.asOf, a.price ?? pts.at(-1)?.c ?? 0, view);
  if (!c) return '';
  const fr = { w: c.w, h: c.h, plotW: c.w - MR, plotH: c.h - MB, id: h.svgId(`pt${ticker}`), label: 'Analyst price targets over time', view };
  const grads = c.segments.map((sg, i) =>
    `<linearGradient id="${fr.id}g${i}" gradientUnits="userSpaceOnUse" x1="${sg.x1}" y1="0" x2="${sg.x2}" y2="0">` +
    `<stop offset="0" class="pt-grad-from"/><stop offset="1" class="${sg.up ? 'pt-grad-up' : 'pt-grad-down'}"/></linearGradient>`).join('');
  // One group per target dot: its segments, the dot, its % label and its orbit ring, so CSS hover can light them together.
  const groups = c.clusters.map((cl, i) => {
    const segs = c.segments.map((sg, k) => [sg, k] as const).filter(([sg]) => sg.endIdx === i).map(([sg, k]) =>
      `<g class="pt-sg"><path class="pt-seg" stroke="url(#${fr.id}g${k})" d="${sg.line}"/><path class="pt-seg-hit" d="${sg.line}"/></g>`).join('');
    const one = cl.members[0]!;
    const label = cl.members.length > 1 ? `${cl.members.length} targets, about ${h.money(cl.meanTarget, 0)}` : `${one.firm}, ${h.money(one.target, 0)}, ${one.date}`;
    return `<g class="pt-cl">${segs}<circle class="pt-dot ${tone(cl.up)}" data-i="${i}" tabindex="0" cx="${cl.x}" cy="${cl.y}" r="${cl.r}" aria-label="${h.esc(label)}"/>` +
      `<text class="pt-pct ${tone(cl.up)}" x="${f(cl.labelLeft ? cl.x - cl.r - 3 : cl.x + cl.r + 3)}" y="${f(cl.y + 3)}"${cl.labelLeft ? ' text-anchor="end"' : ''}>${cl.pctLabel}</text>` +
      `<circle class="pt-orbit ${tone(cl.up)}" cx="${cl.x}" cy="${cl.y}" r="${f(cl.r + 4)}" style="transform-origin:${cl.x}px ${cl.y}px"/></g>`;
  }).join('');
  const starts = c.startDots.map((d) => `<circle class="pt-start" cx="${d.x}" cy="${d.y}" r="${d.r}"/>`).join('');
  const acc: Accuracy = new Map(a.accuracy.filter((x) => x.total > 0).map((x) => [x.firm, x]));
  const legend = `<div class="pt-legend"><span class="pt-lg-price">— actual price</span><span class="pt-lg-up">● bullish target</span>` +
    `<span class="pt-lg-down">● bearish target</span><span class="pt-lg-hint">hover a dot to see the analysts behind it · wheel or drag to move through time · ` +
    `drag the price axis on the right to stretch it · double-click resets</span></div>`;
  return h.chartFrame(fr, {
    defs: grads,
    axes: h.yAxis(fr, c.yTicks) + h.timeAxis(fr, c.xTicks),
    plot: `<line class="pt-today" x1="${c.todayX}" y1="0" x2="${c.todayX}" y2="${c.h}"/><path class="pt-price" d="${c.pricePath}"/>${groups}${starts}`,
    after: c.clusters.map((cl, i) => members(c, cl, i, acc, h)).join(''),
  }) + legend;
}

export function renderStatic(data: Data, p: z.output<typeof manifest.params>, h: Helpers): string {
  const a = data.analysts;
  if (!a) return h.na();
  if (!a.summary || !a.targets.length) return h.na('No analyst targets in the last 12 months');
  return `<figure class="pt-chart pt-pt">${stats(a, h)}${data.series ? chart(a, data.series, p.ticker, p.view, h) : ''}${consensus(a)}</figure>`;
}

/** Beta's hover panel: the dot (or keyboard focus on it) reveals the rows of its analysts. Segments and the orbit are CSS. */
export const element = ({ PtElement }: Kit<HTMLElement>) => class extends PtElement {
  firstUpdated() {
    super.firstUpdated();
    const toggle = (e: Event, show: boolean) => {
      const dot = (e.target as Element).closest?.('.pt-dot[data-i]');
      if (!dot || !this.contains(dot)) return;
      const panel = this.querySelector<HTMLElement>(`.pt-members[data-i="${dot.getAttribute('data-i')}"]`);
      if (panel) panel.hidden = !show;
    };
    this.addEventListener('pointerover', (e) => toggle(e, true));
    this.addEventListener('focusin', (e) => toggle(e, true));
    this.addEventListener('pointerout', (e) => toggle(e, false));
    this.addEventListener('focusout', (e) => toggle(e, false));
  }
};

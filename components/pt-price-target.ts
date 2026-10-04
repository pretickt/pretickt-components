import * as z from 'zod/mini';
import { applyXViewport, applyYViewport, defineComponent, FULL_VIEWPORT, ViewportParam, type DataFor, type Helpers, type Kit, type Viewport } from '../src/sdk';
import { Ticker, type Analysts, type PriceSeries } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-price-target',
  version: '1.2.0',
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
interface Point { t: string; c: number }

// ── Geometry, ported from beta pt-chart.geometry.ts (targets already arrive on our adjusted basis) ──────────────
const W = 800, H = 340, ML = 6, MR = 46, MT = 12, MB = 22;
const DAY = 86_400_000;
const START_DAYS = 15 * DAY;   // start points within a fortnight merge
const END_PCT = 0.2;           // targets within 20% (value) …
const END_DAYS = 45 * DAY;     // … and ~45 days apart merge
const MAX_MEMBER_ROWS = 6;
const LABEL_W = 30;           // room a "+139%" label needs right of its dot

export interface PtSegment { up: boolean; line: string; x1: number; x2: number; endIdx: number }
export interface PtCluster { x: number; y: number; r: number; up: boolean; pctLabel: string; members: Target[]; /** no room right of the dot */ labelLeft: boolean }
export interface PtChart {
  w: number; h: number; pricePath: string; todayX: number;
  yTicks: { y: number; label: string }[]; xTicks: { x: number; label: string }[];
  segments: PtSegment[]; startDots: { x: number; y: number; r: number }[]; clusters: PtCluster[];
}

const ts = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const plus12m = (iso: string) => { const d = new Date(ts(iso)); d.setUTCMonth(d.getUTCMonth() + 12); return d.getTime(); };
const f = (n: number) => Math.round(n * 10) / 10;

/**
 * The real price line; per target a segment from its (fortnight-grouped) start on the price line to its target at the
 * +12-month horizon. Nearby targets (within 20% and ~45 days) merge into one dot sized by count and labelled with its %
 * versus the current price. "Today" is `asOf`: a component never reads the clock.
 */
export function buildPtChart(points: Point[], targets: Target[], asOf: string, current: number, viewport: Viewport = FULL_VIEWPORT): PtChart | null {
  if (!points.length || !targets.length || !(current > 0)) return null;
  const pts = points.map((p) => ({ ts: ts(p.t), close: p.c })).sort((a, b) => a.ts - b.ts);
  const closeAt = (at: number) => { let c = pts[0]!.close; for (const p of pts) { if (p.ts > at) break; c = p.close; } return c; };

  const items = targets
    .filter((t) => t.target > 0)
    .map((t) => { const startTs = ts(t.date), startY = closeAt(startTs); return { t, startTs, startY, endTs: plus12m(t.date), targetY: t.target, up: t.target > startY }; })
    .sort((a, b) => a.startTs - b.startTs);
  if (!items.length) return null;

  const starts: { sumTs: number; sumY: number; count: number }[] = [];
  const startOf: number[] = [];
  items.forEach((it, i) => {
    let ci = starts.findIndex((c) => Math.abs(it.startTs - c.sumTs / c.count) <= START_DAYS);
    if (ci < 0) { starts.push({ sumTs: 0, sumY: 0, count: 0 }); ci = starts.length - 1; }
    const c = starts[ci]!;
    c.sumTs += it.startTs; c.sumY += it.startY; c.count += 1;
    startOf[i] = ci;
  });

  const ends: { sumTs: number; sumY: number; count: number; ups: number; members: Target[] }[] = [];
  const endOf: number[] = [];
  items.forEach((it, i) => {
    let ci = ends.findIndex((c) => {
      const cy = c.sumY / c.count;
      return Math.abs(it.targetY - cy) / Math.max(cy, 1) <= END_PCT && Math.abs(it.endTs - c.sumTs / c.count) <= END_DAYS;
    });
    if (ci < 0) { ends.push({ sumTs: 0, sumY: 0, count: 0, ups: 0, members: [] }); ci = ends.length - 1; }
    const c = ends[ci]!;
    c.sumTs += it.endTs; c.sumY += it.targetY; c.count += 1; c.ups += it.up ? 1 : 0; c.members.push(it.t);
    endOf[i] = ci;
  });

  let yLo = Math.min(...pts.map((p) => p.close), ...items.map((t) => t.targetY));
  let yHi = Math.max(...pts.map((p) => p.close), ...items.map((t) => t.targetY));
  const pad = (yHi - yLo) * 0.05 || 1;
  yLo -= pad; yHi += pad;
  // The user's lens on top of the natural ranges (beta: same viewport object as the event map).
  ({ lo: yLo, hi: yHi } = applyYViewport(yLo, yHi, viewport));
  const today = ts(asOf);
  const { min: xMin, max: xMax } = applyXViewport(Math.min(pts[0]!.ts, ...items.map((t) => t.startTs)),
    Math.max(pts.at(-1)!.ts, today, ...items.map((t) => t.endTs)), viewport);
  const sx = (v: number) => ML + ((v - xMin) / (xMax - xMin || 1)) * (W - ML - MR);
  const sy = (v: number) => H - MB - ((v - yLo) / (yHi - yLo || 1)) * (H - MT - MB);
  const cx = (c: { sumTs: number; count: number }) => c.sumTs / c.count;

  const clusters: PtCluster[] = ends.map((c) => {
    const cy = c.sumY / c.count;
    const pct = (cy / current - 1) * 100;
    const x = f(sx(cx(c))), r = f(2.4 + Math.min(Math.sqrt(c.count) * 1.5, 8));
    return { x, y: f(sy(cy)), r, up: c.ups > c.count / 2, labelLeft: x + r + LABEL_W > W - MR,
      pctLabel: `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`,
      members: [...c.members].sort((a, b) => b.date.localeCompare(a.date) || a.firm.localeCompare(b.firm)) };
  });
  const seen = new Map<string, PtSegment>();
  items.forEach((_, i) => {
    const key = `${startOf[i]}:${endOf[i]}`;
    if (seen.has(key)) return;
    const s = starts[startOf[i]!]!, e = ends[endOf[i]!]!;
    const x1 = f(sx(cx(s))), y1 = f(sy(s.sumY / s.count)), x2 = f(sx(cx(e))), y2 = f(sy(e.sumY / e.count));
    seen.set(key, { up: e.ups > e.count / 2, line: `M${x1} ${y1} L${x2} ${y2}`, x1, x2, endIdx: endOf[i]! });
  });

  return {
    w: W, h: H, todayX: f(sx(today)),
    pricePath: pts.map((p, i) => `${i ? 'L' : 'M'}${f(sx(p.ts))} ${f(sy(p.close))}`).join(' '),
    yTicks: [0, 1, 2, 3, 4].map((i) => { const v = yLo + ((yHi - yLo) * i) / 4; return { y: f(sy(v)), label: `$${Math.round(v)}` }; }),
    xTicks: [0, 1, 2, 3].map((i) => { const v = xMin + ((xMax - xMin) * i) / 3; return { x: f(sx(v)), label: new Date(v).toISOString().slice(0, 7) }; }),
    segments: [...seen.values()],
    startDots: starts.map((c) => ({ x: f(sx(cx(c))), y: f(sy(c.sumY / c.count)), r: f(1.8 + Math.min(Math.sqrt(c.count) * 0.8, 3.5)) })),
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

const tone = (up: boolean) => (up ? 'pt-up' : 'pt-down');

/** Rows revealed one by one under a hovered dot (beta's member panel); hidden until the element shows them. */
function members(c: PtChart, cl: PtCluster, i: number, a: Analysts, h: Helpers): string {
  const acc = new Map(a.accuracy.filter((x) => x.total > 0).map((x) => [x.firm, x]));
  const rows = cl.members.slice(0, MAX_MEMBER_ROWS).map((m, k) => {
    const hit = acc.get(m.firm);
    const accCell = hit
      ? `<span class="pt-mem-acc ${hit.hits / hit.total >= 0.5 ? 'acc-good' : 'acc-bad'}">${Math.round((hit.hits / hit.total) * 100)}% · ${hit.total}</span>`
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
  const id = `pt${ticker.replace(/[^A-Za-z0-9]/g, '-')}`;
  const plotW = c.w - MR, plotH = c.h - MB;
  const grads = c.segments.map((sg, i) =>
    `<linearGradient id="${id}g${i}" gradientUnits="userSpaceOnUse" x1="${sg.x1}" y1="0" x2="${sg.x2}" y2="0">` +
    `<stop offset="0" class="pt-grad-from"/><stop offset="1" class="${sg.up ? 'pt-grad-up' : 'pt-grad-down'}"/></linearGradient>`).join('');
  const grid = c.yTicks.map((t) => `<line class="pt-grid" x1="0" y1="${t.y}" x2="${c.w}" y2="${t.y}"/>` +
    `<text class="pt-axis" x="${c.w - 2}" y="${f(t.y - 2)}" text-anchor="end">${t.label}</text>`).join('');
  const anchor = (i: number) => (i === 0 ? 'start' : i === c.xTicks.length - 1 ? 'end' : 'middle');
  const xticks = c.xTicks.map((t, i) => `<text class="pt-axis" x="${i === c.xTicks.length - 1 ? f(t.x - 16) : t.x}" y="${c.h - 2}" text-anchor="${anchor(i)}">${t.label}</text>`).join('');
  // One group per target dot: its segments, the dot, its % label and its orbit ring, so CSS hover can light them together.
  const groups = c.clusters.map((cl, i) => {
    const segs = c.segments.map((sg, k) => [sg, k] as const).filter(([sg]) => sg.endIdx === i).map(([sg, k]) =>
      `<g class="pt-sg"><path class="pt-seg" stroke="url(#${id}g${k})" d="${sg.line}"/><path class="pt-seg-hit" d="${sg.line}"/></g>`).join('');
    const label = cl.members.length > 1 ? `${cl.members.length} targets, about ${h.money(cl.members.reduce((n, m) => n + m.target, 0) / cl.members.length, 0)}`
      : `${cl.members[0]!.firm}, ${h.money(cl.members[0]!.target, 0)}, ${cl.members[0]!.date}`;
    return `<g class="pt-cl">${segs}<circle class="pt-dot ${tone(cl.up)}" data-i="${i}" tabindex="0" cx="${cl.x}" cy="${cl.y}" r="${cl.r}" aria-label="${h.esc(label)}"/>` +
      `<text class="pt-pct ${tone(cl.up)}" x="${f(cl.labelLeft ? cl.x - cl.r - 3 : cl.x + cl.r + 3)}" y="${f(cl.y + 3)}"${cl.labelLeft ? ' text-anchor="end"' : ''}>${cl.pctLabel}</text>` +
      `<circle class="pt-orbit ${tone(cl.up)}" cx="${cl.x}" cy="${cl.y}" r="${f(cl.r + 4)}" style="transform-origin:${cl.x}px ${cl.y}px"/></g>`;
  }).join('');
  const starts = c.startDots.map((d) => `<circle class="pt-start" cx="${d.x}" cy="${d.y}" r="${d.r}"/>`).join('');
  const svg = `<svg class="pt-chart-svg" viewBox="0 0 ${c.w} ${c.h}" role="img" aria-label="Analyst price targets over time" ${h.zoomable(c.w, c.h, plotW, plotH)}>` +
    `<defs><clipPath id="${id}clip"><rect x="0" y="0" width="${plotW}" height="${plotH}"/></clipPath>${grads}</defs>${grid}` +
    h.zoomStrips(c.w, c.h, plotW, plotH) +
    `<g clip-path="url(#${id}clip)"><line class="pt-today" x1="${c.todayX}" y1="0" x2="${c.todayX}" y2="${c.h}"/>` +
    `<path class="pt-price" d="${c.pricePath}"/>${groups}${starts}</g>${xticks}</svg>`;
  const legend = `<div class="pt-legend"><span class="pt-lg-price">— actual price</span><span class="pt-lg-up">● bullish target</span>` +
    `<span class="pt-lg-down">● bearish target</span><span class="pt-lg-hint">hover a dot to see the analysts behind it · wheel or drag to move through time · ` +
    `drag the price axis on the right to stretch it · double-click resets</span></div>`;
  return `<div class="pt-wrap">${svg}${h.viewControls(view)}${c.clusters.map((cl, i) => members(c, cl, i, a, h)).join('')}</div>${legend}`;
}

export function renderStatic(data: Data, p: { ticker: string; view?: Viewport }, h: Helpers): string {
  const a = data.analysts;
  if (!a) return h.na();
  if (!a.summary || !a.targets.length) return h.na('No analyst targets in the last 12 months');
  return `<figure class="pt-chart pt-pt">${stats(a, h)}${data.series ? chart(a, data.series, p.ticker, p.view, h) : ''}${consensus(a)}</figure>`;
}

/** Beta's hover panel: the dot (or keyboard focus on it) reveals the rows of its analysts. Segments and the orbit are CSS. */
export const element = ({ PtElement }: Kit) => {
  const Base = PtElement as unknown as new () => HTMLElement & { connectedCallback(): void };
  return class extends Base {
    #wired = false;
    connectedCallback() {
      super.connectedCallback();
      if (this.#wired) return;
      this.#wired = true;
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
};

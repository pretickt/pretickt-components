<!--
  Where do analysts think this stock is going, and how spread out are they?
  @version 2.0.0
  @evidence DataForSEO: "{ticker} price target" ~103k searches/month, "{ticker} stock forecast" ~151k (launch/data, public-site spec §4)
  @evidence beta: pt-chart (pretickt-frontend/src/app/companies/pt-chart.ts) — geometry, clustering, hover animations and zoom/pan ported 1:1
-->
<script lang="ts">
import { closeAt, isoDay, linePath, monthTicks } from '../src/ds/chart';
import { applyXViewport, applyYViewport, FULL_VIEWPORT, type Viewport } from '../src/ds/viewport';
import { cmp, type Analysts, type PriceBar } from '../src/typologies';

type Target = Analysts['targets'][number];

// Geometry, ported from beta pt-chart.geometry.ts (targets already arrive on our adjusted basis). x unit: days (isoDay). ─────
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
</script>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePt } from '../src/context/pt';
import { date, money, pct, svgId } from '../src/ds/format';
import PtChart from '../src/ds/PtChart.vue';
import PtTimeAxis from '../src/ds/PtTimeAxis.vue';
import PtYAxis from '../src/ds/PtYAxis.vue';

const props = defineProps<{ ticker: string }>();
const pt = usePt();
const [analysts, series] = await Promise.all([
  pt.analysts({ ticker: props.ticker, window: '1y' }),
  pt.priceSeries({ tickers: [props.ticker], range: '1y', interval: '1d', rebase: false }),
]);
const view = ref<Viewport>(FULL_VIEWPORT);
/** The dot whose analysts are shown (hover or keyboard focus). */
const open = ref<number | null>(null);

const id = svgId(`pt${props.ticker}`);
const pts = series?.[0]?.points ?? [];
const c = computed(() => (analysts && series ? buildPtChart(pts, analysts.targets, analysts.asOf, analysts.price ?? pts.at(-1)?.c ?? 0, view.value) : null));
const tone = (up: boolean) => (up ? 'pt-pos' : 'pt-neg');

const stats = analysts?.summary ? [['Low', money(analysts.summary.low)], ['Average', money(analysts.summary.mean)], ['Median', money(analysts.summary.median)],
  ['High', money(analysts.summary.high)], ['Upside', pct(analysts.price ? analysts.summary.mean / analysts.price - 1 : null)]] as const : [];
const consensus = (() => {
  const k = analysts?.consensus;
  if (!k) return null;
  const parts = [['sb', 'Strong buy', k.strongBuy], ['b', 'Buy', k.buy], ['h', 'Hold', k.hold], ['s', 'Sell', k.sell], ['ss', 'Strong sell', k.strongSell]] as const;
  const total = parts.reduce((n, [, , v]) => n + v, 0);
  if (!total) return null;
  return { bars: parts.filter(([, , v]) => v > 0).map(([key, , v]) => ({ cls: `pt-consensus-${key}`, width: `${((v / total) * 100).toFixed(1)}%` })),
    text: parts.map(([, label, v]) => `${label} ${v}`).join(' · ') };
})();
const accuracy = new Map((analysts?.accuracy ?? []).filter((x) => x.total > 0).map((x) => [x.firm, x]));

const groups = computed(() => {
  const ch = c.value;
  if (!ch) return [];
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
      panel: { above, style: { left: `${f(left)}%`, top: `${f(top)}%` } },
      rows: cl.members.slice(0, MAX_MEMBER_ROWS).map((m, k) => {
        const hit = accuracy.get(m.firm);
        return { m, delay: { animationDelay: `${(k * 0.13).toFixed(2)}s` },
          acc: hit ? { cls: hit.hits / hit.total >= 0.5 ? 'pt-acc-good' : 'pt-acc-bad', text: `${Math.round((hit.hits / hit.total) * 100)}% · ${hit.total}` } : null };
      }),
      more: cl.members.length - MAX_MEMBER_ROWS,
    };
  });
});
const moreDelay = { animationDelay: `${(MAX_MEMBER_ROWS * 0.13).toFixed(2)}s` };
</script>

<template>
  <p v-if="!analysts" class="pt-na">Data not available</p>
  <p v-else-if="!analysts.summary || !analysts.targets.length" class="pt-na">No analyst targets in the last 12 months</p>
  <figure v-else class="pt-chart pt-pt">
    <div class="pt-pt-summary">
      <div v-for="[k, v] in stats" :key="k" class="pt-pt-stat"><span>{{ k }}</span><b>{{ v }}</b></div>
    </div>
    <p class="pt-lede">{{ analysts.summary.n }} firm{{ analysts.summary.n === 1 ? '' : 's' }} with a target in the last 12 months · last close {{ money(analysts.price) }} · as of {{ date(analysts.asOf) }}</p>
    <template v-if="c">
      <PtChart v-model:view="view" :w="c.w" :h="c.h" :plot-w="c.w - MR" :plot-h="c.h - MB" :id="id" label="Analyst price targets over time">
        <template #defs>
          <linearGradient v-for="(sg, i) in c.segments" :id="`${id}g${i}`" :key="i" gradientUnits="userSpaceOnUse" :x1="sg.x1" y1="0" :x2="sg.x2" y2="0">
            <stop offset="0" class="pt-grad-from" /><stop offset="1" :class="sg.up ? 'pt-grad-up' : 'pt-grad-down'" />
          </linearGradient>
        </template>
        <template #axes>
          <PtYAxis :w="c.w" :plot-w="c.w - MR" :ticks="c.yTicks" />
          <PtTimeAxis :h="c.h" :plot-w="c.w - MR" :ticks="c.xTicks" />
        </template>
        <line class="pt-today" :x1="c.todayX" y1="0" :x2="c.todayX" :y2="c.h" />
        <path class="pt-price" :d="c.pricePath" />
        <!-- one group per target dot: its segments, the dot, its % label and its orbit ring, so CSS hover lights them together -->
        <g v-for="g in groups" :key="g.i" class="pt-cl">
          <g v-for="s in g.segs" :key="s.k" class="pt-sg">
            <path class="pt-seg" :stroke="`url(#${id}g${s.k})`" :d="s.sg.line" /><path class="pt-seg-hit" :d="s.sg.line" />
          </g>
          <circle :class="['pt-dot', tone(g.cl.up)]" :data-i="g.i" tabindex="0" :cx="g.cl.x" :cy="g.cl.y" :r="g.cl.r" :aria-label="g.label"
            @pointerover="open = g.i" @pointerout="open = null" @focusin="open = g.i" @focusout="open = null" />
          <text :class="['pt-pct', tone(g.cl.up)]" :x="g.pctX" :y="f(g.cl.y + 3)" :text-anchor="g.cl.labelLeft ? 'end' : undefined">{{ g.cl.pctLabel }}</text>
          <circle :class="['pt-orbit', tone(g.cl.up)]" :cx="g.cl.x" :cy="g.cl.y" :r="f(g.cl.r + 4)" :style="{ transformOrigin: `${g.cl.x}px ${g.cl.y}px` }" />
        </g>
        <circle v-for="(d, i) in c.startDots" :key="`s${i}`" class="pt-start" :cx="d.x" :cy="d.y" :r="d.r" />
        <template #after>
          <div v-for="g in groups" :key="`p${g.i}`" :class="['pt-members', { 'pt-members-above': g.panel.above }]" :data-i="g.i" :hidden="open !== g.i" :style="g.panel.style">
            <div v-for="r in g.rows" :key="`${r.m.firm}${r.m.date}${r.m.target}`" class="pt-mem" :style="r.delay">
              <span class="pt-mem-analyst">{{ r.m.firm }}</span><span :class="['pt-mem-target', tone(g.cl.up)]">{{ money(r.m.target, 0) }}</span>
              <span class="pt-mem-date">{{ r.m.date }}</span><span v-if="r.acc" :class="['pt-mem-acc', r.acc.cls]">{{ r.acc.text }}</span>
            </div>
            <div v-if="g.more > 0" class="pt-mem pt-mem-more" :style="moreDelay">+{{ g.more }} more</div>
          </div>
        </template>
      </PtChart>
      <div class="pt-legend">
        <span class="pt-lg-price">— actual price</span><span class="pt-lg-up">● bullish target</span><span class="pt-lg-down">● bearish target</span>
        <span class="pt-lg-hint">hover a dot to see the analysts behind it · wheel or drag to move through time · drag the price axis on the right to stretch it · double-click resets</span>
      </div>
    </template>
    <template v-if="consensus">
      <div class="pt-consensus" aria-hidden="true"><span v-for="b in consensus.bars" :key="b.cls" :class="b.cls" :style="{ width: b.width }"></span></div>
      <p class="pt-lede">{{ consensus.text }}</p>
    </template>
  </figure>
</template>

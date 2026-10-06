<!--
  What happened to this stock, and when — earnings, dividends, splits, analyst moves on the price line?
  @version 2.0.0
  @evidence Romeo: "grafico di prezzo base su cui si può aggiungere un pallino con un'icona" (2026-10-03)
  @evidence TradingView marks earnings/dividends/splits on its symbol chart; beta event map and SL/TP charts use the same markers
-->
<script lang="ts">
import { closeAt, isoDay, linePath, monthTicks } from '@pretickt/components/ds';
import { applyXViewport, applyYViewport, FULL_VIEWPORT, type Viewport } from '@pretickt/components/ds';
import type { EventItem, PriceBar } from '@pretickt/components/typologies';

// Price labels sit in the right-hand strip you can grab to stretch the scale (beta / TradingView layout).
export const W = 720, H = 260, L = 6, R = 46, T = 12, B = 24;
export const PLOT_W = W - R, PLOT_H = H - B;

/** One marker per day and kind: busy days (a dozen analyst notes after earnings) collapse into one dot. */
export interface Marker { kind: string; date: string; items: EventItem[]; cx: number; cy: number; future: boolean }

/** A rating reiteration is not an event; it would bury the chart in dots. */
export const isEvent = (e: EventItem) => !(e.kind === 'analyst' && e.meta.action === 'maintain');

/** Pure chart geometry: calendar-day x scale (so future events have room), close-price y scale, seen through `viewport`. */
export function layout(points: PriceBar[], items: EventItem[], viewport: Viewport = FULL_VIEWPORT) {
  if (!points.length) return null;
  const first = points[0]!.t, last = points.at(-1)!.t;
  const shown = items.filter((e) => e.date >= first && isEvent(e));
  const end = shown.reduce((m, e) => (e.date > m ? e.date : m), last);
  const { min: d0, max: d1 } = applyXViewport(isoDay(first), Math.max(isoDay(first) + 1, isoDay(end)), viewport);
  const x = (day: number) => L + ((day - d0) / (d1 - d0 || 1)) * (PLOT_W - L);
  let lo = Infinity, hi = -Infinity;
  for (const p of points) { lo = Math.min(lo, p.c); hi = Math.max(hi, p.c); }
  const pad = (hi - lo) * 0.08 || hi * 0.05 || 1;
  ({ lo, hi } = applyYViewport(lo - pad, hi + pad, viewport));
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const groups = new Map<string, EventItem[]>();
  for (const e of shown) { const k = `${e.date}|${e.kind}`; const g = groups.get(k); if (g) g.push(e); else groups.set(k, [e]); }
  const used = new Map<string, number>();
  const markers: Marker[] = [...groups.values()].map((list) => {
    const { date, kind } = list[0]!;
    const n = used.get(date) ?? 0;
    used.set(date, n + 1);
    return { kind, date, items: list, cx: x(isoDay(date)), cy: y(closeAt(points, date)) - 12 - n * 12, future: date > last };
  });
  return {
    path: linePath(points.map((p) => [x(isoDay(p.t)), y(p.c)])),
    markers,
    yTicks: [0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * (i + 0.5)) / 4; return { v, y: Math.round(y(v) * 10) / 10 }; }),
    xTicks: monthTicks(d0, d1).map((t) => ({ label: t.label, x: Math.round(x(t.day) * 10) / 10 })),
  };
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePt } from '@pretickt/components/context';
import { amount, date, money, num, pct, tip } from '@pretickt/components/format';
import { PtChart } from '@pretickt/components/ds';
import { PtTimeAxis } from '@pretickt/components/ds';
import { PtToggles } from '@pretickt/components/ds';
import { PtYAxis } from '@pretickt/components/ds';
import { RANGES, type RangeValue } from '@pretickt/components/typologies';

type RangeT = RangeValue;
const props = withDefaults(defineProps<{ ticker: string; range?: RangeT }>(), { range: '1y' });
const pt = usePt();
const RANGE_TOGGLES = RANGES.map((r) => [r, r.toUpperCase()] as const);
/** One row per event kind: marker glyph, plural for grouped tooltips, legend entry. Unknown kinds render as a plain dot. */
const KINDS: Record<string, { glyph: string; plural: string; legend: string }> = {
  earnings: { glyph: 'E', plural: 'earnings reports', legend: 'earnings' },
  dividend: { glyph: 'D', plural: 'dividends', legend: 'dividend' },
  split: { glyph: 'S', plural: 'splits', legend: 'split' },
  analyst: { glyph: 'A', plural: 'analyst actions', legend: 'analyst rating change' },
};
const LEGEND = Object.values(KINDS).map((k) => `${k.glyph} ${k.legend}`).join(' · ');

const load = (r: RangeT) => Promise.all([
  pt.priceSeries({ tickers: [props.ticker], range: r, interval: '1d', rebase: false }),
  pt.events({ scope: { by: 'ticker', ticker: props.ticker, range: r, ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] }),
]);
const range = ref<RangeT>(props.range);   // the reader's choice (the toggle)
const shown = ref<RangeT>(props.range);   // the range of the data on screen (the captions)
const view = ref<Viewport>(FULL_VIEWPORT);
const [s0, e0] = await load(range.value);
const series = ref(s0), events = ref(e0), loading = ref(false);
async function show(r: RangeT) {
  range.value = r;
  loading.value = true;
  const [s, e] = await load(r);
  [series.value, events.value, shown.value] = [s, e, r];
  view.value = FULL_VIEWPORT; // new data: back to the full view
  loading.value = false;
}

const points = computed(() => series.value?.[0]?.points ?? []);
const g = computed(() => layout(points.value, events.value?.items ?? [], view.value));

function tipFor(e: EventItem): string {
  switch (e.kind) {
    case 'earnings': {
      const m = e.meta;
      const surprise = m.epsActual != null && m.epsEst ? (m.epsActual - m.epsEst) / Math.abs(m.epsEst) : null;
      return tip({ Earnings: date(e.date), Time: m.time ? m.time.toUpperCase() : null, 'EPS est.': m.epsEst == null ? null : num(m.epsEst),
        'EPS actual': m.epsActual == null ? null : num(m.epsActual), Surprise: surprise == null ? null : pct(surprise) });
    }
    case 'dividend':
      return tip({ Dividend: amount(e.meta.amount), 'Ex-date': date(e.date), 'Pay date': e.meta.payDate ? date(e.meta.payDate) : null });
    case 'split':
      return tip({ Split: `${e.meta.numerator}-for-${e.meta.denominator}`, Date: date(e.date) });
    case 'analyst':
      return tip({ [e.meta.firm || 'Analyst']: `${e.meta.action}${e.meta.from || e.meta.to ? ` ${e.meta.from ?? '?'} → ${e.meta.to ?? '?'}` : ''}`, Date: date(e.date) });
    default:
      return tip({ Event: String((e as { kind: string }).kind), Date: date((e as { date: string }).date) });
  }
}
/** Tooltip for a marker: the event itself, or a count with the first few entries. */
function tipForGroup(m: Marker): string {
  if (m.items.length === 1) return tipFor(m.items[0]!);
  const o: Record<string, string> = { [`${m.items.length} ${KINDS[m.kind]?.plural ?? 'events'}`]: date(m.date) };
  for (const e of m.items.slice(0, 5)) {
    const label = e.kind === 'analyst' ? e.meta.firm : e.kind;
    const value = e.kind === 'analyst' ? `${e.meta.action}${e.meta.to ? ` → ${e.meta.to}` : ''}` : date(e.date);
    let k = label;
    for (let i = 2; k in o; i++) k = `${label} (${i})`;
    o[k] = value;
  }
  if (m.items.length > 5) o.More = `+${m.items.length - 5}`;
  return tip(o);
}
const caption = computed(() => {
  const p = points.value;
  if (!p.length) return '';
  return `Last close ${money(p.at(-1)!.c)} · ${pct(p.at(-1)!.c / p[0]!.c - 1)} over ${shown.value} · ${LEGEND}${events.value ? '' : ' · Events not available'}`;
});
</script>

<template>
  <p v-if="!g" class="pt-na">Data not available</p>
  <figure v-else class="pt-chart" :class="{ 'pt-busy': loading }">
    <PtToggles :model-value="range" :options="RANGE_TOGGLES" label="Range" @update:model-value="show" />
    <PtChart v-model:view="view" :w="W" :h="H" :plot-w="PLOT_W" :plot-h="PLOT_H" :id="`pe${ticker}`" :label="`${ticker} price, ${shown}`">
      <template #axes>
        <PtYAxis :w="W" :plot-w="PLOT_W" :ticks="g.yTicks" />
        <PtTimeAxis :h="H" :plot-w="PLOT_W" :ticks="g.xTicks" />
      </template>
      <path class="pt-line" :d="g.path" />
      <g v-for="m in g.markers" :key="`${m.date}|${m.kind}`" :class="['pt-mk', `pt-mk-${KINDS[m.kind] ? m.kind : 'other'}`, { 'pt-mk-future': m.future }]"
        tabindex="0" :data-tip="tipForGroup(m)">
        <circle :cx="m.cx.toFixed(1)" :cy="m.cy.toFixed(1)" r="6" />
        <text :x="m.cx.toFixed(1)" :y="(m.cy + 3).toFixed(1)" text-anchor="middle">{{ KINDS[m.kind]?.glyph ?? '•' }}</text>
      </g>
    </PtChart>
    <p class="pt-lede">{{ caption }}</p>
  </figure>
</template>

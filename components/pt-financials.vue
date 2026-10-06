<!--
  Is this company growing, and is the growth turning into cash?
  @version 2.0.0
  @evidence "<ticker> revenue / earnings / free cash flow" long tail (marketing/ per-ticker SEO)
  @evidence beta: growth charts and tables on the company page
-->
<script setup lang="ts">
import { computed } from 'vue';
import { usePt } from '../src/context/pt';
import { date, level, num, pct, tip, usd } from '../src/ds/format';

const props = withDefaults(defineProps<{ ticker: string; periods?: number }>(), { periods: 8 });
const fin = await usePt().fundamentals({ ticker: props.ticker, periods: props.periods });
const W = 600, H = 160, PAD = 14;
const compact = (v: number | null) => usd(v, { compact: true });

const ps = computed(() => fin?.periods ?? []);
const lede = computed(() => {
  const last = ps.value.at(-1);
  if (!last) return '';
  const yearAgo = ps.value.length >= 5 ? ps.value.at(-5)! : null;
  const facts: string[] = [];
  if (yearAgo?.revenue && last.revenue != null && yearAgo.revenue > 0) facts.push(`Revenue ${pct(last.revenue / yearAgo.revenue - 1)} year over year`);
  if (last.revenue && last.fcf != null) facts.push(`free cash flow ${level(last.fcf / last.revenue)} of revenue`);
  if (last.operatingMargin != null) facts.push(`operating margin ${level(last.operatingMargin)}`);
  return facts.length ? `${last.fiscal}: ${facts.join(', ')}.` : '';
});
const chart = computed(() => {
  const list = ps.value;
  const vals = list.flatMap((p) => [p.revenue ?? 0, p.fcf ?? 0]);
  const hi = Math.max(...vals, 1), lo = Math.min(...vals, 0);
  const y = (v: number) => PAD + ((hi - v) / (hi - lo)) * (H - 2 * PAD);
  const slot = W / Math.max(1, list.length), bw = Math.max(4, slot * 0.32);
  const bar = (v: number | null, x: number) => (v == null ? null
    : { x: x.toFixed(1), y: Math.min(y(v), y(0)).toFixed(1), w: bw.toFixed(1), h: Math.max(1, Math.abs(y(v) - y(0))).toFixed(1) });
  return { zero: y(0).toFixed(1), quarters: list.map((p, i) => {
    const x = i * slot + slot / 2;
    return { fiscal: p.fiscal, x: x.toFixed(1), rev: bar(p.revenue, x - bw - 1), fcf: bar(p.fcf, x + 1),
      tip: tip({ [p.fiscal]: date(p.period), Revenue: compact(p.revenue), 'Free cash flow': compact(p.fcf) }) };
  }) };
});
</script>

<template>
  <p v-if="!fin || !ps.length" class="pt-na">Financial statements not available</p>
  <section v-else class="pt-fin">
    <p v-if="lede" class="pt-lede">{{ lede }}</p>
    <div class="pt-legend"><span class="pt-key pt-key-rev">Revenue</span><span class="pt-key pt-key-fcf">Free cash flow</span></div>
    <svg class="pt-chart-svg pt-fin-chart" :viewBox="`0 0 ${W} ${H + 16}`" role="img" aria-label="Quarterly revenue and free cash flow">
      <line class="pt-grid" x1="0" :x2="W" :y1="chart.zero" :y2="chart.zero" />
      <template v-for="q in chart.quarters" :key="q.fiscal">
        <rect v-if="q.rev" class="pt-fin-rev" :x="q.rev.x" :y="q.rev.y" :width="q.rev.w" :height="q.rev.h" :data-tip="q.tip" />
        <rect v-if="q.fcf" class="pt-fin-fcf" :x="q.fcf.x" :y="q.fcf.y" :width="q.fcf.w" :height="q.fcf.h" :data-tip="q.tip" />
        <text class="pt-axis" :x="q.x" :y="H + 12" text-anchor="middle">{{ q.fiscal }}</text>
      </template>
    </svg>
    <div class="pt-table-wrap">
      <table class="pt-table">
        <thead><tr><th>Quarter</th><th>Period end</th><th>Revenue</th><th>EPS</th><th>FCF</th><th>Gross</th><th>Operating</th><th>Net</th></tr></thead>
        <tbody>
          <tr v-for="p in [...ps].reverse()" :key="p.period" class="pt-fin-q">
            <td>{{ p.fiscal }}</td><td>{{ date(p.period) }}</td><td class="pt-num">{{ compact(p.revenue) }}</td><td class="pt-num">{{ num(p.eps) }}</td>
            <td class="pt-num">{{ compact(p.fcf) }}</td><td class="pt-num">{{ level(p.grossMargin) }}</td><td class="pt-num">{{ level(p.operatingMargin) }}</td>
            <td class="pt-num">{{ level(p.netMargin) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

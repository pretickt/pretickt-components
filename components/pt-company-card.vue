<!--
  How does this company look at a glance: price over the last 60 sessions, 52-week range, analysts, and its key numbers?
  @version 1.0.0
  @evidence beta: the company page header and the hover mini-card (CompanyHoverCard), asked back by Romeo on 2026-10-06
-->
<script lang="ts">
import type { MetricKey } from '@pretickt/components/typologies';

/** The tags before "Show all": fundamentals, then technicals. */
export const CARD_KEYS: readonly MetricKey[] = ['pe_vs_own', 'pe_vs_sector', 'pt_upside', 'off_high', 'insider_net', 'fcf_yield', 'earnings_in',
  'trend', 'sector_trend', 'rsi14', 'ma_cross', 'volume_ratio', 'support', 'resistance'];
/** Items the card's body already shows: never repeated as tags. */
const IN_BODY = new Set<string>(['market_cap', 'consensus', 'range_52w']);
export const SESSIONS = 60;
const SPARK_W = 120, SPARK_H = 32;
</script>

<script setup lang="ts">
import { ref } from 'vue';
import { usePt } from '@pretickt/components/context';
import { PtBadge, PtLogo } from '@pretickt/components/ds';
import { date, money, pct, tone, usd } from '@pretickt/components/format';
import { METRIC_KEYS } from '@pretickt/components/typologies';

const props = withDefaults(defineProps<{ ticker: string; size?: 'wide' | 'compact'; extra?: Record<string, unknown> | null }>(),
  { size: 'wide', extra: null });
const pt = usePt();
const [co, metrics, series] = await Promise.all([
  pt.company({ ticker: props.ticker }),
  pt.metric({ ticker: props.ticker, metrics: [...METRIC_KEYS] }),
  pt.priceSeries({ tickers: [props.ticker], range: '3m' }),
]);
const open = ref(false);

const byKey = new Map((metrics ?? []).map((m) => [m.key, m]));
const points = (series?.[0]?.points ?? []).slice(-SESSIONS);
const range = byKey.get('range_52w');
const close = points.at(-1)?.c ?? range?.value ?? null;
const asOf = points.at(-1)?.t ?? null;
const change = points.length > 1 ? points.at(-1)!.c / points[0]!.c - 1 : null;
const spark = (() => {
  if (points.length < 2) return null;
  const cs = points.map((p) => p.c), lo = Math.min(...cs), hi = Math.max(...cs), span = hi - lo || 1;
  return cs.map((c, i) => `${((i / (cs.length - 1)) * SPARK_W).toFixed(1)},${(SPARK_H - ((c - lo) / span) * SPARK_H).toFixed(1)}`).join(' ');
})();
const mcap = byKey.get('market_cap')?.value;
const consensus = byKey.get('consensus');
const upside = byKey.get('pt_upside')?.value;
const target = close != null && upside != null ? close * (1 + upside) : null;
const rangeAt = range?.range && range.value != null && range.range.hi > range.range.lo
  ? `${Math.min(100, Math.max(0, ((range.value - range.range.lo) / (range.range.hi - range.range.lo)) * 100)).toFixed(1)}%` : null;
const main = CARD_KEYS.flatMap((k) => byKey.get(k) ?? []);
// everything else the payload holds — keys added to the catalogue later included — behind "Show all"
const rest = (metrics ?? []).filter((m) => !CARD_KEYS.includes(m.key as MetricKey) && !IN_BODY.has(m.key));
// the link's tooltip rows, minus the company row (the header says it) and the empty ones
const footer = Object.entries(props.extra ?? {}).filter(([k, v]) => k !== props.ticker && v != null && v !== '').map(([k, v]) => [k, String(v)] as const);
</script>

<template>
  <p v-if="!co && !metrics && !series" class="pt-na">Data not available</p>
  <section v-else class="pt-card" :class="`pt-card-${size}`">
    <div class="pt-card-id">
      <PtLogo :ticker="ticker" :src="co?.logo ?? null" :size="size === 'wide' ? 40 : 32" />
      <div class="pt-card-who">
        <div class="pt-card-name">{{ co?.name ?? ticker }}</div>
        <div class="pt-meta">{{ ticker }}{{ mcap != null ? ` · ${usd(mcap, { compact: true })}` : '' }}</div>
      </div>
    </div>
    <div v-if="close != null" class="pt-card-price">
      <span class="pt-card-close">{{ money(close) }}</span>
      <svg v-if="spark" class="pt-card-spark" :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`" aria-hidden="true"><polyline :points="spark" /></svg>
      <span v-if="change != null" :class="`pt-t-${tone(change)}`">{{ pct(change) }}</span>
      <span v-if="asOf" class="pt-meta pt-card-asof">last {{ SESSIONS }} sessions · close {{ date(asOf) }}</span>
    </div>
    <div v-if="range?.range" class="pt-card-range">
      <span class="pt-meta">{{ money(range.range.lo) }}</span>
      <span class="pt-card-bar" aria-hidden="true"><span v-if="rangeAt" class="pt-card-dot" :style="{ left: rangeAt }"></span></span>
      <span class="pt-meta">{{ money(range.range.hi) }}</span>
      <span class="pt-meta pt-card-asof">52 weeks</span>
    </div>
    <div v-if="consensus || target != null" class="pt-card-analysts">
      <span v-if="consensus?.text" :class="`pt-t-${consensus.tone}`">{{ consensus.text }} · {{ consensus.value }} analysts</span>
      <span v-if="target != null && upside != null" class="pt-card-pt" :class="`pt-tone-${tone(upside)}`">PT {{ money(target) }} {{ pct(upside) }}</span>
    </div>
    <ul v-if="main.length" class="pt-badges pt-card-tags">
      <PtBadge v-for="m in main" :key="m.key" :badge="m" size="mini" />
    </ul>
    <ul v-if="rest.length" v-show="open" class="pt-badges pt-card-more">
      <PtBadge v-for="m in rest" :key="m.key" :badge="m" size="mini" />
    </ul>
    <button v-if="rest.length" type="button" class="pt-abtn pt-card-all" @click="open = !open">{{ open ? 'Show less' : `Show all (${rest.length})` }}</button>
    <div v-if="footer.length" class="pt-card-foot">
      <div v-for="[k, v] in footer" :key="k"><b>{{ k }}</b> {{ v }}</div>
    </div>
  </section>
</template>

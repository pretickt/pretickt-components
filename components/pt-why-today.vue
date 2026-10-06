<!--
  Why did this stock move today: the whole market, its sector, or something specific to the company?
  @version 2.0.0
  @evidence DataForSEO: "why is <ticker> stock down today" family (launch/data/08c-serp-why-is-stock-down-today.json, 10a-why-moving-ticker.json)
  @evidence beta: news spike detector (market-relative story spikes, validated 1.92x abnormal move)
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePt } from '../src/context/pt';
import { date, href, level, num, pct, tone } from '../src/ds/format';
import PtToggles from '../src/ds/PtToggles.vue';
import { SENTIMENT_FLAT, type MoveBreakdown } from '../src/typologies';

type Window = '1d' | '5d' | '1m';
const props = withDefaults(defineProps<{ ticker: string; window?: Window }>(), { window: '1d' });
const pt = usePt();

const FLAT = 0.0005;
const WINDOWS = [['1d', '1D'], ['5d', '5D'], ['1m', '1M']] as const;
const BAR = { pos: 'pt-bd-bar pt-bd-pos', neg: 'pt-bd-bar pt-bd-neg', flat: 'pt-bd-bar pt-bd-flat', na: 'pt-bd-bar pt-bd-na' } as const;
const DOT = { pos: 'pt-dot-pos', neg: 'pt-dot-neg', flat: 'pt-dot-flat', na: 'pt-dot-na' } as const;

const win = ref<Window>(props.window);
const move = ref(await pt.moveBreakdown({ ticker: props.ticker, window: win.value }));
const loading = ref(false);
async function show(w: Window) {
  win.value = w;
  loading.value = true;
  move.value = await pt.moveBreakdown({ ticker: props.ticker, window: w });
  loading.value = false;
}

const verb = (v: number) => (Math.abs(v) < FLAT ? 'was flat' : `${v > 0 ? 'rose' : 'fell'} ${level(Math.abs(v))}`);
const when = (m: MoveBreakdown) =>
  m.window === '1d' ? `on ${date(m.asOf)}` : `over the ${m.window === '5d' ? 'five sessions' : 'month'} to ${date(m.asOf)}`;
const lead = computed(() => (move.value ? `${move.value.name} (${move.value.ticker}) ${verb(move.value.ret)} ${when(move.value)}.` : ''));
const context = computed(() => {
  const m = move.value;
  if (!m) return '';
  const ctx = `The market (SPY) ${verb(m.marketRet)}` + (m.sectorRet != null && m.sectorName ? `; ${m.sectorName} stocks ${verb(m.sectorRet)}` : '') + '.';
  const driver = Math.abs(m.ret) < FLAT ? '' : m.driver === 'market' ? 'Most of the move came from the market as a whole.'
    : m.driver === 'sector' ? 'Most of the move came from its sector.' : `Most of the move is specific to ${m.ticker}.`;
  return `${ctx} ${driver}`.trim();
});
const bars = computed(() => {
  const m = move.value;
  if (!m) return [];
  const parts = [['Market (SPY)', m.market], [m.sectorName ? `${m.sectorName} sector` : 'Sector', m.sector], [`${m.ticker} specific`, m.specific]] as const;
  const max = Math.max(...parts.map(([, v]) => Math.abs(v)), 1e-9);
  return parts.map(([label, v]) => ({ label, v, style: { [v < 0 ? 'right' : 'left']: '50%', width: `${Math.round((Math.abs(v) / max) * 50)}%` } }));
});
const newsHead = computed(() => {
  const n = move.value?.news;
  if (!n) return '';
  return n.spike ? `${n.today} stories, ${num(n.avg30 > 0 ? n.today / n.avg30 : 0, 1)}× the 30-day average.`
    : `${n.today} ${n.today === 1 ? 'story' : 'stories'} on the day${n.avg30 > 0 ? ` (30-day average ${num(n.avg30, 1)})` : ''}.`;
});
</script>

<template>
  <p v-if="!move" class="pt-na">Data not available</p>
  <section v-else class="pt-why" :class="{ 'pt-busy': loading }">
    <div class="pt-head">
      <p class="pt-why-lead">{{ lead }}</p>
      <PtToggles :model-value="win" :options="WINDOWS" label="Window" @update:model-value="show" />
    </div>
    <p class="pt-lede">{{ context }}</p>
    <div class="pt-bd">
      <div v-for="b in bars" :key="b.label" class="pt-bd-row">
        <span class="pt-bd-k">{{ b.label }}</span>
        <span class="pt-bd-track"><span :class="BAR[tone(b.v, FLAT)]" :style="b.style"></span></span>
        <span class="pt-bd-v">{{ pct(b.v) }}</span>
      </div>
    </div>
    <p class="pt-bd-news-head"><strong v-if="move.news.spike">News spike: </strong>{{ newsHead }}</p>
    <ul v-if="move.news.top.length" class="pt-news">
      <li v-for="s in move.news.top" :key="s.url" class="pt-news-item">
        <span :class="DOT[tone(s.sentiment, SENTIMENT_FLAT)]"></span>
        <a :href="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a> <span class="pt-meta">{{ s.site }}</span>
      </li>
    </ul>
    <p class="pt-note">Market = SPY. Sector = equal-weight average of the tracked companies in the same sector, net of the market.</p>
  </section>
</template>

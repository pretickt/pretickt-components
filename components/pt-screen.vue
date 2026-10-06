<!--
  Which companies are on this list today (biggest movers, 52-week extremes, undervalued, insider buying, peers)?
  @version 2.1.0
  @evidence DataForSEO: "biggest stock losers today", "52 week low stocks", "undervalued stocks" (launch/data/08c-serp-undervalued-stocks.json)
  @evidence stockanalysis.com / finviz market-mover tables; beta: peers table on the company page
-->
<script setup lang="ts">
import { computed } from 'vue';
import { usePt } from '@pretickt/components/context';
import { PtLogo } from '@pretickt/components/ds';
import { date, money, num, pct, stockHref, tone, usd } from '@pretickt/components/format';
import type { ScreenList, ScreenRow } from '@pretickt/components/typologies';

/** A market list (`list`) or the peers of one company (`peersOf`). */
const props = withDefaults(defineProps<{ list?: ScreenList; peersOf?: string; limit?: number }>(), { limit: 25 });
const kind: ScreenList | 'peers' = props.peersOf ? 'peers' : props.list ?? 'biggest_losers';
const screen = await usePt().screen({ scope: kind === 'peers' ? { peersOf: props.peersOf! } : { list: kind }, limit: props.limit });

type Cell = { text: string; tone?: string };
const signed = (v: number | null, text = pct(v)): Cell => ({ text, tone: `pt-t-${tone(v)}` });
const COLS = {
  offHigh: { label: 'Off 52w high', cell: (r: ScreenRow) => signed(r.offHigh) },
  ptUpside: { label: 'Target upside', cell: (r: ScreenRow) => signed(r.ptUpside) },
  insiderNet: { label: 'Insiders 90d', cell: (r: ScreenRow) => signed(r.insiderNet, usd(r.insiderNet, { compact: true, signed: true })) },
  volumeRatio: { label: 'Volume vs 20d', cell: (r: ScreenRow): Cell => ({ text: r.volumeRatio == null ? '—' : `${num(r.volumeRatio, 1)}×` }) },
};
const EXTRA: Record<ScreenList | 'peers', (keyof typeof COLS)[]> = {
  biggest_losers: ['offHigh'], biggest_gainers: ['offHigh'], '52w_low': ['offHigh'], '52w_high': ['offHigh'],
  undervalued: ['ptUpside'], insider_buying: ['insiderNet'], most_active: ['volumeRatio'], peers: ['offHigh', 'ptUpside'],
};
const extra = EXTRA[kind].map((k) => COLS[k]);

function spark(v: number[]) {
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  return { points: v.map((c, i) => `${((i / (v.length - 1)) * 60).toFixed(1)},${(18 - ((c - lo) / span) * 16).toFixed(1)}`).join(' '),
    cls: `pt-spark pt-spark-${v.at(-1)! >= v[0]! ? 'pos' : 'neg'}` };
}
const rows = computed(() => (screen?.rows ?? []).map((r) => ({ r, chg: signed(r.chg1d), extra: extra.map((c) => c.cell(r)), spark: spark(r.spark) })));
</script>

<template>
  <p v-if="!screen" class="pt-na">Data not available</p>
  <p v-else-if="!screen.rows.length" class="pt-na">No companies match this list today.</p>
  <div v-else class="pt-table-wrap">
    <table class="pt-table">
      <thead>
        <tr><th></th><th>Company</th><th>Price</th><th>1D</th><th v-for="c in extra" :key="c.label">{{ c.label }}</th><th>P/E</th><th>Market cap</th><th>20D</th></tr>
      </thead>
      <tbody>
        <tr v-for="(x, i) in rows" :key="x.r.ticker" :class="['pt-scr-row', { 'pt-scr-self': x.r.self }]">
          <td class="pt-scr-rank">{{ i + 1 }}</td>
          <td><a class="pt-scr-co" :href="stockHref(x.r.ticker)"><PtLogo :ticker="x.r.ticker" :src="x.r.logo" /> <strong>{{ x.r.ticker }}</strong> <span>{{ x.r.name }}</span></a></td>
          <td class="pt-num">{{ money(x.r.close) }}</td>
          <td class="pt-num"><span :class="x.chg.tone">{{ x.chg.text }}</span></td>
          <td v-for="(c, j) in x.extra" :key="j" class="pt-num"><span v-if="c.tone" :class="c.tone">{{ c.text }}</span><template v-else>{{ c.text }}</template></td>
          <td class="pt-num">{{ x.r.pe == null || x.r.pe <= 0 ? '—' : num(x.r.pe, 1) }}</td>
          <td class="pt-num">{{ usd(x.r.marketCap, { compact: true }) }}</td>
          <td><svg v-if="x.spark" :class="x.spark.cls" viewBox="0 0 60 20" aria-hidden="true"><polyline :points="x.spark.points" /></svg></td>
        </tr>
      </tbody>
    </table>
    <p class="pt-note">Data as of {{ date(screen.asOf) }} close.</p>
  </div>
</template>

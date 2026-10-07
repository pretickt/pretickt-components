<!--
  Are the people running this company buying or selling its stock?
  @version 2.1.0
  @evidence "<ticker> insider trading" long tail (marketing/ per-ticker SEO)
  @evidence beta: insider net flow badge and Form 4 list
-->
<script setup lang="ts">
import { computed } from 'vue';
import { usePt } from '@pretickt/components/context';
import { PtSortTh, useSort } from '@pretickt/components/ds';
import { date, money, num, usd } from '@pretickt/components/format';

const props = withDefaults(defineProps<{ ticker: string; days?: number }>(), { days: 365 });
const ins = await usePt().insider({ ticker: props.ticker, days: props.days });
const LABEL: Record<string, string> = { buy: 'Buy', sell: 'Sell', other: 'Other' };
const compact = (v: number | null) => usd(v, { compact: true });
const sort = useSort(() => ins?.items ?? [], { date: (i) => i.date, name: (i) => i.name, type: (i) => i.type, shares: (i) => i.shares, price: (i) => i.price, value: (i) => i.value });
const COLS = [['date', 'Date'], ['name', 'Insider'], ['type', 'Type'], ['shares', 'Shares'], ['price', 'Price'], ['value', 'Value']] as const;
const summary = computed(() => {
  const items = ins?.items ?? [];
  const sum = (t: 'buy' | 'sell') => items.filter((i) => i.type === t).reduce((a, i) => a + (i.value ?? 0), 0);
  const count = (t: 'buy' | 'sell') => items.filter((i) => i.type === t).length;
  return `Open-market buys ${compact(sum('buy'))} · sells ${compact(sum('sell'))} over the last ${props.days} days (${count('buy')} buys, ${count('sell')} sells).`;
});
</script>

<template>
  <p v-if="!ins" class="pt-na">Data not available</p>
  <p v-else-if="!ins.items.length" class="pt-na">No insider transactions in the last {{ days }} days.</p>
  <section v-else>
    <p class="pt-lede">{{ summary }}</p>
    <div class="pt-table-wrap">
      <table class="pt-table">
        <thead><tr><PtSortTh v-for="[k, l] in COLS" :key="k" :label="l" :state="sort.state(k)" @sort="sort.toggle(k)" /></tr></thead>
        <tbody>
          <tr v-for="i in sort.sorted.value" :key="`${i.date}${i.name}${i.shares}${i.value}`" :class="['pt-ins-row', `pt-ins-${i.type}`]">
            <td>{{ date(i.date) }}</td>
            <td>{{ i.name }}<div v-if="i.title" class="pt-meta">{{ i.title }}</div></td>
            <td><span class="pt-ins-type">{{ LABEL[i.type] ?? 'Other' }}</span></td>
            <td class="pt-num">{{ num(i.shares, 0) }}</td>
            <td class="pt-num">{{ money(i.price) }}</td>
            <td class="pt-num">{{ compact(i.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="pt-note">Source: SEC Form 4 filings. "Other" covers awards, option exercises and gifts.</p>
  </section>
</template>

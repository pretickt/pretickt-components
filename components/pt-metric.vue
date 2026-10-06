<!--
  How does this stock look at a glance on the numbers investors check first?
  @version 2.0.0
  @evidence beta: the badge strip of the company page (25-metric catalogue)
  @evidence video badges (pretickt-shorts DailyBrief)
-->
<script setup lang="ts">
import { usePt } from '../src/context/pt';
import PtBadge from '../src/ds/PtBadge.vue';
import type { MetricKey } from '../src/typologies';

const props = defineProps<{ ticker: string; metrics: MetricKey[] }>();
const items = await usePt().metric({ ticker: props.ticker, metrics: props.metrics });
</script>

<template>
  <p v-if="!items?.length" class="pt-na">Data not available</p>
  <ul v-else class="pt-badges">
    <PtBadge v-for="m in items" :key="m.key" :badge="m" />
  </ul>
</template>

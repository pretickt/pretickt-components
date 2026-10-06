<!-- Price axis of a PtChart (its `axes` slot): a grid line per tick across the plot and the price label in the right-hand strip. -->
<script setup lang="ts">
import { usd } from './format';
defineProps<{ w: number; plotW: number; ticks: readonly { y: number; v: number }[] }>();
</script>

<template>
  <g>
    <template v-for="t in ticks" :key="t.y">
      <line class="pt-grid" x1="0" :x2="plotW" :y1="t.y" :y2="t.y" />
      <text class="pt-axis" :x="w - 4" :y="t.y + 3" text-anchor="end">{{ usd(t.v, { digits: Math.abs(t.v) >= 100 ? 0 : 2 }) }}</text>
    </template>
  </g>
</template>

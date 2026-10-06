<!-- Time axis of a PtChart (its `axes` slot): one label per tick along the bottom strip, anchored so edge labels stay inside. -->
<script setup lang="ts">
defineProps<{ h: number; plotW: number; ticks: readonly { x: number; label: string }[] }>();
</script>

<template>
  <g>
    <text v-for="t in ticks" :key="t.x" class="pt-axis" :x="t.x" :y="h - 6" :text-anchor="t.x < 20 ? 'start' : t.x > plotW - 20 ? 'end' : 'middle'">{{ t.label }}</text>
  </g>
</template>

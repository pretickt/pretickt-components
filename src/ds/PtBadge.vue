<!-- One catalogue badge (a metric@1 item, or any Badge you build) as an <li> for a <ul class="pt-badges">. -->
<script setup lang="ts">
import { computed } from 'vue';
import { badgeValue, date, money, tip, type Badge } from './format';
import PtIcon from './PtIcon.vue';

const props = defineProps<{ badge: Badge }>();
const tooltip = computed(() => {
  const b = props.badge;
  const t: Record<string, string> = { [b.label]: b.hint, 'As of': date(b.asOf) };
  if (b.range) { t.Low = money(b.range.lo); t.High = money(b.range.hi); }
  return tip(t);
});
const rangeLeft = computed(() => {
  const b = props.badge;
  if (!b.range || b.value == null || b.range.hi <= b.range.lo) return null;
  return `${Math.min(100, Math.max(0, ((b.value - b.range.lo) / (b.range.hi - b.range.lo)) * 100)).toFixed(1)}%`;
});
</script>

<template>
  <li class="pt-badge" :class="`pt-tone-${badge.tone}`" tabindex="0" :data-tip="tooltip">
    <PtIcon :name="badge.icon" />
    <span class="pt-badge-k">{{ badge.label }}</span>
    <span v-if="badge.dots?.length" class="pt-dots" :aria-label="`${badge.dots.length} items`">
      <span v-for="(d, i) in badge.dots" :key="i" :class="d === 'pos' ? 'pt-dot-pos' : 'pt-dot-neg'"></span>
    </span>
    <span v-else class="pt-badge-v">{{ badgeValue(badge) }}</span>
    <span v-if="rangeLeft" class="pt-range" aria-hidden="true"><span class="pt-range-dot" :style="{ left: rangeLeft }"></span></span>
  </li>
</template>

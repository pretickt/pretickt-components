<!-- A company logo: a fixed-size square image from the site (`/logos/<ticker>`, lazy); with no source, the initials (no request). -->
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ ticker: string; src?: string | null; size?: number }>(), { src: null, size: 20 });
// only the site's own logo paths: anything else (an external URL from old data) draws the initials
const site = computed(() => (props.src && /^\/logos\/[a-z0-9.-]{1,12}$/.test(props.src) ? props.src : null));
const initials = computed(() => props.ticker.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase());
</script>

<template>
  <img v-if="site" class="pt-logo" :src="site" alt="" :width="size" :height="size" loading="lazy" decoding="async">
  <span v-else class="pt-logo pt-logo-initials" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">{{ initials }}</span>
</template>

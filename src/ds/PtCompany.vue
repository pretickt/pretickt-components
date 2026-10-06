<!-- A company as a link to its page: logo, ticker, name. On pages with islands the runtime gives every such link its hover card. -->
<script setup lang="ts">
import { stockHref } from './format';
import PtLogo from './PtLogo.vue';

withDefaults(defineProps<{ ticker: string; name?: string | null; logo?: string | null; size?: number }>(), { name: null, logo: null, size: 20 });
</script>

<template>
  <a class="pt-co" :href="stockHref(ticker)"><PtLogo :ticker="ticker" :src="logo" :size="size" /><span class="pt-co-t">{{ ticker }}</span><span v-if="name" class="pt-co-n">{{ name }}</span></a>
</template>

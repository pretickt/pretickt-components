<script setup lang="ts">
import { ref } from 'vue';
import { usePt } from '../../context/pt';
import { tip } from '../../ds/format';
import PtToggles from '../../ds/PtToggles.vue';

const props = withDefaults(defineProps<{ ticker: string; limit?: number }>(), { limit: 5 });
const pt = usePt();
const n = ref(props.limit);
const news = ref(await pt.news({ ticker: props.ticker, limit: n.value }));
async function show(v: number) {
  n.value = v;
  news.value = await pt.news({ ticker: props.ticker, limit: v });
}
</script>

<template>
  <p v-if="!news" class="pt-na">Data not available</p>
  <section v-else class="probe">
    <PtToggles :model-value="n" :options="[[5, 'Five'], [8, 'Eight']]" label="How many" @update:model-value="show" />
    <ul>
      <li v-for="s in news.items" :key="s.url" :data-tip="tip({ Site: s.site })">{{ s.title }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { usePt } from '../../context/pt';
const props = defineProps<{ ticker: string }>();
const news = await usePt().news({ ticker: props.ticker });
if (props.ticker || news) throw new Error('component bug');
</script>
<template><p>never</p></template>

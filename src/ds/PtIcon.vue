<!-- One icon of the design system's set, by name (calendar target trend-up trend-down alert peak); an unknown name draws nothing. -->
<script setup lang="ts">
import { computed } from 'vue';
import { ICON_PATHS } from './icons';
const props = defineProps<{ name: string | null | undefined }>();
const d = computed(() => (props.name && Object.hasOwn(ICON_PATHS, props.name) ? ICON_PATHS[props.name] : null)); // never prototype keys
</script>

<template>
  <svg v-if="d" class="pt-icon" viewBox="0 0 16 16" aria-hidden="true"><path :d="d" /></svg>
</template>

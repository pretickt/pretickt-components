<!--
  A zoomable chart frame (beta's ZoomPan + ChartControls): the svg with its clip, the grab strips on the price (right) and time
  (bottom) axes, your axes above the strips, the plot clipped, `front` unclipped, and the fit / today » / reset controls when
  there is something to undo. Wheel/drag on the plot = time, on the right strip = price scale, on the bottom strip = time around
  the grab point, double-click = reset. The view is a v-model: read it in your geometry with applyXViewport / applyYViewport.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue';
import { svgId } from './format';
import { FULL_VIEWPORT, isAtLatest, isFullViewport, isYFitted, type Viewport } from './viewport';
import { attachZoom } from './zoom';

const props = defineProps<{ w: number; h: number; plotW: number; plotH: number; id: string; label: string }>();
const view = defineModel<Viewport>('view', { default: () => FULL_VIEWPORT });

const root = ref<HTMLElement>();
const clip = computed(() => `${svgId(props.id)}clip`);
const zones = computed(() => JSON.stringify({ px: props.plotW / props.w, ty: props.plotH / props.h }));
const controls = computed(() => {
  const v = view.value;
  if (isFullViewport(v)) return [];
  return [
    ...(isYFitted(v) ? [] : [{ k: 'fit', label: 'fit', title: 'Fit the price scale to what is in view — the time window stays where it is' }]),
    ...(isAtLatest(v) ? [] : [{ k: 'latest', label: 'today »', title: 'Back to the latest data, keeping the current zoom' }]),
    { k: 'reset', label: 'reset view', title: 'Back to the full view (or double-click the chart)', wide: true },
  ];
});

let zoom: ReturnType<typeof attachZoom> | undefined;
const interact = (action: string) => root.value?.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action } }));
onMounted(() => {
  zoom = attachZoom(root.value!, { view: () => view.value, setView: (v) => { view.value = v; }, interact });
});
onUpdated(() => zoom?.sync());   // hover classes on the svg survive a re-render
onBeforeUnmount(() => { zoom = undefined; });
</script>

<template>
  <div ref="root" class="pt-wrap">
    <svg class="pt-chart-svg" :viewBox="`0 0 ${w} ${h}`" role="img" :aria-label="label" :data-zoom="zones">
      <defs>
        <clipPath :id="clip"><rect x="0" y="0" :width="plotW" :height="plotH" /></clipPath>
        <slot name="defs" />
      </defs>
      <rect class="pt-taxis" x="0" :y="plotH" :width="plotW" :height="h - plotH" />
      <line class="pt-taxis-edge" x1="0" :x2="plotW" :y1="plotH" :y2="plotH" />
      <text class="pt-taxis-hint" x="14" :y="h - 6">⇔</text>
      <rect class="pt-axis-strip" :x="plotW" y="0" :width="w - plotW" :height="h" />
      <line class="pt-axis-edge" :x1="plotW" :x2="plotW" y1="0" :y2="h" />
      <text class="pt-axis-hint" :x="(plotW + w) / 2" :y="h - 6" text-anchor="middle">⇕</text>
      <slot name="axes" />
      <g :clip-path="`url(#${clip})`"><slot /></g>
      <slot name="front" />
    </svg>
    <div v-if="controls.length" class="pt-vctl">
      <button v-for="c in controls" :key="c.k" type="button" class="pt-abtn" :class="{ 'pt-abtn-wide': c.wide }" :data-view="c.k" :title="c.title"
        @click="zoom?.control(c.k)">{{ c.label }}</button>
    </div>
    <slot name="after" />
  </div>
</template>

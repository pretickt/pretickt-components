<!-- A button group switching one value: `[value, label]` options, the current one pressed. Emits update:modelValue (v-model). -->
<script setup lang="ts" generic="V extends string | number">
defineProps<{ options: ReadonlyArray<readonly [V, string]>; label: string }>();
const model = defineModel<V>({ required: true });
const emit = defineEmits<{ interact: [action: string] }>();

function choose(v: V, e: Event) {
  if (v === model.value) return;
  model.value = v;
  e.currentTarget?.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'set' } }));
  emit('interact', 'set');
}
</script>

<template>
  <div class="pt-toggles" role="group" :aria-label="label">
    <button v-for="[v, l] in options" :key="String(v)" type="button" :aria-pressed="v === model" @click="choose(v, $event)">{{ l }}</button>
  </div>
</template>

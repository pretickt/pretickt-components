<!--
  A button group switching one value: `[value, label]` options, the current one pressed. Emits update:modelValue (v-model) on
  every press, the pressed option included: after a request failed, pressing it again asks again.
-->
<script setup lang="ts" generic="V extends string | number">
const props = defineProps<{ modelValue: V; options: ReadonlyArray<readonly [V, string]>; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: V]; interact: [action: string] }>();

function choose(v: V, e: Event) {
  const changed = v !== props.modelValue;
  emit('update:modelValue', v);
  if (!changed) return; // a retry, not a new choice: the beacon counts choices
  e.currentTarget?.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'set' } }));
  emit('interact', 'set');
}
</script>

<template>
  <div class="pt-toggles" role="group" :aria-label="label">
    <button v-for="[v, l] in options" :key="String(v)" type="button" :aria-pressed="v === modelValue" @click="choose(v, $event)">{{ l }}</button>
  </div>
</template>

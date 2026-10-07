<!-- A sortable column header: the label as a button that emits `sort`; `state` shows the order (aria-sort on the sorted column only). -->
<script setup lang="ts">
import { computed } from 'vue';
import type { SortState } from './sort';

const props = withDefaults(defineProps<{ label: string; state?: SortState }>(), { state: null });
const emit = defineEmits<{ sort: [] }>();
const aria = computed(() => (props.state === 'asc' ? 'ascending' : props.state === 'desc' ? 'descending' : 'none'));
const arrow = computed(() => (props.state === 'asc' ? '↑' : props.state === 'desc' ? '↓' : '↕'));

function sort(e: Event) {
  emit('sort');
  e.currentTarget?.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'sort' } }));
}
</script>

<template>
  <th :aria-sort="state ? aria : undefined"><button type="button" class="pt-sort" @click="sort">{{ label }}<span class="pt-sort-i" aria-hidden="true">{{ arrow }}</span></button></th>
</template>

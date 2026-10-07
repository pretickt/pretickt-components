import { computed, ref } from 'vue';
import { cmp } from '../typologies/values';

export type SortState = 'asc' | 'desc' | null;
type Value = number | string | null | undefined;

/**
 * Client-side sorting of the rows a table already has (no new request): `toggle(key)` cycles the column through its first order
 * (numbers high→low, dates newest first, text A→Z), the reverse, and back to the original order. Missing values always go last; ties
 * keep the original order; text compares without case. The server renders the original order.
 */
export function useSort<R>(rows: () => readonly R[], keys: Record<string, (r: R) => Value>) {
  const by = ref<string | null>(null);
  const dir = ref<SortState>(null);
  const sorted = computed(() => {
    const list = rows();
    const get = by.value ? keys[by.value] : undefined;
    if (!get || !dir.value) return list;
    const sign = dir.value === 'asc' ? 1 : -1;
    return list.map((r, i) => ({ r, i, v: get(r) })).sort((a, b) => {
      const na = a.v == null, nb = b.v == null;
      if (na || nb) return na === nb ? a.i - b.i : na ? 1 : -1;
      // text without case (toLowerCase, not toLocale*: the same in every browser)
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : cmp(String(a.v).toLowerCase(), String(b.v).toLowerCase());
      return c ? sign * c : a.i - b.i;
    }).map((x) => x.r);
  });
  /** The first order of a column: text A→Z; numbers and dates (ISO) high/newest first. */
  const first = (key: string): SortState => {
    const v = rows().map(keys[key]!).find((x) => x != null);
    return typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(v) ? 'asc' : 'desc';
  };
  function toggle(key: string) {
    if (by.value !== key) { by.value = key; dir.value = first(key); return; }
    const start = first(key);
    if (dir.value === start) dir.value = start === 'asc' ? 'desc' : 'asc';
    else { by.value = null; dir.value = null; }
  }
  const state = (key: string): SortState => (by.value === key ? dir.value : null);
  return { sorted, toggle, state };
}

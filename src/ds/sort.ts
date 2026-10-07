import { computed, ref } from 'vue';
import { cmp } from '../typologies/values';

export type SortState = 'asc' | 'desc' | null;
type Value = number | string | null | undefined;
/** Numbers by value, text without case (toLowerCase, not toLocale*: the same in every browser). */
const compare = (a: number | string, b: number | string): number =>
  typeof a === 'number' && typeof b === 'number' ? a - b : cmp(String(a).toLowerCase(), String(b).toLowerCase());

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
      const c = compare(a.v!, b.v!);
      return c ? sign * c : a.i - b.i;
    }).map((x) => x.r);
  });
  /** The first order of a column: text A→Z; numbers and dates (ISO) high/newest first. */
  const first = (key: string): SortState => {
    const v = rows().map(keys[key]!).find((x) => x != null);
    return typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(v) ? 'asc' : 'desc';
  };
  /** A column's first order, unless the rows already stand in it: then the reverse, so a first click always changes something. */
  const opening = (key: string): SortState => {
    const want = first(key), get = keys[key]!;
    const vs = rows().map(get).filter((v) => v != null);
    const sorted = vs.every((v, i) => !i || compare(vs[i - 1]!, v) * (want === 'asc' ? 1 : -1) <= 0);
    return vs.length > 1 && sorted ? (want === 'asc' ? 'desc' : 'asc') : want;
  };
  const started = ref<SortState>(null);
  function toggle(key: string) {
    if (by.value !== key) { by.value = key; dir.value = started.value = opening(key); return; }
    if (dir.value === started.value) dir.value = started.value === 'asc' ? 'desc' : 'asc';
    else { by.value = null; dir.value = started.value = null; }
  }
  const state = (key: string): SortState => (by.value === key ? dir.value : null);
  return { sorted, toggle, state };
}

import { computed, signal, type Signal } from '@angular/core';
import { cmp } from '../typologies/values';

export type SortState = 'asc' | 'desc' | null;
type Value = number | string | null | undefined;
/** Numbers by value, text without case (toLowerCase, not toLocale*: the same in every browser). */
const compare = (a: number | string, b: number | string): number =>
  typeof a === 'number' && typeof b === 'number' ? a - b : cmp(String(a).toLowerCase(), String(b).toLowerCase());

/**
 * Client-side sorting of the rows a table already has (no new request): `toggle(key)` cycles the column through its first order
 * (numbers high→low, dates newest first, text A→Z), the reverse, and back to the original order. Missing values always go last;
 * ties keep the original order; text compares without case. The server renders the original order.
 */
export function useSort<R>(rows: () => readonly R[], keys: Record<string, (r: R) => Value>): {
  sorted: Signal<readonly R[]>; toggle(key: string): void; state(key: string): SortState;
} {
  const by = signal<string | null>(null);
  const dir = signal<SortState>(null);
  const started = signal<SortState>(null);
  const sorted = computed(() => {
    const list = rows();
    const key = by(), d = dir();
    const get = key ? keys[key] : undefined;
    if (!get || !d) return list;
    const sign = d === 'asc' ? 1 : -1;
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
    const inOrder = vs.every((v, i) => !i || compare(vs[i - 1]!, v) * (want === 'asc' ? 1 : -1) <= 0);
    return vs.length > 1 && inOrder ? (want === 'asc' ? 'desc' : 'asc') : want;
  };
  return {
    sorted,
    toggle(key: string) {
      if (by() !== key) { const o = opening(key); by.set(key); dir.set(o); started.set(o); return; }
      if (dir() === started()) dir.set(started() === 'asc' ? 'desc' : 'asc');
      else { by.set(null); dir.set(null); started.set(null); }
    },
    state: (key: string): SortState => (by() === key ? dir() : null),
  };
}

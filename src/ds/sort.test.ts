// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createSSRApp } from 'vue';
import PtSortTh from './PtSortTh.vue';
import { useSort } from './sort';

const ROWS = [{ t: 'B', v: 2 }, { t: 'a', v: null }, { t: 'C', v: 10 }, { t: 'A', v: 2 }];
const DATED = [{ d: '2026-03-01' }, { d: '2026-09-15' }, { d: '2026-06-30' }];
const Table = defineComponent(() => {
  const s = useSort(() => ROWS, { t: (r) => r.t, v: (r) => r.v });
  return () => h('table', [h('thead', h('tr', [h(PtSortTh, { label: 'Name', state: s.state('t'), onSort: () => s.toggle('t') }),
    h(PtSortTh, { label: 'Value', state: s.state('v'), onSort: () => s.toggle('v') })])),
  h('tbody', s.sorted.value.map((r) => h('tr', { key: r.t }, [h('td', r.t), h('td', String(r.v))])))]);
});
const order = (w: ReturnType<typeof mount>) => w.findAll('tbody tr').map((r) => r.find('td').text());

describe('sortable tables', () => {
  it('a header click sorts: numbers high first, text A→Z first; again reverses; a third time restores the original order', async () => {
    const w = mount(Table, { attachTo: document.body });
    expect(order(w)).toEqual(['B', 'a', 'C', 'A']);
    const [name, value] = w.findAll('th button');
    await value!.trigger('click');
    expect(order(w)).toEqual(['C', 'B', 'A', 'a']);             // missing values last, ties in the original order
    expect(w.findAll('th')[1]!.attributes('aria-sort')).toBe('descending');
    await value!.trigger('click');
    expect(order(w)).toEqual(['B', 'A', 'C', 'a']);             // ascending, missing still last
    await value!.trigger('click');
    expect(order(w)).toEqual(['B', 'a', 'C', 'A']);
    expect(w.findAll('th')[1]!.attributes('aria-sort')).toBeUndefined();   // aria-sort only on the sorted column
    await name!.trigger('click');
    expect(order(w)).toEqual(['a', 'A', 'B', 'C']);             // case-insensitive, ties in the original order
    w.unmount();
  });
  it('dates sort newest first on the first click', async () => {
    const s = useSort(() => DATED, { d: (r) => r.d });
    s.toggle('d');
    expect(s.sorted.value.map((r) => r.d)).toEqual(['2026-09-15', '2026-06-30', '2026-03-01']);
  });
  it('the server renders the original order with plain sortable headers (hydration-safe), and a sort is a beacon interaction', async () => {
    const html = await renderToString(createSSRApp(Table));
    expect(html).toContain('<th><button type="button" class="pt-sort">Name<span class="pt-sort-i" aria-hidden="true">↕</span></button></th>');
    const seen: string[] = [];
    document.addEventListener('pt-interact', (e) => seen.push((e as CustomEvent<{ action: string }>).detail.action));
    const w = mount(Table, { attachTo: document.body });
    await w.find('th button').trigger('click');
    expect(seen).toEqual(['sort']);
    w.unmount();
  });
});

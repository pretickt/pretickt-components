// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { renderToString } from 'vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { describe, expect, it } from 'vitest';
import PtBadge from './PtBadge.vue';
import PtToggles from './PtToggles.vue';
import type { Badge } from './format';

const badge: Badge = { key: 'pe', label: 'P/E', value: 21.5, text: null, unit: 'x', delta: null, tone: 'pos', range: null, icon: 'target', hint: 'Price over earnings', asOf: '2026-10-02' };

describe('PtToggles', () => {
  it('a button group for one value: the current one pressed, a click emits the new value and a pt-interact "set"', async () => {
    const seen: string[] = [];
    const w = mount(PtToggles, { props: { modelValue: '1d', options: [['1d', '1D'], ['5d', '5D']] as const, label: 'Window' }, attachTo: document.body });
    document.addEventListener('pt-interact', (e) => seen.push((e as CustomEvent<{ action: string }>).detail.action));
    expect(w.attributes('aria-label')).toBe('Window');
    expect(w.findAll('button').map((b) => `${b.text()}:${b.attributes('aria-pressed')}`)).toEqual(['1D:true', '5D:false']);
    await w.findAll('button')[1]!.trigger('click');
    expect(w.emitted('update:modelValue')).toEqual([['5d']]);
    expect(seen).toEqual(['set']);
    w.unmount();
  });
});

describe('PtBadge', () => {
  it('renders a catalogue item: label, value by unit, tone class, icon, tooltip (hint + as-of)', async () => {
    const html = await renderToString(createSSRApp(() => h('ul', [h(PtBadge, { badge })])));
    expect(html).toContain('class="pt-badge pt-tone-pos"');
    expect(html).toContain('<span class="pt-badge-k">P/E</span>');
    expect(html).toContain('<span class="pt-badge-v">21.5x</span>');
    expect(html).toMatch(/<svg[^>]*>/); // the icon
    const tip = JSON.parse(/data-tip="([^"]*)"/.exec(html)![1]!.replace(/&quot;/g, '"'));
    expect(tip).toEqual({ 'P/E': 'Price over earnings', 'As of': 'Oct 2, 2026' });
  });
  it('dots instead of a value, and a range bar with low/high in the tooltip', async () => {
    const html = await renderToString(createSSRApp(() => h('ul', [
      h(PtBadge, { badge: { ...badge, dots: ['pos', 'neg'], icon: null } }),
      h(PtBadge, { badge: { ...badge, key: 'r', unit: '$', value: 150, range: { lo: 100, hi: 200, marks: [] }, icon: null } }),
    ])));
    expect(html).toContain('<span class="pt-dot-pos"></span><span class="pt-dot-neg"></span>');
    expect(html).toContain('style="left:50.0%;"');
    expect(html).toContain('&quot;Low&quot;:&quot;$100.00&quot;');
  });
  it('an unknown icon name renders nothing (never prototype keys)', async () => {
    const html = await renderToString(createSSRApp(() => h(PtBadge, { badge: { ...badge, icon: 'constructor' } })));
    expect(html).not.toMatch(/<svg/);
  });
});

// @vitest-environment happy-dom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import PtChart from './PtChart.vue';
import { FULL_VIEWPORT, type Viewport } from './viewport';

/** A chart that prints its view, so the test reads what the frame did. */
const Probe = defineComponent(() => {
  const view = ref<Viewport>(FULL_VIEWPORT);
  return () => h('div', [
    h('p', { class: 'probe' }, `${view.value.start.toFixed(3)}|${view.value.end.toFixed(3)}|${(view.value.yScale ?? 1).toFixed(3)}`),
    h(PtChart, { w: 800, h: 340, plotW: 754, plotH: 318, id: 'probe', label: 'Probe chart', view: view.value, 'onUpdate:view': (v: Viewport) => { view.value = v; } },
      { default: () => h('path', { class: 'line', d: 'M0 0L10 10' }), axes: () => h('text', { class: 'pt-y-label' }, '100') }),
  ]);
});

let w: VueWrapper;
const probe = () => w.find('.probe').text();
const svg = () => w.find('svg').element;
const at = <E extends Event>(e: E, o: Record<string, number>) => { for (const [k, v] of Object.entries(o)) Object.defineProperty(e, k, { value: v }); return e; };
const wheel = async (x: number, deltaY: number) => { svg().dispatchEvent(at(new Event('wheel', { bubbles: true, cancelable: true }), { clientX: x, clientY: 100, deltaY })); await w.vm.$nextTick(); };
const ptr = (type: string, x: number, y: number) => svg().dispatchEvent(at(new Event(type, { bubbles: true }), { clientX: x, clientY: y, button: 0, pointerId: 1 }));

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 340, right: 800, bottom: 340, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  w = mount(Probe, { attachTo: document.body });
});
afterEach(() => { w.unmount(); vi.restoreAllMocks(); });

describe('PtChart: the zoomable chart frame of the design system', () => {
  it('draws the frame: svg with zones, clip, grab strips, slots in the svg namespace', () => {
    expect(svg().getAttribute('data-zoom')).toBe(JSON.stringify({ px: 754 / 800, ty: 318 / 340 }));
    expect(svg().getAttribute('aria-label')).toBe('Probe chart');
    expect(w.find('clipPath#probeclip').exists()).toBe(true);
    expect(w.findAll('.pt-taxis, .pt-axis-strip')).toHaveLength(2);
    expect(w.find('path.line').element.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(w.find('g[clip-path="url(#probeclip)"] path.line').exists()).toBe(true);
  });
  it('wheel over the plot zooms time around the cursor; over the price axis it scales price', async () => {
    await wheel(400, -100);
    expect(probe()).toBe('0.100|0.900|1.000');
    await wheel(790, 100);
    expect(probe()).toBe('0.100|0.900|1.250');
  });
  it('drag over the plot pans a zoomed window', async () => {
    await wheel(400, -100);
    ptr('pointerdown', 400, 100); ptr('pointermove', 320, 100); ptr('pointerup', 320, 100);
    await w.vm.$nextTick();
    expect(probe()).toBe('0.180|0.980|1.000');
  });
  it('view controls appear only when there is something to undo, and undo it; double-click resets', async () => {
    expect(w.find('.pt-vctl').exists()).toBe(false);
    await wheel(400, -100); await wheel(790, 100);
    expect(w.findAll('[data-view]').map((b) => b.attributes('data-view'))).toEqual(['fit', 'latest', 'reset']);
    await w.find('[data-view="fit"]').trigger('click');
    expect(probe()).toBe('0.100|0.900|1.000');
    svg().dispatchEvent(new Event('dblclick', { bubbles: true }));
    await w.vm.$nextTick();
    expect(probe()).toBe('0.000|1.000|1.000');
    expect(w.find('.pt-vctl').exists()).toBe(false);
  });
  it('reports interactions as pt-interact events (the island runtime turns them into analytics beacons)', async () => {
    const seen: string[] = [];
    document.addEventListener('pt-interact', (e) => seen.push((e as CustomEvent<{ action: string }>).detail.action));
    await wheel(400, -100);
    expect(seen).toContain('zoom');
  });
});

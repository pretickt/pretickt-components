// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/mini';
import { defineComponent, helpers as h, type ComponentModule } from './index';
import { classFor } from './element';
import { lit } from './testing';
import { FULL_VIEWPORT, ViewportParam, type Viewport } from '../ds/viewport';

/** A minimal zoomable component: prints its view so the test can read what the element did. */
const mod: ComponentModule = {
  manifest: defineComponent({
    tag: 'pt-zoom-probe', version: '1.0.0', need: { question: 'probe', evidence: ['test'] },
    params: z.object({ ticker: z.string(), range: z._default(z.string(), '1y'), view: z.optional(ViewportParam) }),
    user: [], uses: [], needs: () => ({}),
  }),
  renderStatic: (_d, p: { view?: Viewport }) => {
    const v = p.view ?? FULL_VIEWPORT;
    return `<p class="probe">${v.start.toFixed(3)}|${v.end.toFixed(3)}|${(v.yScale ?? 1).toFixed(3)}</p>` +
      `<svg viewBox="0 0 800 340" ${h.zoomable(800, 340, 754, 318)}>${h.zoomStrips(800, 340, 754, 318)}</svg>${h.viewControls(p.view)}` +
      `<button data-set='{"range":"5y"}'>5y</button>`;
  },
};
customElements.define('pt-zoom-probe-v1', classFor(lit, mod, { resolve: async () => ({}) }));

type El = HTMLElement & { params: Record<string, unknown>; data: unknown; updateComplete: Promise<boolean> };
let el: El;
const probe = () => el.querySelector('.probe')!.textContent;
const svgEl = () => el.querySelector('svg[data-zoom]')!;
/** happy-dom drops clientX/Y from WheelEvent/PointerEvent init: set them on the event itself. */
const at = <E extends Event>(e: E, o: Record<string, number>) => { for (const [k, v] of Object.entries(o)) Object.defineProperty(e, k, { value: v }); return e; };
const wheel = (x: number, y: number, deltaY: number) => svgEl().dispatchEvent(at(new Event('wheel', { bubbles: true, cancelable: true }), { clientX: x, clientY: y, deltaY }));
const ptr = (type: string, x: number, y: number) => svgEl().dispatchEvent(at(new Event(type, { bubbles: true }), { clientX: x, clientY: y, button: 0, pointerId: 1 }));

beforeEach(async () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 340, right: 800, bottom: 340, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  el = document.createElement('pt-zoom-probe-v1') as El;
  el.params = { ticker: 'X', range: '1y' };
  el.data = {};
  document.body.append(el);
  await el.updateComplete;
});
afterEach(() => { el.remove(); vi.restoreAllMocks(); });

describe('zoom & pan in the base element (any component with data-zoom)', () => {
  it('wheel over the plot zooms time around the cursor', async () => {
    wheel(400, 100, -100);
    await el.updateComplete;
    expect(probe()).toBe('0.100|0.900|1.000');
  });
  it('wheel over the price axis scales price, not time', async () => {
    wheel(790, 100, 100);
    await el.updateComplete;
    expect(probe()).toBe('0.000|1.000|1.250');
  });
  it('drag over the plot pans a zoomed window', async () => {
    wheel(400, 100, -100);
    await el.updateComplete;
    ptr('pointerdown', 400, 100); ptr('pointermove', 320, 100); ptr('pointerup', 320, 100);
    await el.updateComplete;
    expect(probe()).toBe('0.180|0.980|1.000');
  });
  it('vertical drag follows the pointer: dragging down looks higher up the price range', async () => {
    wheel(790, 100, -100); // stretch the price axis so it can be dragged
    await el.updateComplete;
    ptr('pointerdown', 400, 100); ptr('pointermove', 400, 134); ptr('pointerup', 400, 134);
    await el.updateComplete;
    expect(((el.params.view as { yShift?: number }).yShift ?? 0)).toBeLessThan(0);
  });
  it('vertical drag moves the content exactly as far as the pointer, whatever the vertical zoom', async () => {
    wheel(790, 100, -100);
    await el.updateComplete;
    const scale = (el.params.view as { yScale: number }).yScale;
    ptr('pointerdown', 400, 100); ptr('pointermove', 400, 134); ptr('pointerup', 400, 134);
    await el.updateComplete;
    // 34 of 340 px is a tenth of what is visible, and what is visible is `scale` of the fitted range
    expect((el.params.view as { yShift: number }).yShift).toBeCloseTo(-0.1 * scale, 6);
  });
  it('drag on the price axis strip stretches the price scale (down stretches, up compresses)', async () => {
    ptr('pointerdown', 790, 100); ptr('pointermove', 790, 134); ptr('pointerup', 790, 134);
    await el.updateComplete;
    expect(probe()).toBe('0.000|1.000|1.100');
  });
  it('drag on the time strip squeezes or stretches time around the grabbed point', async () => {
    ptr('pointerdown', 400, 330); ptr('pointermove', 360, 330); ptr('pointerup', 360, 330);
    await el.updateComplete;
    const [start, end] = probe()!.split('|').map(Number);
    expect(end! - start!).toBeCloseTo(1, 3); // already full: stretching past the whole series is clamped
    wheel(400, 100, -100);
    await el.updateComplete;
    ptr('pointerdown', 400, 330); ptr('pointermove', 440, 330); ptr('pointerup', 440, 330);
    await el.updateComplete;
    const [s2, e2] = probe()!.split('|').map(Number);
    expect(e2! - s2!).toBeCloseTo(0.8 * 0.9, 3);
  });
  it('"today »" slides the window to the latest data and keeps its width', async () => {
    wheel(400, 100, -100);
    await el.updateComplete;
    ptr('pointerdown', 400, 100); ptr('pointermove', 480, 100); ptr('pointerup', 480, 100); // pan back in time
    await el.updateComplete;
    (el.querySelector('[data-view="latest"]') as HTMLElement).click();
    await el.updateComplete;
    expect(probe()).toBe('0.200|1.000|1.000');
  });
  it('hovering an axis strip is a class on the svg (the cursor comes from CSS) and it survives a re-render', async () => {
    ptr('pointermove', 790, 100);
    expect(svgEl().classList.contains('pt-over-axis')).toBe(true);
    expect((svgEl() as SVGSVGElement).style.cursor).toBe('');
    wheel(790, 100, 100); // re-renders: a new svg
    await el.updateComplete;
    expect(svgEl().classList.contains('pt-over-axis')).toBe(true);
    ptr('pointermove', 400, 330);
    expect(svgEl().classList.contains('pt-over-taxis')).toBe(true);
    expect(svgEl().classList.contains('pt-over-axis')).toBe(false);
  });
  it('a pointer moving outside the chart costs no layout read', async () => {
    const rect = vi.mocked(Element.prototype.getBoundingClientRect);
    rect.mockClear();
    el.querySelector('.probe')!.dispatchEvent(at(new Event('pointermove', { bubbles: true }), { clientX: 10, clientY: 10 }));
    expect(rect).not.toHaveBeenCalled();
  });
  it('controls appear only when there is something to undo, and undo it', async () => {
    expect(el.querySelector('.pt-vctl')).toBeNull();
    wheel(400, 100, -100); wheel(790, 100, 100);
    await el.updateComplete;
    expect([...el.querySelectorAll('[data-view]')].map((b) => b.getAttribute('data-view'))).toEqual(['fit', 'latest', 'reset']);
    (el.querySelector('[data-view="fit"]') as HTMLElement).click();
    await el.updateComplete;
    expect(probe()).toBe('0.100|0.900|1.000');
    (el.querySelector('[data-view="reset"]') as HTMLElement).click();
    await el.updateComplete;
    expect(probe()).toBe('0.000|1.000|1.000');
    expect(el.querySelector('.pt-vctl')).toBeNull();
  });
  it('double-click resets', async () => {
    wheel(400, 100, -100);
    await el.updateComplete;
    svgEl().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await el.updateComplete;
    expect(probe()).toBe('0.000|1.000|1.000');
  });
  it('reports interactions as pt-interact events (the host turns them into analytics beacons)', async () => {
    const seen: string[] = [];
    el.addEventListener('pt-interact', (e) => seen.push(`${(e as CustomEvent).detail.component}:${(e as CustomEvent).detail.action}`));
    wheel(400, 100, -100);
    await el.updateComplete;
    svgEl().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    (el.querySelector('[data-set]') as HTMLElement).click();
    expect(seen).toEqual(['pt-zoom-probe@1.0.0:zoom', 'pt-zoom-probe@1.0.0:reset', 'pt-zoom-probe@1.0.0:set']);
  });
  it('a params patch (new data) drops the view', async () => {
    wheel(400, 100, -100);
    await el.updateComplete;
    (el.querySelector('[data-set]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.params.range).toBe('5y');
    expect(probe()).toBe('0.000|1.000|1.000');
  });
});

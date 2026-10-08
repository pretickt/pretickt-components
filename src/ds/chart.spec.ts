import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FULL_VIEWPORT, type Viewport } from './viewport';
import { PtChart, PtTimeAxis, PtYAxis } from './index';

/** A chart that prints its view, so the test reads what the frame did. */
@Component({
  imports: [PtChart, PtYAxis, PtTimeAxis],
  template: `
    <p class="probe">{{ view().start.toFixed(3) }}|{{ view().end.toFixed(3) }}|{{ (view().yScale ?? 1).toFixed(3) }}</p>
    <div ptChart [w]="800" [h]="340" [plotW]="754" [plotH]="318" id="probe" label="Probe chart" [(view)]="view">
      <svg:g ptAxes>
        <svg:g ptYAxis [w]="800" [plotW]="754" [ticks]="yTicks"></svg:g>
        <svg:g ptTimeAxis [h]="340" [plotW]="754" [ticks]="xTicks"></svg:g>
      </svg:g>
      <svg:g ptPlot><svg:path class="line" d="M0 0L10 10" /></svg:g>
    </div>`,
})
class Probe {
  view = signal<Viewport>(FULL_VIEWPORT);
  yTicks = [{ y: 100, v: 12.34 }, { y: 200, v: 1234 }];
  xTicks = [{ x: 10, label: 'Jan' }, { x: 400, label: 'Feb' }, { x: 745, label: 'Mar' }];
}

let f: ReturnType<typeof TestBed.createComponent<Probe>>;
let el: HTMLElement;
const probe = () => el.querySelector('.probe')!.textContent;
const svg = () => el.querySelector('svg')!;
const at = <E extends Event>(e: E, o: Record<string, number>) => { for (const [k, v] of Object.entries(o)) Object.defineProperty(e, k, { value: v }); return e; };
const settle = async () => { f.detectChanges(); await f.whenStable(); f.detectChanges(); };
const wheel = async (x: number, deltaY: number) => { svg().dispatchEvent(at(new Event('wheel', { bubbles: true, cancelable: true }), { clientX: x, clientY: 100, deltaY })); await settle(); };
const ptr = (type: string, x: number, y: number) => svg().dispatchEvent(at(new Event(type, { bubbles: true }), { clientX: x, clientY: y, button: 0, pointerId: 1 }));

beforeEach(async () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 340, right: 800, bottom: 340, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  f = TestBed.createComponent(Probe);
  el = f.nativeElement as HTMLElement;
  await settle();
});
afterEach(() => vi.restoreAllMocks());

describe('PtChart: the zoomable chart frame of the design system', () => {
  it('draws the frame: svg with zones, clip, grab strips, projected parts in the svg namespace, axes', () => {
    expect(el.querySelector('div[ptChart]')!.className).toBe('pt-wrap');
    expect(svg().getAttribute('data-zoom')).toBe(JSON.stringify({ px: 754 / 800, ty: 318 / 340 }));
    expect(svg().getAttribute('aria-label')).toBe('Probe chart');
    expect(el.querySelector('clipPath#probeclip')).not.toBeNull();
    expect(el.querySelectorAll('.pt-taxis, .pt-axis-strip')).toHaveLength(2);
    expect(el.querySelector('path.line')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(el.querySelector('g[clip-path="url(#probeclip)"] path.line')).not.toBeNull();
    expect([...el.querySelectorAll('g[ptYAxis] text')].map((t) => t.textContent)).toEqual(['$12.34', '$1,234']);
    expect(el.querySelector('g[ptYAxis] line')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect([...el.querySelectorAll('g[ptTimeAxis] text')].map((t) => `${t.textContent}:${t.getAttribute('text-anchor')}`)).toEqual(['Jan:start', 'Feb:middle', 'Mar:end']);
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
    await settle();
    expect(probe()).toBe('0.180|0.980|1.000');
  });
  it('view controls appear only when there is something to undo, and undo it; double-click resets', async () => {
    expect(el.querySelector('.pt-vctl')).toBeNull();
    await wheel(400, -100); await wheel(790, 100);
    expect([...el.querySelectorAll('[data-view]')].map((b) => b.getAttribute('data-view'))).toEqual(['fit', 'latest', 'reset']);
    (el.querySelector('[data-view="fit"]') as HTMLButtonElement).click();
    await settle();
    expect(probe()).toBe('0.100|0.900|1.000');
    svg().dispatchEvent(new Event('dblclick', { bubbles: true }));
    await settle();
    expect(probe()).toBe('0.000|1.000|1.000');
    expect(el.querySelector('.pt-vctl')).toBeNull();
  });
  it('reports interactions as pt-interact events (analytics beacons)', async () => {
    const seen: string[] = [];
    document.addEventListener('pt-interact', (e) => seen.push((e as CustomEvent<{ action: string }>).detail.action));
    await wheel(400, -100);
    expect(seen).toContain('zoom');
  });
});

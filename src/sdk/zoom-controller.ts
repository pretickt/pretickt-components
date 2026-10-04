import {
  fitYViewport, FULL_VIEWPORT, latestViewport, panViewport, scaleYViewport, shiftYViewport, zoomViewport, type Viewport,
} from './viewport';

export interface ZoomHost {
  view(): Viewport;
  setView(v: Viewport): void;
  interact(action: string): void;
}

/**
 * TradingView-style zoom & pan for any component whose svg carries `data-zoom` (beta's ZoomPan directive): wheel/drag on the plot =
 * time, on the right strip = price scale, on the bottom strip = time around the grab point, double-click = reset. The view lives in
 * the element's params, so renderStatic stays the only renderer and no data is fetched. Listeners sit on the host element, not the
 * svg: every view change re-renders (replaces) the svg mid-gesture — `sync()` re-applies the hover classes to the new one.
 */
export function attachZoom(el: HTMLElement, host: ZoomHost) {
  const svgOf = () => el.querySelector<SVGSVGElement>('svg[data-zoom]');
  const inSvg = (e: Event) => !!(e.target as Element).closest?.('svg[data-zoom]');
  const geo = (e: { clientX: number; clientY: number }) => {
    const svg = svgOf();
    if (!svg) return null;
    let zones = { px: 0.93, ty: 0.9 };
    try { zones = { ...zones, ...JSON.parse(svg.getAttribute('data-zoom') ?? '{}') }; } catch { /* defaults */ }
    const r = svg.getBoundingClientRect();
    const fx = r.width > 0 ? (e.clientX - r.left) / r.width : 0.5;
    const fy = r.height > 0 ? (e.clientY - r.top) / r.height : 0.5;
    const onAxis = fx >= zones.px;
    return { r, fx, onAxis, onTimeAxis: !onAxis && fy >= zones.ty };
  };

  /** Which strip is hovered: classes on the svg light it up and set the cursor (ds.css). */
  let over = { axis: false, taxis: false };
  const sync = () => {
    const svg = svgOf();
    svg?.classList.toggle('pt-over-axis', over.axis);
    svg?.classList.toggle('pt-over-taxis', over.taxis);
  };
  const hover = (axis: boolean, taxis: boolean) => {
    if (axis === over.axis && taxis === over.taxis) return;
    over = { axis, taxis };
    sync();
  };

  let drag: { axis: boolean; taxis: boolean; anchor: number; x: number; y: number; moved: boolean } | null = null;

  el.addEventListener('wheel', (e) => {
    if (!inSvg(e)) return;
    const g = geo(e);
    if (!g) return;
    e.preventDefault();
    host.interact('zoom');
    const factor = e.deltaY > 0 ? 1.25 : 0.8;
    host.setView(g.onAxis ? scaleYViewport(host.view(), factor) : zoomViewport(host.view(), g.fx, factor));
  }, { passive: false });

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !inSvg(e)) return;
    const g = geo(e);
    if (!g) return;
    drag = { axis: g.onAxis, taxis: g.onTimeAxis, anchor: g.fx, x: e.clientX, y: e.clientY, moved: false };
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag) {
      if (!inSvg(e)) { hover(false, false); return; } // no layout read outside the chart
      const g = geo(e);
      if (g) hover(g.onAxis, g.onTimeAxis);
      return;
    }
    const g = geo(e);
    if (!g || g.r.width === 0 || g.r.height === 0) return;
    const { r } = g;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    const v = host.view();
    if (drag.axis) {   // down stretches the price scale, up compresses it
      if (Math.abs(dy) < 1) return;
      drag.moved = true; drag.y = e.clientY;
      host.setView(scaleYViewport(v, 1 + dy / r.height));
      return;
    }
    if (drag.taxis) {  // squeeze or stretch time around the grabbed point
      if (Math.abs(dx) < 1) return;
      drag.moved = true; drag.x = e.clientX;
      host.setView(zoomViewport(v, drag.anchor, Math.max(0.5, Math.min(2, 1 - (2 * dx) / r.width))));
      return;
    }
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
    let next = panViewport(v, -dx / r.width);
    const yScale = v.yScale ?? 1; // the visible price span is yScale × the fitted one: the content follows the pointer 1:1
    if (yScale !== 1 && Math.abs(dy) >= 1) next = shiftYViewport(next, (-dy / r.height) * yScale);
    host.setView(next);
  });

  const end = () => {
    if (drag?.moved) host.interact('zoom');
    drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => hover(false, false));
  el.addEventListener('dblclick', (e) => { if (inSvg(e)) { host.interact('reset'); host.setView(FULL_VIEWPORT); } });

  return {
    sync,
    /** A `data-view` button: fit the price scale, back to the latest data, or reset. */
    control(k: string | null) {
      host.interact(k ?? 'reset');
      const v = host.view();
      host.setView(k === 'fit' ? fitYViewport(v) : k === 'latest' ? latestViewport(v) : FULL_VIEWPORT);
    },
  };
}

/** Ported from beta (pretickt-frontend/src/app/companies/chart-viewport.ts). Pure and QuickJS-safe: components use it
 *  in their geometry; the base element drives it from wheel/drag (see element.ts, `data-zoom`). */
/** TradingView-style x-viewport for time charts, as a pure fraction window over the full series.
 *  Wheel zooms around the cursor anchor, drag pans, double-click resets — the directive emits new
 *  viewports and each chart re-renders its geometry on the sliced data (true re-scale, no SVG
 *  stretching). */

/** A window over a chart: time as fractions of the full series (0 ≤ start < end ≤ 1); `yScale` 1 = fit the data, <1 = stretched,
 *  >1 = compressed; `yShift` vertical pan in fractions of the (scaled) price range. */
export interface Viewport { start: number; end: number; yScale?: number; yShift?: number }

export const FULL_VIEWPORT: Viewport = { start: 0, end: 1, yScale: 1, yShift: 0 };

/** Price zoom stays within these bounds so the chart can never collapse or explode. */
const Y_MIN = 0.05;
const Y_MAX = 6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Zoom by `factor` (<1 = in, >1 = out) keeping the point at `anchor` (0..1 of the view) fixed. */
export function zoomViewport(vp: Viewport, anchor: number, factor: number, minSpan = 0.02): Viewport {
  const span = vp.end - vp.start;
  const newSpan = Math.min(1, Math.max(minSpan, span * factor));
  const pivot = vp.start + clamp01(anchor) * span;
  let start = pivot - clamp01(anchor) * newSpan;
  let end = start + newSpan;
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > 1) {
    start -= end - 1;
    end = 1;
  }
  return { ...vp, start: clamp01(start), end: clamp01(end) };
}

/** Stretch or compress the price axis around the middle of the current view. */
export function scaleYViewport(vp: Viewport, factor: number): Viewport {
  const next = Math.min(Y_MAX, Math.max(Y_MIN, (vp.yScale ?? 1) * factor));
  return { ...vp, yScale: next };
}

/** Slide the price axis (positive = look lower down the price range). */
export function shiftYViewport(vp: Viewport, delta: number): Viewport {
  const next = Math.min(3, Math.max(-3, (vp.yShift ?? 0) + delta));
  return { ...vp, yShift: next };
}

/** Apply the viewport's vertical zoom/pan to a data range the chart just computed.
 *  Charts keep deciding what their natural [lo, hi] is; this is the user's lens on top. */
export function applyYViewport(lo: number, hi: number, vp: Viewport): { lo: number; hi: number } {
  const scale = vp.yScale ?? 1;
  const shift = vp.yShift ?? 0;
  if (scale === 1 && shift === 0) return { lo, hi };
  const span = hi - lo;
  const mid = (lo + hi) / 2 - shift * span;
  const half = (span * scale) / 2;
  return { lo: mid - half, hi: mid + half };
}

/** Pan by a fraction OF THE CURRENT VIEW (positive = towards newer data). */
export function panViewport(vp: Viewport, deltaFrac: number): Viewport {
  const span = vp.end - vp.start;
  let start = vp.start + deltaFrac * span;
  start = Math.min(1 - span, Math.max(0, start));
  return { ...vp, start, end: start + span };
}

export function isFullViewport(vp: Viewport): boolean {
  return vp.start <= 0 && vp.end >= 1 && isYFitted(vp) && isAtLatest(vp);
}

/** Drop the price-scale lens so the chart auto-fits again — the time window is left alone. */
export function fitYViewport(vp: Viewport): Viewport {
  return { ...vp, yScale: 1, yShift: 0 };
}

/** Slide the window to the end of the series KEEPING its width, and the price lens with it. */
export function latestViewport(vp: Viewport): Viewport {
  const span = Math.min(1, vp.end - vp.start);
  return { ...vp, start: 1 - span, end: 1 };
}

export function isYFitted(vp: Viewport): boolean {
  return (vp.yScale ?? 1) === 1 && (vp.yShift ?? 0) === 0;
}

export function isAtLatest(vp: Viewport): boolean {
  return vp.end >= 1 - 1e-6;
}


/** The time (or any numeric x) domain seen through the window. */
export function applyXViewport(min: number, max: number, vp: Viewport): { min: number; max: number } {
  const span = max - min;
  return { min: min + span * vp.start, max: min + span * vp.end };
}

import { describe, expect, it } from 'vitest';
import {
  applyXViewport,
  isSameViewport,
  ViewportParam,
  applyYViewport,
  fitYViewport,
  FULL_VIEWPORT,
  isAtLatest,
  isFullViewport,
  isYFitted,
  latestViewport,
  panViewport,
  scaleYViewport,
  shiftYViewport,
  viewportSlice,
  zoomViewport,
} from './viewport';

describe('zoomViewport', () => {
  it('zooms in around the anchor and clamps at the edges', () => {
    const vp = zoomViewport(FULL_VIEWPORT, 0.5, 0.5);
    expect(vp).toMatchObject({ start: 0.25, end: 0.75 });
    const right = zoomViewport(FULL_VIEWPORT, 1, 0.5);
    expect(right).toMatchObject({ start: 0.5, end: 1 });
    // zooming out beyond full snaps back to full
    expect(isFullViewport(zoomViewport({ start: 0.4, end: 0.6 }, 0.5, 10))).toBe(true);
  });

  it('never collapses below minSpan', () => {
    let vp = FULL_VIEWPORT;
    for (let i = 0; i < 50; i++) vp = zoomViewport(vp, 0.5, 0.5);
    expect(vp.end - vp.start).toBeCloseTo(0.02, 5);
  });
});

describe('panViewport', () => {
  it('shifts by a fraction of the view and clamps at both ends', () => {
    const vp = { start: 0.4, end: 0.6 };
    expect(panViewport(vp, 0.5)).toEqual({ start: 0.5, end: 0.7 });
    expect(panViewport(vp, 100).end).toBe(1);
    expect(panViewport(vp, -100).start).toBe(0);
  });
});

describe('viewportSlice', () => {
  it('maps fractions to indices with a minimum width', () => {
    expect(viewportSlice(200, { start: 0.25, end: 0.75 })).toEqual({ from: 50, to: 150 });
    const tiny = viewportSlice(200, { start: 0.5, end: 0.51 }, 10);
    expect(tiny.to - tiny.from).toBeGreaterThanOrEqual(10);
    expect(viewportSlice(5, FULL_VIEWPORT)).toEqual({ from: 0, to: 5 });
  });
});


describe('price-axis scaling', () => {
  it('stretches and compresses around the middle, leaving the time window alone', () => {
    const zoomed = scaleYViewport(FULL_VIEWPORT, 0.5);
    expect(zoomed.yScale).toBe(0.5);
    expect(zoomed.start).toBe(0);
    expect(zoomed.end).toBe(1);
    // half the range, same centre
    expect(applyYViewport(100, 200, zoomed)).toEqual({ lo: 125, hi: 175 });
    // and back out
    expect(applyYViewport(100, 200, scaleYViewport(FULL_VIEWPORT, 2))).toEqual({ lo: 50, hi: 250 });
  });

  it('never collapses or explodes the scale', () => {
    let vp = FULL_VIEWPORT;
    for (let i = 0; i < 40; i++) vp = scaleYViewport(vp, 0.5);
    expect(vp.yScale).toBeGreaterThan(0);
    expect(vp.yScale).toBeGreaterThanOrEqual(0.05);
    for (let i = 0; i < 40; i++) vp = scaleYViewport(vp, 2);
    expect(vp.yScale).toBeLessThanOrEqual(6);
  });

  it('slides the visible price band without changing its height', () => {
    const shifted = shiftYViewport(FULL_VIEWPORT, 0.25);
    const { lo, hi } = applyYViewport(100, 200, shifted);
    expect(hi - lo).toBeCloseTo(100, 6);
    expect(lo).toBeLessThan(100); // looking lower down the range
  });

  it('is a no-op at rest', () => {
    expect(applyYViewport(100, 200, FULL_VIEWPORT)).toEqual({ lo: 100, hi: 200 });
    expect(applyYViewport(100, 200, { start: 0.2, end: 0.8 })).toEqual({ lo: 100, hi: 200 });
  });

  it('counts a scaled price axis as not-full, so the reset button shows up', () => {
    expect(isFullViewport(scaleYViewport(FULL_VIEWPORT, 0.5))).toBe(false);
    expect(isFullViewport(FULL_VIEWPORT)).toBe(true);
  });
});


describe('axis buttons', () => {
  const moved = { start: 0.2, end: 0.5, yScale: 2.5, yShift: 0.4 };

  it('fit drops the price lens and leaves the time window alone', () => {
    expect(fitYViewport(moved)).toEqual({ start: 0.2, end: 0.5, yScale: 1, yShift: 0 });
  });

  it('today slides to the end keeping BOTH the zoom width and the price lens', () => {
    const v = latestViewport(moved);
    expect(v.end).toBe(1);
    expect(v.end - v.start).toBeCloseTo(0.3, 10); // same window width
    expect(v).toMatchObject({ yScale: 2.5, yShift: 0.4 });
  });

  it('today on a full view is a no-op', () => {
    expect(latestViewport(FULL_VIEWPORT)).toEqual(FULL_VIEWPORT);
  });

  it('each button knows when it has nothing to do', () => {
    expect(isYFitted(FULL_VIEWPORT)).toBe(true);
    expect(isYFitted({ start: 0, end: 1 })).toBe(true); // defaults count as fitted
    expect(isYFitted(moved)).toBe(false);
    expect(isYFitted({ start: 0, end: 1, yScale: 1, yShift: 0.2 })).toBe(false);
    expect(isAtLatest(FULL_VIEWPORT)).toBe(true);
    expect(isAtLatest(moved)).toBe(false);
    expect(isAtLatest({ start: 0.7, end: 1 })).toBe(true);
  });

  it('pressing both is equivalent to a full reset', () => {
    expect(isFullViewport(fitYViewport(latestViewport({ start: 0, end: 1, yScale: 3 })))).toBe(true);
  });
});


describe('pretickt additions', () => {
  it('applyXViewport narrows a numeric domain to the window', () => {
    expect(applyXViewport(0, 100, { start: 0.25, end: 0.75 })).toEqual({ min: 25, max: 75 });
    expect(applyXViewport(10, 20, FULL_VIEWPORT)).toEqual({ min: 10, max: 20 });
  });
  it('ViewportParam validates the window and rejects nonsense', () => {
    expect(ViewportParam.safeParse({ start: 0.1, end: 0.9, yScale: 1, yShift: 0 }).success).toBe(true);
    expect(ViewportParam.safeParse({ start: 0.9, end: 0.1 }).success).toBe(false);
    expect(ViewportParam.safeParse({ start: -1, end: 0.5 }).success).toBe(false);
  });
  it('isSameViewport treats a missing y lens as fitted', () => {
    expect(isSameViewport({ start: 0, end: 1 }, FULL_VIEWPORT)).toBe(true);
  });
});

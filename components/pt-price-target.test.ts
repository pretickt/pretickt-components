// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { analystsDemo, priceSeriesDemo } from '../src/typologies';
import * as mod from './pt-price-target';
import { standardSuite } from './_harness';

const analysts = analystsDemo({ ticker: 'NVDA', window: '1y' });
const series = priceSeriesDemo({ tickers: ['NVDA'], range: '1y', interval: '1d', rebase: false });
const p = { ticker: 'NVDA' };

const pts = [{ t: '2025-06-02', o: 100, h: 100, l: 100, c: 100, v: 1 }, { t: '2025-09-02', o: 110, h: 110, l: 110, c: 110, v: 1 },
  { t: '2026-01-05', o: 120, h: 120, l: 120, c: 120, v: 1 }];
const tg = (o: Partial<{ date: string; firm: string; target: number; priceWhenPosted: number | null }>) =>
  ({ date: '2025-09-02', firm: 'A', target: 150, priceWhenPosted: 110, ...o });

describe('buildPtChart (ported from beta pt-chart.geometry)', () => {
  it('links every segment to its end cluster', () => {
    const c = mod.buildPtChart(pts, [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 80 })], '2026-01-05', 120)!;
    expect(c.segments).toHaveLength(2);
    expect(c.clusters).toHaveLength(2);
    for (const s of c.segments) {
      expect(c.clusters[s.endIdx]!.x).toBe(s.x2);
      expect(c.clusters[s.endIdx]!.up).toBe(s.up);
    }
  });
  it('merges targets within 20% and ~45 days into one dot and one segment', () => {
    const c = mod.buildPtChart(pts, [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 155 })], '2026-01-05', 120)!;
    expect(c.clusters).toHaveLength(1);
    expect(c.segments).toHaveLength(1);
    expect(c.clusters[0]!.members.map((m) => m.firm).sort()).toEqual(['A', 'B']);
  });
  it('labels each dot with its distance from the current price, and starts on the price line', () => {
    const c = mod.buildPtChart(pts, [tg({ target: 150 })], '2026-01-05', 120)!;
    expect(c.clusters[0]!.pctLabel).toBe('+25%');
    expect(c.startDots).toHaveLength(1);
  });
  it('puts the % label left of a dot that sits against the price axis', () => {
    const near = mod.buildPtChart(pts, [tg({ date: '2026-01-05', target: 150 })], '2026-01-05', 120)!;
    expect(near.clusters[0]!.labelLeft).toBe(true);
    const far = mod.buildPtChart(pts, [tg({ date: '2025-06-02', target: 150 }), tg({ firm: 'Z', date: '2026-01-05', target: 60 })], '2026-01-05', 120)!;
    expect(far.clusters.find((c) => c.members[0]!.date === '2025-06-02')!.labelLeft).toBe(false);
  });
  it('members are listed newest first', () => {
    const c = mod.buildPtChart(pts, [tg({ firm: 'A', date: '2025-09-02' }), tg({ firm: 'B', date: '2025-09-20' })], '2026-01-05', 120)!;
    expect(c.clusters[0]!.members.map((m) => m.firm)).toEqual(['B', 'A']);
  });
  it('today is the as-of date, never the clock: a later as-of moves the today line right', () => {
    const early = mod.buildPtChart(pts, [tg({})], '2025-12-01', 120)!;
    const late = mod.buildPtChart(pts, [tg({})], '2026-01-05', 120)!;
    expect(late.todayX).toBeGreaterThan(early.todayX);
  });
});

describe('buildPtChart with a viewport (beta spec)', () => {
  const two = [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 130 })];
  it('narrows the time window to the requested slice', () => {
    const full = mod.buildPtChart(pts, two, '2026-01-05', 120)!;
    const zoomed = mod.buildPtChart(pts, two, '2026-01-05', 120, { start: 0.5, end: 1, yScale: 1, yShift: 0 })!;
    expect(zoomed.xTicks[0]!.label).not.toBe(full.xTicks[0]!.label);
    expect(zoomed.todayX).toBeLessThan(full.todayX);
  });
  it('stretches the price scale without touching time', () => {
    const full = mod.buildPtChart(pts, two, '2026-01-05', 120)!;
    const tall = mod.buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 2, yShift: 0 })!;
    expect(tall.todayX).toBeCloseTo(full.todayX, 6);
    expect(tall.yTicks.map((t) => t.v)).not.toEqual(full.yTicks.map((t) => t.v));
  });
  it('is unchanged by the identity viewport', () => {
    expect(mod.buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 1, yShift: 0 })!.pricePath)
      .toBe(mod.buildPtChart(pts, two, '2026-01-05', 120)!.pricePath);
  });
});

describe('pt-price-target', () => {
  standardSuite(mod);

  it('shows low, average, median, high and upside against the last close', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    for (const label of ['Low', 'Average', 'Median', 'High', 'Upside']) expect(out).toContain(`>${label}<`);
    expect(out).toContain(h.money(analysts.summary!.mean));
    expect(out).toContain(h.pct(analysts.summary!.mean / analysts.price! - 1));
  });
  it('draws one dot per target cluster and one segment per start→end pair (beta geometry)', () => {
    const c = mod.buildPtChart(series[0]!.points, analysts.targets, analysts.asOf, analysts.price!)!;
    const out = mod.renderStatic({ analysts, series }, p, h);
    expect(out.match(/<circle class="pt-dot /g)).toHaveLength(c.clusters.length);
    expect(out.match(/<path class="pt-seg"/g)).toHaveLength(c.segments.length);
    expect(out.match(/class="pt-seg-hit"/g)).toHaveLength(c.segments.length);
    expect(out.match(/<linearGradient /g)).toHaveLength(c.segments.length);
    expect(out.match(/class="pt-orbit /g)).toHaveLength(c.clusters.length);
    expect(out.match(/class="pt-members/g)).toHaveLength(c.clusters.length);
  });
  it('each member panel lists the analysts behind its dot (at most six rows, then "+n more")', () => {
    const c = mod.buildPtChart(series[0]!.points, analysts.targets, analysts.asOf, analysts.price!)!;
    const out = mod.renderStatic({ analysts, series }, p, h);
    expect((out.match(/class="pt-mem"/g) ?? []).length).toBe(c.clusters.reduce((n, cl) => n + Math.min(cl.members.length, 6), 0));
    expect(out).toContain('animation-delay:0.13s');
  });
  it('one tone vocabulary: dots, labels and member targets are pt-pos / pt-neg, accuracy is pt-acc-*', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    expect(out).toMatch(/<circle class="pt-dot pt-(pos|neg)"/);
    expect(out).not.toMatch(/pt-up|pt-down|"acc-/);
  });
  it('price labels sit above the grab strip (readable), time labels name the month', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    expect(out.indexOf('class="pt-axis-strip"')).toBeLessThan(out.indexOf('text-anchor="end">$'));
    expect(out).toMatch(/>[A-Z][a-z]{2} \d{2}</);
  });
  it('renders the consensus bar with counts as text', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    expect(out).toContain('pt-consensus');
    expect(out).toContain(`Strong buy ${analysts.consensus!.strongBuy}`);
  });
  it('is zoomable: grab strips on the svg, controls only once the view moved', () => {
    const still = mod.renderStatic({ analysts, series }, p, h);
    expect(still).toContain('data-zoom=');
    expect(still).toContain('class="pt-axis-strip"');
    expect(still).not.toContain('pt-vctl');
    const moved = mod.renderStatic({ analysts, series }, { ...p, view: { start: 0.2, end: 0.8, yScale: 1, yShift: 0 } }, h);
    expect(moved).toContain('data-view="latest"');
  });
  it('edge time labels stay inside the plot (the first one at the left edge is left-aligned)', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    const ticks = [...out.matchAll(/<text class="pt-axis" x="([\d.]+)" y="[\d.]+" text-anchor="(\w+)">[A-Z][a-z]{2} \d{2}</g)];
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0]![2]).toBe('start');
    expect(ticks.every((m) => Number(m[1]) <= 754)).toBe(true);
  });
  it('explains missing coverage', () => {
    const none = { ...analysts, summary: null, targets: [], consensus: null, history: [] };
    expect(mod.renderStatic({ analysts: none, series }, p, h)).toContain('No analyst targets in the last 12 months');
  });
  it('keeps the stats when the price series is missing', () => {
    const out = mod.renderStatic({ analysts, series: null }, p, h);
    expect(out).toContain('>Average<');
    expect(out).not.toContain('<svg');
  });
});

describe('pt-price-target element (beta hover: member rows under the dot)', () => {
  it('shows the panel of the hovered dot and hides it on leave', async () => {
    const { lit } = await import('./_harness');
    const { classFor } = await import('../src/sdk/element');
    customElements.define('pt-pt-hover-test', classFor(lit, mod, { resolve: async () => null }));
    const el = document.createElement('pt-pt-hover-test') as HTMLElement & { params: unknown; data: unknown; updateComplete: Promise<boolean> };
    el.params = p;
    el.data = { analysts, series };
    document.body.append(el);
    await el.updateComplete;
    const dot = el.querySelector('.pt-dot')!;
    const i = dot.getAttribute('data-i');
    const panel = el.querySelector(`.pt-members[data-i="${i}"]`) as HTMLElement;
    expect(panel.hidden).toBe(true);
    dot.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(panel.hidden).toBe(false);
    dot.dispatchEvent(new Event('pointerout', { bubbles: true }));
    expect(panel.hidden).toBe(true);
    el.remove();
  });
});

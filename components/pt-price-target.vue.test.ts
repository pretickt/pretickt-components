// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { h, Suspense } from 'vue';
import { createPt, PT } from '../src/context/pt';
import { money, pct } from '../src/ds/format';
import { analystsDemo, priceSeriesDemo } from '../src/typologies';
import PtPriceTarget, { buildPtChart } from './pt-price-target.vue';
import { demo, render, standardSuite, withData } from './_suite';

const analysts = analystsDemo({ ticker: 'NVDA', window: '1y' });
const series = priceSeriesDemo({ tickers: ['NVDA'], range: '1y', interval: '1d', rebase: false });
const p = { ticker: 'NVDA' };
const html = async (a: unknown = analysts, s: unknown = series) => (await render(PtPriceTarget, p, withData({ 'analysts@1': a, 'price-series@1': s }))).html;

const pts = [{ t: '2025-06-02', o: 100, h: 100, l: 100, c: 100, v: 1 }, { t: '2025-09-02', o: 110, h: 110, l: 110, c: 110, v: 1 },
  { t: '2026-01-05', o: 120, h: 120, l: 120, c: 120, v: 1 }];
const tg = (o: Partial<{ date: string; firm: string; target: number; priceWhenPosted: number | null }>) =>
  ({ date: '2025-09-02', firm: 'A', target: 150, priceWhenPosted: 110, ...o });

describe('buildPtChart (ported from beta pt-chart.geometry)', () => {
  it('links every segment to its end cluster', () => {
    const c = buildPtChart(pts, [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 80 })], '2026-01-05', 120)!;
    expect(c.segments).toHaveLength(2);
    expect(c.clusters).toHaveLength(2);
    for (const s of c.segments) {
      expect(c.clusters[s.endIdx]!.x).toBe(s.x2);
      expect(c.clusters[s.endIdx]!.up).toBe(s.up);
    }
  });
  it('merges targets within 20% and ~45 days into one dot and one segment', () => {
    const c = buildPtChart(pts, [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 155 })], '2026-01-05', 120)!;
    expect(c.clusters).toHaveLength(1);
    expect(c.segments).toHaveLength(1);
    expect(c.clusters[0]!.members.map((m) => m.firm).sort()).toEqual(['A', 'B']);
  });
  it('labels each dot with its distance from the current price, and starts on the price line', () => {
    const c = buildPtChart(pts, [tg({ target: 150 })], '2026-01-05', 120)!;
    expect(c.clusters[0]!.pctLabel).toBe('+25%');
    expect(c.startDots).toHaveLength(1);
  });
  it('puts the % label left of a dot that sits against the price axis', () => {
    const near = buildPtChart(pts, [tg({ date: '2026-01-05', target: 150 })], '2026-01-05', 120)!;
    expect(near.clusters[0]!.labelLeft).toBe(true);
    const far = buildPtChart(pts, [tg({ date: '2025-06-02', target: 150 }), tg({ firm: 'Z', date: '2026-01-05', target: 60 })], '2026-01-05', 120)!;
    expect(far.clusters.find((c) => c.members[0]!.date === '2025-06-02')!.labelLeft).toBe(false);
  });
  it('members are listed newest first', () => {
    const c = buildPtChart(pts, [tg({ firm: 'A', date: '2025-09-02' }), tg({ firm: 'B', date: '2025-09-20' })], '2026-01-05', 120)!;
    expect(c.clusters[0]!.members.map((m) => m.firm)).toEqual(['B', 'A']);
  });
  it('today is the as-of date, never the clock: a later as-of moves the today line right', () => {
    const early = buildPtChart(pts, [tg({})], '2025-12-01', 120)!;
    const late = buildPtChart(pts, [tg({})], '2026-01-05', 120)!;
    expect(late.todayX).toBeGreaterThan(early.todayX);
  });
});

describe('buildPtChart with a viewport (beta spec)', () => {
  const two = [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 130 })];
  it('narrows the time window to the requested slice', () => {
    const full = buildPtChart(pts, two, '2026-01-05', 120)!;
    const zoomed = buildPtChart(pts, two, '2026-01-05', 120, { start: 0.5, end: 1, yScale: 1, yShift: 0 })!;
    expect(zoomed.xTicks[0]!.label).not.toBe(full.xTicks[0]!.label);
    expect(zoomed.todayX).toBeLessThan(full.todayX);
  });
  it('stretches the price scale without touching time', () => {
    const full = buildPtChart(pts, two, '2026-01-05', 120)!;
    const tall = buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 2, yShift: 0 })!;
    expect(tall.todayX).toBeCloseTo(full.todayX, 6);
    expect(tall.yTicks.map((t) => t.v)).not.toEqual(full.yTicks.map((t) => t.v));
  });
  it('is unchanged by the identity viewport', () => {
    expect(buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 1, yShift: 0 })!.pricePath)
      .toBe(buildPtChart(pts, two, '2026-01-05', 120)!.pricePath);
  });
});

describe('pt-price-target', () => {
  standardSuite('pt-price-target.vue', PtPriceTarget);

  it('shows low, average, median, high and upside against the last close', async () => {
    const out = await html();
    for (const label of ['Low', 'Average', 'Median', 'High', 'Upside']) expect(out).toContain(`>${label}<`);
    expect(out).toContain(money(analysts.summary!.mean));
    expect(out).toContain(pct(analysts.summary!.mean / analysts.price! - 1));
  });
  it('draws one dot per target cluster and one segment per start→end pair (beta geometry)', async () => {
    const c = buildPtChart(series[0]!.points, analysts.targets, analysts.asOf, analysts.price!)!;
    const out = await html();
    expect(out.match(/<circle class="pt-dot /g)).toHaveLength(c.clusters.length);
    expect(out.match(/<path class="pt-seg"/g)).toHaveLength(c.segments.length);
    expect(out.match(/class="pt-seg-hit"/g)).toHaveLength(c.segments.length);
    expect(out.match(/<linearGradient /g)).toHaveLength(c.segments.length);
    expect(out.match(/class="pt-orbit /g)).toHaveLength(c.clusters.length);
    expect(out.match(/class="pt-members/g)).toHaveLength(c.clusters.length);
  });
  it('each member panel lists the analysts behind its dot (at most six rows, then "+n more")', async () => {
    const c = buildPtChart(series[0]!.points, analysts.targets, analysts.asOf, analysts.price!)!;
    const out = await html();
    expect((out.match(/class="pt-mem"/g) ?? []).length).toBe(c.clusters.reduce((n, cl) => n + Math.min(cl.members.length, 6), 0));
    expect(out).toContain('animation-delay:0.13s');
  });
  it('one tone vocabulary: dots, labels and member targets are pt-pos / pt-neg, accuracy is pt-acc-*', async () => {
    const out = await html();
    expect(out).toMatch(/<circle class="pt-dot pt-(pos|neg)"/);
    expect(out).not.toMatch(/pt-up|pt-down|"acc-/);
  });
  it('price labels sit above the grab strip (readable), time labels name the month', async () => {
    const out = await html();
    expect(out.indexOf('class="pt-axis-strip"')).toBeLessThan(out.indexOf('text-anchor="end">$'));
    expect(out).toMatch(/>[A-Z][a-z]{2} \d{2}</);
  });
  it('renders the consensus bar with counts as text', async () => {
    const out = await html();
    expect(out).toContain('pt-consensus');
    expect(out).toContain(`Strong buy ${analysts.consensus!.strongBuy}`);
  });
  it('is zoomable: grab strips on the svg, no view controls at the full view', async () => {
    const out = await html();
    expect(out).toContain('data-zoom=');
    expect(out).toContain('class="pt-axis-strip"');
    expect(out).not.toContain('pt-vctl');
  });
  it('edge time labels stay inside the plot (the first one at the left edge is left-aligned)', async () => {
    const out = await html();
    const ticks = [...out.matchAll(/<text class="pt-axis" x="([\d.]+)" y="[\d.]+" text-anchor="(\w+)">[A-Z][a-z]{2} \d{2}</g)];
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0]![2]).toBe('start');
    expect(ticks.every((m) => Number(m[1]) <= 754)).toBe(true);
  });
  it('explains missing coverage', async () => {
    expect(await html({ ...analysts, summary: null, targets: [], consensus: null, history: [] })).toContain('No analyst targets in the last 12 months');
  });
  it('keeps the stats when the price series is missing', async () => {
    const out = await html(analysts, null);
    expect(out).toContain('>Average<');
    expect(out).not.toContain('<svg');
  });
  it('hovering a dot shows the analysts behind it, leaving hides them (beta hover)', async () => {
    const w = mount({ render: () => h(Suspense, null, { default: () => h(PtPriceTarget, p) }) },
      { global: { provide: { [PT as symbol]: createPt({ resolve: demo() }) } }, attachTo: document.body });
    await flushPromises();
    const dot = w.find('.pt-dot');
    const panel = () => w.find(`.pt-members[data-i="${dot.attributes('data-i')}"]`).element as HTMLElement;
    expect(panel().hidden).toBe(true);
    await dot.trigger('pointerover');
    expect(panel().hidden).toBe(false);
    await dot.trigger('pointerout');
    expect(panel().hidden).toBe(true);
    w.unmount();
  });
});

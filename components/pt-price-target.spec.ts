import { money, pct } from '../src/ds/format';
import { analystsDemo, priceSeriesDemo } from '../src/typologies';
import { buildPtChart, PtPriceTarget } from './pt-price-target';
import { basics, render, settle, withData } from './_spec';

const analysts = analystsDemo({ ticker: 'NVDA', window: '1y' });
const series = priceSeriesDemo({ tickers: ['NVDA'], range: '1y', interval: '1d', rebase: false });
const p = { ticker: 'NVDA' };
const view = (a: unknown = analysts, s: unknown = series) => render(PtPriceTarget, p, withData({ 'analysts@1': a, 'price-series@1': s }));

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
    expect(buildPtChart(pts, [tg({})], '2026-01-05', 120)!.todayX).toBeGreaterThan(buildPtChart(pts, [tg({})], '2025-12-01', 120)!.todayX);
  });
  it('a viewport narrows time, stretches price, and the identity viewport changes nothing', () => {
    const two = [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 130 })];
    const full = buildPtChart(pts, two, '2026-01-05', 120)!;
    const zoomed = buildPtChart(pts, two, '2026-01-05', 120, { start: 0.5, end: 1, yScale: 1, yShift: 0 })!;
    expect(zoomed.xTicks[0]!.label).not.toBe(full.xTicks[0]!.label);
    expect(zoomed.todayX).toBeLessThan(full.todayX);
    const tall = buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 2, yShift: 0 })!;
    expect(tall.todayX).toBeCloseTo(full.todayX, 6);
    expect(tall.yTicks.map((t) => t.v)).not.toEqual(full.yTicks.map((t) => t.v));
    expect(buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 1, yShift: 0 })!.pricePath).toBe(full.pricePath);
  });
});

describe('pt-price-target', () => {
  basics(PtPriceTarget, p);

  it('shows low, average, median, high and upside against the last close', async () => {
    const out = (await view()).html();
    for (const label of ['Low', 'Average', 'Median', 'High', 'Upside']) expect(out).toContain(`>${label}<`);
    expect(out).toContain(money(analysts.summary!.mean));
    expect(out).toContain(pct(analysts.summary!.mean / analysts.price! - 1));
  });
  it('draws one dot, orbit and member panel per target cluster and one segment (+ hit path + gradient) per start→end pair', async () => {
    const c = buildPtChart(series[0]!.points, analysts.targets, analysts.asOf, analysts.price!)!;
    const { el } = await view();
    expect(el.querySelectorAll('circle.pt-dot')).toHaveLength(c.clusters.length);
    expect(el.querySelectorAll('path.pt-seg')).toHaveLength(c.segments.length);
    expect(el.querySelectorAll('path.pt-seg-hit')).toHaveLength(c.segments.length);
    expect(el.querySelectorAll('linearGradient')).toHaveLength(c.segments.length);
    expect(el.querySelectorAll('circle.pt-orbit')).toHaveLength(c.clusters.length);
    expect(el.querySelectorAll('.pt-members')).toHaveLength(c.clusters.length);
    expect(el.querySelector('linearGradient')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
  it('each member panel lists the analysts behind its dot (at most six rows, then "+n more"), rows animate in turn', async () => {
    const c = buildPtChart(series[0]!.points, analysts.targets, analysts.asOf, analysts.price!)!;
    const { el } = await view();
    expect(el.querySelectorAll('.pt-mem:not(.pt-mem-more)')).toHaveLength(c.clusters.reduce((n, cl) => n + Math.min(cl.members.length, 6), 0));
    expect([...el.querySelectorAll<HTMLElement>('.pt-mem')].some((m) => m.style.animationDelay === '0.13s')).toBe(true);
  });
  it('one tone vocabulary: dots, labels and member targets are pt-pos / pt-neg, accuracy is pt-acc-*', async () => {
    const { el, html } = await view();
    expect([...el.querySelectorAll('circle.pt-dot')].every((d) => /^pt-dot pt-(pos|neg)$/.test(d.getAttribute('class')!))).toBe(true);
    expect(html()).not.toMatch(/pt-up|pt-down|"acc-/);
  });
  it('price labels sit above the grab strip, time labels name the month and stay inside the plot', async () => {
    const out = (await view()).html();
    expect(out.indexOf('class="pt-axis-strip"')).toBeLessThan(out.search(/text-anchor="end"[^>]*>\$/));
    const ticks = [...out.matchAll(/<text class="pt-axis" x="([\d.]+)" y="[\d.]+" text-anchor="(\w+)">[A-Z][a-z]{2} \d{2}</g)];
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0]![2]).toBe('start');
    expect(ticks.every((m) => Number(m[1]) <= 754)).toBe(true);
  });
  it('renders the consensus bar with counts as text', async () => {
    const out = (await view()).html();
    expect(out).toContain('pt-consensus');
    expect(out).toContain(`Strong buy ${analysts.consensus!.strongBuy}`);
  });
  it('is zoomable: grab strips on the svg, no view controls at the full view', async () => {
    const out = (await view()).html();
    expect(out).toContain('data-zoom=');
    expect(out).toContain('class="pt-axis-strip"');
    expect(out).not.toContain('pt-vctl');
  });
  it('explains missing coverage, keeps the stats without prices', async () => {
    expect((await view({ ...analysts, summary: null, targets: [], consensus: null, history: [] })).html()).toContain('No analyst targets in the last 12 months');
    const noPrices = (await view(analysts, null)).html();
    expect(noPrices).toContain('>Average<');
    expect(noPrices).not.toContain('<svg');
  });
  it('hovering a dot shows the analysts behind it, leaving hides them (beta hover)', async () => {
    const r = await view();
    const dot = r.el.querySelector('circle.pt-dot')!;
    const panel = () => r.el.querySelector(`.pt-members[data-i="${dot.getAttribute('data-i')}"]`) as HTMLElement;
    expect(panel().hidden).toBe(true);
    dot.dispatchEvent(new Event('pointerover', { bubbles: true }));
    await settle(r.f);
    expect(panel().hidden).toBe(false);
    dot.dispatchEvent(new Event('pointerout', { bubbles: true }));
    await settle(r.f);
    expect(panel().hidden).toBe(true);
  });
});

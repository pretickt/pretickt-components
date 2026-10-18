import { money, pct } from '../src/ds/format';
import { analystsDemo, priceSeriesDemo } from '../src/typologies';
import { buildLadder, buildPtChart, LADDER_GAP, PtPriceTarget } from './pt-price-target';
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
  it('leaves room on the right: the furthest target dot keeps its % label on its right, clear of the price axis', () => {
    const c = buildPtChart(pts, [tg({ date: '2026-01-05', target: 150 })], '2026-01-05', 120)!;
    const dot = c.clusters[0]!;
    expect(dot.labelLeft).toBe(false);
    expect(dot.x + dot.r + 30).toBeLessThanOrEqual(c.w - 46);
  });
  it('puts the % label left of a dot that sits against the price axis (zoomed so the dot is at the edge)', () => {
    const one = [tg({ date: '2026-01-05', target: 150 })];
    expect(buildPtChart(pts, one, '2026-01-05', 120, { start: 0, end: 0.95, yScale: 1, yShift: 0 })!.clusters[0]!.labelLeft).toBe(true);
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

describe('buildLadder (the targets against today\'s price, upright)', () => {
  const meta = { low: 547.25, mean: 792.86, median: 817.14, high: 1026.3 };
  const firms = [tg({ firm: 'A', target: 1026.3 }), tg({ firm: 'B', target: 820 }), tg({ firm: 'C', target: 815 }), tg({ firm: 'D', target: 812 }),
    tg({ firm: 'E', target: 650 }), tg({ firm: 'F', target: 547.25 }), tg({ firm: 'G', target: 0 })];
  const L = buildLadder(meta, 709.33, firms)!;
  it('reads top to bottom: high, median, average, today, low — each with its price and its distance from today', () => {
    expect(L.marks.map((m) => [m.key, m.price, m.pct])).toEqual([['high', '$1,026.30', '+44.7%'], ['median', '$817.14', '+15.2%'], ['mean', '$792.86', '+11.8%'],
      ['now', '$709.33', null], ['low', '$547.25', '-22.8%']]);
    expect(L.marks.map((m) => m.tone)).toEqual(['pos', 'pos', 'pos', 'now', 'neg']);
    expect(L.marks[0]!.y).toBeLessThan(L.marks[4]!.y);
    expect(L.marks.every((m, i, a) => i === 0 || m.y >= a[i - 1]!.y)).toBe(true);
  });
  it('keeps the labels apart (close values: median and average) and joins each to its true place on the rail', () => {
    const ys = L.marks.map((m) => m.labelY);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(LADDER_GAP - 1e-9);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    for (const m of L.marks) expect(m.lead).toMatch(new RegExp(`^M[\\d.]+ ${m.y} .*L[\\d.]+ ${m.labelY}$`));
  });
  it('the rail is green above today\'s price and red below; the dots are the firms\' targets, coloured by side, never on top of each other', () => {
    expect(L.zones.map((z) => z.tone)).toEqual(['pos', 'neg']);
    expect(L.zones[0]!.top + L.zones[0]!.height).toBeCloseTo(L.marks[3]!.y, 6);
    expect(L.dots).toHaveLength(6);                                   // a target of 0 is no target
    expect(L.dots.map((d) => d.tone)).toEqual(['pos', 'pos', 'pos', 'pos', 'neg', 'neg']);
    for (const d of L.dots) for (const e of L.dots) if (d !== e && d.x === e.x) expect(Math.abs(d.y - e.y)).toBeGreaterThanOrEqual(2.5);
    expect(JSON.parse(L.dots[0]!.tip)).toEqual({ A: '$1,026 · 2025-09-02' });
  });
  it('one dot a firm — its latest target, the one the summary counts — never an older one outside the range', () => {
    const L2 = buildLadder(meta, 709.33, [tg({ firm: 'A', date: '2026-01-05', target: 1200 }), tg({ firm: 'A', date: '2026-06-01', target: 900 }),
      tg({ firm: 'B', date: '2026-02-01', target: 700 })])!;
    expect(L2.dots.map((d) => JSON.parse(d.tip))).toEqual([{ A: '$900 · 2026-06-01' }, { B: '$700 · 2026-02-01' }]);
  });
  it('today above every target: the whole rail is downside; without a price, no today and no distances', () => {
    const above = buildLadder(meta, 1100, firms)!;
    expect(above.zones.map((z) => z.tone)).toEqual(['neg']);
    expect(above.marks[0]!.key).toBe('now');
    const none = buildLadder(meta, null, firms)!;
    expect(none.marks.map((m) => m.key)).toEqual(['high', 'median', 'mean', 'low']);
    expect(none.marks.every((m) => m.pct === null)).toBe(true);
    expect(none.zones.map((z) => z.tone)).toEqual(['flat']);
  });
  it('one target (low = high): finite places, no division by zero', () => {
    const one = buildLadder({ low: 100, mean: 100, median: 100, high: 100 }, 100, [tg({ target: 100 })])!;
    expect(one.marks.every((m) => Number.isFinite(m.y) && Number.isFinite(m.labelY))).toBe(true);
  });
});

describe('pt-price-target', () => {
  basics(PtPriceTarget, p);

  it('shows low, average, median, high and today upright, each with its distance from the last close; the average\'s is the upside', async () => {
    const { el } = await view();
    const g = el.querySelector('.pt-tg')!;
    const s = analysts.summary!, byValue = ([['High', s.high], ['Median', s.median], ['Average', s.mean], ['Now', analysts.price!], ['Low', s.low]] as const)
      .map((x, i) => ({ name: x[0], v: x[1], i })).sort((a, b) => b.v - a.v || a.i - b.i).map((x) => x.name);
    expect([...g.querySelectorAll('.pt-tg-name')].map((n) => n.textContent!.trim())).toEqual(byValue);  // top to bottom by value
    expect(g.textContent).toContain(money(analysts.summary!.mean));
    expect(g.querySelector('.pt-tg-mean .pt-tg-pct')!.textContent!.trim()).toBe(pct(analysts.summary!.mean / analysts.price! - 1));
    expect(el.querySelector('.pt-pt-stat')).toBeNull();
    expect(g.querySelectorAll('.pt-tg-dot').length).toBe(new Set(analysts.targets.filter((t) => t.target > 0).map((t) => t.firm)).size); // a dot a firm
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
    expect(noPrices).toContain('>Average<');                          // the ladder stays (today = the answer's last close)
    expect(noPrices).not.toContain('pt-chart-svg');                    // the chart over time needs the series
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

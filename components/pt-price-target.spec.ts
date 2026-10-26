import { money, pct } from '../src/ds/format';
import { analystsDemo, priceSeriesDemo } from '../src/typologies';
import { buildConsensusHistory, buildPtChart, consensusText, LEVEL_GAP, PtPriceTarget } from './pt-price-target';
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
  it('marks the last close and the high, average and low targets: a dashed line and a price on the axis each, in the tone of its side', () => {
    const c = buildPtChart(pts, [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 80 })], '2026-01-05', 120, undefined, { low: 80, mean: 115, high: 150 })!;
    expect(c.levels.map((l) => [l.key, l.tone])).toEqual([['high', 'pos'], ['now', 'now'], ['mean', 'neg'], ['low', 'neg']]); // top to bottom
    expect(c.levels.map((l) => l.label)).toEqual(['$150', '$120', '$115', '$80.00']);                                     // the axis' own format
    expect(c.levels.map((l) => l.name)).toEqual(['HIGH', 'TODAY', 'AVERAGE', 'LOW']);                                     // small, under each price
    expect(c.levels.every((l) => l.y > 0 && l.y < c.h)).toBe(true);
    expect(c.levels.find((l) => l.key === 'mean')!.tip).toBe(`Average target ${money(115)} · ${pct(115 / 120 - 1)} from the last close`);
    expect(c).not.toHaveProperty('todayX');                                                                             // no today line any more
    expect(c).not.toHaveProperty('yTicks');                                                                             // the levels are the axis
  });
  it('keeps the level labels apart (an average next to the last close) while each line stays at its price', () => {
    const c = buildPtChart(pts, [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 80 })], '2026-01-05', 120, undefined, { low: 80, mean: 120.5, high: 150 })!;
    const now = c.levels.find((l) => l.key === 'now')!, mean = c.levels.find((l) => l.key === 'mean')!;
    expect(Math.abs(now.y - mean.y)).toBeLessThan(LEVEL_GAP);
    expect(Math.abs(now.labelY - mean.labelY)).toBeGreaterThanOrEqual(LEVEL_GAP - 1e-9);
    expect(mean.tone).toBe('pos');
  });
  it('crowded at the bottom, only the labels short of room move up: the ones with room stay on their lines (CHTR, 2026-10-26)', () => {
    const c = buildPtChart(pts, [tg({ firm: 'A', target: 500 }), tg({ firm: 'B', target: 100 })], '2026-01-05', 101, undefined, { low: 100, mean: 173, high: 500 })!;
    const at = (k: string) => c.levels.find((l) => l.key === k)!;
    expect(c.levels.map((l) => l.key)).toEqual(['high', 'mean', 'now', 'low']);
    expect(at('high').labelY).toBe(at('high').y);
    expect(at('mean').labelY).toBe(at('mean').y);
    const ys = c.levels.map((l) => l.labelY);
    ys.slice(1).forEach((y, i) => expect(y - ys[i]!).toBeGreaterThanOrEqual(LEVEL_GAP - 1e-9));
    expect(at('low').labelY + 13).toBeLessThanOrEqual(c.h - 22 - 1);                                                     // its name above the time axis
  });
  it('four levels crowded together near the bottom keep their gaps inside the plot', () => {
    const c = buildPtChart(pts, [tg({ firm: 'A', target: 104 }), tg({ firm: 'B', target: 100 })], '2026-01-05', 101, undefined, { low: 100, mean: 102, high: 104 })!;
    const ys = c.levels.map((l) => l.labelY);
    expect(ys).toHaveLength(4);
    ys.slice(1).forEach((y, i) => expect(y - ys[i]!).toBeGreaterThanOrEqual(LEVEL_GAP - 1e-9));
    expect(ys[0]! - 7).toBeGreaterThan(0);                                                                               // the top pill inside the chart
    expect(ys.at(-1)! + 13).toBeLessThanOrEqual(c.h - 22 - 1);
  });
  it('a level outside the visible prices draws neither line nor label; without a summary only the last close', () => {
    const two = [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 80 })], s = { low: 80, mean: 115, high: 150 };
    const zoomed = buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 0.25, yShift: 0 }, s)!;  // a quarter of the prices: 105–125
    expect(zoomed.levels.map((l) => l.key)).toEqual(['now', 'mean']);
    expect(buildPtChart(pts, two, '2026-01-05', 120)!.levels.map((l) => l.key)).toEqual(['now']);
  });
  it('a viewport narrows time, stretches price, and the identity viewport changes nothing', () => {
    const two = [tg({ firm: 'A', target: 150 }), tg({ firm: 'B', target: 130 })];
    const full = buildPtChart(pts, two, '2026-01-05', 120)!;
    const zoomed = buildPtChart(pts, two, '2026-01-05', 120, { start: 0.5, end: 1, yScale: 1, yShift: 0 })!;
    expect(zoomed.xTicks[0]!.label).not.toBe(full.xTicks[0]!.label);
    expect(zoomed.levels.map((l) => l.y)).toEqual(full.levels.map((l) => l.y));                                         // time zoom: prices stay put
    const tall = buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 2, yShift: 0 })!;
    expect(tall.xTicks).toEqual(full.xTicks);
    expect(tall.levels.map((l) => l.y)).not.toEqual(full.levels.map((l) => l.y));
    expect(buildPtChart(pts, two, '2026-01-05', 120, { start: 0, end: 1, yScale: 1, yShift: 0 })!.pricePath).toBe(full.pricePath);
  });
});

describe('buildConsensusHistory (beta\'s stacked monthly ratings, half as tall, on the target chart\'s time axis)', () => {
  const h = (period: string, strongBuy: number, buy: number, hold = 0, sell = 0, strongSell = 0) => ({ period, strongBuy, buy, hold, sell, strongSell });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const periodOf = (label: string) => { const [m, y] = label.split(' ') as [string, string]; return `20${y}-${String(MON.indexOf(m) + 1).padStart(2, '0')}-01`; };
  it('stacks strong sell up to strong buy (strong buy on top), oldest month first, each month where the chart puts it', () => {
    const c = buildPtChart(pts, [tg({})], '2026-01-05', 120)!;
    const ticks = c.xTicks.slice(1, 3); // the first tick may start mid-month (clamped to the chart's start)
    const k = buildConsensusHistory([h(periodOf(ticks[1]!.label), 12, 18, 4, 1), h(periodOf(ticks[0]!.label), 8, 22, 6)], c.x)!;
    expect(k.layers.map((l) => l.band)).toEqual(['strongSell', 'sell', 'hold', 'buy', 'strongBuy']);
    expect(k.months.map((m) => m.x)).toEqual(ticks.map((t) => t.x));
    expect(k.maxTotal).toBe(36);
    expect([k.w, k.h]).toEqual([c.w, 84]);                                                                    // half of beta's 180
    expect(JSON.parse(k.months[1]!.tip)).toEqual({ [ticks[1]!.label]: '35 analysts', 'Strong buy': 12, Buy: 18, Hold: 4, Sell: 1, 'Strong sell': 0 });
  });
  it('follows the chart\'s zoom: a narrower time window moves the months', () => {
    const two = [h('2025-09-01', 10, 20), h('2025-12-01', 11, 19)];
    const full = buildConsensusHistory(two, buildPtChart(pts, [tg({})], '2026-01-05', 120)!.x)!;
    const zoomed = buildConsensusHistory(two, buildPtChart(pts, [tg({})], '2026-01-05', 120, { start: 0.5, end: 1, yScale: 1, yShift: 0 })!.x)!;
    expect(zoomed.months.map((m) => m.x)).not.toEqual(full.months.map((m) => m.x));
  });
  it('says the consensus in a sentence for search engines: the latest month\'s split, then the share of buys a year earlier', () => {
    const year = [h('2025-10-01', 10, 40, 8, 2), h('2026-04-01', 12, 44, 5, 1), h('2026-10-01', 10, 49, 2, 1)];
    expect(consensusText(year)).toBe('62 analysts in October 2026: 59 rate it a buy or strong buy (95%), 2 a hold and 1 a sell or strong sell. A year earlier, 83% rated it a buy or strong buy.');
    expect(consensusText([h('2026-10-01', 13, 44, 5)])).toBe('62 analysts in October 2026: 57 rate it a buy or strong buy (92%) and 5 a hold.');
    expect(consensusText([h('2026-10-01', 0, 1)])).toBe('1 analyst in October 2026: 1 rates it a buy or strong buy (100%).');
    expect(consensusText([h('2026-10-01', 0, 0)])).toBeNull();
    expect(consensusText([])).toBeNull();
  });
  it('one month, or no analysts at all: no chart', () => {
    const x = buildPtChart(pts, [tg({})], '2026-01-05', 120)!.x;
    expect(buildConsensusHistory([h('2025-09-01', 10, 20)], x)).toBeNull();
    expect(buildConsensusHistory([h('2025-09-01', 0, 0), h('2025-10-01', 0, 0)], x)).toBeNull();
  });
});

describe('pt-price-target', () => {
  basics(PtPriceTarget, p);

  it('reads top to bottom: the targets in a sentence, the legend, the target chart, the consensus by month, its counts and its sentence', async () => {
    const { el } = await view();
    const ledes = [...el.querySelectorAll('figure .pt-lede')];
    expect(ledes[0]!.textContent).toContain(`${analysts.summary!.n} firms with a target in the last 12 months · last close ${money(analysts.price!)}`);
    expect(ledes.at(-1)!.textContent).toBe(consensusText(analysts.history));                                     // the text search engines read
    const order = [ledes[0]!, el.querySelector('.pt-legend')!, el.querySelector('svg.pt-chart-svg')!, el.querySelector('svg.pt-cons')!, el.querySelector('.pt-cons-keys')!, ledes.at(-1)!];
    for (let i = 1; i < order.length; i++) expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector('.pt-tg')).toBeNull();                                                            // no upright summary
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
  it('no today line: the last close and the high, average and low targets are dashed lines with their prices on the axis', async () => {
    const { el } = await view();
    expect(el.querySelector('.pt-today')).toBeNull();
    const lines = [...el.querySelectorAll('line.pt-lvl')], labels = [...el.querySelectorAll('text.pt-lvl-t')];
    expect(lines.map((l) => l.getAttribute('class'))).toEqual(labels.map((t) => t.getAttribute('class')!.replaceAll('pt-lvl-t', 'pt-lvl')));
    expect(lines.length).toBe(4);
    expect(el.querySelector('text.pt-lvl-t-now')!.textContent!.trim()).toBe(lines.length ? money(analysts.price!, analysts.price! >= 100 ? 0 : 2) : '');
    expect(el.querySelector('rect.pt-lvl-pill')).not.toBeNull();                                                        // today's price in a dark pill, as upright
    expect([...el.querySelectorAll('text.pt-lvl-n')].map((n) => n.textContent!.trim()).sort()).toEqual(['AVERAGE', 'HIGH', 'LOW', 'TODAY']); // what each price is
    expect(el.querySelector('svg.pt-chart-svg line.pt-grid')).toBeNull();                                               // no unnamed grid lines on the target chart
  });
  it('under the chart, the consensus by month: five stacked bands on the chart\'s time axis, a tooltip a month, the counts as its key', async () => {
    const { el } = await view();
    const svg = el.querySelector('svg.pt-cons')!;
    expect([...svg.querySelectorAll('path.pt-cons-band')].map((p) => p.getAttribute('class')))
      .toEqual(['strongSell', 'sell', 'hold', 'buy', 'strongBuy'].map((b) => `pt-cons-band pt-cons-${b}`));
    expect(svg.querySelectorAll('rect.pt-cons-hit[data-tip]').length).toBe(analysts.history.length);
    expect(svg.getAttribute('viewBox')).toBe('0 0 800 84');
    expect(el.querySelector('.pt-cons-keys')!.textContent).toContain(`Strong buy ${analysts.consensus!.strongBuy}`);
    expect(el.querySelector('.pt-consensus')).toBeNull();                                                     // the one-line bar only without the chart
  });
  it('without prices the consensus keeps its one-line bar and its counts', async () => {
    const out = (await view(analysts, null)).html();
    expect(out).toContain('class="pt-consensus"');
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
    expect(noPrices).not.toContain('pt-chart-svg');                    // the chart over time needs the series; the consensus stays (next test)
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

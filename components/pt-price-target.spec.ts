import { date, mention, money, pct, plainName, tip, type Said } from '../src/ds/format';
import { analystsDemo, demoFor, priceSeriesDemo, type Basket, type SectorBasket } from '../src/typologies';
import { buildConsensusHistory, buildPtChart, buildTrend, consensusText, LEVEL_GAP, PtPriceTarget, trendLegs, trendText } from './pt-price-target';
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

describe('the average target week by week (the trend under the chart): its legs, its turn, its sentence', () => {
  const wk = (t: string, mean: number | null, n = 10) => ({ t, mean, n });
  /** A revision: `prev` → `target` (prev null: a firm's first). */
  const rv = (date: string, firm: string, prev: number | null, target: number) => ({ date, firm, target, priceWhenPosted: null, prev });
  const many = (k: number, date: string, up: boolean) => Array.from({ length: k }, (_, i) => rv(date, `F${up ? 'u' : 'd'}${i}`, 100, up ? 110 : 90));
  const said = (s: Said | null) => s && s.map((p) => (typeof p === 'string' ? p : `${plainName(p.name ?? p.ticker)} ${p.ticker}`)).join('');
  const nvda = mention('NVDA', 'NVIDIA Corporation', null), nke = mention('NKE', 'NIKE, Inc.', null);
  const x = (w: { t: string }[]) => buildPtChart([{ t: w[0]!.t, o: 1, h: 1, l: 1, c: 1, v: 1 }, { t: w.at(-1)!.t, o: 1, h: 1, l: 1, c: 1, v: 1 }], [tg({ date: w[0]!.t })], w.at(-1)!.t, 1)!.x;
  const peak = [wk('2026-08-14', 300), wk('2026-08-21', 320), wk('2026-08-28', 332), wk('2026-09-04', 325), wk('2026-11-13', 310)];
  const low = [wk('2026-04-10', 400), wk('2026-04-17', 380), wk('2026-04-24', 366), wk('2026-05-01', 400), wk('2026-11-13', 461)];
  const fall = [wk('2025-11-14', 84.1), wk('2026-02-13', 70), wk('2026-05-15', 60), wk('2026-08-14', 50), wk('2026-11-13', 39.3)];

  it('legs between turns: a high or low counts once the average has moved 3% away from it', () => {
    expect(trendLegs([100, 104, 110, 106, 100, 98])).toEqual([{ i0: 0, i1: 2, dir: 'up' }, { i0: 2, i1: 5, dir: 'down' }]);
    expect(trendLegs([100, 102, 101, 102.5])).toEqual([{ i0: 0, i1: 3, dir: 'up' }]);
    expect(trendLegs([null, null, 100, 90])).toEqual([{ i0: 2, i1: 3, dir: 'down' }]);
    expect(trendLegs([100, 110, null, 100])).toEqual([{ i0: 0, i1: 1, dir: 'up' }, { i0: 1, i1: 3, dir: 'down' }]);
    expect(trendLegs([100])).toEqual([]);
    expect(trendLegs([null, null])).toEqual([]);
  });
  it('a peak and a low are marked with their price and week; one leg has no turn; the end names the average target', () => {
    const p = buildTrend(peak, [], x(peak))!;
    expect(p.turn).toMatchObject({ peak: true, label: '$332 peak · Aug 28' });
    expect(p.end).toMatchObject({ dir: 'down', label: '$310 average target' });
    expect(p.legs.map((l) => l.dir)).toEqual(['up', 'down']);
    expect([p.w, p.h]).toEqual([800, 120]);
    expect(buildTrend(low, [], x(low))!.turn).toMatchObject({ peak: false, label: '$366 low · Apr 24' });
    const f = buildTrend(fall, [], x(fall))!;
    expect(f.turn).toBeNull();
    expect(f.end.label).toBe('$39.30 average target');
  });
  it('sits on the chart\'s time axis: a leg starts where the consensus strip would put its week, and the zoom moves it', () => {
    const ax = x(peak), sx = (t: string) => 6 + ((Math.floor(Date.parse(`${t}T00:00:00Z`) / 864e5) - ax.min) / (ax.max - ax.min)) * (800 - 6 - 46);
    const p = buildTrend(peak, [], ax)!;
    expect(Number(p.legs[1]!.path.match(/^M([\d.]+)/)![1])).toBeCloseTo(sx('2026-08-28'), 0);
    expect(buildTrend(peak, [], { min: ax.min + 20, max: ax.max })!.legs[0]!.path).not.toBe(p.legs[0]!.path);
  });
  it("the turn's label stays inside the strip: above a peak, under a low, with room for its text (stories, 2026-11-14: a low's label 1 unit past the bottom)", () => {
    const p = buildTrend(peak, [], x(peak))!, l = buildTrend(low, [], x(low))!;
    expect(p.turn!.labelY).toBeLessThan(p.turn!.y);
    expect(p.turn!.labelY - 9).toBeGreaterThanOrEqual(0);
    expect(l.turn!.labelY).toBeGreaterThan(l.turn!.y);
    expect(l.turn!.labelY + 3).toBeLessThanOrEqual(l.h);
  });
  it('fewer than two weeks with an average: no line', () => {
    expect(buildTrend([wk('2026-11-06', null, 2), wk('2026-11-13', 310)], [], x(peak))).toBeNull();
    expect(buildTrend([], [], x(peak))).toBeNull();
  });
  it("a week's tip: its average, its firms, and who raised or cut that week (newest first, six at most, one row a firm)", () => {
    const w = [wk('2026-10-23', 320, 32), wk('2026-10-30', 326, 33), wk('2026-11-06', null, 2)];
    const ts = [rv('2026-10-26', 'UBS', 400, 380), rv('2026-10-29', 'Mizuho', 300, 350), rv('2026-10-27', 'New', null, 500), rv('2026-10-23', 'Old', 100, 90)];
    const c = buildTrend(w, ts, x(w))!;
    expect(c.weeks[1]!.tip).toBe(tip({ 'Week to Oct 30, 2026': 'average $326', Firms: 33, '▲ Mizuho': '$300 → $350', '▼ UBS': '$400 → $380' }));
    expect(c.weeks[2]!.tip).toBeNull();
    const busy = Array.from({ length: 8 }, (_, i) => rv(`2026-10-2${4 + (i % 6)}`, `B${i}`, 100, 120));
    const twice = [rv('2026-10-26', 'Same', 100, 120), rv('2026-10-28', 'Same', 120, 90)];
    expect(JSON.parse(buildTrend(w, busy, x(w))!.weeks[1]!.tip!)).toMatchObject({ '…': '2 more' });
    expect(JSON.parse(buildTrend(w, twice, x(w))!.weeks[1]!.tip!)).toEqual({ 'Week to Oct 30, 2026': 'average $326', Firms: 33, '▼ Same': '$120 → $90.00' });
  });
  it('says what analysts did since the turn, in a sentence for search engines', () => {
    expect(said(trendText(nvda, peak, [...many(8, '2026-09-10', false), ...many(3, '2026-10-01', true), ...many(4, '2026-08-20', true)]))).toBe(
      'The average price target for Nvidia NVDA peaked at $332 in the week to Aug 28, 2026 and has fallen 7% since, to $310: 8 cuts and 3 raises since then.');
    expect(said(trendText(nvda, low, [...many(29, '2026-06-01', true), ...many(4, '2026-07-01', false)]))).toBe(
      'The average price target for Nvidia NVDA bottomed at $366 in the week to Apr 24, 2026 and has risen 26% since, to $461: 29 raises and 4 cuts since then.');
    expect(said(trendText(nke, fall, [...many(60, '2026-03-01', false), ...many(2, '2026-04-01', true)]))).toBe(
      `The average price target for Nike NKE fell from $84.10 to $39.30 in 12 months (${pct(39.3 / 84.1 - 1, 0)}): 60 cuts and 2 raises.`);
  });
  it('the counts: the larger first, cuts first on a tie, singular, a zero left out, none at all no clause; a change under 0.5% is «is at … now»', () => {
    const at = (ts: ReturnType<typeof rv>[]) => said(trendText(nvda, peak, ts))!.replace(/^.*to \$310/, '');
    expect(at([...many(2, '2026-09-10', false), ...many(2, '2026-09-11', true)])).toBe(': 2 cuts and 2 raises since then.');
    expect(at([...many(1, '2026-09-10', false), ...many(1, '2026-09-11', true)])).toBe(': 1 cut and 1 raise since then.');
    expect(at(many(2, '2026-09-10', false))).toBe(': 2 cuts since then.');
    expect(at([rv('2026-09-10', 'New', null, 300)])).toBe('.');
    const flat = [wk('2026-08-14', 320), wk('2026-08-28', 332), wk('2026-09-04', 322), wk('2026-11-13', 331)];
    expect(said(trendText(nvda, flat, many(1, '2026-09-10', false)))).toBe(
      'The average price target for Nvidia NVDA peaked at $332 in the week to Aug 28, 2026 and is at $331 now: 1 cut since then.');
    expect(trendText(nvda, [wk('2026-11-13', 310)], [])).toBeNull();
    // a line that starts later (too few firms before): no «in 12 months», its raises and cuts since its first week
    const late = [wk('2026-05-15', null, 2), wk('2026-05-22', 60), wk('2026-08-14', 50), wk('2026-11-13', 39.3)];
    expect(said(trendText(nke, late, [...many(3, '2026-05-01', false), ...many(5, '2026-06-01', false)]))).toBe(
      `The average price target for Nike NKE fell from $60.00 to $39.30 since the week to May 22, 2026 (${pct(39.3 / 60 - 1, 0)}): 5 cuts.`);
  });
});

describe('pt-price-target', () => {
  basics(PtPriceTarget, p);

  it('reads top to bottom: the targets in a sentence, the legend, the target chart, the average target week by week and its sentence, the consensus by month, its counts and its sentence', async () => {
    const { el } = await view();
    const ledes = [...el.querySelectorAll('figure .pt-lede')];
    expect(ledes[0]!.textContent).toContain(`${analysts.summary!.n} firms with a target in the last 12 months · last close ${money(analysts.price!)}`);
    expect(ledes.at(-1)!.textContent).toBe(consensusText(analysts.history));                                     // the text search engines read
    const order = [ledes[0]!, el.querySelector('.pt-legend')!, el.querySelector('svg.pt-chart-svg')!, el.querySelector('.pt-trend-legend')!, el.querySelector('svg.pt-trend')!,
      el.querySelector('.pt-trend-say')!, el.querySelector('svg.pt-cons')!, el.querySelector('.pt-cons-keys')!, ledes.at(-1)!];
    for (let i = 1; i < order.length; i++) expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector('.pt-tg')).toBeNull();                                                            // no upright summary
  });
  it('under the chart, the average target week by week: a leg a path in its tone, a hover strip a week, the turn and the end dots reachable by keyboard', async () => {
    const { el } = await view();
    const c = buildPtChart(series[0]!.points, analysts.targets, analysts.asOf, analysts.price!)!;
    const k = buildTrend(analysts.weekly!, analysts.targets, c.x)!;
    const svg = el.querySelector('svg.pt-trend')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 800 120');
    expect(svg.getAttribute('aria-label')).toBe(k.label);
    expect([...svg.querySelectorAll('path.pt-trend-leg')].map((p) => p.getAttribute('class'))).toEqual(k.legs.map((l) => `pt-trend-leg pt-trend-${l.dir}`));
    expect(svg.querySelectorAll('rect.pt-trend-hit[data-tip]')).toHaveLength(analysts.weekly!.filter((w) => w.mean != null).length);
    expect(svg.querySelectorAll('rect.pt-trend-hit[tabindex]')).toHaveLength(0);
    expect(svg.querySelectorAll('circle.pt-trend-turn')).toHaveLength(k.turn ? 1 : 0);
    const end = svg.querySelector('circle.pt-trend-end')!;
    expect(end.getAttribute('tabindex')).toBe('0');
    expect(end.getAttribute('data-tip')).toBe(k.end.tip);
    expect(svg.textContent).toContain(k.end.label);
  });
  it("its sentence names the company as people search it, through the company's mention, and says what trendText says", async () => {
    const { el } = await view();
    const say = el.querySelector('.pt-trend-say')!;
    expect(say.querySelector('a.pt-mention')!.textContent).toContain('NVDA');
    expect(say.textContent!.replace(/\s+/g, ' ').trim()).toMatch(/^The average price target for .+ NVDA (peaked|bottomed|rose|fell) /);
  });
  it('a payload of before the weeks (no weekly): no line, no sentence, the rest as it was', async () => {
    const { weekly: _, ...old } = analysts;
    const { el } = await view(old);
    expect(el.querySelector('svg.pt-trend')).toBeNull();
    expect(el.querySelector('.pt-trend-say')).toBeNull();
    expect(el.querySelector('.pt-trend-legend')).toBeNull();
    expect(el.querySelector('svg.pt-cons')).not.toBeNull();
  });
  it("the line follows the chart's zoom, as the consensus strip does", async () => {
    const r = await view();
    const before = r.el.querySelector('path.pt-trend-leg')!.getAttribute('d');
    (r.f.componentInstance as unknown as { view: { set(v: unknown): void } }).view.set({ start: 0.5, end: 1, yScale: 1, yShift: 0 });
    await settle(r.f);
    expect(r.el.querySelector('path.pt-trend-leg')!.getAttribute('d')).not.toBe(before);
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

describe('pt-price-target on a basket: its holdings\' targets, week by week', () => {
  const smh = demoFor({ t: 'basket@1', params: { ticker: 'SMH' } }) as Basket;
  const tech = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
  const fundSeries = priceSeriesDemo({ tickers: ['SMH'], range: '1y', interval: '1d', rebase: false });
  const fund = (b: unknown = smh) => render(PtPriceTarget, { ticker: 'SMH', basket: true }, withData({ 'basket@1': b, 'price-series@1': fundSeries }));
  basics(PtPriceTarget, { ticker: 'SMH', basket: true });
  basics(PtPriceTarget, { sector: 'Technology' });

  it('a fund and a sector draw no weekly average line of their own (their dots already are the weeks)', async () => {
    expect((await fund()).el.querySelector('svg.pt-trend')).toBeNull();
    expect((await render(PtPriceTarget, { sector: 'Technology' }, withData({ 'sector@1': tech }))).el.querySelector('svg.pt-trend')).toBeNull();
  });
  it("a fund: a segment from each week's price to its 12-month horizon, dots, its levels the last close and today's target; the lede says weighted", async () => {
    const r = await fund();
    expect(r.text()).toContain("Analysts' targets on its holdings, weighted as it holds them today, week by week over the last 12 months");
    expect(r.el.querySelectorAll('circle.pt-dot').length).toBeGreaterThan(1);
    expect(r.el.querySelectorAll('path.pt-seg').length).toBeGreaterThan(1);
    expect([...r.el.querySelectorAll('.pt-lvl-n')].map((n) => n.textContent!.trim()).sort()).toEqual(['TARGET', 'TODAY']);
    expect(r.el.querySelector('.pt-cons')).toBeNull();
    expect(r.calls()).toBe(2);
  });
  it('a sector: its value line and targets in compact dollars, never a $ with commas', async () => {
    const r = await render(PtPriceTarget, { sector: 'Technology' }, withData({ 'sector@1': tech }));
    expect(r.text()).toContain("Analysts' targets on its companies, weighted by their value today, week by week over the last 12 months");
    expect(r.el.querySelectorAll('circle.pt-dot').length).toBeGreaterThan(1);
    expect(r.el.innerHTML).not.toMatch(/\$\d{1,3}(,\d{3}){2,}/);
    expect(r.calls()).toBe(1);
  });
  it('a sector has no close: the legend, the level tips and TODAY name its value', async () => {
    const r = await render(PtPriceTarget, { sector: 'Technology' }, withData({ 'sector@1': tech }));
    expect(r.el.innerHTML).not.toMatch(/last close/i);
    expect(r.el.querySelector('.pt-lg-lvl')!.textContent).toBe("┄ its value and today's target");
    const tips = [...r.el.querySelectorAll('.pt-lvl-t')].map((t) => t.getAttribute('data-tip')!);
    expect(tips.find((t) => t.startsWith('Its value'))).toBeDefined();
    expect(tips.find((t) => t.startsWith("Today's target"))).toMatch(/from its value$/);
  });
  it("a dot's panel names its week and the basket's largest companies, each with its logo and its upside then, never a 'Weighted target'", async () => {
    for (const [r, b] of [[await fund(), smh], [await render(PtPriceTarget, { sector: 'Technology' }, withData({ 'sector@1': tech })), tech]] as const) {
      expect(r.text()).not.toContain('Weighted target');
      expect(r.el.querySelector('.pt-lg-hint')!.textContent).toContain('hover a dot to see its largest companies that week');
      const last = b.targetHistory!.at(-1)!, name = new Map(b.holdings.map((h) => [h.ticker, h.name]));
      const panel = [...r.el.querySelectorAll('.pt-members')].find((p) => p.querySelector('.pt-mem-week')?.textContent?.trim() === `Week of ${date(last.t)}`)!;
      expect(panel).toBeDefined();
      const rows = [...panel.querySelectorAll('.pt-mem-co')];
      expect(rows.map((x) => x.querySelector('.pt-mem-analyst')!.textContent!.trim())).toEqual(last.top!.map((c) => plainName(name.get(c.ticker)!)));
      expect(rows.map((x) => x.querySelector('.pt-mem-target')!.textContent!.trim())).toEqual(last.top!.map((c) => pct(c.upside, 0)));
      expect(rows.every((x) => x.querySelector('pt-logo'))).toBe(true);
    }
  });
  it('a week written before the companies were: its panel says the week only', async () => {
    const r = await fund({ ...smh, targetHistory: smh.targetHistory!.map(({ top: _, ...w }) => w) });
    expect(r.el.querySelectorAll('.pt-mem-week').length).toBeGreaterThan(0);
    expect(r.el.querySelectorAll('.pt-mem-co').length).toBe(0);
    expect(r.text()).not.toContain('Weighted target');
  });
  it("no target history (a fund under 80%, or last night's payload): no chart, one line saying so", async () => {
    const r = await fund({ ...smh, targetHistory: undefined });
    expect(r.el.querySelector('svg')).toBeNull();
    expect(r.text().trim()).toBe('No weekly target for this fund');
  });
  it('not available', async () => {
    expect((await fund(null)).el.querySelector('.pt-na')).not.toBeNull();
  });
});

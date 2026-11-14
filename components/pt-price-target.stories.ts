/**
 * pt-price-target as a company page shows it: the demo, www's real targets (NKE, CHTR, SKYD, NVDA) and the cases its axis and its
 * coverage have to survive. The fixtures are made up; they reproduce the shapes the live pages showed.
 */
import { addDays, demoFor, median, sessionsBack, targetWeeks, weeksOf, withPrev, type Analysts, type Basket, type PriceSeries, type SectorBasket } from '../src/typologies';
import { demo, story } from '../src/stories/story';
import { PtPriceTarget } from './pt-price-target';

/** `n` weekdays from `from`, closes from `f(i)`. */
function series(ticker: string, from: string, n: number, f: (i: number) => number): PriceSeries {
  const points: PriceSeries[number]['points'] = [];
  for (let d = Date.parse(`${from}T00:00:00Z`); points.length < n; d += 864e5) {
    const w = new Date(d).getUTCDay();
    if (w === 0 || w === 6) continue;
    const c = Math.round(f(points.length) * 100) / 100;
    points.push({ t: new Date(d).toISOString().slice(0, 10), o: c, h: c * 1.01, l: c * 0.99, c, v: 1e6 });
  }
  return [{ ticker, points }];
}
const months = (from: number, counts: (i: number) => [number, number, number, number, number]) => Array.from({ length: 12 }, (_, i) => {
  const [strongBuy, buy, hold, sell, strongSell] = counts(i);
  const m = (from + i - 1) % 12 + 1;
  return { strongBuy, buy, hold, sell, strongSell, period: `${m >= 11 ? 2025 : 2026}-${String(m).padStart(2, '0')}-01` };
});
const tg = (date: string, firm: string, target: number, priceWhenPosted: number) => ({ date, firm, target, priceWhenPosted });

// CHTR, 2026-10-26: a year's slide to today's price, one old target far above, the low target at today's price
const slide = series('CHTR', '2025-10-27', 250, (i) => 180 - 79 * (i / 249) + Math.sin(i / 9) * 4);
const crowded: Analysts = {
  asOf: '2026-10-23', price: 101,
  summary: { low: 100, mean: 206.33, median: 145, high: 500, n: 6 },
  consensus: { strongBuy: 2, buy: 3, hold: 6, sell: 1, strongSell: 0, period: '2026-10-01' },
  history: months(11, (i) => [3, 5 - Math.floor(i / 4), 4 + Math.floor(i / 3), i > 8 ? 1 : 0, 0]),
  targets: [tg('2025-11-12', 'Firm A', 500, 176), tg('2026-02-03', 'Firm B', 210, 160), tg('2026-05-20', 'Firm C', 150, 130),
    tg('2026-07-15', 'Firm D', 140, 118), tg('2026-09-08', 'Firm E', 138, 108), tg('2026-10-14', 'Firm F', 100, 103)],
  accuracy: [],
};
// NKE, 2026-10-26: a firm's January target above today's HIGH, since cut (the lines are each firm's latest target, the dots all of them)
const fade = series('NKE', '2025-10-27', 250, (i) => 72 - 14 * (i / 249) + Math.sin(i / 11) * 3);
const superseded: Analysts = {
  asOf: '2026-10-23', price: 58.2,
  summary: { low: 52, mean: 64.25, median: 65, high: 75, n: 4 },
  consensus: { strongBuy: 4, buy: 9, hold: 14, sell: 2, strongSell: 0, period: '2026-10-01' },
  history: months(11, (i) => [5, 12 - Math.floor(i / 2), 10 + Math.floor(i / 3), i > 6 ? 2 : 1, 0]),
  targets: [tg('2026-01-08', 'Firm A', 110, 68), tg('2026-03-19', 'Firm B', 75, 66), tg('2026-06-26', 'Firm C', 65, 62),
    tg('2026-08-14', 'Firm D', 52, 60), tg('2026-10-02', 'Firm A', 60, 58)],
  accuracy: [],
};
const nvda = demo<Analysts>('analysts@1', { ticker: 'NVDA', window: '1y' });

/**
 * The average target week by week (2.7, Romeo 2026-11-14): ten made-up firms revising every two months or so over two years, around a
 * level that follows `level(x)` (x: 0 two years ago → 1 today); prices about 10% under it. `late`: most firms start in the last 200 days.
 */
function trending(ticker: string, level: (x: number) => number, o: { late?: boolean } = {}): { a: Analysts; s: PriceSeries } {
  const asOf = '2026-10-23', rows: { date: string; firm: string; target: number; priceWhenPosted: number }[] = [];
  const r2 = (v: number) => Math.round(v * 100) / 100;
  for (let k = 0; k < 10; k++) {
    const first = o.late && k > 1 ? 200 - k * 9 : 730 - k * 6;
    for (let d = first; d >= 0; d -= 52 + k * 4) {
      const lv = level((730 - d) / 730);
      rows.push({ date: addDays(asOf, -d), firm: `Firm ${String.fromCharCode(65 + k)}`, target: r2(lv * (1 + ((k % 5) - 2) * 0.05)), priceWhenPosted: r2(lv * 0.9) });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.firm < b.firm ? -1 : 1));
  const year = addDays(asOf, -365), latest = new Map<string, number>();
  for (const t of rows) if (t.date > year) latest.set(t.firm, t.target);
  const vals = [...latest.values()].sort((a, b) => a - b);
  const s = series(ticker, '2025-10-27', 250, (i) => level(0.5 + (i / 249) * 0.5) * 0.9);
  return {
    s, a: {
      asOf, price: s[0]!.points.at(-1)!.c,
      summary: { low: vals[0]!, mean: r2(vals.reduce((a, b) => a + b, 0) / vals.length), median: median(vals), high: vals.at(-1)!, n: vals.length },
      consensus: { strongBuy: 8, buy: 14, hold: 6, sell: 1, strongSell: 0, period: '2026-10-01' },
      history: months(11, (i) => [8, 14 - (i % 3), 6, 1, 0]),
      targets: withPrev(rows).filter((t) => t.date > year), accuracy: [], weekly: targetWeeks(rows, weeksOf(sessionsBack(asOf, 256))),
    },
  };
}
const rising = trending('RISE', (x) => 200 + 120 * x);
const peaked = trending('PEAK', (x) => (x < 0.8 ? 220 + 140 * x : 332 - (x - 0.8) * 160));
const bottomed = trending('BOTM', (x) => (x < 0.72 ? 450 - 115 * x : 367 + (x - 0.72) * 340));
const late = trending('LATE', (x) => 90 - 40 * x, { late: true });
const { weekly: _older, ...older } = nvda;

export const stories = [
  story(PtPriceTarget, { name: 'Demo (NVDA)', inputs: { ticker: 'NVDA' } }),
  story(PtPriceTarget, { name: 'www: NVDA', inputs: { ticker: 'NVDA' }, live: true }),
  story(PtPriceTarget, { name: 'www: CHTR (crowded at the bottom)', inputs: { ticker: 'CHTR' }, live: true }),
  story(PtPriceTarget, { name: 'www: SKYD (four levels a few pixels apart)', inputs: { ticker: 'SKYD' }, live: true }),
  story(PtPriceTarget, { name: 'www: NKE (a target above HIGH)', inputs: { ticker: 'NKE' }, live: true }),
  story(PtPriceTarget, { name: 'Crowded at the bottom: only the labels short of room move up', inputs: { ticker: 'CHTR' },
    data: { 'analysts@1': crowded, 'price-series@1': slide } }),
  story(PtPriceTarget, { name: 'A superseded target above HIGH', inputs: { ticker: 'NKE' }, data: { 'analysts@1': superseded, 'price-series@1': fade } }),
  // the average target week by week under the chart (2.7, made up): its legs, its turn, the sentence with the raises and cuts since
  story(PtPriceTarget, { name: 'Trend: rose all year', inputs: { ticker: 'RISE' }, data: { 'analysts@1': rising.a, 'price-series@1': rising.s } }),
  story(PtPriceTarget, { name: 'Trend: peaked, now falling', inputs: { ticker: 'PEAK' }, data: { 'analysts@1': peaked.a, 'price-series@1': peaked.s } }),
  story(PtPriceTarget, { name: 'Trend: bottomed, now rising', inputs: { ticker: 'BOTM' }, data: { 'analysts@1': bottomed.a, 'price-series@1': bottomed.s } }),
  story(PtPriceTarget, { name: 'Trend: too few firms at the start', inputs: { ticker: 'LATE' }, data: { 'analysts@1': late.a, 'price-series@1': late.s } }),
  story(PtPriceTarget, { name: 'Trend: a payload of before the weeks (no line)', inputs: { ticker: 'NVDA' }, data: { 'analysts@1': older } }),
  story(PtPriceTarget, { name: 'Without prices: stats and the one-line consensus', inputs: { ticker: 'NVDA' }, data: { 'price-series@1': null } }),
  story(PtPriceTarget, { name: 'No targets in 12 months', inputs: { ticker: 'NVDA' },
    data: { 'analysts@1': { ...nvda, summary: null, targets: [], consensus: null, history: [] } } }),
  story(PtPriceTarget, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
  // a basket (Romeo, 2026-11-07): its holdings' targets, weighted, one a week over the year, on the fund's price or the sector's value (made up)
  story(PtPriceTarget, { name: 'A fund: its holdings\' targets, week by week (demo)', inputs: { ticker: 'SMH', basket: true } }),
  story(PtPriceTarget, { name: 'A sector: its companies\' targets, week by week, in compact dollars (demo)', inputs: { sector: 'Technology' } }),
  story(PtPriceTarget, { name: 'A fund with no weeks yet (or under 80%): one line says so', inputs: { ticker: 'SMH', basket: true },
    data: { 'basket@1': { ...(demoFor({ t: 'basket@1', params: { ticker: 'SMH' } }) as Basket), targetHistory: undefined } } }),
  story(PtPriceTarget, { name: 'A sector, not available', inputs: { sector: 'Technology' }, data: { 'sector@1': null as unknown as SectorBasket } }),
];

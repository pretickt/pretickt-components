/**
 * pt-quality (version 1, the numbers pretickt has): the four companies of the prototype on www's data, a reporter in euros,
 * a fall that is mostly the company's own, a stock near its high, a recent listing. Fixtures made up.
 */
import type { Events, Fundamentals, PriceSeries, Screen } from '@pretickt/components/typologies';
import { story } from '../src/stories/story';
import { PtQuality } from './pt-quality';

type Period = Fundamentals['periods'][number];
const q = (period: string, fiscal: string, revenue: number, o: Partial<Period> = {}): Period => ({ period, fiscal, revenue, eps: 1.2, fcf: 9e8,
  grossMargin: 0.62, operatingMargin: 0.31, netMargin: 0.22, pe: 24, shares: 1e9, ...o });
// three years of quarters: growth slowing from 18% to 9%, the operating margin down 5 points in the last one, the P/E falling
const fund: Fundamentals = { asOf: '2026-10-23', periods: [
  ['2023-09-30', 'Q3 FY23', 7.0e9], ['2023-12-31', 'Q4 FY23', 7.3e9], ['2024-03-31', 'Q1 FY24', 7.5e9], ['2024-06-30', 'Q2 FY24', 7.8e9],
  ['2024-09-30', 'Q3 FY24', 8.3e9], ['2024-12-31', 'Q4 FY24', 8.6e9], ['2025-03-31', 'Q1 FY25', 8.8e9], ['2025-06-30', 'Q2 FY25', 9.1e9],
  ['2025-09-30', 'Q3 FY25', 9.5e9], ['2025-12-31', 'Q4 FY25', 9.6e9], ['2026-03-31', 'Q1 FY26', 9.7e9], ['2026-06-30', 'Q2 FY26', 9.9e9],
].map(([p, f, r], i) => q(p as string, f as string, r as number, { pe: 30 - i, operatingMargin: i === 11 ? 0.26 : 0.31 })) };
const co = { ticker: 'XYZ', name: 'XYZ Corp', logo: null, mcap: 9e10 };
const earn = (date: string, epsEst: number, epsActual: number) => ({ ...co, date, kind: 'earnings' as const, meta: { time: 'amc' as const, epsEst, epsActual, revEst: null, revActual: null } });
const events: Events = { asOf: '2026-10-23', items: [earn('2025-10-28', 1.1, 1.2), earn('2026-01-27', 1.15, 1.21), earn('2026-04-28', 1.2, 1.18), earn('2026-07-28', 1.25, 1.31),
  { ...co, date: '2026-09-15', kind: 'analyst', meta: { firm: 'Firm A', action: 'downgrade', from: 'Buy', to: 'Hold' } },
  { ...co, date: '2026-09-18', kind: 'analyst', meta: { firm: 'Firm B', action: 'downgrade', from: 'Overweight', to: 'Equal-Weight' } }] };
/** A year of weekdays: the company climbs, then falls `fall` over its last 30 sessions; SPY and three peers slip a little. */
function prices(fall: number): PriceSeries {
  const ts: string[] = [];
  for (let d = Date.parse('2025-10-27T00:00:00Z'); ts.length < 250; d += 864e5) { const w = new Date(d).getUTCDay(); if (w && w < 6) ts.push(new Date(d).toISOString().slice(0, 10)); }
  const line = (start: number, peak: number, drop: number) => ts.map((t, i) => {
    const c = Math.round((i < 220 ? start + (peak - start) * (i / 219) + Math.sin(i / 7) * start * 0.01 : peak * (1 - drop * ((i - 219) / 30))) * 100) / 100;
    return { t, o: c, h: c, l: c, c, v: 1e6 };
  });
  return [{ ticker: 'XYZ', points: line(80, 120, fall) }, { ticker: 'SPY', points: line(560, 600, 0.012) },
    { ticker: 'AAA', points: line(40, 48, 0.03) }, { ticker: 'BBB', points: line(70, 76, 0.04) }, { ticker: 'CCC', points: line(20, 22, 0.02) }];
}
const peers: Screen = { asOf: '2026-10-23', rows: [] };
const own = { 'fundamentals@1': fund, 'events@1': events, 'screen@1': peers };

export const stories = [
  story(PtQuality, { name: 'Demo (NVDA)', inputs: { ticker: 'NVDA' } }),
  story(PtQuality, { name: 'www: META', inputs: { ticker: 'META' }, live: true }),
  story(PtQuality, { name: 'www: NFLX', inputs: { ticker: 'NFLX' }, live: true }),
  story(PtQuality, { name: 'www: NKE', inputs: { ticker: 'NKE' }, live: true }),
  story(PtQuality, { name: 'www: GOOGL', inputs: { ticker: 'GOOGL' }, live: true }),
  story(PtQuality, { name: 'www: ASML (reports in euros)', inputs: { ticker: 'ASML' }, live: true }),
  story(PtQuality, { name: 'A 20% fall, mostly its own: the drop test on top', inputs: { ticker: 'XYZ' }, data: { ...own, 'price-series@1': prices(0.2) } }),
  story(PtQuality, { name: 'Near its high: no drop test', inputs: { ticker: 'XYZ' }, data: { ...own, 'price-series@1': prices(0.04) } }),
  story(PtQuality, { name: 'A recent listing: two quarters, nothing to compare', inputs: { ticker: 'XYZ' },
    data: { ...own, 'fundamentals@1': { asOf: '2026-10-23', periods: fund.periods.slice(-2) }, 'events@1': { asOf: '2026-10-23', items: [] }, 'price-series@1': prices(0.04) } }),
  story(PtQuality, { name: 'Not available', inputs: { ticker: 'XYZ' }, data: null }),
];

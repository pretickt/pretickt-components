/** pt-company-header: the box on a company's main page and, low, on its sub-pages. Fixtures are made up. */
import { PT_LIVE } from '../src/context';
import { liveSource } from '../src/site/live';
import { demo, liveDay, story } from '../src/stories/story';
import { demoFor, METRIC_KEYS, type MetricItem, type SectorBasket } from '../src/typologies';
import { PtCompanyHeader } from './pt-company-header';

/** A made-up sector: its companies' bars rise through the session, the largest not yet traded (it counts flat). */
const tech = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
const sectorBars = (o: Record<string, unknown> = {}) => ({ session: '2099-01-02', prev: tech.asOf, asOf: '2099-01-02T18:20:00.000Z', time: '1:20 PM ET', closed: false,
  bars: Object.fromEntries(tech.holdings.slice(1).map((h, k) => [h.ticker, Array.from({ length: 46 }, (_, i) => +((h.close ?? 100) * (1 + (k % 2 ? -1 : 1) * 0.0004 * i)).toFixed(2))])), ...o });
const sectorStories = [
  story(PtCompanyHeader, { name: 'A sector: its worth over the year, its basket badges, the fund line', inputs: { sector: 'Technology' }, data: { 'sector@1': tech } }),
  story(PtCompanyHeader, { name: 'A sector, market open: its line from its companies\' bars, 15-min delayed', inputs: { sector: 'Technology' }, data: { 'sector@1': tech },
    providers: liveDay({}, { bars: () => sectorBars() }) }),
  story(PtCompanyHeader, { name: 'A sector, bars of another session: no line of the day', inputs: { sector: 'Technology' }, data: { 'sector@1': tech },
    providers: liveDay({}, { bars: () => sectorBars({ prev: '2099-01-01' }) }) }),
  story(PtCompanyHeader, { name: 'A sector, not available', inputs: { sector: 'Technology' }, data: null }),
];

const base = demo<MetricItem[]>('metric@1', { ticker: 'NVDA', metrics: [...METRIC_KEYS] });
const points = demo<{ points: { t: string; c: number }[] }[]>('price-series@1', { tickers: ['NVDA'], range: '3m', interval: '1d', rebase: false })[0]!.points;
const close = points.at(-1)!.c, lastDay = points.at(-1)!.t, before = points.at(-2)!.t;

/** The demo's badges with some forced to a side, so the story shows what its name says. */
const lean = (pos: string[], neg: string[]): MetricItem[] => base.map((m) => (pos.includes(m.key) ? { ...m, tone: 'pos' as const } : neg.includes(m.key) ? { ...m, tone: 'neg' as const } : { ...m, tone: m.tone === 'na' ? m.tone : 'flat' as const }));
const SIDES = ['pt_upside', 'consensus', 'pe_vs_own', 'pe_vs_sector', 'fcf_yield', 'insider_net', 'news', 'trend', 'ma_detail', 'macd', 'sector_trend'];
const bullish = lean(SIDES.slice(0, 9), SIDES.slice(9));
const bearish = lean(SIDES.slice(0, 2), SIDES.slice(2));
const noBears = lean(SIDES, []);

/** A made-up session: `slots` five-minute closes wandering around the last close. */
const session = (slots: number, drift: number): (number | null)[] => Array.from({ length: slots }, (_, i) => +(close * (1 + (drift * i) / slots + 0.004 * Math.sin(i / 3))).toFixed(2));
const lineOf = (closes: (number | null)[], o: Record<string, unknown> = {}) => ({ session: '2099-01-02', prev: lastDay, asOf: '2099-01-02T18:20:00.000Z', time: '1:20 PM ET', closed: false, bars: { NVDA: closes }, ...o });

// a valuation badge just under its threshold, so a price going up and down takes it from one band to the other
const moving = base.map((m) => (m.key === 'pe_vs_own' ? { ...m, value: -0.11, tone: 'pos' as const } : m));
let turn = 0;
const updates = { bars: () => { turn += 1; return lineOf(session(10 + (turn % 30), (turn % 6) < 3 ? -0.03 : 0.05), { time: 'every 1.5 s here' }); }, poll: { everyMs: 1500, anyTime: true } };

const wwwLines = [{ provide: PT_LIVE, useValue: liveSource('/live/v1.json') }];

const both = (name: string, o: Omit<Parameters<typeof story<PtCompanyHeader>>[1], 'name' | 'inputs'> = {}) => [
  story(PtCompanyHeader, { name: `Full: ${name}`, inputs: { ticker: 'NVDA' }, ...o }),
  story(PtCompanyHeader, { name: `Low: ${name}`, inputs: { ticker: 'NVDA', size: 'low' }, ...o }),
];

export const stories = [
  ...both('the demo, before the prices load'),
  ...both('mostly bullish', { data: { 'metric@1': bullish } }),
  ...both('mostly bearish', { data: { 'metric@1': bearish } }),
  ...both('no bearish readings at all', { data: { 'metric@1': noBears } }),
  ...both('session running, 1:20 PM', { providers: liveDay({}, { bars: () => lineOf(session(46, 0.012)) }) }),
  ...both('an update moves a badge to the other band, every 1.5 s', { data: { 'metric@1': moving }, providers: liveDay({}, updates) }),
  ...both('closed, before the nightly', { providers: liveDay({}, { bars: () => lineOf(session(78, 0.012), { closed: true }) }) }),
  ...both('after the nightly: the session in the zone', { providers: liveDay({}, { bars: () => lineOf(session(78, 0.012), { session: lastDay, prev: before, closed: true }) }) }),
  ...both('the prices failed to load', { providers: liveDay({}, { bars: () => null }) }),
  ...both('a ticker missing from the file', { providers: liveDay({}, { bars: () => lineOf([], { bars: {} }) }) }),
  ...both('no price series', { data: { 'price-series@1': null } }),
  // www's data and the real intraday file, through the dev proxy
  story(PtCompanyHeader, { name: 'www: NVDA', inputs: { ticker: 'NVDA' }, live: true, providers: wwwLines }),
  story(PtCompanyHeader, { name: 'www: KO, low', inputs: { ticker: 'KO', size: 'low' }, live: true, providers: wwwLines }),
  story(PtCompanyHeader, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
  ...sectorStories,
];

/** pt-answer: each page's question answered first, on demo data and on www's, and the answer when a company has no target. */
import type { Analysts } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { PtAnswer } from './pt-answer';

const nvda = demo<Analysts>('analysts@1', { ticker: 'NVDA', window: '1y' });

export const stories = [
  story(PtAnswer, { name: 'Forecast: the hub (demo)', inputs: { topic: 'forecast', ticker: 'NVDA' } }),
  story(PtAnswer, { name: 'Price target (demo)', inputs: { topic: 'price-target', ticker: 'NVDA' } }),
  story(PtAnswer, { name: 'Peers (demo)', inputs: { topic: 'peers', ticker: 'NVDA' } }),
  story(PtAnswer, { name: 'Financials (demo)', inputs: { topic: 'financials', ticker: 'NVDA' } }),
  story(PtAnswer, { name: 'Insiders (demo)', inputs: { topic: 'insiders', ticker: 'NVDA' } }),
  story(PtAnswer, { name: 'Technicals: the averages and the 52-week range (demo)', inputs: { topic: 'technicals', ticker: 'NVDA' } }),
  story(PtAnswer, { name: 'A market list (demo)', inputs: { topic: 'list', list: 'biggest_gainers' } }),
  story(PtAnswer, { name: 'A sector\'s list (demo)', inputs: { topic: 'list', list: '52w_low', sector: 'Healthcare' } }),
  story(PtAnswer, { name: 'A sector: its companies, their worth and their targets (demo)', inputs: { topic: 'sector', sector: 'Technology' } }),
  story(PtAnswer, { name: 'Earnings calendar (demo)', inputs: { topic: 'earnings', month: '2026-10' } }),
  story(PtAnswer, { name: 'Dividend calendar (demo)', inputs: { topic: 'dividends', month: '2026-10' } }),
  // round 14: the week's and the day's earnings pages (/earnings-this-week/, /earnings-today/), the week calendar's call
  story(PtAnswer, { name: 'Earnings this week (demo)', inputs: { topic: 'earnings', start: '2026-10-19' } }),
  story(PtAnswer, { name: 'Earnings on a day (demo)', inputs: { topic: 'earnings-day', start: '2026-10-22' } }),
  // a company's earnings page (/stocks/<t>/earnings/): its next date, the estimates, its record and usual move, its last report
  story(PtAnswer, { name: 'Earnings date (demo)', inputs: { topic: 'earnings-date', ticker: 'NVDA' } }),
  story(PtAnswer, { name: 'Earnings on a day with none', inputs: { topic: 'earnings-day', start: '2026-10-24' }, data: { 'events@1': { asOf: '2026-10-16', items: [] } } }),
  story(PtAnswer, { name: 'www: forecast, NVDA', inputs: { topic: 'forecast', ticker: 'NVDA' }, live: true }),
  story(PtAnswer, { name: 'www: technicals, NVDA', inputs: { topic: 'technicals', ticker: 'NVDA' }, live: true }),
  story(PtAnswer, { name: 'www: financials, ASML (euros)', inputs: { topic: 'financials', ticker: 'ASML' }, live: true }),
  story(PtAnswer, { name: 'www: earnings this month', inputs: { topic: 'earnings', month: '2026-10' }, live: true }),
  story(PtAnswer, { name: 'www: earnings the week of Nov 16', inputs: { topic: 'earnings', start: '2026-11-16' }, live: true }),
  story(PtAnswer, { name: 'www: earnings on Nov 19', inputs: { topic: 'earnings-day', start: '2026-11-19' }, live: true }),
  story(PtAnswer, { name: 'www: NVDA earnings date', inputs: { topic: 'earnings-date', ticker: 'NVDA' }, live: true }),
  story(PtAnswer, { name: 'www: WMT earnings date', inputs: { topic: 'earnings-date', ticker: 'WMT' }, live: true }),
  story(PtAnswer, { name: 'No target in a year is an answer too', inputs: { topic: 'price-target', ticker: 'NVDA' },
    data: { 'analysts@1': { ...nvda, summary: null, targets: [], consensus: null, history: [] } } }),
  story(PtAnswer, { name: 'Not available', inputs: { topic: 'forecast', ticker: 'NVDA' }, data: null }),
];

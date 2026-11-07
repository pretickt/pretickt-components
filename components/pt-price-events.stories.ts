/** pt-price-events: the price line with its earnings, dividend, split and analyst markers over each range, www's real ones, and gaps. */
import type { Events } from '@pretickt/components/typologies';
import { story } from '../src/stories/story';
import { PtPriceEvents } from './pt-price-events';

const quiet: Events = { asOf: '2026-09-30', items: [] };

export const stories = [
  story(PtPriceEvents, { name: 'A year (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtPriceEvents, { name: 'A month (demo)', inputs: { ticker: 'NVDA', range: '1m' } }),
  story(PtPriceEvents, { name: 'Five years (demo)', inputs: { ticker: 'NVDA', range: '5y' } }),
  story(PtPriceEvents, { name: 'www: NVDA, a year', inputs: { ticker: 'NVDA' }, live: true }),
  story(PtPriceEvents, { name: 'www: AAPL, five years (a split)', inputs: { ticker: 'AAPL', range: '5y' }, live: true }),
  story(PtPriceEvents, { name: 'No events: the line alone', inputs: { ticker: 'NVDA' }, data: { 'events@1': quiet } }),
  story(PtPriceEvents, { name: 'No prices', inputs: { ticker: 'NVDA' }, data: { 'price-series@1': [{ ticker: 'NVDA', points: [] }] } }),
  story(PtPriceEvents, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
  story(PtPriceEvents, { name: 'A sector: what its companies are worth over the year, its 5 largest companies\' reports (demo)', inputs: { sector: 'Technology' } }),
  story(PtPriceEvents, { name: 'A sector, not available', inputs: { sector: 'Technology' }, data: null }),
];

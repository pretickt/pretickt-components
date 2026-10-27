/** pt-insiders: a year and a month of Form 4 trades, www's real ones, more than 20 trades, none. */
import type { Insider } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { PtInsiders } from './pt-insiders';

const year = demo<Insider>('insider@1', { ticker: 'NVDA', days: 365 });
// thirty trades: two a fortnight, buys and sells, so the table needs "Show 20 more"
const busy: Insider = { asOf: '2026-09-30', items: Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.parse('2026-09-28T00:00:00Z') - i * 6 * 864e5).toISOString().slice(0, 10);
  const shares = 2000 + ((i * 7919) % 40000);
  const price = 120 + ((i * 37) % 60);
  return { date, filingDate: date, name: ['Jane Doe', 'John Roe', 'Ann Poe'][i % 3]!, title: ['CEO', 'CFO', 'Director'][i % 3]!,
    type: i % 4 === 0 ? 'buy' as const : 'sell' as const, shares, price, value: shares * price };
}) };

export const stories = [
  story(PtInsiders, { name: 'A year (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtInsiders, { name: 'Thirty days (demo)', inputs: { ticker: 'NVDA', days: 30 } }),
  story(PtInsiders, { name: 'www: NVDA', inputs: { ticker: 'NVDA' }, live: true }),
  story(PtInsiders, { name: 'www: META', inputs: { ticker: 'META' }, live: true }),
  story(PtInsiders, { name: 'Thirty trades: "Show 20 more"', inputs: { ticker: 'NVDA' }, data: { 'insider@1': busy } }),
  story(PtInsiders, { name: 'No trades', inputs: { ticker: 'NVDA' }, data: { 'insider@1': { ...year, items: [] } } }),
  story(PtInsiders, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];

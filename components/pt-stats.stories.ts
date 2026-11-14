/** pt-stats: the demo, a short history without beta, a calm stock with no swing, www's TSLA, KO and NVDA, not available. */
import type { Stats } from '@pretickt/components/typologies';
import { demo as demoOf, story } from '../src/stories/story';
import { PtStats } from './pt-stats';

const demo = demoOf<Stats>('stats@1', { ticker: 'NVDA' });
const short: Stats = { ...demo, fullWindow: false, since: '2024-03-01', sessions: 680, beta: null, years: demo.years.slice(-3), months: demo.months.slice(-31),
  path: demo.path.filter((p) => p.t >= '2024-03-01'), swings: demo.swings.filter((w) => w.from >= '2024-03-01').map((w, i) => ({ ...w, first: i === 0 })) };
const calm: Stats = { ...demo, threshold: 0.1, swings: [], last: null };

export const stories = [
  story(PtStats, { name: 'Demo: three falls and three rises', inputs: { ticker: 'NVDA' } }),
  story(PtStats, { name: 'A short history: since its listing, no beta', inputs: { ticker: 'NVDA' }, data: { 'stats@1': short } }),
  story(PtStats, { name: 'A calm stock: no swing beyond 10%', inputs: { ticker: 'NVDA' }, data: { 'stats@1': calm } }),
  story(PtStats, { name: 'Without the S&P 500', inputs: { ticker: 'NVDA' }, data: { 'stats@1': { ...demo, spy: null } } }),
  story(PtStats, { name: 'www: TSLA', inputs: { ticker: 'TSLA' }, live: true }),
  story(PtStats, { name: 'www: KO', inputs: { ticker: 'KO' }, live: true }),
  story(PtStats, { name: 'www: NVDA', inputs: { ticker: 'NVDA' }, live: true }),
  story(PtStats, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];

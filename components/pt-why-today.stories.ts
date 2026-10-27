/** pt-why-today as a company page shows it: the three windows, www's real moves, the drivers, a news spike, and the market open. */
import type { MoveBreakdown } from '@pretickt/components/typologies';
import { demo, liveDay, story } from '../src/stories/story';
import { PtWhyToday } from './pt-why-today';

const base = (o: Partial<MoveBreakdown> = {}): MoveBreakdown => ({ ...demo<MoveBreakdown>('move-breakdown@1', { ticker: 'NVDA', window: '1d' }),
  name: 'NVIDIA', sectorName: 'Technology', ret: -0.031, marketRet: -0.012, sectorRet: -0.02, market: -0.012, sector: -0.008, specific: -0.011,
  driver: 'market', ...o });
// today's file: down 6% by 11:30, results reported last night, a dozen stories since the close
const OPEN = { q: { NVDA: { p: 100, pc: 106.38, r: -0.06, m: 0.004, s: -0.002, x: -0.062 } },
  news: { NVDA: { n: 12, top: [{ title: 'Nvidia falls after its outlook disappoints', site: 'WSJ', url: 'https://www.wsj.com/', at: '2026-10-01 10:31:00' }] } },
  earnings: { NVDA: { date: '2026-09-30', time: 'amc' as const, eps: 7.4, epsEst: 6.54, rev: 64601000000, revEst: 63343010000 } } };

export const stories = [
  story(PtWhyToday, { name: 'The day (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtWhyToday, { name: 'Five days (demo)', inputs: { ticker: 'NVDA', window: '5d' } }),
  story(PtWhyToday, { name: 'A month (demo)', inputs: { ticker: 'NVDA', window: '1m' } }),
  story(PtWhyToday, { name: 'www: NVDA', inputs: { ticker: 'NVDA' }, live: true }),
  story(PtWhyToday, { name: 'www: TSLA, five days', inputs: { ticker: 'TSLA', window: '5d' }, live: true }),
  story(PtWhyToday, { name: 'The market drove it', inputs: { ticker: 'NVDA' }, data: { 'move-breakdown@1': base() } }),
  story(PtWhyToday, { name: 'Its own move', inputs: { ticker: 'NVDA' },
    data: { 'move-breakdown@1': base({ ret: 0.084, market: 0.003, sector: 0.006, specific: 0.075, marketRet: 0.003, sectorRet: 0.009, driver: 'stock' }) } }),
  story(PtWhyToday, { name: 'A news spike, top stories listed', inputs: { ticker: 'NVDA' }, data: { 'move-breakdown@1': base({ driver: 'stock', specific: -0.024,
    news: { today: 9, avg30: 3, spike: true, top: [{ title: 'Regulators open a probe into the chip export deal', site: 'Reuters', url: 'https://www.reuters.com/', sentiment: -0.6 },
      { title: 'Analysts split on what the probe means for margins', site: 'Barrons', url: 'https://www.barrons.com/', sentiment: -0.1 }] } }) } }),
  story(PtWhyToday, { name: 'Stories without a 30-day average', inputs: { ticker: 'NVDA' }, data: { 'move-breakdown@1': base({ news: { today: 7, avg30: 0, spike: false, top: [] } }) } }),
  story(PtWhyToday, { name: 'Market open: down 6% so far, results just reported', inputs: { ticker: 'NVDA' }, data: { 'move-breakdown@1': base() }, providers: liveDay(OPEN) }),
  story(PtWhyToday, { name: 'Market open: no company news since the close', inputs: { ticker: 'NVDA' }, data: { 'move-breakdown@1': base() }, providers: liveDay({ q: OPEN.q }) }),
  story(PtWhyToday, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];

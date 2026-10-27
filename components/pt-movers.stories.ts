/** pt-movers as the home can show it: both orders, www's moves today, and the tornado's edge cases (made-up numbers). */
import type { OngoingMoveRow, OngoingMoves } from '@pretickt/components/typologies';
import { story } from '../src/stories/story';
import { rankMoves } from '../src/typologies';
import { PtMovers } from './pt-movers';

const row = (ticker: string, name: string, cap: number, week: number, o: Partial<OngoingMoveRow> = {}): OngoingMoveRow => ({
  ticker, name, logo: null, marketCap: cap, kind: week < 0 ? 'drawdown' : 'rally', since: '2026-09-22', days: 18,
  move: week < 0 ? Math.min(week * 1.7, -0.042) : Math.max(week * 1.7, 0.042), close: 100, week, month: week * 1.8, quarter: week * 2.5,
  industry: null, ...o,
});
// ranked as the API sends them: this week's losers, then its gainers, each most important first
const moves = (rows: OngoingMoveRow[], o: Partial<OngoingMoves> = {}): OngoingMoves =>
  ({ asOf: '2026-10-16', threshold: 0.04, market: 'bullish', rows: rankMoves(rows, 'cap'), ...o });
const LOSERS = [row('MSFT', 'Microsoft', 3.9e12, -0.031), row('AMZN', 'Amazon', 2.3e12, -0.054), row('META', 'Meta Platforms', 1.8e12, -0.022),
  row('ORCL', 'Oracle', 6.1e11, -0.087), row('NFLX', 'Netflix', 4.2e11, -0.046)];
const GAINERS = [row('NVDA', 'NVIDIA', 4.4e12, 0.062), row('AVGO', 'Broadcom', 1.6e12, 0.033), row('JPM', 'JPMorgan Chase', 8.1e11, 0.018)];
const MANY = ['AAPL', 'GOOGL', 'TSLA', 'WMT', 'LLY', 'V', 'MA', 'XOM', 'COST', 'HD', 'PG', 'KO'].map((t, i) => row(t, `${t} Inc.`, 3e12 / (i + 1), -0.012 - i * 0.006));

export const stories = [
  story(PtMovers, { name: 'Market cap order (demo)', inputs: { sort: 'cap' } }),
  story(PtMovers, { name: '% move order (demo)', inputs: { sort: 'move' } }),
  story(PtMovers, { name: 'www today', inputs: { sort: 'cap' }, live: true }),
  story(PtMovers, { name: 'www today, % move', inputs: { sort: 'move' }, live: true }),
  story(PtMovers, {
    name: 'Pressing "% move" a second after loading',
    inputs: { sort: 'cap' },
    run: (refresh, el) => { [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === '% move')?.click(); refresh(); },
  }),
  story(PtMovers, { name: 'A move its industry shares (⚠, peers in the tooltip)', data: { 'ongoing-moves@1': moves([LOSERS[0]!,
    row('NVDA', 'NVIDIA', 4.4e12, -0.066, { industry: { median: -0.05, peers: [{ ticker: 'AMD', move: -0.09 }, { ticker: 'MU', move: -0.071 }] } }),
    ...GAINERS.slice(1)]) } }),
  story(PtMovers, { name: 'More than 7 on a side: phones crop to the middle half', data: { 'ongoing-moves@1': moves([...MANY, ...GAINERS]) } }),
  story(PtMovers, { name: 'Gainers only', data: { 'ongoing-moves@1': moves(GAINERS) } }),
  story(PtMovers, { name: 'Bearish market', data: { 'ongoing-moves@1': moves([...LOSERS, ...GAINERS], { market: 'bearish' }) } }),
  story(PtMovers, { name: 'Sideways market', data: { 'ongoing-moves@1': moves([...LOSERS, ...GAINERS], { market: 'sideways' }) } }),
  story(PtMovers, { name: 'Market trend unknown: no chip', data: { 'ongoing-moves@1': moves([...LOSERS, ...GAINERS], { market: null }) } }),
  story(PtMovers, { name: 'No 90-day history (a recent listing)', data: { 'ongoing-moves@1': moves([row('ARM', 'Arm Holdings', 1.5e11, -0.072, { quarter: null }), ...GAINERS]) } }),
  story(PtMovers, { name: 'Quiet market', data: { 'ongoing-moves@1': moves([]) } }),
  story(PtMovers, { name: 'Not available', data: null }),
];

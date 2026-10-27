/** pt-financials: quarters on demo data, many quarters behind "Show 20 more", www's real statements in dollars, euros and yuan. */
import type { Fundamentals } from '@pretickt/components/typologies';
import { story } from '../src/stories/story';
import { PtFinancials } from './pt-financials';

export const stories = [
  story(PtFinancials, { name: 'Eight quarters (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtFinancials, { name: 'Twenty-four quarters: "Show 20 more"', inputs: { ticker: 'NVDA', periods: 24 } }),
  story(PtFinancials, { name: 'www: AAPL', inputs: { ticker: 'AAPL' }, live: true }),
  story(PtFinancials, { name: 'www: JPM (a bank)', inputs: { ticker: 'JPM' }, live: true }),
  story(PtFinancials, { name: 'www: ASML (reports in euros)', inputs: { ticker: 'ASML' }, live: true }),
  story(PtFinancials, { name: 'www: PDD (reports in yuan)', inputs: { ticker: 'PDD' }, live: true }),
  story(PtFinancials, { name: 'No quarters', inputs: { ticker: 'NVDA' }, data: { 'fundamentals@1': { asOf: '2026-09-30', periods: [] } satisfies Fundamentals } }),
  story(PtFinancials, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];

/** pt-company-card: the wide page header and the compact hover card, www's real companies, the market open, and what is missing. */
import { liveDay, story } from '../src/stories/story';
import { PtCompanyCard } from './pt-company-card';

export const stories = [
  story(PtCompanyCard, { name: 'Wide: the page header (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtCompanyCard, { name: 'Compact: the hover card, its link\'s tooltip rows as a footer', inputs: { ticker: 'NVDA', size: 'compact',
    extra: { NVDA: 'NVIDIA Corporation', Earnings: 'Oct 28, 2026', Time: 'AMC', 'EPS est.': null } } }),
  story(PtCompanyCard, { name: 'www: NVDA', inputs: { ticker: 'NVDA' }, live: true }),
  story(PtCompanyCard, { name: 'www: KO, compact', inputs: { ticker: 'KO', size: 'compact' }, live: true }),
  story(PtCompanyCard, { name: 'Market open: today\'s price, 15 minutes late', inputs: { ticker: 'NVDA' },
    providers: liveDay({ q: { NVDA: { p: 100, pc: 110, r: -0.0909, m: 0, s: 0, x: -0.0909 } } }) }),
  story(PtCompanyCard, { name: 'No profile: the ticker as its name', inputs: { ticker: 'NVDA' }, data: { 'company@1': null } }),
  story(PtCompanyCard, { name: 'No prices: no sparkline', inputs: { ticker: 'NVDA' }, data: { 'price-series@1': null } }),
  story(PtCompanyCard, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];

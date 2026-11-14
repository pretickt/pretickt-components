/** pt-company-card: the wide page header and the compact hover card, www's real companies, the market open, and what is missing. */
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState } from '../src/context';
import { PtFollow } from '../src/context/follow';
import { companyDemo } from '../src/typologies';
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

/** The bell (follow, 2026-11-14): made-up alerts; what this browser follows from a store in memory. */
// PtFollow too: a story's own instance, which sees the story's store (the root one does not)
const follows = (s: FollowState) => [{ provide: PT_FOLLOW_ON, useValue: true }, { provide: PT_FOLLOW, useValue: { read: () => s, write: () => undefined } }, PtFollow];
const nvda = companyDemo({ ticker: 'NVDA' });
stories.push(
  story(PtCompanyCard, { name: 'Bell: 4 new alerts', inputs: { ticker: 'NVDA', size: 'compact' }, providers: follows({ follows: [], seen: {} }) }),
  story(PtCompanyCard, { name: 'Bell: following, 1 new alert', inputs: { ticker: 'NVDA', size: 'compact' }, providers: follows({ follows: ['NVDA'], seen: { NVDA: nvda.alerts![1]!.session } }) }),
  story(PtCompanyCard, { name: 'Bell: 9+', inputs: { ticker: 'NVDA', size: 'compact' }, data: { 'company@1': { ...nvda, alerts: Array.from({ length: 12 }, () => nvda.alerts![0]!) } }, providers: follows({ follows: [], seen: {} }) }),
);

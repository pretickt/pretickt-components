import { demoFor, type Basket, type SectorBasket } from '../src/typologies';
import { liveDay, story } from '../src/stories/story';
import { PtBasket } from './pt-basket';

/** Made-up funds and sectors: the numbers are nobody's. Real previews live in .stories/local, never committed. */
const smh = demoFor({ t: 'basket@1', params: { ticker: 'SMH' } }) as Basket;
const low = demoFor({ t: 'basket@1', params: { ticker: 'ARKW' } }) as Basket;
const quotes = (tickers: (string | null)[]) => Object.fromEntries(tickers.filter((t): t is string => !!t).map((t, i) => [t, { p: 100, pc: 100, r: (i % 3 ? -1 : 1) * 0.01 * (i + 1), m: 0, s: null, x: null }]));
const open = liveDay({ session: '2026-10-01', prev: '2026-09-30', time: '11:30 AM ET', q: quotes(smh.holdings.map((h) => h.ticker)) });
const crowded: Basket = { ...smh, holdings: Array.from({ length: 60 }, (_, i) => ({ ticker: i % 4 ? `T${i}` : null, name: i % 4 ? `A Long Company Name Number ${i} Incorporated` : `An Unlisted Holding ${i}`, logo: null, weight: 0.03 - i * 0.0004, ret: i % 4 ? 0.01 : null, upside: i % 4 ? 0.1 : null, label: i % 4 ? 'Buy' : null })) };
const notComparable: Basket = { ...smh, questions: smh.questions!.map((q) => (q.key === 'advantage' || q.key === 'fragility' ? { ...q, pos: 0, flat: 0, neg: 0, comparable: false } : q)) };
const each = (name: string, data: Basket | null) => (['moves', 'holdings', 'analysts', 'questions', 'faq'] as const).map((section) => story(PtBasket, { name: `${name}: ${section}`, inputs: { ticker: data?.ticker ?? 'SMH', section }, data: { 'basket@1': data } }));

const tech = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
const fin = demoFor({ t: 'sector@1', params: { sector: 'Financial Services' } }) as SectorBasket;
const utl = demoFor({ t: 'sector@1', params: { sector: 'Utilities' } }) as SectorBasket;
// a company not yet traded: the largest one is left out of the quotes, and counts flat
const sectorOpen = liveDay({ session: '2026-10-01', prev: '2026-09-30', time: '11:30 AM ET', q: quotes(tech.holdings.slice(1).map((h) => h.ticker)) });
const sector = (name: string, data: SectorBasket | null) => (['moves', 'holdings', 'analysts', 'questions', 'faq'] as const).map((section) => story(PtBasket, { name: `${name}: ${section}`, inputs: { sector: data?.sector ?? 'Technology', section }, data: { 'sector@1': data } }));

export const stories = [
  ...each('Demo', smh),
  ...each('Under 80%', low),
  story(PtBasket, { name: 'A file weeks old, with a note', inputs: { ticker: 'SMH', section: 'holdings' }, data: { 'basket@1': { ...smh, stale: true, note: 'Part of this fund\'s return comes from options, which the target does not see.' } } }),
  story(PtBasket, { name: 'Sixty holdings, long names', inputs: { ticker: 'SMH', section: 'holdings' }, data: { 'basket@1': crowded } }),
  story(PtBasket, { name: 'Questions that do not read across the fund', inputs: { ticker: 'SMH', section: 'questions' }, data: { 'basket@1': notComparable } }),
  story(PtBasket, { name: 'Market open: the moves at the delayed prices', inputs: { ticker: 'SMH', section: 'moves' }, data: { 'basket@1': smh }, providers: open }),
  story(PtBasket, { name: 'No good file in 7 days', inputs: { ticker: 'SMH', section: 'analysts' }, data: { 'basket@1': { ...low, coverage: 0.99 } } }),
  story(PtBasket, { name: 'Not available', inputs: { ticker: 'SMH', section: 'moves' }, data: null }),
  ...sector('A sector (demo)', tech),
  story(PtBasket, { name: 'A sector, market open: its move is its companies\' delayed prices, the largest not yet traded', inputs: { sector: 'Technology', section: 'moves' }, data: { 'sector@1': tech }, providers: sectorOpen }),
  story(PtBasket, { name: 'Financial Services: Advantage and Fragility not comparable', inputs: { sector: 'Financial Services', section: 'questions' }, data: { 'sector@1': fin } }),
  story(PtBasket, { name: 'Utilities: Fragility not comparable', inputs: { sector: 'Utilities', section: 'questions' }, data: { 'sector@1': utl } }),
  story(PtBasket, { name: 'A sector, not available', inputs: { sector: 'Technology', section: 'holdings' }, data: null }),
];

/** Made-up click notes, one or more per kind: the box's specs and stories (never on a page). */
import type { ClickNote } from '../../context/click';
import { miniBars } from '../../../components/pt-calendar';
import { mention, say } from '../../ds/format';

/** Nov 16 2026, 3:40 PM in the reader's time zone: the click. */
export const SEEN_AT = new Date(2026, 10, 16, 15, 40).getTime();
const NVDA = mention('NVDA', 'NVIDIA Corporation', '/logos/nvda.55199575.webp');
const base = { v: 1, to: 'NVDA', land: '/stocks/nvda/', at: SEEN_AT } as const;

export const CTX_EARNINGS_AHEAD: ClickNote = {
  ...base, from: { path: '/earnings-calendar/', title: 'Earnings calendar November 2026' }, kind: 'earnings',
  d: {
    title: 'Nvidia', ticker: 'NVDA', logo: '/logos/nvda.55199575.webp', out: false, cue: '±7.0%', cueTone: 'est',
    when: 'Wed, Nov 18 · after the close · reacts Thu', hint: 'Beat 7 of 8 · rose after 5 of 8',
    bars: miniBars([8.1, -3.2, 16.4, -6.1, 9.3, 2.4, -8.5, 3.1]),
    said: say`${NVDA} reports Wed, Nov 18 (confirmed), after the close; the stock reacts Thu, Nov 19. In the session after each of its last 8 reports it moved ±7.0% on average. It beat the EPS estimate in 7 of its last 8 reports.`,
    facts: 'EPS est. $1.25 · revenue est. $54.9B', page: { href: '/stocks/nvda/earnings/', label: 'Nvidia earnings date, estimates and record' },
  },
};

export const CTX_EARNINGS_OUT: ClickNote = {
  ...base, from: { path: '/', title: 'pretickt' }, kind: 'earnings',
  d: {
    ...(CTX_EARNINGS_AHEAD.d as Extract<ClickNote, { kind: 'earnings' }>['d']), out: true, cue: '−4.2%', cueTone: 'neg',
    when: 'Reported Wed, Nov 18 · after the close', hint: 'Beat by 6% · 0.6× its usual',
    said: say`${NVDA} reported Wed, Nov 18, after the close: EPS $1.33 vs $1.25 expected, beat by 6%. The stock moved −4.2% in the session that traded it, 0.6× its usual ±7.0%.`,
    facts: 'Revenue $57.0B vs $54.9B expected',
  },
};

export const CTX_DIVIDEND: ClickNote = {
  ...base, to: 'KO', land: '/stocks/ko/', from: { path: '/dividend-calendar/', title: 'Dividend calendar November 2026' }, kind: 'dividend',
  d: {
    title: 'Coca-Cola', ticker: 'KO', logo: '/logos/ko.c9c7e1b0.webp', out: false, cue: '$0.51', cueTone: 'est', when: 'Ex-dividend Fri, Nov 28',
    hint: 'Payable Dec 12', bars: null, said: say`${mention('KO', 'The Coca-Cola Company', '/logos/ko.c9c7e1b0.webp')} goes ex-dividend Fri, Nov 28: $0.51 a share, payable Dec 12.`,
    facts: '', page: { href: '/stocks/ko/dividend/', label: 'Coca-Cola dividend history' },
  },
};

const home = { path: '/', title: 'pretickt' };

export const CTX_MOVER: ClickNote = {
  ...base, from: home, kind: 'mover',
  d: {
    asOf: '2026-11-13', kind: 'drawdown', move: -0.142, since: '2026-11-03', days: 10, week: -0.091, month: -0.12, quarter: -0.04,
    today: { r: -0.052, label: '11:30 AM ET, 15-min delayed' },
    industry: { median: -0.038, peers: [{ ticker: 'AMD', move: -0.06 }, { ticker: 'AVGO', move: -0.041 }] },
  },
};
export const CTX_MOVER_PLAIN: ClickNote = { ...CTX_MOVER, d: { ...(CTX_MOVER.d as Extract<ClickNote, { kind: 'mover' }>['d']), kind: 'rally', move: 0.21, today: null, industry: null } };

export const CTX_HEAT_MAP: ClickNote = {
  ...base, from: { path: '/market-map/', title: 'Stock market heat map today' }, kind: 'heat-map',
  d: { asOf: '2026-11-13', lens: 'market', move: -0.031, cap: 4.3e12, sector: 'Technology', rank: 2, of: 12, sectorMove: -0.012 },
};

export const CTX_NEWS_MAP: ClickNote = { ...base, from: home, kind: 'talk-map', d: { lens: 'news', count: '46, 5× its usual day', label: 'Stories' } };
export const CTX_SOCIAL_MAP: ClickNote = { ...base, from: home, kind: 'talk-map', d: { lens: 'social', count: '120', label: 'Posts' } };

export const CTX_FEED: ClickNote = {
  ...base, from: { path: '/sectors/technology/', title: 'Technology stocks' }, kind: 'feed',
  d: { label: 'Big move', sub: '3× usual', day: 'Nov 13', text: 'Nvidia fell 5.1% on Nov 13, three times its usual day.', pill: { text: '-5.1%', cls: 'pt-feed-pill pt-feed-pill-neg' },
    href: '/stocks/nvda/#price', group: 'technical' },
};
export const CTX_FEED_SUB: ClickNote = {
  ...CTX_FEED, land: '/stocks/nvda/earnings/', from: home,
  d: { label: 'Earnings', sub: 'beat', day: 'Nov 18', text: 'Nvidia beat the EPS estimate by 6%.', pill: null, href: '/stocks/nvda/earnings/', group: 'fundamental' },
};
export const CTX_NEWS: ClickNote = {
  ...base, from: { path: '/etfs/smh/', title: 'SMH: VanEck Semiconductor ETF' }, kind: 'news',
  d: { title: 'Nvidia supplier warns on demand', url: 'https://example.com/a', site: 'Reuters', publishedAt: '2026-11-16T13:00:00Z' },
};

const LOSER_COLS = [{ label: 'Today', text: '-5.1%', tone: 'pt-t-neg' }, { label: 'Off 52w high', text: '-22.0%', tone: 'pt-t-neg' }];
export const CTX_LIST: ClickNote = {
  ...base, land: '/stocks/nvda/why-moving/', from: home, kind: 'list',
  d: { title: 'Biggest stock losers today', href: '/markets/biggest-losers/', rank: 3, of: 20, cols: LOSER_COLS },
};
export const CTX_LIST_OWN: ClickNote = {
  ...CTX_LIST, from: { path: '/markets/biggest-losers/', title: 'Biggest stock losers today' }, d: { ...(CTX_LIST.d as Extract<ClickNote, { kind: 'list' }>['d']), href: '#list' },
};
export const CTX_PEERS: ClickNote = {
  ...base, to: 'AMD', land: '/stocks/amd/', from: { path: '/stocks/nvda/', title: 'Nvidia (NVDA) stock: price, targets and why it moves' }, kind: 'peers',
  d: { of: { ticker: 'NVDA', name: 'Nvidia' }, href: '#peers',
    cols: [{ label: 'Today', text: '-3.0%', tone: 'pt-t-neg' }, { label: 'Off 52w high', text: '-12.4%', tone: 'pt-t-neg' }, { label: 'Target upside', text: '+18.0%', tone: 'pt-t-pos' }] },
};

export const CTX_HOLDING: ClickNote = {
  ...base, land: '/stocks/nvda/why-moving/', from: { path: '/etfs/xlk/', title: 'XLK: Technology Select Sector SPDR Fund' }, kind: 'holding',
  d: { basket: { name: 'XLK', href: '/etfs/xlk/' }, whole: 'fund', weight: 0.142, ret: -0.031, points: -0.0044 },
};
export const CTX_HOLDING_SECTOR: ClickNote = {
  ...CTX_HOLDING, from: { path: '/sectors/technology/', title: 'Technology stocks' },
  d: { basket: { name: 'Technology', href: '' }, whole: 'sector', weight: 0.081, ret: null, points: null },
};
const PF = { path: '/portfolio/', title: 'Your portfolio' };
export const CTX_PORTFOLIO: ClickNote = { ...base, from: PF, kind: 'portfolio', d: { weight: 0.08, ret: -0.031, points: -0.0025, earnings: null, headline: null } };
export const CTX_PORTFOLIO_EARNINGS: ClickNote = { ...CTX_PORTFOLIO, d: { weight: 0.08, ret: null, points: null, earnings: '2026-11-18', headline: null } };
export const CTX_PORTFOLIO_NEWS: ClickNote = {
  ...CTX_PORTFOLIO, d: { weight: null, ret: null, points: null, earnings: null, headline: { title: 'Nvidia supplier warns on demand', url: 'https://example.com/a' } },
};

export const CTX_HOLDER: ClickNote = {
  ...base, to: 'BLK', land: '/stocks/blk/', from: { path: '/stocks/nvda/value/', title: 'Is Nvidia a good stock to buy?' }, kind: 'holder',
  d: { of: { ticker: 'NVDA', name: 'Nvidia' }, question: 'biggest holders', label: '7.8% +0.1', href: '#value-owners-biggest-holders' },
};
export const CTX_MENTION: ClickNote = {
  ...base, to: 'AMD', land: '/stocks/amd/', from: { path: '/stocks/nvda/why-moving/', title: 'Why Nvidia moved today' }, kind: 'mention',
  d: { said: say`${NVDA} fell 5.1% as ${mention('AMD', 'Advanced Micro Devices, Inc.', '/logos/amd.a8e17428.webp')} gained 2.0% on the same report.` },
};
export const CTX_FOLLOWING: ClickNote = { ...base, from: { path: '/alerts/', title: 'Your alerts' }, kind: 'following', d: { name: 'Nvidia', alerts: 2 } };
export const CTX_FOLLOWING_NONE: ClickNote = { ...CTX_FOLLOWING, d: { name: 'Nvidia', alerts: 0 } };

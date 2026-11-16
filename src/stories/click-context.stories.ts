/** pt-click-box on made-up notes: what the reader clicked, at the top of the company page; `compact` is the hover card's block. */
import { PtClickBox } from '../site/context/box';
import { CTX_DIVIDEND, CTX_EARNINGS_AHEAD, CTX_FEED, CTX_FEED_SUB, CTX_HOLDING, CTX_HOLDING_SECTOR, CTX_LIST, CTX_LIST_OWN, CTX_NEWS, CTX_PEERS, CTX_PORTFOLIO, CTX_PORTFOLIO_EARNINGS, CTX_PORTFOLIO_NEWS, CTX_EARNINGS_OUT, CTX_HEAT_MAP, CTX_MOVER, CTX_MOVER_PLAIN, CTX_NEWS_MAP, CTX_SOCIAL_MAP } from '../site/context/mock';
import { story } from './story';

const GROUP = 'Click context · The box on the company page (made-up data)';

export const stories = [
  story(PtClickBox, { name: 'Earnings calendar · NVDA before its report', inputs: { note: CTX_EARNINGS_AHEAD }, group: GROUP }),
  story(PtClickBox, { name: 'Earnings · NVDA after its report (from the home)', inputs: { note: CTX_EARNINGS_OUT }, group: GROUP }),
  story(PtClickBox, { name: 'Dividend calendar · KO', inputs: { note: CTX_DIVIDEND }, group: GROUP }),
  story(PtClickBox, { name: 'Compact (the hover card) · NVDA before its report', inputs: { note: CTX_EARNINGS_AHEAD, compact: true }, group: GROUP }),
  story(PtClickBox, { name: 'Ongoing moves · NVDA in a drawdown, today\'s line, its industry too', inputs: { note: CTX_MOVER }, group: GROUP }),
  story(PtClickBox, { name: 'Ongoing moves · a rally, no line, no industry', inputs: { note: CTX_MOVER_PLAIN }, group: GROUP }),
  story(PtClickBox, { name: 'Heat map · NVDA 2nd of 12 in Technology', inputs: { note: CTX_HEAT_MAP }, group: GROUP }),
  story(PtClickBox, { name: 'News map · NVDA, 46 stories', inputs: { note: CTX_NEWS_MAP }, group: GROUP }),
  story(PtClickBox, { name: 'Social map · NVDA, 120 posts', inputs: { note: CTX_SOCIAL_MAP }, group: GROUP }),
  story(PtClickBox, { name: 'Feed · a big move, from a sector page', inputs: { note: CTX_FEED }, group: GROUP }),
  story(PtClickBox, { name: 'Feed · an earnings card that led to the earnings page', inputs: { note: CTX_FEED_SUB }, group: GROUP }),
  story(PtClickBox, { name: 'News · a story on a fund page', inputs: { note: CTX_NEWS }, group: GROUP }),
  story(PtClickBox, { name: 'Market list · #3 of the biggest losers, from the home', inputs: { note: CTX_LIST }, group: GROUP }),
  story(PtClickBox, { name: 'Market list · from the list\'s own page', inputs: { note: CTX_LIST_OWN }, group: GROUP }),
  story(PtClickBox, { name: 'Peers · AMD, a peer of Nvidia', inputs: { note: CTX_PEERS }, group: GROUP }),
  story(PtClickBox, { name: 'Fund · 14.2% of XLK', inputs: { note: CTX_HOLDING }, group: GROUP }),
  story(PtClickBox, { name: 'Sector · its weight, no move yet', inputs: { note: CTX_HOLDING_SECTOR }, group: GROUP }),
  story(PtClickBox, { name: 'Your portfolio · a line', inputs: { note: CTX_PORTFOLIO }, group: GROUP }),
  story(PtClickBox, { name: 'Your portfolio · earnings ahead', inputs: { note: CTX_PORTFOLIO_EARNINGS }, group: GROUP }),
  story(PtClickBox, { name: 'Your portfolio · a headline', inputs: { note: CTX_PORTFOLIO_NEWS }, group: GROUP }),
];

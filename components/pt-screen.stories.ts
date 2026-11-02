/** pt-screen: each market list, a sector's, a company's peers, www's real lists, and an empty one. */
import type { Screen } from '@pretickt/components/typologies';
import { story } from '../src/stories/story';
import { PtScreen } from './pt-screen';

const none: Screen = { asOf: '2026-09-30', rows: [] };

export const stories = [
  story(PtScreen, { name: 'Biggest losers (demo)', inputs: { list: 'biggest_losers' } }),
  story(PtScreen, { name: 'Biggest gainers (demo)', inputs: { list: 'biggest_gainers' } }),
  story(PtScreen, { name: '52-week lows (demo)', inputs: { list: '52w_low' } }),
  story(PtScreen, { name: 'Undervalued (demo)', inputs: { list: 'undervalued' } }),
  story(PtScreen, { name: 'Insider buying (demo)', inputs: { list: 'insider_buying' } }),
  story(PtScreen, { name: 'Most active (demo)', inputs: { list: 'most_active', limit: 10 } }),
  story(PtScreen, { name: 'Technology, largest (demo)', inputs: { list: 'largest', sector: 'Technology', limit: 10 } }),
  story(PtScreen, { name: 'Peers of NVDA, the subject highlighted (demo)', inputs: { peersOf: 'NVDA' } }),
  // round 16: the lists people search
  story(PtScreen, { name: 'Upgrades and downgrades (demo)', inputs: { list: 'upgrades_downgrades', limit: 10 } }),
  story(PtScreen, { name: 'Golden cross (demo)', inputs: { list: 'golden_cross', limit: 10 } }),
  story(PtScreen, { name: 'Death cross (demo)', inputs: { list: 'death_cross', limit: 10 } }),
  story(PtScreen, { name: 'Low P/E (demo)', inputs: { list: 'low_pe', limit: 10 } }),
  story(PtScreen, { name: 'Piotroski 8–9 (demo)', inputs: { list: 'piotroski', limit: 10 } }),
  story(PtScreen, { name: 'Unusual volume (demo)', inputs: { list: 'unusual_volume', limit: 10 } }),
  story(PtScreen, { name: 'www: biggest losers', inputs: { list: 'biggest_losers' }, live: true }),
  story(PtScreen, { name: 'www: Energy, 52-week highs', inputs: { list: '52w_high', sector: 'Energy' }, live: true }),
  story(PtScreen, { name: 'www: peers of KO', inputs: { peersOf: 'KO' }, live: true }),
  story(PtScreen, { name: 'An empty list', inputs: { list: 'insider_buying' }, data: { 'screen@1': none } }),
  story(PtScreen, { name: 'Not available', inputs: { list: 'biggest_losers' }, data: null }),
];

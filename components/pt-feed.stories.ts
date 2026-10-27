/**
 * pt-feed, off the pages until Romeo reworks it (2026-10-26): a company's, a sector's and the market's feed, on demo data and on
 * www's, a quiet window and a kind this build has never seen.
 */
import type { Feed } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { getTypology } from '../src/typologies';
import { PtFeed } from './pt-feed';

const GROUP = 'Experiments · Feed (off the pages)';
const aapl = demo<Feed>('feed@1', { scope: { by: 'ticker', ticker: 'AAPL' } });

export const stories = [
  story(PtFeed, { name: 'A company (demo AAPL)', inputs: { ticker: 'AAPL' }, group: GROUP }),
  story(PtFeed, { name: 'A sector (demo Technology)', inputs: { sector: 'Technology' }, group: GROUP }),
  story(PtFeed, { name: 'The market (demo)', inputs: {}, group: GROUP }),
  story(PtFeed, { name: 'www: AAPL', inputs: { ticker: 'AAPL' }, live: true, group: GROUP }),
  story(PtFeed, { name: 'www: Energy', inputs: { sector: 'Energy' }, live: true, group: GROUP }),
  story(PtFeed, { name: 'www: the market', inputs: {}, live: true, group: GROUP }),
  story(PtFeed, { name: 'A kind and a link this build has never seen', inputs: { ticker: 'AAPL' }, group: GROUP,
    data: { 'feed@1': getTypology('feed@1')!.unknownVariant!(aapl as never) } }),
  story(PtFeed, { name: 'A quiet window', inputs: { ticker: 'AAPL' }, data: { 'feed@1': { ...aapl, items: [] } }, group: GROUP }),
  story(PtFeed, { name: 'Not available', inputs: { ticker: 'AAPL' }, data: null, group: GROUP }),
];

/** The bell's panel and /alerts/ on made-up alerts (follow, 2026-11-14): what this browser follows from a store in memory. */
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState } from '../context';
import { PtFollow } from '../context/follow';
import { followDemo, type FollowFile } from '../typologies';
import { PT_FOLLOW_FILE, PtFollowing } from '../site/alerts/following';
import { PtFollowPanel } from '../site/alerts/follow-panel';
import { story } from './story';

const GROUP = 'Follow: the bell';
// PtFollow too: a story's own instance, which sees the story's store (the root one does not)
const follows = (s: FollowState) => [{ provide: PT_FOLLOW_ON, useValue: true }, { provide: PT_FOLLOW, useValue: { read: () => s, write: () => undefined } }, PtFollow];
const FILE: FollowFile = { v: 1, asOf: '2026-09-30', companies: { AAPL: { name: 'Apple Inc.', alerts: followDemo('AAPL') }, MSFT: { name: 'Microsoft Corporation', alerts: followDemo('MSFT') },
  INTC: { name: 'Intel Corporation', alerts: [] } } };

export const stories = [
  story(PtFollowPanel, { name: 'Panel: four alerts, not followed', group: GROUP, inputs: { ticker: 'AAPL', name: 'Apple', alerts: followDemo('AAPL') }, providers: follows({ follows: [], seen: {} }) }),
  story(PtFollowPanel, { name: 'Panel: followed, the other kinds', group: GROUP, inputs: { ticker: 'NVDA', name: 'Nvidia', alerts: followDemo('NVDA') }, providers: follows({ follows: ['NVDA'], seen: {} }) }),
  story(PtFollowPanel, { name: 'Panel: no alerts', group: GROUP, inputs: { ticker: 'INTC', name: 'Intel', alerts: [] }, providers: follows({ follows: [], seen: {} }) }),
  story(PtFollowing, { name: '/alerts/: three followed', group: GROUP, providers: [...follows({ follows: ['AAPL', 'MSFT', 'INTC'], seen: {} }), { provide: PT_FOLLOW_FILE, useValue: async () => FILE }] }),
  story(PtFollowing, { name: '/alerts/: nothing followed', group: GROUP, providers: [...follows({ follows: [], seen: {} }), { provide: PT_FOLLOW_FILE, useValue: async () => FILE }] }),
];

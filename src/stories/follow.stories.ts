/** The bell's panel and /alerts/ on made-up alerts (follow, 2026-11-14): what this browser follows from a store in memory. */
import { PT_FOLLOW, PT_FOLLOW_ON, type FollowState } from '../context';
import { PtFollow } from '../context/follow';
import { followDemo, type FollowFile } from '../typologies';
import { PT_FOLLOW_FILE, PT_FOLLOW_SEARCH, PtFollowing } from '../site/alerts/following';
import { PT_FOLLOW_EMAIL, type FollowBackend } from '../site/alerts/follow-backend';
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
/** A made-up server (the stories never call the Worker): every op answers the same state. */
const SERVER: FollowBackend = { signup: async () => 'ok', manage: async () => ({ email: 'r•••@example.com', status: 'active', weekly: false, digest: false, rules: [],
  follows: ['AAPL', 'MSFT', 'INTC'], cadence: 'day', manage: 'm.n' }) };
const mail = [{ provide: PT_FOLLOW_EMAIL, useValue: { backend: SERVER, check: null } }, { provide: PT_FOLLOW_SEARCH, useValue: '' }];
stories.push(
  story(PtFollowPanel, { name: 'Panel: the email row (email alerts on)', group: GROUP, inputs: { ticker: 'AAPL', name: 'Apple', alerts: followDemo('AAPL') }, providers: [...follows({ follows: [], seen: {} }), ...mail] }),
  story(PtFollowPanel, { name: 'Panel: linked to an email', group: GROUP, inputs: { ticker: 'AAPL', name: 'Apple', alerts: followDemo('AAPL') },
    providers: [...follows({ follows: ['AAPL'], seen: {}, link: { token: 'm.n', email: 'r•••@example.com', cadence: 'week' } }), ...mail] }),
  story(PtFollowing, { name: '/alerts/: linked to an email', group: GROUP, providers: [...follows({ follows: ['AAPL', 'MSFT', 'INTC'], seen: {},
    link: { token: 'm.n', email: 'r•••@example.com', cadence: 'day' } }), { provide: PT_FOLLOW_FILE, useValue: async () => FILE }, ...mail] }),
  // an email's link opened on a browser that followed other companies: they are offered, not sent
  story(PtFollowing, { name: "/alerts/: an email's link, this browser's others offered", group: GROUP, providers: [...follows({ follows: ['NVDA', 'AAPL'], seen: {} }),
    { provide: PT_FOLLOW_FILE, useValue: async () => ({ ...FILE, companies: { ...FILE.companies, NVDA: { name: 'NVIDIA Corporation', alerts: followDemo('NVDA') } } }) },
    { provide: PT_FOLLOW_EMAIL, useValue: { backend: SERVER, check: null } }, { provide: PT_FOLLOW_SEARCH, useValue: '?t=a.b' }] }),
);

/** pt-calendar: the earnings and dividend months, the home's week, www's real calendar, an empty week. */
import type { Events } from '@pretickt/components/typologies';
import { story } from '../src/stories/story';
import { PtCalendar } from './pt-calendar';

const empty: Events = { asOf: '2026-09-30', items: [] };

export const stories = [
  story(PtCalendar, { name: 'Earnings, October (demo)', inputs: { month: '2026-10' } }),
  story(PtCalendar, { name: 'Dividends, October (demo)', inputs: { month: '2026-10', kind: 'dividend' } }),
  story(PtCalendar, { name: 'The home\'s week, across a month end (demo)', inputs: { month: '2026-10', view: 'week', start: '2026-10-26' } }),
  story(PtCalendar, { name: 'A week without a start: its month\'s first', inputs: { month: '2026-10', view: 'week' } }),
  story(PtCalendar, { name: 'www: earnings this month', inputs: { month: '2026-10' }, live: true }),
  story(PtCalendar, { name: 'www: dividends next month', inputs: { month: '2026-11', kind: 'dividend' }, live: true }),
  story(PtCalendar, { name: 'www: this week', inputs: { month: '2026-10', view: 'week', start: '2026-10-26' }, live: true }),
  story(PtCalendar, { name: 'A week with no company scheduled', inputs: { month: '2026-10', view: 'week', start: '2026-10-19' }, data: { 'events@1': empty } }),
  story(PtCalendar, { name: 'Not available', inputs: { month: '2026-10' }, data: null }),
];

/** pt-calendar: the earnings and dividend months, the home's week, what to expect from each event, www's real calendar, an empty week. */
import type { EventItem, Events } from '@pretickt/components/typologies';
import { story } from '../src/stories/story';
import { OCTOBER } from './drafts/outlook-mock';
import type { CalOutlook, MacroEvent } from './drafts/pt-cal-outlook';
import { PtCalendar } from './pt-calendar';

const empty: Events = { asOf: '2026-09-30', items: [] };

/** The headline figure of a draft's market date ("3.50%" → 3.5 in %), under the names the platform will give them. */
const HEADLINE: Record<string, string> = { Fed: 'Fed funds rate', CPI: 'CPI YoY', Jobs: 'Nonfarm Payrolls', GDP: 'GDP QoQ', PCE: 'Core PCE MoM' };
const value = (s: string | null) => (s == null ? null : Number.parseFloat(s));
function headline(e: MacroEvent) {
  const name = HEADLINE[e.label], sample = e.expected ?? e.previous ?? e.result?.actual ?? null;
  if (!name || sample == null) return null;
  return { name, unit: sample.replace(/^[-\d.]+/, '') || null, expected: value(e.expected), previous: value(e.previous), actual: value(e.result?.actual ?? null) };
}
/** Made-up stories about the events around the evening of Oct 27, tagged as a classifier would (example.com links). */
const told = (at: string, title: string, site: string, tag: string | null) =>
  ({ publishedAt: `${at}T13:30:00Z`, title, site, url: `https://example.com/${at}/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, tag });
const NEWS: Record<string, ReturnType<typeof told>[]> = {
  MSFT: [told('2026-10-27', 'What to watch in Microsoft\'s report: cloud growth and AI spending', 'Reuters', 'Preview'),
    told('2026-10-24', 'Analysts lift Microsoft targets ahead of earnings', 'MarketWatch', 'Preview'), told('2026-10-20', 'Microsoft expands its data-center plans', 'Barron\'s', null)],
  GOOGL: [told('2026-10-27', 'Alphabet earnings preview: search, cloud and capital spending', 'Barron\'s', 'Preview')],
  AAPL: [told('2026-10-26', 'Apple heads into its report with iPhone demand in focus', 'Reuters', 'Preview')],
  AMZN: [told('2026-10-25', 'Amazon earnings: what the street expects from AWS', 'MarketWatch', 'Preview')],
  UPS: [told('2026-10-27', 'UPS beats on profit but cuts its volume outlook', 'Reuters', 'Results'), told('2026-10-27', 'UPS sees a softer holiday season', 'MarketWatch', 'Guidance')],
  KO: [told('2026-10-27', 'Coca-Cola tops estimates on pricing', 'Reuters', 'Results')],
  V: [told('2026-10-27', 'Visa results beat as payments volume grows', 'Barron\'s', 'Results')],
  'macro:Fed': [told('2026-10-27', 'Markets price another quarter-point cut this week', 'Reuters', 'Preview'),
    told('2026-10-23', 'Fed officials signal patience on the pace of cuts', 'MarketWatch', null)],
};
/** The draft's October (made-up numbers, real tickers and logos) as events@1.2 serves it: what the platform will fill. */
function asEvents(d: CalOutlook): Events {
  return { asOf: d.asOf, normal: d.normal, items: d.items.map((e): EventItem => {
    if (e.kind === 'macro') return { date: e.date, kind: 'macro', meta: { label: e.label, event: e.event, impact: 'High', headline: headline(e),
      moves: e.moves.slice(-8).map((m) => m.move), move: e.result?.move ?? null, news: NEWS[`macro:${e.label}`] } };
    const known = e.reactions.slice(-8).filter((r) => r.verdict != null);
    return { date: e.date, ticker: e.ticker, name: e.name, logo: e.logo, mcap: e.mcap, kind: 'earnings', meta: { time: e.time, confirmed: e.confirmed,
      epsEst: e.epsEst, epsActual: e.result?.epsActual ?? null, revEst: e.revEst, revActual: e.result?.revActual ?? null,
      moves: e.reactions.slice(-8).map((r) => Math.round(r.move * 1000) / 1000), record: { beats: known.filter((r) => r.verdict === 'beat').length, of: known.length },
      move: e.result?.move ?? null, news: NEWS[e.ticker] } };
  }) };
}
const october = asEvents(OCTOBER);

export const stories = [
  story(PtCalendar, { name: 'October on the evening of the 27th: what to expect from each event (made-up outlook)', inputs: { month: '2026-10' }, data: { 'events@1': october } }),
  story(PtCalendar, { name: 'The home\'s week of Oct 26 (made-up outlook)', inputs: { month: '2026-10', view: 'week', start: '2026-10-26' }, data: { 'events@1': october } }),
  story(PtCalendar, { name: 'Earnings, October (demo)', inputs: { month: '2026-10' } }),
  story(PtCalendar, { name: 'Dividends, October (demo)', inputs: { month: '2026-10', kind: 'dividend' } }),
  story(PtCalendar, { name: 'The home\'s week, across a month end (demo)', inputs: { month: '2026-10', view: 'week', start: '2026-09-28' } }),
  story(PtCalendar, { name: 'A week without a start: its month\'s first', inputs: { month: '2026-10', view: 'week' } }),
  story(PtCalendar, { name: 'www: earnings this month (no outlook yet: the date and the estimate)', inputs: { month: '2026-10' }, live: true }),
  story(PtCalendar, { name: 'www: dividends next month', inputs: { month: '2026-11', kind: 'dividend' }, live: true }),
  story(PtCalendar, { name: 'www: next week', inputs: { month: '2026-11', view: 'week', start: '2026-11-02' }, live: true }),
  story(PtCalendar, { name: 'A week with no company scheduled', inputs: { month: '2026-10', view: 'week', start: '2026-10-19' }, data: { 'events@1': empty } }),
  story(PtCalendar, { name: 'Not available', inputs: { month: '2026-10' }, data: null }),
];

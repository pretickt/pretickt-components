/** pt-daily: a company's card of the day — today's, an older one, a quiet day of a main company, a quoted headline, the longest a card can be, the facts alone, nothing new. Made up. */
import type { Daily } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { PtDaily } from './pt-daily';

const base = demo<Daily>('daily@1', { ticker: 'NVDA' });
// a made-up company for the made-up news: no real name beside a headline nobody wrote
const T = 'EXCH', ex: Daily = { ...base, ticker: T, name: 'Example Chips Inc.' };
const S = base.asOf;
const day = (text: string) => ({ kind: 'day', date: S, text });
const MOVE = day('Last close (Sep 30): EXCH -4.3% = market (SPY) -0.4% + Technology sector -0.8% + EXCH on its own -3.1%.');
const WEEK = { kind: 'week', date: S, text: 'Last 5 sessions to Sep 30: EXCH -6.0% = market (SPY) -1.1% + Technology sector -1.4% + EXCH on its own -3.5%.' };
const NEWS = { kind: 'news-day', date: S, text: 'Example Chips had 155 news stories on Sep 30, against 40 on a usual day. Top story: “The Chief Executive Is Out at Example Chips.”' };
const CUT = { kind: 'downgrade', date: S, text: 'Demo Bank downgraded Example Chips to Neutral from Buy on Sep 30, 2026.' };
const card = (o: Partial<NonNullable<Daily['card']>>, of: Daily = base): Daily => ({ ...of, card: { ...base.card!, ...o } });
const LONG_MESSAGE = 'Example Chips fell 4.3% on Sep 30 as Demo Bank, Other Bank and 3 more firms downgraded it.';   // 90 characters
const LONG_BODY = 'Four firms moved their ratings to Neutral in the session and the mean price target fell from $208.10 to $198.40. '
  + 'The stock has now lost 6.0% over the five sessions to Sep 30, most of that on its own rather than with the market or the tech sector. '
  + 'Results are due on Oct 14 after the close, the next date on its calendar.';   // 320 characters

export const stories = [
  story(PtDaily, { name: 'Today\'s card, a changed target with what it was (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtDaily, { name: 'An older card: Latest, two sessions old', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ session: '2026-09-28', writtenAt: '2026-09-29T00:12:00.000Z' }) } }),
  story(PtDaily, { name: 'A main company\'s quiet day', inputs: { ticker: 'MSFT' }, data: { 'daily@1': { ...base, ticker: 'MSFT', name: 'Microsoft Corporation', card: { ...base.card!,
    message: 'Microsoft rose 0.4% on Sep 30, the only change for the stock', body: 'The gain comes in a weak stretch for the shares.',
    facts: [day('Last close (Sep 30): MSFT +0.4% = market (SPY) -0.4% + Technology sector -0.8% + MSFT on its own +1.6%.')] } } } }),
  story(PtDaily, { name: 'A quoted headline in the message', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({
    message: 'Headlines on Sep 30 read “The Chief Executive Is Out at Example Chips”', body: 'It was the top story among 155 that day, and Demo Bank downgraded the stock in the same session.',
    facts: [NEWS, CUT, MOVE] }, ex) } }),
  story(PtDaily, { name: 'The longest card: 90 and 320 characters, four facts', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ message: LONG_MESSAGE, body: LONG_BODY,
    facts: [CUT, base.card!.facts[0]!, WEEK, MOVE] }, ex) } }),
  story(PtDaily, { name: 'No card: the day\'s facts alone', inputs: { ticker: 'NVDA' }, data: { 'daily@1': { ...ex, card: null, facts: [MOVE, WEEK, base.card!.facts[0]!, CUT] } } }),
  story(PtDaily, { name: 'Nothing new recorded', inputs: { ticker: 'NVDA' }, data: { 'daily@1': { ...base, card: null, facts: [] } } }),
  story(PtDaily, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];

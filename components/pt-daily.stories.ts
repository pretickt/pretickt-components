/** pt-daily: a company's card of the day — today's, an older one, a quiet day of a main company, a quoted headline, the longest a card can be, the facts alone, a night that did not read the company; since 1.1 the chips, the bold, each picture and each kind of "What to watch" half. Made up. */
import type { Daily, DailyFact, DailyVisual, DailyWatch } from '@pretickt/components/typologies';
import { dailyWatchDemo } from '../src/typologies';
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
// a picture belongs to the facts it was drawn from: a story that changes the facts draws only what it says
const card = (o: Partial<NonNullable<Daily['card']>>, of: Daily = base): Daily => ({ ...of, card: { ...base.card!, visual: o.facts ? undefined : base.card!.visual, visualAt: o.facts ? undefined : base.card!.visualAt, ...o } });
const LONG_MESSAGE = 'Example Chips fell 4.3% on Sep 30 as Demo Bank, Other Bank and 3 more firms downgraded it.';   // 90 characters
const LONG_BODY = 'Four firms moved their ratings to Neutral in the session and the mean price target fell from $208.10 to $198.40. '
  + 'The stock has now lost 6.0% over the five sessions to Sep 30, most of that on its own rather than with the market or the tech sector. '
  + 'Results are due on Oct 14 after the close, the next date on its calendar.';   // 320 characters

// 1.1: the "What to watch" half and the pictures, on the made-up company only
const fact = (kind: string, text: string, label: string, value?: string): DailyFact => ({ kind, date: S, text, chip: value ? { label, value } : { label } });
const SUP = fact('level-below', 'Support as of Sep 30: $184.25, 2.1% below the last close; it held 4 times.', 'Support', '2.1% below');
const RES = fact('level-above', 'Resistance as of Sep 30: $194.60, 3.4% above the last close; price turned back there 6 times.', 'Resistance', '3.4% above');
const RSI = fact('rsi', 'RSI (14 days) as of Sep 30: 25, under the 30 line read as oversold; it was 31 five sessions earlier.', 'RSI', '25');
const HIGH = fact('range-52w', 'As of Sep 30, Example Chips closed 1.3% under its 52-week high of $190.70.', '52-week high', '1.3% under');
const MA = fact('ma-gap', 'As of Sep 30 the 20-day average ($186.10) is 0.6% under the 50-day ($187.22).', '20- vs 50-day', '0.6% apart');
const M200 = fact('ma-200', 'As of Sep 30 the close is 1.1% above the 200-day average ($186.15).', '200-day', '1.1% above');
const DATE = fact('date', 'Example Chips reports on Oct 5, 2026 after the close, with EPS estimated at $1.12; over its last 8 reports the stock moved 6.1% on average.', 'Report', 'in 3 sessions');
const CROSS = fact('level-crossed', 'Closed below the Sep 29 support ($190.00) on Sep 30; price had turned there 5 times.', 'Below support', '$190.00');
const closes = (n: number, from: number, step: number) => Array.from({ length: n }, (_, i) => Math.round((from + i * step + ((i * 7) % 5 - 2) * 0.35) * 100) / 100);
const C60 = closes(60, 200, -0.2);
const PICS: [string, DailyVisual, DailyFact][] = [
  ['a support 2.1% below', { v: 'level', close: 188.2, level: 184.25, distPct: -2.1, closes: [...C60.slice(0, 59), 188.2] }, SUP],
  ['a resistance 3.4% above', { v: 'level', close: 188.2, level: 194.6, distPct: 3.4, closes: [...C60.slice(0, 59), 188.2] }, RES],
  ['a far level, drawn far (9.8% below)', { v: 'level', close: 188.2, level: 169.75, distPct: -9.8, closes: [...C60.slice(0, 59), 188.2] }, fact('level-below', 'Support as of Sep 30: $169.75, 9.8% below the last close; it held 3 times.', 'Support', '9.8% below')],
  ['the 52-week high 1.3% away', { v: 'range', lo: 131.4, hi: 190.7, close: 188.2 }, HIGH],
  ['RSI at 25', { v: 'rsi', values: [44, 41, 39, 40, 37, 35, 36, 33, 31, 30, 31, 29, 28, 30, 27, 26, 28, 26, 25, 25] }, RSI],
  ['the two averages 0.6% apart', { v: 'ma', fast: closes(60, 196, -0.17), slow: closes(60, 192, -0.08), crossAgo: null }, MA],
  ['the 200-day average 1.1% below', { v: 'ma200', close: 188.2, ma200: 186.15, closes: [...C60.slice(0, 59), 188.2] }, M200],
  ['a report in 3 sessions', { v: 'date', date: '2026-10-05', sessions: 3 }, DATE],
  ['a support crossed', { v: 'crossed', level: 190, close: 188.2, closes: [...closes(19, 194, -0.2), 188.2] }, CROSS],
];
const watch = (w: DailyWatch | null): Daily => ({ ...ex, watch: w });
const half = (o: Partial<Extract<DailyWatch, { kind: 'half' }>>): DailyWatch => ({ ...(dailyWatchDemo(T) as Extract<DailyWatch, { kind: 'half' }>), ...o });
const LONG_HALF = half({ message: 'Example Chips closed 2.1% above a support it held 4 times in the year', // 70 characters
  body: 'The support at $184.25 is the nearest level and **turned the price 4 times**; the resistance at $194.60 sits 3.4% above. '
    + 'RSI stands at 25, **under the 30 line**, and results are due on Oct 5.',   // 191 characters without the marks
  facts: [SUP, RES, RSI, DATE] });

export const stories = [
  story(PtDaily, { name: 'Today\'s card, a changed target with what it was (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtDaily, { name: 'An older card: Latest, two sessions old', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ session: '2026-09-28', writtenAt: '2026-09-29T00:12:00.000Z' }) } }),
  story(PtDaily, { name: 'A main company\'s quiet day', inputs: { ticker: 'MSFT' }, data: { 'daily@1': { ...base, ticker: 'MSFT', name: 'Microsoft Corporation', card: { ...base.card!,
    message: 'Microsoft rose 0.4% on Sep 30, the only change for the stock', body: 'The gain comes in a weak stretch for the shares.',
    facts: [day('Last close (Sep 30): MSFT +0.4% = market (SPY) -0.4% + Technology sector -0.8% + MSFT on its own +1.6%.')],
    visual: { v: 'split', ret: 0.004, market: -0.004, sector: -0.008, specific: 0.016 }, visualAt: 0 } } } }),
  story(PtDaily, { name: 'A quoted headline in the message', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({
    message: 'Headlines on Sep 30 read “The Chief Executive Is Out at Example Chips”', body: 'It was the top story among 155 that day, and Demo Bank downgraded the stock in the same session.',
    facts: [NEWS, CUT, MOVE] }, ex) } }),
  story(PtDaily, { name: 'The longest card: 90 and 320 characters, four facts', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ message: LONG_MESSAGE, body: LONG_BODY,
    facts: [CUT, base.card!.facts[0]!, WEEK, MOVE] }, ex) } }),
  story(PtDaily, { name: 'No card: the day\'s facts alone', inputs: { ticker: 'NVDA' }, data: { 'daily@1': { ...ex, card: null, facts: [MOVE, WEEK, base.card!.facts[0]!, CUT] } } }),
  story(PtDaily, { name: 'No summary: the night did not read the company', inputs: { ticker: 'NVDA' }, data: { 'daily@1': { ...base, card: null, facts: [] } } }),
  story(PtDaily, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
  // 1.1
  story(PtDaily, { name: '1.1 · the card with its chips, its bold and the move\'s split', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ body: 'Four firms moved to Neutral and **the mean target fell**; the stock lost 4.3% in the session, most of it on its own.',
    facts: [{ ...CUT, chip: { label: 'Downgrade' } }, { ...MOVE, chip: { label: 'Sep 30', value: '-4.3%' } }], visual: { v: 'split', ret: -0.043, market: -0.004, sector: -0.008, specific: -0.031 }, visualAt: 1 }, ex) } }),
  story(PtDaily, { name: '1.1 · a changed target drawn before and after', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ visual: { v: 'target', before: 208.1, after: 212.4 } }, ex) } }),
  story(PtDaily, { name: '1.1 · the ratings before and after', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ message: 'Example Chips gained a buy rating on Sep 30', body: 'One firm moved from hold to buy.',
    facts: [fact('consensus', 'Ratings as of Sep 30: 31 buy, 5 hold, 0 sell; on Sep 29: 30 buy, 6 hold, 0 sell.', 'Ratings', '31 buy · 5 hold · 0 sell')],
    visual: { v: 'ratings', before: { buy: 30, hold: 6, sell: 0 }, after: { buy: 31, hold: 5, sell: 0 } }, visualAt: 0 }, ex) } }),
  story(PtDaily, { name: '1.1 · an event\'s day on the closes', inputs: { ticker: 'NVDA' }, data: { 'daily@1': card({ message: 'Demo Bank downgraded Example Chips on Sep 30', body: 'The stock fell in the session.',
    facts: [{ ...CUT, chip: { label: 'Downgrade' } }], visual: { v: 'event', date: S, closes: closes(20, 196, -0.3).map((c, i) => ({ t: `2026-09-${String(i + 3).padStart(2, '0')}`, c })).slice(0, 19).concat([{ t: S, c: 188.2 }]) }, visualAt: 0 }, ex) } }),
  ...PICS.map(([what, visual, f]) => story(PtDaily, { name: `1.1 · What to watch: the platform's sentence, ${what}`, inputs: { ticker: 'NVDA' }, data: { 'daily@1': watch({ kind: 'fact', fact: f, visual }) } })),
  story(PtDaily, { name: '1.1 · What to watch: a half worded by the model, with bold, chips and its picture', inputs: { ticker: 'NVDA' }, data: { 'daily@1': watch(dailyWatchDemo(T)) } }),
  story(PtDaily, { name: '1.1 · What to watch: nothing close', inputs: { ticker: 'NVDA' }, data: { 'daily@1': watch({ kind: 'nothing', text: 'Nothing close as of Sep 30: no level within 5%, no date in the next 10 sessions, RSI between 36 and 64.' }) } }),
  story(PtDaily, { name: '1.1 · What to watch: nothing stored tonight (no half shown)', inputs: { ticker: 'NVDA' }, data: { 'daily@1': watch(null) } }),
  story(PtDaily, { name: '1.1 · the longest card with the longest half: four facts each, two bold phrases', inputs: { ticker: 'NVDA' }, data: { 'daily@1': { ...card({ message: LONG_MESSAGE, body: LONG_BODY,
    facts: [{ ...CUT, chip: { label: 'Downgrade' } }, { ...base.card!.facts[0]!, chip: { label: 'Mean target', value: '$212.40' } }, { ...WEEK, chip: { label: '5 sessions', value: '-6.0%' } }, { ...MOVE, chip: { label: 'Sep 30', value: '-4.3%' } }],
    visual: { v: 'split', ret: -0.043, market: -0.004, sector: -0.008, specific: -0.031 }, visualAt: 3 }, ex), watch: LONG_HALF } } }),
  story(PtDaily, { name: '1.1 · a card stored before chips and pictures, with a half', inputs: { ticker: 'NVDA' }, data: { 'daily@1': { ...card({ facts: [MOVE] }, ex), watch: { kind: 'fact', fact: SUP } } } }),
];

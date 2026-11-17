/** pt-technicals: every card on the demo, a state seen only twice, SPY (the market itself), a short history, www's NVDA, KO and SPY, not available. */
import type { Technicals, TechCardKey } from '@pretickt/components/typologies';
import { demo as demoOf, story } from '../src/stories/story';
import { PtTechnicals } from './pt-technicals';

const demo = demoOf<Technicals>('technicals@1', { ticker: 'NVDA' });
const CARDS: [TechCardKey, string][] = [['rsi', 'RSI'], ['support', 'Support'], ['resistance', 'Resistance'], ['ma200', '200-day average'], ['mas', '20, 50 and 100-day averages'],
  ['cross', 'Golden and death cross'], ['bollinger', 'Bollinger Bands'], ['macd', 'MACD'], ['high', 'Distance from the 52-week high']];
const twice: Technicals = { ...demo, cards: demo.cards.map((c) => (c.key !== 'rsi' ? c : { ...c, state: 'below30',
  states: c.states.map((s) => (s.key !== 'below30' ? s : { ...s, total: 2, episodes: s.episodes.slice(-2), paths: s.paths?.slice(-2) ?? null,
    stock: [{ ...s.stock[0], n: 2, up: 1 }, { ...s.stock[1], n: 2, up: 1 }] })) })) };
const short: Technicals = { ...demo, fullWindow: false, since: '2025-08-01', cards: demo.cards.filter((c) => c.key !== 'ma200' && c.key !== 'cross') };

export const stories = [
  ...CARDS.map(([card, name]) => story(PtTechnicals, { name: `Demo: ${name}`, inputs: { ticker: 'NVDA', card } })),
  story(PtTechnicals, { name: 'RSI below 30 only twice: the dates, no share', inputs: { ticker: 'NVDA', card: 'rsi' }, data: { 'technicals@1': twice } }),
  story(PtTechnicals, { name: 'SPY, the market itself: no comparison with the market', inputs: { ticker: 'SPY', card: 'ma200' } }),
  story(PtTechnicals, { name: 'A short history: no 200-day card yet', inputs: { ticker: 'NVDA', card: 'ma200' }, data: { 'technicals@1': short } }),
  story(PtTechnicals, { name: 'A short history: since its listing', inputs: { ticker: 'NVDA', card: 'rsi' }, data: { 'technicals@1': short } }),
  story(PtTechnicals, { name: 'www: NVDA RSI', inputs: { ticker: 'NVDA', card: 'rsi' }, live: true }),
  story(PtTechnicals, { name: 'www: KO support', inputs: { ticker: 'KO', card: 'support' }, live: true }),
  story(PtTechnicals, { name: 'www: SPY 200-day average', inputs: { ticker: 'SPY', card: 'ma200' }, live: true }),
  story(PtTechnicals, { name: 'Not available', inputs: { ticker: 'NVDA', card: 'rsi' }, data: null }),
];

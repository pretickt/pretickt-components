import { TECH_CARDS, technicalsDemo, type TechCard, type Technicals, type TechCardKey, type TechState } from '../src/typologies';
import { PtTechnicals } from './pt-technicals';
import { basics, press, render, withData } from './_spec';

const demo = technicalsDemo({ ticker: 'NVDA' });
const view = async (d: Technicals | null, card: TechCardKey = 'rsi') => {
  const r = await render(PtTechnicals, { ticker: 'NVDA', card }, withData({ 'technicals@1': d }));
  return { ...r, words: r.el.textContent!.replace(/\s+/g, ' ') };
};
const ep = (t: string, r: number, m = 0.01) => ({ t, r: [r, r] as [number, number], m: [m, m] as [number, number], held: null });
const sum = (n: number, up: number, med: number, mkt: number | null = 0.04, net: number | null = 0.02) => ({ n, up, med, mkt, net });
/** The demo with its RSI card set to `below30` and the given state. */
const withRsi = (st: Partial<TechState>, o: Partial<Technicals> = {}): Technicals => ({
  ...demo, ...o,
  cards: demo.cards.map((c): TechCard => (c.key !== 'rsi' ? c : { ...c, state: 'below30', now: { rsi: 23, was: 41 },
    states: [{ ...c.states[0]!, ...st, key: 'below30' }, c.states[1]!] })),
});
const seven = [0.12, 0.05, -0.04, 0.2, 0.08, -0.1, 0.06].map((r, i) => ep(`2022-0${i + 1}-03`, r));

describe('pt-technicals', () => {
  basics(PtTechnicals, { ticker: 'NVDA', card: 'rsi' });

  it('every card: a question, its answer with a number and the date, and a chart', async () => {
    for (const k of TECH_CARDS) {
      const { el, words } = await view(demo, k);
      expect(el.querySelector('[data-faq-q]')?.textContent?.trim(), k).toMatch(/NVDA/);
      expect(el.querySelector('[data-faq-a]')?.textContent, k).toMatch(/\d/);
      expect(words, k).toContain('Sep 30, 2026');
      expect(el.querySelector('svg'), k).toBeTruthy();
    }
  });

  it('the stock\'s own count, the market beside it, and all the companies', async () => {
    const st = withRsi({ total: 7, episodes: seven, paths: seven.map(() => [0, 0.01, 0.02]), stock: [sum(7, 5, 0.062, 0.041, 0.02), sum(7, 4, 0.05)], all: [sum(4100, 2378, 0.02, 0.012, 0.005), sum(4000, 2400, 0.03)] });
    const { words } = await view(st);
    expect(words).toContain('Is NVDA oversold?');
    expect(words).toContain('higher a month later 5 of 7 times');
    expect(words).toContain('+6.2%');
    expect(words).toContain('the market +4.1%');
    expect(words).toContain('58% of 4,100 times');
  });

  it('fewer than three times: only N times with the dates, no share', async () => {
    const two = seven.slice(0, 2);
    const { words } = await view(withRsi({ total: 2, episodes: two, paths: null, stock: [sum(2, 1, 0.03), sum(2, 1, 0.03)] }));
    expect(words).toContain('only 2 times');
    expect(words).toContain('Jan 3, 2022');
    expect(words).not.toContain('of 2 times');
  });

  it('SPY is the market: no comparison with the market, no net', async () => {
    const spy = withRsi({ total: 7, episodes: seven, stock: [sum(7, 5, 0.062, null, null), sum(7, 4, 0.05, null, null)] }, { ticker: 'SPY', kind: 'etf', name: 'SPDR S&P 500 ETF Trust' });
    const { words } = await view(spy);
    expect(words).not.toContain('the market +');
    expect(words).not.toContain('net');
  });

  it('three months behind the toggle, without a new call', async () => {
    const st = withRsi({ total: 7, episodes: seven, stock: [sum(7, 5, 0.062), sum(7, 4, 0.11)] });
    const r = await render(PtTechnicals, { ticker: 'NVDA', card: 'rsi' }, withData({ 'technicals@1': st }));
    await press(r.f, r.el, '3 months');
    const words = r.el.textContent!.replace(/\s+/g, ' ');
    expect(words).toContain('higher three months later 4 of 7 times');
    expect(words).toContain('+11.0%');
  });

  it('a card the payload lacks (a short history): says so', async () => {
    const { words } = await view({ ...demo, cards: demo.cards.filter((c) => c.key !== 'ma200') }, 'ma200');
    expect(words).toContain('not enough');
  });

  it('never a word of advice', async () => {
    for (const k of TECH_CARDS) {
      const { words } = await view(demo, k);
      expect(words.toLowerCase(), k).not.toMatch(/buy signal|sell signal|bullish|bearish|strong buy/);
    }
  });
});

import { TECH_CARDS, technicalsDemo, type TechCard, type Technicals, type TechCardKey, type TechState } from '../src/typologies';
import { afterChart, nowChart, PtTechnicals } from './pt-technicals';
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

  it('held: of the times with a month after them, at both horizons (review)', async () => {
    const sup = (o: Partial<TechState>): Technicals => ({ ...demo, cards: demo.cards.map((c): TechCard => (c.key !== 'support' ? c : { ...c, state: 'near',
      now: { level: 30, dist: -0.02, touches: 3 }, states: [{ ...c.states[0]!, key: 'near', ...o }] })) });
    const st = sup({ total: 7, episodes: seven, held: 4, stock: [sum(7, 5, 0.06), sum(5, 3, 0.05)] });
    const r = await render(PtTechnicals, { ticker: 'NVDA', card: 'support' }, withData({ 'technicals@1': st }));
    expect(r.el.textContent!.replace(/\s+/g, ' ')).toContain('held 4 of 7 times');
    await press(r.f, r.el, '3 months');
    expect(r.el.textContent!.replace(/\s+/g, ' ')).toContain('held 4 of 7 times');
  });

  it('the only time is too recent: said once, never counted twice (review: CAT on Nov 16)', async () => {
    const { words } = await view(withRsi({ total: 1, episodes: [{ ...ep('2026-09-25', 0), r: [null, null], m: [null, null] }], paths: null, stock: [sum(0, 0, 0), sum(0, 0, 0)] }));
    expect(words).toContain('only 1 time');
    expect(words).toContain('too recent');
    expect(words).not.toContain('more time');
  });

  it('SPY: no "net" even where it has no count of its own (review)', async () => {
    const spy = withRsi({ total: 0, episodes: [], paths: null, stock: [sum(0, 0, 0, null, null), sum(0, 0, 0, null, null)] }, { ticker: 'SPY', kind: 'etf', name: 'SPDR S&P 500 ETF Trust' });
    const { words } = await view(spy);
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

  // Romeo, 2026-11-18, on www
  it('a resistance the price turned up at, now above it, says it used to be a support', async () => {
    const res = (now: Record<string, number | null>): Technicals => ({ ...demo, cards: demo.cards.map((c): TechCard => (c.key !== 'resistance' ? c : { ...c, state: 'far', now })) });
    const flipped = (await view(res({ level: 168.32, dist: 0.083, touches: 6, made: 1, flipped: 1 }), 'resistance')).words;
    expect(flipped).toContain('It used to be a support: the price turned up there 6 times in the last two years, then fell through it');
    const plain = (await view(res({ level: 168.32, dist: 0.083, touches: 6, made: -1, flipped: 0 }), 'resistance')).words;
    expect(plain).toContain('the price turned down there 6 times');
    expect(plain).not.toContain('used to be');
  });

  it('a level\'s chart marks the closes it is made of, on the level line, and says so', async () => {
    const c = demo.cards.find((x) => x.key === 'resistance')!;
    expect(c.chart.range).toBe('weekly');
    expect(c.chart.marks.length).toBe(c.now['touches']);
    const g = nowChart(demo, c)!;
    expect(new Set(g.marks.map((m) => m.cy))).toEqual(new Set([g.levels[0]!.y]));
    expect(g.marks.every((m) => m.cls === 'pt-tech-turn')).toBe(true);
    expect((await view(demo, 'resistance')).words).toContain('The closes the price turned at');
  });

  it('Bollinger: the two bands as one shaded channel', () => {
    const g = nowChart(demo, demo.cards.find((x) => x.key === 'bollinger')!)!;
    expect(g.band).toMatch(/^M.*Z$/);
    expect(g.lines.map((l) => l.cls)).toEqual(['pt-tech-bb', 'pt-tech-bb-mid', 'pt-tech-bb']);
  });

  it('MACD says what it usually means, as the RSI does', async () => {
    expect((await view(demo, 'macd')).words).toMatch(/usually read as momentum turning (up|down)/);
  });

  it('the after chart: every company\'s median as a line over the whole horizon, the middle half as a band from four times', () => {
    const st = (n: number, allPath: (number | null)[] | null): TechState => ({ ...demo.cards[0]!.states[0]!, medPath: undefined, half: undefined,
      paths: Array.from({ length: n }, (_, j) => Array.from({ length: 22 }, (_, i) => (j - 1) * 0.004 * i)), allPath });
    const g = afterChart(st(5, Array.from({ length: 22 }, (_, i) => 0.001 * i)), 0)!;
    expect(g.all).toMatch(/^M[\d.]+,[\d.]+(L[\d.]+,[\d.]+){7}$/); // 8 points: 0 to 21 sessions every 3rd
    expect(g.band).toMatch(/Z$/);
    expect(g.ends).toHaveLength(2);
    expect(g.grid.some((u) => u.zero)).toBe(true);
    expect(afterChart(st(3, null), 0)!.band).toBeNull();
    expect(afterChart(st(3, null), 0)!.all).toBeNull();
    expect(afterChart({ ...st(5, null), total: 25 }, 0)!.some).toBe(5);
  });
});

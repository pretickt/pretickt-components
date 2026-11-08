import { addDays, DEMO_ASOF, DEMO_COMPANIES, prng, round, type ClosesFile, type FactsCompany, type FactsFile, type PortfolioBasket } from '../typologies';
import { computePortfolio } from '../site/portfolio/compute';
import type { StoredPortfolio } from '../site/portfolio/store';

/**
 * Made-up facts, closes and portfolios for the portfolio page's specs and stories (a public repo: no provider's numbers). The tickers are the demo
 * companies'; every figure comes from a seeded generator. `DEMO` is a fund looked through to them.
 */
const TONES = ['pos', 'flat', 'neg'] as const;
function company([ticker, name]: readonly [string, string], i: number): FactsCompany {
  const r = prng(`${ticker}:portfolio`);
  const close = round(40 + r() * 400, 2);
  return {
    ticker, name, logo: null, sector: i % 4 === 3 ? 'Consumer Defensive' : 'Technology', close, ret: round((r() - 0.5) * 0.06, 4), upside: round(r() * 0.4 - 0.05, 4), firms: 3 + Math.floor(r() * 30),
    consensus: { strongBuy: Math.floor(r() * 10), buy: Math.floor(r() * 20), hold: Math.floor(r() * 10), sell: Math.floor(r() * 3), strongSell: 0 },
    pe: round(10 + r() * 40, 1), nextEarnings: i < 4 ? addDays(DEMO_ASOF, 5 + i * 9) : null,
    sections: { demand: TONES[i % 3], advantage: TONES[(i + 1) % 3], economics: TONES[(i + 2) % 3], execution: 'pos', fragility: 'flat', price: TONES[i % 3] },
    headline: i < 6 ? { title: `${name} demo headline`, url: `https://example.com/${ticker.toLowerCase().replace('.', '-')}` } : null, news: [0.2, null],
  };
}
const companies = DEMO_COMPANIES.map(company);
export const DEMO_FACTS: FactsFile = {
  v: 1, asOf: DEMO_ASOF,
  companies: Object.fromEntries(companies.map((c) => [c.ticker, c])),
  funds: { DEMO: { name: 'Demo Large-Cap ETF', logo: null, close: 512.4, ret: 0.004, coverage: 0.93, weights: companies.slice(0, 8).map((c, i): [string, number] => [c.ticker, round([0.2, 0.17, 0.15, 0.12, 0.1, 0.08, 0.06, 0.05][i]!, 4)]) } },
};

/** A year of weekday sessions before DEMO_ASOF, each company's close walking back from tonight's. */
function oneYear(): ClosesFile {
  const dates: string[] = [];
  for (let d = DEMO_ASOF; dates.length < 252; d = addDays(d, -1)) if (![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) dates.unshift(d);
  const walk = (t: string, last: number) => {
    const r = prng(`${t}:closes`), out = [last];
    for (let i = 1; i < dates.length; i++) out.unshift(round(out[0]! / (1 + (r() - 0.47) * 0.03), 2));
    return out;
  };
  return { v: 1, from: dates[0]!, to: dates.at(-1)!, dates, closes: Object.fromEntries([...companies.map((c) => [c.ticker, walk(c.ticker, c.close!)]), ['DEMO', walk('DEMO', 512.4)]]) };
}
export const DEMO_CLOSES = new Map<string, ClosesFile>([['1y', oneYear()]]);

const d = (n: number) => DEMO_CLOSES.get('1y')!.dates[n]!;
export const DEMO_PORTFOLIOS: Record<'shares' | 'watchlist' | 'low' | 'fund', StoredPortfolio> = {
  shares: { id: 'demo-shares', name: 'Long term', kind: 'portfolio', unit: 'shares', rows: [
    { t: 'AAPL', n: 40, d: d(12) }, { t: 'NVDA', n: 25, d: d(80) }, { t: 'MSFT', n: 12, d: d(150) }, { t: 'KO', n: 60, d: d(30) }, { t: 'DEMO', n: 8, d: d(5) },
  ] },
  watchlist: { id: 'demo-watch', name: 'Chips to watch', kind: 'watchlist', unit: 'equal', rows: ['NVDA', 'AMD', 'AVGO', 'INTC'].map((t) => ({ t, n: null, d: null })) },
  low: { id: 'demo-low', name: 'Mostly elsewhere', kind: 'portfolio', unit: 'usd', rows: [{ t: 'AAPL', n: 2000, d: null }, { t: 'OLDCO', n: 6000, d: null }] },
  fund: { id: 'demo-fund', name: 'Just the fund', kind: 'portfolio', unit: 'pct', rows: [{ t: 'DEMO', n: 100, d: null }] },
};
export const demoPortfolio = (k: keyof typeof DEMO_PORTFOLIOS): PortfolioBasket => computePortfolio(DEMO_PORTFOLIOS[k], DEMO_FACTS, DEMO_CLOSES);

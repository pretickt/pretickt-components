import { describe, expect, it } from 'vitest';
import { BASKET_MIN_COVERAGE, PortfolioBasket, type ClosesFile, type FactsCompany, type FactsFile } from '../../typologies';
import { closesNeeded, computePortfolio, yearLine } from './compute';
import type { StoredPortfolio } from './store';

const co = (ticker: string, o: Partial<FactsCompany> = {}): FactsCompany => ({
  ticker, name: `${ticker} Inc.`, logo: null, sector: 'Technology', close: 100, ret: 0, upside: 0.2, firms: 5,
  consensus: { strongBuy: 1, buy: 3, hold: 1, sell: 0, strongSell: 0 }, pe: 20, nextEarnings: null, sections: { demand: 'pos' }, headline: null, news: [], ...o,
});
const FACTS: FactsFile = {
  v: 1, asOf: '2026-11-06',
  companies: {
    AAA: co('AAA', { close: 100, ret: 0.1, nextEarnings: '2026-11-20', headline: { title: 'Aaa beats', url: 'https://example.com/aaa' } }),
    BBB: co('BBB', { close: 50, ret: -0.05, upside: 0.1, firms: 4 }),
    LATE: co('LATE', { close: 30 }),
    CUT: co('CUT', { close: 40 }),
  },
  funds: { VOO: { name: 'Demo 500 ETF', logo: null, close: 500, ret: 0.01, coverage: 0.9, weights: [['AAA', 0.5], ['BBB', 0.4]] } },
};
// a year of made-up sessions: Mon 2026-03-02 … ; LATE lists on 2026-04-01; CUT's series starts at its break on 2026-04-01
const DATES = ['2026-03-02', '2026-03-03', '2026-03-09', '2026-03-10', '2026-04-01', '2026-11-06'];
const ONE_YEAR: ClosesFile = { v: 1, from: DATES[0]!, to: DATES.at(-1)!, dates: DATES, closes: {
  AAA: [80, 82, 90, 91, 95, 100], BBB: [40, 40, 45, 46, 48, 50], VOO: [400, 401, 450, 455, 480, 500], LATE: [null, null, null, null, 25, 30], CUT: [null, null, null, null, 35, 40],
} };
const YEAR_2025: ClosesFile = { v: 1, from: '2025-01-02', to: '2025-12-31', dates: ['2025-06-02', '2025-12-31'], closes: { AAA: [50, 70] } };
const CLOSES = new Map([['1y', ONE_YEAR], ['2025', YEAR_2025]]);
const pf = (o: Partial<StoredPortfolio>): StoredPortfolio => ({ id: 'p', name: 'Mine', kind: 'portfolio', unit: 'shares', rows: [], ...o });
const r = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

describe('a portfolio computed on the page', () => {
  it('weights, value and coverage in each unit', () => {
    const shares = computePortfolio(pf({ rows: [{ t: 'AAA', n: 3, d: null }, { t: 'BBB', n: 4, d: null }] }), FACTS, CLOSES);
    expect(shares.value).toBe(500);
    expect(shares.holdings.map((h) => [h.ticker, h.weight])).toEqual([['AAA', 0.6], ['BBB', 0.4]]);
    expect(shares.coverage).toBe(1);
    expect(computePortfolio(pf({ unit: 'usd', rows: [{ t: 'AAA', n: 1000, d: null }, { t: 'BBB', n: 3000, d: null }] }), FACTS, CLOSES)).toMatchObject({ value: 4000, holdings: [{ ticker: 'BBB', weight: 0.75 }, { ticker: 'AAA', weight: 0.25 }] });
    expect(computePortfolio(pf({ unit: 'pct', rows: [{ t: 'AAA', n: 30, d: null }, { t: 'BBB', n: 10, d: null }] }), FACTS, CLOSES)).toMatchObject({ value: null, holdings: [{ weight: 0.75 }, { weight: 0.25 }] });
    expect(computePortfolio(pf({ unit: 'equal', rows: [{ t: 'AAA', n: null, d: null }, { t: 'BBB', n: null, d: null }] }), FACTS, CLOSES).holdings.map((h) => h.weight)).toEqual([0.5, 0.5]);
  });

  it('a fund is looked through; a company held directly and through a fund is summed; an unknown fund is not covered', () => {
    // AAA: 0.5 directly + 0.5 × 0.5 through VOO; BBB 0.5 × 0.4; VOO's uncovered 0.5 × 0.1
    const b = computePortfolio(pf({ unit: 'usd', rows: [{ t: 'VOO', n: 1000, d: null }, { t: 'AAA', n: 1000, d: null }] }), FACTS, CLOSES);
    expect(b.holdings.find((h) => h.ticker === 'VOO')).toMatchObject({ fund: true, name: 'Demo 500 ETF', weight: 0.5, ret: 0.01 });
    expect(b.coverage).toBe(0.95);
    expect(b.target!.share).toBe(0.95);
    expect(b.uncovered).toEqual([{ name: 'Demo 500 ETF, outside the companies we cover', weight: 0.05 }]);
    // a symbol no longer on the site is not covered, and named first (the largest)
    const g = computePortfolio(pf({ unit: 'usd', rows: [{ t: 'VOO', n: 1000, d: null }, { t: 'AAA', n: 1000, d: null }, { t: 'GONE', n: 500, d: null }] }), FACTS, CLOSES);
    expect(g.coverage).toBe(r(0.4 + 0.2 + 0.16, 4));
    expect(g.uncovered).toEqual([{ name: 'GONE', weight: 0.2 }, { name: 'Demo 500 ETF, outside the companies we cover', weight: r(0.04, 4) }]);
  });

  it('under 80% no figure, the uncovered named', () => {
    const b = computePortfolio(pf({ unit: 'usd', rows: [{ t: 'AAA', n: 1000, d: null }, { t: 'GONE', n: 1000, d: null }] }), FACTS, CLOSES);
    expect(b.coverage).toBeLessThan(BASKET_MIN_COVERAGE);
    expect(b).toMatchObject({ state: 'low', target: null, consensus: null, pe: null, questions: null, uncovered: [{ name: 'GONE', weight: 0.5 }] });
  });

  it("a line's return since its date; the whole since for dated shares", () => {
    const b = computePortfolio(pf({ rows: [{ t: 'AAA', n: 2, d: '2026-03-02' }, { t: 'AAA', n: 2, d: '2025-06-02' }, { t: 'BBB', n: 10, d: '2026-03-10' }] }), FACTS, CLOSES);
    const aaa = b.holdings.find((h) => h.ticker === 'AAA')!;
    expect(aaa).toMatchObject({ bought: '2025-06-02', noSince: false });
    expect(aaa.since).toBe(r((4 * 100) / (2 * 80 + 2 * 50) - 1, 4)); // the two lots at their own closes
    expect(b.holdings.find((h) => h.ticker === 'BBB')!.since).toBe(r(50 / 46 - 1, 4));
    expect(b.since).toEqual({ from: '2025-06-02', ret: r((4 * 100 + 10 * 50) / (2 * 80 + 2 * 50 + 10 * 46) - 1, 4) });
    expect(computePortfolio(pf({ rows: [{ t: 'AAA', n: 2, d: '2026-03-02' }, { t: 'BBB', n: 1, d: null }] }), FACTS, CLOSES).since).toBeNull();
  });

  it('a date on a holiday, before the first close or before a break', () => {
    const b = computePortfolio(pf({ rows: [{ t: 'AAA', n: 1, d: '2026-03-07' }, { t: 'LATE', n: 1, d: '2026-03-02' }, { t: 'CUT', n: 1, d: '2026-03-03' }] }), FACTS, CLOSES);
    expect(b.holdings.find((h) => h.ticker === 'AAA')!.since).toBe(r(100 / 90 - 1, 4)); // Saturday: Monday's close
    expect(b.holdings.find((h) => h.ticker === 'LATE')).toMatchObject({ since: null, noSince: true });
    expect(b.holdings.find((h) => h.ticker === 'CUT')).toMatchObject({ since: null, noSince: true });
    expect(b.since).toBeNull();
  });

  it('a watchlist: equal weights, no value, no since', () => {
    const b = computePortfolio(pf({ kind: 'watchlist', unit: 'equal', rows: [{ t: 'AAA', n: null, d: null }, { t: 'BBB', n: null, d: null }] }), FACTS, CLOSES);
    expect(b).toMatchObject({ kind: 'watchlist', value: null, since: null, holdings: [{ weight: 0.5, bought: null }, { weight: 0.5, bought: null }] });
  });

  it('the payload passes PortfolioBasket: moves, earnings and headlines included', () => {
    const b = computePortfolio(pf({ rows: [{ t: 'AAA', n: 3, d: '2026-03-02' }, { t: 'BBB', n: 4, d: null }, { t: 'VOO', n: 1, d: null }] }), FACTS, CLOSES);
    expect(PortfolioBasket.safeParse(b).success).toBe(true);
    expect(b.moves.up[0]!.ticker).toBe('AAA');
    expect(b.moves.down[0]!.ticker).toBe('BBB');
    expect(b.earnings).toEqual([{ ticker: 'AAA', name: 'AAA Inc.', logo: null, date: '2026-11-20' }]);
    expect(b.headlines).toEqual([{ ticker: 'AAA', name: 'AAA Inc.', title: 'Aaa beats', url: 'https://example.com/aaa' }]);
  });

  it('the files a portfolio needs: the year file for dates before the last year (and the next for a date at the year end)', () => {
    expect(closesNeeded(pf({ rows: [{ t: 'AAA', n: 1, d: '2025-06-02' }, { t: 'BBB', n: 1, d: '2026-03-10' }, { t: 'AAA', n: 1, d: '2023-12-29' }] }), '2025-11-07'))
      .toEqual(['2023', '2024', '2025']);
    expect(closesNeeded(pf({ kind: 'watchlist', rows: [{ t: 'AAA', n: null, d: null }] }), '2025-11-07')).toEqual([]);
  });
});

describe("the portfolio's year", () => {
  it("with shares, what today's holdings were worth each day (a company not listed yet at its first close); otherwise the weighted return since the first day", () => {
    const s = yearLine(pf({ rows: [{ t: 'AAA', n: 3, d: null }, { t: 'LATE', n: 2, d: null }] }), FACTS, ONE_YEAR)!;
    expect(s.unit).toBe('value');
    expect(s.points.map((p) => p.v)).toEqual([3 * 80 + 2 * 25, 3 * 82 + 2 * 25, 3 * 90 + 2 * 25, 3 * 91 + 2 * 25, 3 * 95 + 2 * 25, 3 * 100 + 2 * 30]);
    expect(s.points.map((p) => p.t)).toEqual(DATES);
    const w = yearLine(pf({ kind: 'watchlist', unit: 'equal', rows: [{ t: 'AAA', n: null, d: null }, { t: 'BBB', n: null, d: null }] }), FACTS, ONE_YEAR)!;
    expect(w.unit).toBe('return');
    expect(w.points[0]!.v).toBe(0);
    expect(w.points.at(-1)!.v).toBe(r(0.5 * (100 / 80 - 1) + 0.5 * (50 / 40 - 1), 4));
    expect(yearLine(pf({ rows: [] }), FACTS, ONE_YEAR)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { basketConsensus, basketPe, basketQuestions, basketTarget, consensusOf, holdingOf, valueMoves, type BasketFacts, type BasketLine } from './basket-math';
import * as browser from './browser';

const facts = (ticker: string, o: Partial<BasketFacts> = {}): BasketFacts => ({
  ticker, name: `${ticker} Inc.`, logo: null, sector: 'Technology', close: 100, ret: 0, upside: null, firms: 0, consensus: null, pe: null, nextEarnings: null,
  sections: null, headline: null, news: [], ...o,
});
const line = (ticker: string, weight: number, o: Partial<BasketFacts> = {}): BasketLine => ({ ticker, weight, f: facts(ticker, o) });
const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

describe('the basket math, one implementation for the nightly and the page', () => {
  it("a basket's target, consensus, P/E and questions, as the funds' pages compute them", () => {
    const lines = [
      line('AAA', 0.5, { upside: 0.2, firms: 5, pe: 20, consensus: { strongBuy: 2, buy: 6, hold: 2, sell: 0, strongSell: 0 }, sections: { demand: 'pos' } }),
      line('BBB', 0.3, { upside: 0.1, firms: 4, pe: 30, consensus: { strongBuy: 0, buy: 1, hold: 3, sell: 1, strongSell: 0 }, sections: { demand: 'neg' } }),
      line('CCC', 0.2, { upside: 0.5, firms: 2, pe: -5 }),
    ];
    const t = basketTarget(lines, 100)!;
    expect(t.price).toBe(r(100 * (1 + (0.5 * 0.2 + 0.3 * 0.1) / 0.8), 2));
    expect(t.share).toBe(0.8); // CCC has 2 firms: left out
    expect(basketConsensus(lines)).toEqual({ buy: r(9 / 15, 4), hold: r(5 / 15, 4), sell: r(1 / 15, 4), n: 15, label: 'Buy', share: 0.8 });
    expect(basketPe(lines)).toEqual({ value: r(0.8 / (0.5 / 20 + 0.3 / 30), 2), share: 0.8 });
    const demand = basketQuestions(lines, 1)!.find((q) => q.key === 'demand')!;
    expect(demand).toEqual({ key: 'demand', pos: r(0.5 / 0.8, 4), flat: 0, neg: r(0.3 / 0.8, 4), share: 0.8, comparable: true });
    expect(holdingOf(lines[0]!)).toMatchObject({ ticker: 'AAA', weight: 0.5, upside: 0.2, label: 'Buy' });
    expect(consensusOf({ strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 })).toBeNull();
  });

  it("valueMoves: the day's move is the sum of the points, from yesterday's values", () => {
    const m = valueMoves([
      { ticker: 'AAA', name: 'Aaa', logo: null, value: 300, ret: 0.1, headline: null },
      { ticker: 'BBB', name: 'Bbb', logo: null, value: 100, ret: -0.1, headline: null },
    ]);
    const prev = 300 / 1.1 + 100 / 0.9;
    expect(m.ret).toBe(r((300 - 300 / 1.1 + 100 - 100 / 0.9) / prev, 6));
    expect(m.up.map((x) => x.ticker)).toEqual(['AAA']);
    expect(m.down.map((x) => x.ticker)).toEqual(['BBB']);
    expect(valueMoves([]).ret).toBeNull();
  });

  it('the browser entry carries the math', () => {
    expect(typeof browser.basketTarget).toBe('function');
    expect(typeof browser.valueMoves).toBe('function');
  });
});

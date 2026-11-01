import { describe, expect, it } from 'vitest';
import { MEGA_CAP } from '../typologies/values';
import { MOCK_BARS, MOCK_UNIVERSE } from './mock';
import { condition, exampleOf, inUniverse, matches, nameOf, passCount, RULE_MAX, ruleProblem, type Rule } from './rule';
import { rowsOf } from './rows';

const rows = rowsOf(MOCK_UNIVERSE, null);
const romeo: Rule = { v: 1, all: [condition('session-move'), condition('below-average'), condition('mega-caps')] };

describe('rules', () => {
  it('the made-up universe has 100 companies, 61 of them mega caps, and AMD as in the mockups', () => {
    expect(MOCK_UNIVERSE.rows).toHaveLength(100);
    expect(MOCK_UNIVERSE.rows.filter((r) => (r.marketCap ?? 0) >= MEGA_CAP)).toHaveLength(61);
    const amd = rows.find((r) => r.ticker === 'AMD')!;
    expect(amd.move!).toBeCloseTo(-0.079, 3);
    expect(amd.price / amd.ma50! - 1).toBeCloseTo(-0.24, 2);
    expect(amd.marketCap).toBe(310e9);
    expect(MOCK_BARS['AMD']!.at(-1)).toBeCloseTo(amd.price, 2);
  });

  it('a rule of universe conditions only is refused', () => {
    expect(ruleProblem({ v: 1, all: [] })).toBe('empty');
    expect(ruleProblem({ v: 1, all: [condition('mega-caps'), condition('sector')] })).toBe('universe-only');
    expect(ruleProblem({ v: 1, all: Array.from({ length: RULE_MAX + 1 }, () => condition('session-move')) })).toBe('too-many');
    expect(ruleProblem(romeo)).toBeNull();
  });

  it('condition() lays defaults, then the seed, then the given params', () => {
    const amd = rows.find((r) => r.ticker === 'AMD')!;
    expect(condition('session-move', { pct: 7 })).toEqual({ c: 'session-move', p: { dir: 'down', pct: 7 } });
    expect(condition('price-crosses', undefined, amd).p['price']).toBe(Math.round(amd.price * 0.95));
    expect(condition('price-crosses', { price: 120 }, amd).p['price']).toBe(120);
  });

  it('matches applies every condition', () => {
    expect(matches(romeo, rows).map((r) => r.ticker)).toEqual(['AMD']);
    const looser: Rule = { v: 1, all: [condition('session-move'), condition('mega-caps')] };
    expect(matches(looser, rows).map((r) => r.ticker).sort()).toEqual(['AMD', 'MU', 'PLTR', 'TSLA']);
  });

  it("passCount counts within the rule's universe", () => {
    expect(passCount(romeo, 0, rows)).toEqual({ pass: 4, of: 61 });
    expect(passCount(romeo, 1, rows)).toEqual({ pass: 3, of: 61 });
    expect(passCount(romeo, 2, rows)).toEqual({ pass: 61, of: 100 });
  });

  it('exampleOf prefers the clicked ticker when it is in the universe, else the closest', () => {
    expect(exampleOf(romeo, rows)?.ticker).toBe('AMD');
    expect(exampleOf(romeo, rows, 'NVDA')?.ticker).toBe('NVDA');
    expect(exampleOf(romeo, rows, 'F')?.ticker).toBe('AMD');   // F is not a mega cap in the made-up universe
    expect(exampleOf({ v: 1, all: [condition('one-stock', { ticker: 'ZZZZ' }), condition('session-move')] }, rows)).toBeNull();
  });

  it('nameOf joins the short names', () => {
    expect(nameOf(romeo)).toBe('Drops 5%+ · 15% under 50-day avg · Mega caps');
    const long: Rule = { v: 1, all: [condition('session-move'), condition('below-average'), condition('news-spike'),
      condition('earnings-soon'), condition('mega-caps'), condition('sector', { sector: 'Communication Services' })] };
    expect(nameOf(long).length).toBeLessThanOrEqual(60);
    expect(nameOf(long).endsWith(' · ')).toBe(false);
  });
});

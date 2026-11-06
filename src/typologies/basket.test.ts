import { describe, expect, it } from 'vitest';
import { demoFor, getTypology } from './index';
import { BasketPayload, BASKET_MIN_COVERAGE, BASKET_MOVERS, type Basket } from './basket';
import { CompanyPayload } from './company';
import { NewsPayload } from './news';

const demo = (ticker: string) => demoFor({ t: 'basket@1', params: { ticker } }) as Basket;
const smh = demo('SMH');
const ok = (v: unknown) => BasketPayload.safeParse(v).success;

describe('basket@1', () => {
  it('is registered; the demo parses and is deterministic', () => {
    expect(getTypology('basket@1')).toBeTruthy();
    expect(ok(smh)).toBe(true);
    expect(demo('SMH')).toEqual(smh);
  });
  it('a low state with any basket figure is refused: a fund under 80% shows none', () => {
    const low = { ...smh, state: 'low', coverage: 0.72 };
    expect(ok(low)).toBe(false);
    expect(ok({ ...low, target: null, consensus: null, pe: null, questions: null })).toBe(true);
    expect(ok({ ...low, target: null, consensus: smh.consensus, pe: null, questions: null })).toBe(false);
  });
  it('an ok state under 80% is refused', () => {
    expect(BASKET_MIN_COVERAGE).toBe(0.8);
    expect(ok({ ...smh, coverage: 0.79 })).toBe(false);
  });
  it('a demo at 72% has none of the basket figures', () => {
    const d = demo('ARKW');
    expect(ok(d)).toBe(true);
    expect([d.state, d.target, d.consensus, d.pe, d.questions]).toEqual(['low', null, null, null, null]);
    expect(d.holdings.length).toBeGreaterThan(0);
  });
  it('moves are at most five a side; at most three contributors to the target', () => {
    expect(BASKET_MOVERS).toBe(5);
    const six = [...smh.moves.up, ...smh.moves.up].slice(0, 6);
    expect(ok({ ...smh, moves: { ...smh.moves, up: six } })).toBe(false);
    expect(ok({ ...smh, target: { ...smh.target!, top: [...smh.target!.top, ...smh.target!.top] } })).toBe(false);
  });
  it('a question that is comparable has shares adding up to the whole; one that is not needs none', () => {
    const q = smh.questions![0]!;
    expect(ok({ ...smh, questions: [{ ...q, pos: 0.9, flat: 0.9, neg: 0 }] })).toBe(false);
    expect(ok({ ...smh, questions: [{ ...q, pos: 0, flat: 0, neg: 0, comparable: false }] })).toBe(true);
  });
  it('weights are fractions; a company we do not cover has no link, no move and no upside', () => {
    const other = smh.holdings.find((h) => h.ticker === null)!;
    expect(other).toMatchObject({ ret: null, upside: null, label: null, logo: null });
    expect(ok({ ...smh, holdings: [{ ...other, weight: 20.5 }] })).toBe(false);
  });
  it('no faq says buy, sell or a probability: the answers are facts', () => {
    for (const f of smh.faq) expect(f.a).not.toMatch(/\b(should buy|should sell|likely to rise|probability|we recommend)\b/i);
  });
});

describe('what company@1 and news@1 gain for a fund', () => {
  it('company@1: optional kind and coverage', () => {
    const c = { ticker: 'SMH', name: 'A Fund', sector: null, industry: null, logo: null };
    expect(CompanyPayload.safeParse(c).success).toBe(true);
    expect(CompanyPayload.safeParse({ ...c, kind: 'etf', coverage: 0.99 }).success).toBe(true);
    expect(CompanyPayload.parse({ ...c, kind: 'etf', coverage: 0.99 })).toMatchObject({ kind: 'etf', coverage: 0.99 });
    expect(CompanyPayload.safeParse({ ...c, kind: 'stock' }).success).toBe(false);
  });
  it('news@1: an item may name its company', () => {
    const item = { publishedAt: '2026-11-05T13:00:00Z', title: 't', site: 's', url: 'https://example.com/x', sentiment: null };
    expect(NewsPayload.parse({ asOf: '2026-11-05', items: [{ ...item, ticker: 'NVDA', name: 'Nvidia', logo: null }] }).items[0]).toMatchObject({ ticker: 'NVDA', name: 'Nvidia' });
    expect(NewsPayload.safeParse({ asOf: '2026-11-05', items: [item] }).success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { demoFor } from './index';
import { PIOTROSKI_CHECKS, VALUE_KEYS, ValuePayload, type Value, type ValueCard } from './value';

const demo = (ticker: string) => demoFor({ t: 'value@1', params: { ticker } }) as Value;
const nvda = demo('NVDA');
const first = nvda.sections[0]!.cards[0]!;
/** NVDA's payload with a single question holding a single card. */
const withCard = (card: unknown) => ({ ...nvda, sections: [{ key: 'demand', tone: 'pos', verdict: 'growing fast', cards: [card] }] });
const ok = (v: unknown) => ValuePayload.safeParse(v).success;

describe('value@1', () => {
  it('the six questions in their order, each at most once; a question without data is left out', () => {
    expect(ok(nvda)).toBe(true);
    expect(nvda.sections.map((s) => s.key)).toEqual([...VALUE_KEYS]);
    const [demand, advantage, ...rest] = nvda.sections;
    expect(ok({ ...nvda, sections: [advantage, demand, ...rest] })).toBe(false);
    expect(ok({ ...nvda, sections: [demand, demand] })).toBe(false);
    expect(ok({ ...nvda, sections: [demand, ...rest] })).toBe(true);
  });
  it('the Piotroski card carries the nine checks; a record names its quarters as the company does', () => {
    const all = Object.fromEntries(PIOTROSKI_CHECKS.map((k) => [k, true]));
    expect(ok(withCard({ ...first, viz: { kind: 'checks', ok: all } }))).toBe(true);
    const { shares: _, ...eight } = all;
    expect(ok(withCard({ ...first, viz: { kind: 'checks', ok: eight } }))).toBe(false);
    const record = (q: string, fy: string) => withCard({ ...first, viz: { kind: 'quarters', vs: 'its forecast', quarters: [{ q, fy, by: 0.05 }] } });
    expect(ok(record('Q3', 'FY26'))).toBe(true);
    for (const [q, fy] of [['Q5', 'FY26'], ['Q3', '2026'], ['3', 'FY26']]) expect(ok(record(q!, fy!)), `${q} ${fy}`).toBe(false);
  });
  it('another company links to its page only when it has one: a holder without a ticker is a name; each company once a card', () => {
    const rows = (r: unknown[]) => withCard({ ...first, viz: { kind: 'companies', bars: true, rows: r } });
    const vanguard = { ticker: null, name: 'Vanguard', logo: null, value: 8.9, label: '8.9%' };
    expect(ok(rows([vanguard]))).toBe(true);
    expect(ok(rows([{ ...vanguard, ticker: 'VANGUARD' }]))).toBe(false);
    expect(ok(rows([vanguard, vanguard]))).toBe(false);
    const holders = nvda.sections.find((s) => s.key === 'fragility')!.cards.find((c) => c.title === 'shareholders')!;
    expect(holders.viz.kind === 'companies' && holders.viz.rows[0]).toMatchObject({ ticker: null, name: 'Vanguard' });
  });
  it('a fact without data has no card: no empty picture, no empty words, no question without a card', () => {
    const empty = [{ kind: 'bars', values: [] }, { kind: 'quarters', vs: 'its forecast', quarters: [] }, { kind: 'split', parts: [] },
      { kind: 'companies', rows: [], bars: true }];
    for (const viz of empty) expect(ok(withCard({ ...first, viz })), viz.kind).toBe(false);
    for (const k of ['title', 'big', 'say', 'source'] as const) expect(ok(withCard({ ...first, [k]: '' })), k).toBe(false);
    expect(ok({ ...nvda, sections: [{ key: 'demand', tone: 'na', verdict: 'no data yet', cards: [] }] })).toBe(false);
  });
  it('a picture is consistent: a label per bar, shares of a whole that add up to it', () => {
    expect(ok(withCard({ ...first, viz: { kind: 'bars', values: [1, 2], labels: ['FY25'] } }))).toBe(false);
    const split = (shares: number[]) => withCard({ ...first, viz: { kind: 'split', parts: shares.map((share, i) => ({ label: `part ${i}`, share })) } });
    expect(ok(split([0.88, 0.08, 0.04]))).toBe(true);
    expect(ok(split([0.88, 0.3]))).toBe(false);
  });
});

describe('value@1 demo (made-up data)', () => {
  it('three answers: a strong business at a high price, a weakening one at a low price, a fragile one without a P/E', () => {
    const tone = (v: Value, k: string) => v.sections.find((s) => s.key === k)!.tone;
    expect([tone(nvda, 'economics'), tone(nvda, 'price')]).toEqual(['pos', 'neg']);
    expect([tone(demo('NKE'), 'demand'), tone(demo('NKE'), 'price')]).toEqual(['neg', 'pos']);
    expect(demo('INTC').pe).toEqual({ now: null, median: null });
  });
  it('any other company gets the strong example under its own ticker and name, in every sentence, once in each card', () => {
    for (const ticker of ['AAPL', 'MSFT']) {
      const d = demo(ticker);
      expect(d.ticker).toBe(ticker);
      expect(JSON.stringify(d)).not.toMatch(/NVDA|Nvidia/);
      expect(ok(d), ticker).toBe(true);
    }
  });
});

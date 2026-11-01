import { describe, expect, it } from 'vitest';
import { MEGA_CAP, SECTORS } from '../typologies/values';
import { CONDITIONS, CONDITION_IDS, pillText, sentence, type ConditionId, type Params } from './catalog';
import type { AlertRow } from './rows';

const row = (o: Partial<AlertRow> = {}): AlertRow => ({
  ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', logo: null, sector: 'Technology', marketCap: 310e9,
  close: 164, prevClose: 160, ma20: 170, ma50: 200, ma100: 190, ma200: 150, low52: 120, high52: 230, volumeRatio: 3.4,
  peVsSector: -0.22, undervalued: true, ptUpside: 0.31, piotroski: 8, checks: null, surprises: [0.02, 0.03, 0.01, 0.062],
  insiderNet90: 2.4e6, earningsDate: '2026-11-02', grade: { dir: 'down', date: '2026-10-30', firm: 'Firm' },
  news: 12, newsUsual: 3, social: 303, socialUsual: 64,
  session: '2026-10-30', live: true, price: 151, move: -0.079, ...o,
});
const test = (id: ConditionId, o: Partial<AlertRow>, p: Params = {}) => CONDITIONS[id].test(row(o), { ...CONDITIONS[id].defaults, ...p });

describe('the catalog: technical and universe conditions', () => {
  it("every condition's defaults fit its own params", () => {
    for (const id of CONDITION_IDS) {
      const c = CONDITIONS[id];
      expect(c.id).toBe(id);
      for (const s of c.params) {
        const v = c.defaults[s.key];
        expect(v, `${id}.${s.key}`).toBeDefined();
        if (s.kind === 'number') {
          expect(typeof v).toBe('number');
          expect(v as number).toBeGreaterThanOrEqual(s.min);
          expect(v as number).toBeLessThanOrEqual(s.max);
          expect(Math.abs(((v as number) - s.min) / s.step - Math.round(((v as number) - s.min) / s.step))).toBeLessThan(1e-9);
        } else if (s.kind === 'choice') expect(s.options.map(([o]) => o)).toContain(v);
        else if (s.kind === 'sector') expect(SECTORS as readonly string[]).toContain(v);
        else expect(String(v)).toMatch(/^[A-Z][A-Z.]{0,5}$/);
      }
    }
  });

  it('session-move falls 5%: −5% passes, −4.9% does not; rises mirrors', () => {
    expect(test('session-move', { move: -0.05 }).pass).toBe(true);
    expect(test('session-move', { move: -0.049 }).pass).toBe(false);
    expect(test('session-move', { move: 0.05 }, { dir: 'up' }).pass).toBe(true);
    expect(test('session-move', { move: 0.049 }, { dir: 'up' }).pass).toBe(false);
    expect(test('session-move', { move: -0.079 }).value).toBeCloseTo(-0.079, 10);
  });

  it('price-crosses compares the price with the level', () => {
    expect(test('price-crosses', { price: 151 }, { price: 155 }).pass).toBe(true);
    expect(test('price-crosses', { price: 156 }, { price: 155 }).pass).toBe(false);
    expect(test('price-crosses', { price: 156 }, { dir: 'above', price: 155 }).pass).toBe(true);
  });

  it('below-average reads the chosen average', () => {
    // price 151: 24.5% under the 50-day (200), 0.7% over the 200-day (150)
    expect(test('below-average', { price: 151 }).pass).toBe(true);
    expect(test('below-average', { price: 151 }, { days: '200' }).pass).toBe(false);
    expect(test('below-average', { price: 151 }).value).toBeCloseTo(151 / 200 - 1, 10);
    expect(test('below-average', { price: 180, ma200: 150 }, { dir: 'above', days: '200' }).pass).toBe(true);
  });

  it('near-52w low within 2% passes at 1.02 × low52, not at 1.03 ×', () => {
    expect(test('near-52w', { price: 120 * 1.02, low52: 120 }).pass).toBe(true);
    expect(test('near-52w', { price: 120 * 1.03, low52: 120 }).pass).toBe(false);
    expect(test('near-52w', { price: 230 * 0.985, high52: 230 }, { side: 'high' }).pass).toBe(true);
    expect(test('near-52w', { price: 230 * 0.97, high52: 230 }, { side: 'high' }).pass).toBe(false);
  });

  it('volume-spike needs the chosen multiple of the usual volume', () => {
    expect(test('volume-spike', { volumeRatio: 3 }).pass).toBe(true);
    expect(test('volume-spike', { volumeRatio: 2.9 }).pass).toBe(false);
  });

  it('mega-caps starts at MEGA_CAP', () => {
    expect(MEGA_CAP).toBe(200e9);
    expect(test('mega-caps', { marketCap: 200e9 }).pass).toBe(true);
    expect(test('mega-caps', { marketCap: 199.9e9 }).pass).toBe(false);
  });

  it('sector and one-stock match the chosen one', () => {
    expect(test('sector', { sector: 'Technology' }).pass).toBe(true);
    expect(test('sector', { sector: 'Energy' }).pass).toBe(false);
    expect(test('one-stock', { ticker: 'NVDA' }).pass).toBe(true);
    expect(test('one-stock', { ticker: 'AMD' }).pass).toBe(false);
  });

  it('null fields never pass', () => {
    const cases: [ConditionId, Partial<AlertRow>][] = [
      ['session-move', { move: null }], ['below-average', { ma50: null }], ['near-52w', { low52: null }],
      ['volume-spike', { volumeRatio: null }], ['mega-caps', { marketCap: null }], ['sector', { sector: null }],
    ];
    for (const [id, o] of cases) expect(test(id, o), id).toEqual({ pass: false, value: null });
  });

  it('say renders pills in order', () => {
    expect(sentence('session-move', CONDITIONS['session-move'].defaults)).toBe('Falls more than 5% in one session');
    expect(sentence('below-average', CONDITIONS['below-average'].defaults)).toBe('Trades 15% below its 50-day average');
    expect(pillText({ key: 'x', kind: 'number', min: 0, max: 10, step: 0.5, unit: 'pct' }, 2.5)).toBe('2.5%');
    expect(pillText({ key: 'x', kind: 'number', min: 1, max: 9, step: 1, unit: 'times' }, 3)).toBe('3×');
  });

  it('price-crosses seeds a round price below the example', () => {
    expect(CONDITIONS['price-crosses'].seed!(row({ price: 163.27 }))).toEqual({ price: 155 });
    expect(CONDITIONS['price-crosses'].seed!(row({ price: 42.5 }))).toEqual({ price: 40.4 });
  });

  it('facts read as plain English', () => {
    const f = (id: ConditionId, v: number | null, p: Params = {}) => CONDITIONS[id].fact({ ...CONDITIONS[id].defaults, ...p }, v);
    expect(f('session-move', -0.079)).toBe('fell 7.9% in the session');
    expect(f('session-move', 0.051, { dir: 'up' })).toBe('rose 5.1% in the session');
    expect(f('below-average', -0.245)).toBe('trades 25% below its 50-day average');
    expect(f('mega-caps', 310e9)).toBe('is a mega cap ($310B)');
  });
});

describe('the catalog: fundamental, news and social conditions', () => {
  it('pe-vs-sector, undervalued and analyst-upside read the nightly numbers', () => {
    expect(test('pe-vs-sector', { peVsSector: -0.2 }).pass).toBe(true);
    expect(test('pe-vs-sector', { peVsSector: -0.19 }).pass).toBe(false);
    expect(test('pe-vs-sector', { peVsSector: 0.25 }, { dir: 'above' }).pass).toBe(true);
    expect(test('undervalued', { undervalued: true }).pass).toBe(true);
    expect(test('undervalued', { undervalued: false }).pass).toBe(false);
    expect(test('analyst-upside', { ptUpside: 0.2 }).pass).toBe(true);
    expect(test('analyst-upside', { ptUpside: 0.19 }).pass).toBe(false);
  });

  it('piotroski or more / or less', () => {
    expect(test('piotroski', { piotroski: 7 }).pass).toBe(true);
    expect(test('piotroski', { piotroski: 6 }).pass).toBe(false);
    expect(test('piotroski', { piotroski: 3 }, { side: 'low', score: 3 }).pass).toBe(true);
    expect(test('piotroski', { piotroski: 4 }, { side: 'low', score: 3 }).pass).toBe(false);
  });

  it('earnings-surprise reads the latest report', () => {
    expect(test('earnings-surprise', { surprises: [0.2, 0.01] }).pass).toBe(false);
    expect(test('earnings-surprise', { surprises: [0.01, 0.06] }).pass).toBe(true);
    expect(test('earnings-surprise', { surprises: [0.01, -0.06] }, { dir: 'miss' }).pass).toBe(true);
    expect(test('earnings-surprise', { surprises: [] })).toEqual({ pass: false, value: null });
  });

  it('insider-buying needs the chosen net amount in 90 days', () => {
    expect(test('insider-buying', { insiderNet90: 1e6 }).pass).toBe(true);
    expect(test('insider-buying', { insiderNet90: 0.9e6 }).pass).toBe(false);
  });

  it('news-spike needs 4 stories at least', () => {
    expect(test('news-spike', { news: 3, newsUsual: 0.5 }).pass).toBe(false);
    expect(test('news-spike', { news: 4, newsUsual: 0.5 }).pass).toBe(true);
    expect(test('news-spike', { news: 8, newsUsual: 3 }).pass).toBe(false);
    expect(test('news-spike', { news: 9, newsUsual: 3 }).pass).toBe(true);
    expect(test('news-spike', { news: 9, newsUsual: 3 }).value).toBeCloseTo(3, 10);
  });

  it('earnings-soon counts calendar days from the session', () => {
    expect(test('earnings-soon', { session: '2026-10-30', earningsDate: '2026-11-02' }).pass).toBe(true);
    expect(test('earnings-soon', { session: '2026-10-30', earningsDate: '2026-11-02' }, { days: 2 }).pass).toBe(false);
    expect(test('earnings-soon', { session: '2026-10-30', earningsDate: '2026-10-29' }).pass).toBe(false);
    expect(test('earnings-soon', { session: '2026-10-30', earningsDate: '2026-11-02' }).value).toBe(3);
  });

  it('grade-change fires on the session of the grade only', () => {
    expect(test('grade-change', { session: '2026-10-30', grade: { dir: 'down', date: '2026-10-30', firm: 'F' } }).pass).toBe(true);
    expect(test('grade-change', { session: '2026-10-31', grade: { dir: 'down', date: '2026-10-30', firm: 'F' } }).pass).toBe(false);
    expect(test('grade-change', { session: '2026-10-30', grade: { dir: 'up', date: '2026-10-30', firm: 'F' } }).pass).toBe(false);
    expect(test('grade-change', { session: '2026-10-30', grade: { dir: 'up', date: '2026-10-30', firm: 'F' } }, { dir: 'up' }).pass).toBe(true);
  });

  it('social-buzz needs 10 posts at least', () => {
    expect(test('social-buzz', { social: 9, socialUsual: 1 }).pass).toBe(false);
    expect(test('social-buzz', { social: 10, socialUsual: 1 }).pass).toBe(true);
    expect(test('social-buzz', { social: 303, socialUsual: 64 }).pass).toBe(true);
  });

  it('null fields never pass (fundamental, news, social)', () => {
    const cases: [ConditionId, Partial<AlertRow>][] = [
      ['pe-vs-sector', { peVsSector: null }], ['analyst-upside', { ptUpside: null }], ['piotroski', { piotroski: null }],
      ['earnings-surprise', { surprises: null }], ['insider-buying', { insiderNet90: null }], ['news-spike', { news: null }],
      ['news-spike', { newsUsual: null }], ['earnings-soon', { earningsDate: null }], ['grade-change', { grade: null }],
      ['social-buzz', { socialUsual: null }],
    ];
    for (const [id, o] of cases) expect(test(id, o), id).toEqual({ pass: false, value: null });
  });

  it('the catalog has 18 conditions in table order, each with a group, a chart and a short name', () => {
    expect(CONDITION_IDS).toEqual(['session-move', 'price-crosses', 'below-average', 'near-52w', 'volume-spike', 'pe-vs-sector',
      'undervalued', 'analyst-upside', 'piotroski', 'earnings-surprise', 'insider-buying', 'news-spike', 'earnings-soon',
      'grade-change', 'social-buzz', 'mega-caps', 'sector', 'one-stock']);
    for (const id of CONDITION_IDS) {
      const c = CONDITIONS[id];
      expect(c.group && c.chart && c.short(c.defaults), id).toBeTruthy();
    }
  });

  it('their facts read as plain English', () => {
    const f = (id: ConditionId, v: number | null, p: Params = {}) => CONDITIONS[id].fact({ ...CONDITIONS[id].defaults, ...p }, v);
    expect(f('earnings-surprise', 0.062)).toBe('beat estimates by 6.2%');
    expect(f('news-spike', 4.1)).toBe('had 4.1× its usual number of stories');
    expect(f('earnings-soon', 2)).toBe('reports earnings in 2 days');
    expect(f('grade-change', null)).toBe('was downgraded by an analyst');
    expect(f('insider-buying', 2.4e6)).toBe('saw $2.4M of net insider buying in 90 days');
  });
});

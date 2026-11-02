import { describe, expect, it } from 'vitest';
import { estimate, type AlertHistory, type AlertHistoryRow } from './estimate';
import { condition, type Rule } from './rule';

/** A made-up company on one day: what the nightly saw, with the day's low and high. */
function row(ticker: string, close: number, prevClose: number | null, more: Partial<AlertHistoryRow> = {}): AlertHistoryRow {
  return {
    ticker, name: ticker, logo: null, sector: 'Technology', marketCap: 300e9, close, prevClose,
    ma20: null, ma50: null, ma100: null, ma200: null, low52: null, high52: null, volumeRatio: null, peVsSector: null,
    undervalued: false, ptUpside: null, piotroski: null, checks: null, surprises: null, lastReport: null, insiderNet90: null,
    earningsDate: null, grade: null, news: null, newsUsual: null, social: null, socialUsual: null, low: close, high: close, ...more,
  };
}
/** Sessions a weekday apart from Monday 2 November 2026; `rows` per day. */
const DAYS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11',
  '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17'];
const history = (days: AlertHistoryRow[][]): AlertHistory => days.map((rows, i) => ({ session: DAYS[i]!, rows }));
/** One stock's closes, each day's previous close the day before's. */
const closes = (t: string, cs: number[]) => cs.map((c, i) => [row(t, c, i ? cs[i - 1]! : null)]);

const above100: Rule = { v: 1, all: [condition('price-crosses', { dir: 'above', price: 100 }), condition('one-stock', { ticker: 'AMD' })] };

describe('estimate', () => {
  it('needs two sessions: the first only says who met the rule before', () => {
    expect(estimate(above100, history([[row('AMD', 101, 99)]]))).toBeNull();
    expect(estimate(above100, history(closes('AMD', [101, 102])))).toEqual({ emails: 0, sessions: 1, perMonth: 0 });
  });

  it('a level fires each time a stock comes back to it, at most once a day', () => {
    // 99 → 101 enters, 102 stays, 99 leaves, 101 enters again
    expect(estimate(above100, history(closes('AMD', [99, 101, 102, 99, 101])))!.emails).toBe(2);
  });

  it('with "a week" a stock it fired for stays quiet for 7 days', () => {
    const weekly: Rule = { ...above100, once: 'week' };
    // enters on Nov 3 and Nov 5 (quiet), and again on Nov 11 (8 days later)
    expect(estimate(weekly, history(closes('AMD', [99, 101, 99, 101, 99, 99, 99, 101])))!.emails).toBe(2);
    expect(estimate(above100, history(closes('AMD', [99, 101, 99, 101, 99, 99, 99, 101])))!.emails).toBe(3);
  });

  it("a touch of the level during the day counts, by the day's high or low", () => {
    const days = [[row('AMD', 99, null)], [row('AMD', 99.5, 99, { low: 98, high: 100.4 })]];
    expect(estimate(above100, history(days))!.emails).toBe(1);
  });

  it('a stock that met it at the close before, dipped out and closed in again, came back in', () => {
    const days = [[row('AMD', 101, null)], [row('AMD', 102, 101, { low: 99, high: 102 })], [row('AMD', 103, 102, { low: 101, high: 103 })]];
    expect(estimate(above100, history(days))!.emails).toBe(1);
  });

  it("a condition on the session's own numbers starts again every session", () => {
    const drop: Rule = { v: 1, all: [condition('session-move', { dir: 'down', pct: 5 }), condition('one-stock', { ticker: 'AMD' })] };
    // −6% at the low on two sessions in a row: two emails, though it was still down at the first close
    const days = [[row('AMD', 100, null)], [row('AMD', 94, 100, { low: 94, high: 100 })], [row('AMD', 88, 94, { low: 88, high: 94 })]];
    expect(estimate(drop, history(days))!.emails).toBe(2);
  });

  it('a rule watching many stocks sends one email per stock that comes in, up to 3 a day, the rest in the evening summary', () => {
    const drop: Rule = { v: 1, all: [condition('session-move', { dir: 'down', pct: 5 })] };
    const quiet = ['A', 'B', 'C', 'D', 'E'].map((t) => row(t, 100, null));
    const two = ['A', 'B'].map((t) => row(t, 94, 100, { low: 94 })).concat(['C', 'D', 'E'].map((t) => row(t, 100, 100)));
    const five = ['A', 'B', 'C', 'D', 'E'].map((t) => row(t, 94, 100, { low: 94 }));
    expect(estimate(drop, history([quiet, two]))!.emails).toBe(2);
    expect(estimate(drop, history([quiet, five]))!.emails).toBe(4);
  });

  it("a rule of the nightly's numbers only fires after the nightly: one email a day, however many stocks", () => {
    const strong: Rule = { v: 1, all: [condition('piotroski', { side: 'high', score: 7 })] };
    const weak = ['A', 'B', 'C', 'D'].map((t) => row(t, 100, null, { piotroski: 5 }));
    const all = ['A', 'B', 'C', 'D'].map((t) => row(t, 100, 100, { piotroski: 8 }));
    expect(estimate(strong, history([weak, all]))!.emails).toBe(1);
  });

  it('scales the sessions it has to a month of 21', () => {
    // 10 sessions after the first, entering every other day: 5 emails → 10.5 a month
    const cs = [99, 101, 99, 101, 99, 101, 99, 101, 99, 101, 99];
    expect(estimate(above100, history(closes('AMD', cs)))).toEqual({ emails: 5, sessions: 10, perMonth: 11 });
  });
});

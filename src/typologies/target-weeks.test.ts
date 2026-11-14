import { describe, expect, it } from 'vitest';
import { AnalystsPayload, analystsDemo } from './analysts';
import { DEMO_ASOF } from './common';
import { targetWeeks, weeksOf, withPrev } from './target-weeks';

const row = (date: string, firm: string, target: number) => ({ date, firm, target });

describe('the average target week by week (analysts@1 weekly, the trend under the target chart)', () => {
  it('weeks are every 5th session back from the last one, oldest first, 52 at most', () => {
    const sessions = Array.from({ length: 300 }, (_, i) => `d${String(i).padStart(3, '0')}`);
    const w = weeksOf(sessions);
    expect(w).toHaveLength(52);
    expect(w.at(-1)).toBe('d299');
    expect(w[0]).toBe('d044');
    expect(weeksOf(sessions.slice(0, 12))).toEqual(['d001', 'd006', 'd011']);
  });
  it("a target's previous one is the same firm's, while it still stands (published in the 365 days before)", () => {
    const rows = [row('2025-01-10', 'A', 100), row('2025-06-01', 'A', 120), row('2025-06-01', 'B', 90), row('2026-07-01', 'A', 130)];
    expect(withPrev(rows).map((r) => r.prev)).toEqual([null, 100, null, null]);
    expect(withPrev(rows).map((r) => [r.date, r.firm, r.target])).toEqual(rows.map((r) => [r.date, r.firm, r.target]));
  });
  it("a week's mean is each firm's latest target in the 365 days up to it, null under 3 firms", () => {
    const rows = [row('2026-01-05', 'A', 100), row('2026-02-02', 'B', 200), row('2026-03-02', 'C', 300), row('2026-04-06', 'A', 160)];
    expect(targetWeeks(rows, ['2026-02-27', '2026-03-06', '2026-04-10', '2027-01-20', '2027-03-01'])).toEqual([
      { t: '2026-02-27', mean: null, n: 2 },
      { t: '2026-03-06', mean: 200, n: 3 },
      { t: '2026-04-10', mean: 220, n: 3 },
      { t: '2027-01-20', mean: 220, n: 3 },
      { t: '2027-03-01', mean: null, n: 2 }, // B's target of 2026-02-02 is over 365 days old
    ]);
  });
  it('a mean is rounded to cents', () => {
    const rows = [row('2026-01-05', 'A', 100), row('2026-01-05', 'B', 100), row('2026-01-05', 'C', 101)];
    expect(targetWeeks(rows, ['2026-01-09'])[0]!.mean).toBe(100.33);
  });
  it('the demo carries 52 weeks ending on its as-of date and a previous target on every target, and parses', () => {
    const a = analystsDemo({ ticker: 'NVDA', window: '1y' });
    expect(AnalystsPayload.safeParse(a).success).toBe(true);
    expect(a.weekly).toHaveLength(52);
    expect(a.weekly!.at(-1)!.t).toBe(DEMO_ASOF);
    expect(a.targets.length).toBeGreaterThan(0);
    for (const t of a.targets) expect(t).toHaveProperty('prev');
    expect(a.targets.every((t) => t.date > '2025-09-30')).toBe(true);
  });
});

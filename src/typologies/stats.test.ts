import { describe, expect, it } from 'vitest';
import { needKey } from '../api';
import { getTypology } from './index';
import { StatsParams, StatsPayload, statsDemo } from './stats';

describe('stats@1: a stock\'s last five years — how much it moves, its years, its falls and rises, how often it went up', () => {
  it('asks for one company by its ticker', () => {
    expect(StatsParams.parse({ ticker: 'NVDA' })).toEqual({ ticker: 'NVDA' });
    expect(StatsParams.parse({ ticker: 'BRK.B' })).toEqual({ ticker: 'BRK.B' });
    expect(StatsParams.safeParse({ ticker: 'nvda' }).success).toBe(false);
    expect(StatsParams.safeParse({}).success).toBe(false);
    expect(needKey({ t: 'stats@1', params: { ticker: 'NVDA' } })).toBe('stats@1|{"ticker":"NVDA"}');
    expect(getTypology('stats@1')).toBeTruthy();
  });

  it('the demo: a made-up company with three falls and three rises at 30%, SPY beside it — valid, the same twice', () => {
    const d = statsDemo(StatsParams.parse({ ticker: 'NVDA' }));
    expect(StatsPayload.safeParse(d).success).toBe(true);
    expect(d).toEqual(statsDemo({ ticker: 'NVDA' }));
    expect(d.threshold).toBe(0.3);
    expect(d.swings.filter((s) => s.kind === 'fall')).toHaveLength(3);
    expect(d.swings.filter((s) => s.kind === 'rise')).toHaveLength(3);
    expect(d.spy).not.toBeNull();
    expect(d.months.length).toBeGreaterThan(50);
    expect(d.months.some((m) => m.month === d.asOf.slice(0, 7))).toBe(false); // the current month is not closed
    expect(d.years.at(-1)!.soFar).toBe(true);
    expect(d.path.length).toBeGreaterThan(200);
  });

  it('a short history is a valid answer: no beta, no SPY, no swings', () => {
    const d = statsDemo({ ticker: 'MSFT' });
    expect(StatsPayload.safeParse({ ...d, beta: null, spy: null, swings: [], last: null, fullWindow: false, bestMonth: null, worstMonth: null }).success).toBe(true);
    expect(StatsPayload.safeParse({ ...d, swings: [{ ...d.swings[0], kind: 'up' }] }).success).toBe(false);
  });
});

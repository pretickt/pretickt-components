import { describe, expect, it } from 'vitest';
import { zigzag } from './zigzag';

const pt = (date: string, close: number) => ({ date, close });

// ported from beta (pretickt-backend/src/companies/swings.spec.ts), plus the cases the home's ongoing moves rely on
describe('zigzag', () => {
  const series = [
    pt('2026-01-01', 100),
    pt('2026-01-10', 130), // +30% drawup...
    pt('2026-01-20', 110), // ...confirmed by a -15.4% retreat → drawdown starts at 130
    pt('2026-02-01', 91), // -30% from 130
    pt('2026-02-10', 105), // +15.4% rebound → drawdown confirmed, drawup ongoing
  ];

  it('segments alternating swings at the threshold; the trailing one is ongoing', () => {
    const eps = zigzag(series, 10);
    expect(eps.map((e) => e.kind)).toEqual(['drawup', 'drawdown', 'drawup']);
    expect(eps[0]).toMatchObject({ start: '2026-01-01', end: '2026-01-10', ongoing: false });
    expect(eps[0]!.magnitude).toBeCloseTo(30);
    expect(eps[1]!.magnitude).toBeCloseTo(-30);
    expect(eps[1]!.days).toBe(22); // 01-10 → 02-01
    expect(eps[2]).toMatchObject({ start: '2026-02-01', end: '2026-02-10', ongoing: true });
    expect(eps[2]!.magnitude).toBeCloseTo((105 / 91 - 1) * 100);
  });
  it('ignores wiggles below the threshold', () => {
    expect(zigzag([pt('2026-01-01', 100), pt('2026-01-05', 105), pt('2026-01-09', 98), pt('2026-01-12', 103)], 10)).toEqual([]);
  });
  it('a higher threshold merges swings (the +15% tail is invisible at θ=25)', () => {
    expect(zigzag(series, 35)).toEqual([]);
    const eps = zigzag(series, 25);
    expect(eps.map((e) => e.kind)).toEqual(['drawup', 'drawdown']);
    expect(eps[1]!.ongoing).toBe(true);
  });
  it('at 4%: a running rally is the ongoing tail, measured from its trough to its latest peak', () => {
    const eps = zigzag([pt('2026-09-01', 100), pt('2026-09-02', 95), pt('2026-09-03', 99), pt('2026-09-04', 103), pt('2026-09-07', 102)], 4);
    const tail = eps.at(-1)!;
    expect(tail).toMatchObject({ kind: 'drawup', start: '2026-09-02', end: '2026-09-04', ongoing: true });
    expect(tail.magnitude).toBeCloseTo((103 / 95 - 1) * 100);
  });
  it('a reversal of exactly the threshold closes the swing, and the reversal is the new ongoing tail', () => {
    const eps = zigzag([pt('2026-09-01', 100), pt('2026-09-02', 110), pt('2026-09-03', 105.6)], 4); // 110 → 105.6 = -4.0%
    expect(eps.map((e) => [e.kind, e.ongoing])).toEqual([['drawup', false], ['drawdown', true]]);
    expect(eps[1]!.magnitude).toBeCloseTo(-4);
  });
  it('skips non-positive closes, and fewer than two usable points give nothing', () => {
    expect(zigzag([], 4)).toEqual([]);
    expect(zigzag([pt('2026-09-01', 100)], 4)).toEqual([]);
    expect(zigzag([pt('2026-09-01', 0), pt('2026-09-02', -5), pt('2026-09-03', 100)], 4)).toEqual([]);
    const eps = zigzag([pt('2026-09-01', 100), pt('2026-09-02', 0), pt('2026-09-03', 110)], 4);
    expect(eps.map((e) => [e.kind, e.start, e.magnitude.toFixed(1)])).toEqual([['drawup', '2026-09-01', '10.0']]);
  });
});

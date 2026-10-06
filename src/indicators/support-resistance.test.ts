import { describe, expect, it } from 'vitest';
import {
  swingPivots,
  clusterLevels,
  supportResistance,
} from './support-resistance';

describe('swingPivots', () => {
  it('finds local highs and lows over the window', () => {
    const s = [10, 12, 15, 12, 10, 8, 11, 14, 11, 9];
    const p = swingPivots(s, 2);
    expect(p.map((x) => ({ price: x.price, kind: x.kind }))).toEqual([
      { price: 15, kind: 'high' },
      { price: 8, kind: 'low' },
      { price: 14, kind: 'high' },
    ]);
  });
});

describe('clusterLevels', () => {
  it('merges pivots within tolerance and counts touches', () => {
    const levels = clusterLevels(
      [{ price: 100 }, { price: 102 }, { price: 140 }],
      0.05,
    );
    expect(levels).toHaveLength(2);
    expect(levels[0]).toMatchObject({ price: 101, touches: 2 });
    expect(levels[1]).toMatchObject({ price: 140, touches: 1 });
  });

  it('carries what each cluster is MADE OF, not just where it sits', () => {
    const levels = clusterLevels(
      [
        { price: 100, kind: 'high' as const },
        { price: 102, kind: 'high' as const },
        { price: 140, kind: 'low' as const },
      ],
      0.05,
    );
    expect(levels[0]).toMatchObject({ touches: 2, highs: 2, lows: 0 });
    expect(levels[1]).toMatchObject({ touches: 1, highs: 0, lows: 1 });
  });

  it('caps the cluster span so chain-merging cannot blur distinct levels', () => {
    const pivots = [{ price: 100 }, { price: 104 }, { price: 107 }];
    // Without a cap the running mean chains all three into one blurred level…
    expect(clusterLevels(pivots, 0.05)).toEqual([
      { price: (100 + 104 + 107) / 3, touches: 3, highs: 0, lows: 0 },
    ]);
    // …with maxSpanPct the third point (span 7% > 5%) starts a new cluster.
    expect(clusterLevels(pivots, 0.05, 0.05)).toEqual([
      { price: 102, touches: 2, highs: 0, lows: 0 },
      { price: 107, touches: 1, highs: 0, lows: 0 },
    ]);
  });
});

describe('supportResistance', () => {
  it('classifies levels vs the current price with distance + near', () => {
    // current = last close = 103; pivots → low 95, high 105
    const s = [100, 105, 100, 95, 100, 105, 100, 103];
    const sr = supportResistance(s, {
      tolPct: 0.05,
      window: 2,
      maxEach: 5,
      minTouches: 1,
    });
    expect(sr.current).toBe(103);
    expect(sr.resistances.map((l) => l.price)).toEqual([105]);
    expect(sr.resistances[0]!.near).toBe(true); // (105-103)/103 = 1.9% ≤ 5%
    expect(sr.resistances[0]!.distPct).toBeCloseTo(1.94, 1);
    expect(sr.supports.map((l) => l.price)).toEqual([95]);
    expect(sr.supports[0]!.near).toBe(false); // -7.8%
  });

  it('merges at half the near-tolerance, keeping close-but-distinct levels apart', () => {
    // window 1 → lows at 95, 99, 98.5 and highs at 100, 100; current = 103.
    // Old behavior (merge at tolPct 5%) chained everything into one ~98.5 support;
    // merging at tolPct/2 keeps 95 separate from the 98.5–100 zone.
    const s = [100, 95, 100, 99, 100, 98.5, 100, 103];
    const sr = supportResistance(s, {
      tolPct: 0.05,
      window: 1,
      maxEach: 5,
      minTouches: 1,
    });
    expect(sr.supports.map((l) => Math.round(l.price * 100) / 100)).toEqual([
      99.38, 95,
    ]);
    expect(sr.supports[0]!.near).toBe(true); // near flag still uses the full 5%
  });

  it('returns empty lists for a too-short series', () => {
    expect(supportResistance([1, 2, 3], { window: 5 })).toEqual({
      current: 3,
      resistances: [],
      supports: [],
    });
  });
});

describe('a level is judged by what it is made of, not by which side of today it lands on', () => {
  /** Price rejected twice at ~224, then closed a hair above it — NVDA on 2026-08-14. */
  const brokenCeiling = [
    200, 210, 224, 212, 205, 214, 224.2, 213, 206, 212, 218, 222, 225.16,
  ];

  it('flags a freshly broken ceiling instead of quietly calling it support', () => {
    const sr = supportResistance(brokenCeiling, {
      tolPct: 0.05,
      window: 2,
      maxEach: 5,
    });
    const lvl = sr.supports.find((l) => Math.abs(l.price - 224) < 2);
    expect(lvl).toBeDefined();
    // it still sits below the close, so it is listed under supports…
    expect(lvl!.price).toBeLessThan(sr.current!);
    // …but it is made of highs, and the page can now say so
    expect(lvl!.kind).toBe('ceiling');
    expect(lvl!.flipped).toBe(true);
  });

  it('does not flag a floor that price is genuinely holding above', () => {
    // troughs at ~200 that price bounced off, with the close well clear of them
    const realFloor = [220, 205, 200, 212, 224, 201, 199.5, 214, 226, 231, 240];
    const sr = supportResistance(realFloor, {
      tolPct: 0.05,
      window: 2,
      maxEach: 5,
    });
    const lvl = sr.supports.find((l) => l.price < 210);
    expect(lvl?.kind).toBe('floor');
    expect(lvl?.flipped).toBe(false);
  });

  it('refuses to call a single swing a level at all', () => {
    // one lonely high at 224 — an incident, not a shelf
    const onePivot = [200, 205, 224, 208, 203, 207, 210, 214, 225];
    const sr = supportResistance(onePivot, { tolPct: 0.05, window: 2 });
    expect(sr.supports.every((l) => l.touches >= 2)).toBe(true);
    expect(
      sr.supports.find((l) => Math.abs(l.price - 224) < 2),
    ).toBeUndefined();
    // …unless a caller explicitly asks for single-touch levels
    expect(
      supportResistance(onePivot, { tolPct: 0.05, window: 2, minTouches: 1 })
        .supports.length,
    ).toBeGreaterThan(0);
  });
});

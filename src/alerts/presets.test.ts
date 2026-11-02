import { describe, expect, it } from 'vitest';
import { CONDITIONS, type ConditionId } from './catalog';
import { presets } from './presets';

const spec = (id: ConditionId, key: string) => CONDITIONS[id].params.find((s) => s.key === key) as Parameters<typeof presets>[0];

describe('presets: the values above and below a percentage or a price being edited (Romeo, 2026-11-02)', () => {
  it('a percentage: the two nearest round ones on each side, nearest first, within its limits and on its step', () => {
    expect(presets(spec('session-move', 'pct'), 5)).toEqual({ up: [7.5, 10], down: [4, 3] });
    expect(presets(spec('session-move', 'pct'), 20)).toEqual({ up: [], down: [15, 10] });          // its most
    expect(presets(spec('session-move', 'pct'), 1)).toEqual({ up: [1.5, 2], down: [] });           // its least
    expect(presets(spec('session-move', 'pct'), 6.5)).toEqual({ up: [7.5, 10], down: [5, 4] });     // a typed one in between
    expect(presets(spec('below-average', 'pct'), 5)).toEqual({ up: [10, 15], down: [4, 3] });       // step 1: no 7.5
    expect(presets(spec('pe-vs-sector', 'pct'), 20)).toEqual({ up: [25, 30], down: [15, 10] });    // step 5
    expect(presets(spec('near-52w', 'pct'), 2)).toEqual({ up: [3, 4], down: [1.5, 1] });
  });

  it('a price: about ±5% and ±10%, rounded to two significant digits, nearest first, never the value itself', () => {
    expect(presets(spec('price-crosses', 'price'), 160.07)).toEqual({ up: [170, 180], down: [150, 140] });
    expect(presets(spec('price-crosses', 'price'), 92.1)).toEqual({ up: [97, 100], down: [87, 83] });
    expect(presets(spec('price-crosses', 'price'), 3.47)).toEqual({ up: [3.6, 3.8], down: [3.3, 3.1] });
    expect(presets(spec('price-crosses', 'price'), 150)).toEqual({ up: [160, 170], down: [140, 130] });
    expect(presets(spec('price-crosses', 'price'), 1)).toEqual({ up: [1.1, 1.2], down: [0.95, 0.9] });
  });
});

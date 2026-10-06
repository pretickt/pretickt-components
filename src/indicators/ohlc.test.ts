import { describe, expect, it } from 'vitest';
import { trueRange, atr } from './ohlc';

const n = 40;
const upC = Array.from({ length: n }, (_, i) => 100 + i);
const upH = upC.map((c) => c + 1);
const upL = upC.map((c) => c - 1);
const downC = Array.from({ length: n }, (_, i) => 140 - i);
const downH = downC.map((c) => c + 1);
const downL = downC.map((c) => c - 1);

describe('trueRange / atr', () => {
  it('true range takes the largest of the three ranges', () => {
    // bar 1: h-l = 2, |h - prevClose| = |12-5| = 7, |l - prevClose| = |10-5| = 5 -> 7
    expect(trueRange([6, 12], [4, 10], [5, 11])[1]).toBe(7);
  });

  it('atr is Wilder-smoothed and warms up after `period` bars', () => {
    const a = atr(upH, upL, upC, 14);
    expect(a[13]).toBeNull();
    // steady +1/bar series with high=close+1, low=close-1: TR = max(2, 2, 0) = 2 every bar
    expect(a[14]).toBeCloseTo(2, 8);
    expect(a[39]).toBeCloseTo(2, 8);
  });
});


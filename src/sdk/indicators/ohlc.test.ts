import { describe, expect, it } from 'vitest';
import {
  stochastic,
  obv,
  slope,
  trueRange,
  atr,
  realizedVol,
  avgDollarVolume,
  volumeStart,
} from './ohlc';

const n = 40;
const upC = Array.from({ length: n }, (_, i) => 100 + i);
const upH = upC.map((c) => c + 1);
const upL = upC.map((c) => c - 1);
const downC = Array.from({ length: n }, (_, i) => 140 - i);
const downH = downC.map((c) => c + 1);
const downL = downC.map((c) => c - 1);

describe('stochastic', () => {
  it('uses true highs/lows and is ~93 at the top, ~7 at the bottom of the range', () => {
    const s = stochastic(upH, upL, upC, 14, 3);
    // bars 26..39: highs 127..140 -> hi 140, lows 125..138 -> lo 125; (139-125)/(140-125) = 93.33
    expect(s.k[39]).toBeCloseTo(93.3333, 3);
    expect(s.k[12]).toBeNull();
    expect(stochastic(downH, downL, downC, 14, 3).k[39]).toBeCloseTo(6.6667, 3);
  });

  it('%D is the 3-period SMA of %K and warms up 2 bars later', () => {
    const s = stochastic(upH, upL, upC, 14, 3);
    expect(s.d[13]).toBeNull();
    expect(s.d[14]).toBeNull();
    expect(s.d[15]).toBeCloseTo((s.k[13]! + s.k[14]! + s.k[15]!) / 3, 8);
  });

  it('returns 50 for a flat range instead of dividing by zero', () => {
    const flat = Array(20).fill(10);
    expect(stochastic(flat, flat, flat, 14, 3).k[19]).toBe(50);
  });
});

describe('obv', () => {
  it('adds volume on up closes, subtracts on down closes, ignores unchanged', () => {
    expect(obv([10, 11, 11, 9, 12], [100, 200, 300, 400, 500])).toEqual([0, 200, 200, -200, 300]);
  });
});

describe('slope', () => {
  it('is the least-squares slope of the trailing window', () => {
    expect(slope([1, 2, 3, 4, 5], 5)[4]).toBeCloseTo(1, 8);
    expect(slope([5, 4, 3, 2, 1], 5)[4]).toBeCloseTo(-1, 8);
    expect(slope([1, 2, 3, 4, 5], 5)[3]).toBeNull();
  });

  it('is null when the window contains a null', () => {
    expect(slope([null, 2, 3], 3)[2]).toBeNull();
  });
});

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

describe('realizedVol', () => {
  it('is 0 for a constant series and positive for a noisy one', () => {
    const flat = Array(40).fill(50);
    expect(realizedVol(flat, 20)[39]).toBeCloseTo(0, 10);
    const zig = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 100 : 105));
    expect(realizedVol(zig, 20)[39]).toBeGreaterThan(0.5);
    expect(realizedVol(flat, 20)[19]).toBeNull();
  });
});

describe('avgDollarVolume', () => {
  it('averages close × volume over the window', () => {
    const c = [10, 10, 10, 20];
    const v = [1, 1, 1, 1];
    expect(avgDollarVolume(c, v, 4)[3]).toBeCloseTo((10 + 10 + 10 + 20) / 4, 8);
    expect(avgDollarVolume(c, v, 4)[2]).toBeNull();
  });
});

describe('volumeStart', () => {
  it('is the first index of the unbroken non-null volume run ending at the last bar', () => {
    expect(volumeStart([null, null, 1, 2, 3])).toBe(2);
    expect(volumeStart([1, null, 2, null, 3])).toBe(4);
    expect(volumeStart([1, 2, 3])).toBe(0);
    expect(volumeStart([1, 2, null])).toBe(3);
  });
});


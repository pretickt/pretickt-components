import { describe, expect, it } from 'vitest';
import { dailySigmaPct, vectorise, SCALES } from './pivots';
import type { Bar } from './types';

/** Bars on consecutive calendar days from a close series. */
const bars = (closes: number[]): Bar[] =>
  closes.map((close, i) => ({
    date: new Date(Date.UTC(2020, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
    close,
  }));

/** A deterministic zigzag: `legs` alternating moves of `amp`% spread over `len` bars each. */
const sawtooth = (legs: number, len: number, amp: number, start = 100): number[] => {
  const out = [start];
  for (let l = 0; l < legs; l++) {
    const dir = l % 2 === 0 ? 1 : -1;
    for (let i = 0; i < len; i++) out.push(out[out.length - 1]! * (1 + (dir * amp) / 100 / len));
  }
  return out;
};

describe('dailySigmaPct', () => {
  it('measures the trailing window only', () => {
    const calm = Array.from({ length: 300 }, (_, i) => 100 + (i % 2) * 0.1);
    const wild = Array.from({ length: 300 }, (_, i) => 100 + (i % 2) * 10);
    const b = bars([...calm, ...wild]);
    const early = dailySigmaPct(b, 299)!;
    const late = dailySigmaPct(b, 599)!;
    expect(early).toBeLessThan(late / 5); // the calm window never sees the storm
  });

  it('returns null before a full window exists', () => {
    expect(dailySigmaPct(bars([100, 101, 102]), 2)).toBeNull();
  });
});

describe('vectorise', () => {
  const opts = { k: 1, sigmaWindow: 20, epochLen: 20 };

  it('produces alternating legs with signed magnitudes and durations', () => {
    // 14 legs, not 8: the first ~2 are eaten by the sigma warm-up and the direction bootstrap
    const v = vectorise(bars(sawtooth(14, 12, 20)), opts);
    expect(v.legs.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < v.legs.length; i++) expect(v.legs[i]!.up).toBe(!v.legs[i - 1]!.up);
    for (const leg of v.legs) {
      expect(leg.days).toBeGreaterThan(0);
      expect(Math.sign(leg.pct)).toBe(leg.up ? 1 : -1);
      expect(leg.to.kind).toBe(leg.up ? 'peak' : 'trough');
    }
  });

  it('marks every pivot as knowable strictly AFTER it happened', () => {
    const v = vectorise(bars(sawtooth(8, 12, 20)), opts);
    expect(v.pivots.length).toBeGreaterThan(0);
    for (const p of v.pivots) {
      expect(p.knowableIdx).toBeGreaterThan(p.idx); // the extreme is recognised only in arrears
      expect(p.knowableFrom > p.date).toBe(true);
    }
  });

  it('IS PREFIX-STABLE: what it says about the past never changes as the future arrives', () => {
    // The whole point-in-time guarantee in one property. If any part of the layer — sigma, the
    // epoch schedule, the pivot search — peeked ahead, truncating the series would move a pivot.
    const closes = sawtooth(14, 11, 18);
    const full = vectorise(bars(closes), opts);
    for (const cut of [120, 160, 200]) {
      const prefix = vectorise(bars(closes.slice(0, cut)), opts);
      const shared = prefix.pivots.filter((p) => p.knowableIdx < cut - 1);
      expect(shared.length).toBeGreaterThan(0);
      shared.forEach((p, i) => {
        expect(full.pivots[i]!.idx).toBe(p.idx);
        expect(full.pivots[i]!.knowableIdx).toBe(p.knowableIdx);
        expect(full.pivots[i]!.price).toBeCloseTo(p.price, 10);
      });
    }
  });

  it('scales the threshold with volatility, so a calm and a wild name give comparable leg counts', () => {
    const calm = vectorise(bars(sawtooth(10, 12, 4)), opts);
    const wild = vectorise(bars(sawtooth(10, 12, 40)), opts);
    expect(Math.abs(calm.legs.length - wild.legs.length)).toBeLessThanOrEqual(2);
  });

  it('exposes the three named scales, coarser as k grows', () => {
    expect(SCALES.fast).toBeLessThan(SCALES.mid);
    expect(SCALES.mid).toBeLessThan(SCALES.slow);
    const closes = sawtooth(20, 9, 15);
    const fast = vectorise(bars(closes), { ...opts, k: SCALES.fast });
    const slow = vectorise(bars(closes), { ...opts, k: SCALES.slow });
    expect(fast.legs.length).toBeGreaterThanOrEqual(slow.legs.length);
  });

  it('returns nothing for a series too short to estimate volatility', () => {
    expect(vectorise(bars([100, 101, 102]), { k: 3 }).legs).toEqual([]);
  });
});

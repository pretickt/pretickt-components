import { describe, expect, it } from 'vitest';
import { technicalSnapshot, type TechnicalBar } from './technicals';

/** `n` bars walking a deterministic path; `shape` bends the last close. */
function bars(n: number, priceAt: (i: number) => number): TechnicalBar[] {
  return Array.from({ length: n }, (_, i) => {
    const close = priceAt(i);
    return {
      date: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000_000,
    };
  });
}

describe('technicalSnapshot', () => {
  it('refuses to guess without enough history', () => {
    expect(technicalSnapshot(bars(29, () => 100))).toBeNull();
  });

  it('reads a flat series as mid-band with the moving averages on top of the price', () => {
    const s = technicalSnapshot(bars(120, () => 100))!;
    expect(s.close).toBe(100);
    expect(s.movingAverages.map((m) => m.value)).toEqual([100, 100, 100, null]); // no MA200 yet
    expect(s.movingAverages[0]!.distPct).toBeCloseTo(0, 6);
    // zero variance ⇒ the band collapses onto the mean
    expect(s.bollinger.widthPct).toBeCloseTo(0, 6);
    expect(s.bollinger.state).toBe('upper half'); // close === mid counts as the upper half
  });

  it('puts a spike above the upper band and reports how far across it sits', () => {
    const b = bars(120, (i) => 100 + Math.sin(i / 3));
    b[b.length - 1]!.close = 130;
    const s = technicalSnapshot(b)!;
    expect(s.bollinger.state).toBe('above upper');
    expect(s.bollinger.percentB!).toBeGreaterThan(1);
    expect(s.rsi14).toBeGreaterThan(50);
  });

  it('flags a close that came back inside the band after piercing it', () => {
    const b = bars(120, (i) => 100 + Math.sin(i / 3));
    b[b.length - 2]!.close = 130; // yesterday pierced
    const s = technicalSnapshot(b)!;
    expect(s.bollinger.reentered).toBe(true);
  });

  it('carries the session it speaks for, not today', () => {
    const b = bars(60, () => 100);
    expect(technicalSnapshot(b)!.asOf).toBe(b[b.length - 1]!.date);
  });

  it('measures ATR against the price and volume against its own 20-day average', () => {
    const b = bars(120, () => 100);
    b[b.length - 1]!.volume = 3_000_000;
    const s = technicalSnapshot(b)!;
    expect(s.atrPct).toBeGreaterThan(0);
    expect(s.volume.ratio).toBeGreaterThan(1.5);
  });

  it('turns a steady climb into a positive MACD histogram and a stretched RSI', () => {
    const s = technicalSnapshot(bars(200, (i) => 100 * 1.004 ** i))!;
    expect(s.macd.histogram).toBeGreaterThan(0);
    expect(s.rsi14).toBeGreaterThan(70);
    expect(s.movingAverages.every((m) => m.distPct === null || m.distPct > 0)).toBe(true);
  });
});

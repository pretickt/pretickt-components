import { describe, expect, it } from 'vitest';
import { trend } from './trend';

const NOW = Date.parse('2026-07-01');
const DAY = 86_400_000;

/** `n` daily bars ending at NOW; close = fn(indexFromOldest). */
function series(n: number, fn: (k: number) => number) {
  const out: { date: string; close: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push({ date: new Date(NOW - i * DAY).toISOString().slice(0, 10), close: fn(n - 1 - i) });
  }
  return out;
}

describe('trend', () => {
  it('rising series → positive 3m change and up regime', () => {
    const r = trend(series(210, (k) => 100 + k), NOW);
    expect(r.changePct!).toBeGreaterThan(0);
    expect(r.regime).toBe('up');
  });

  it('falling series → negative 3m change and down regime', () => {
    const r = trend(series(210, (k) => 300 - k), NOW);
    expect(r.changePct!).toBeLessThan(0);
    expect(r.regime).toBe('down');
  });

  it('short series → null change and null regime', () => {
    const r = trend(series(30, (k) => 100 + k), NOW);
    expect(r.changePct).toBeNull();
    expect(r.regime).toBeNull();
  });

  it('empty series → nulls', () => {
    expect(trend([], NOW)).toEqual({ changePct: null, regime: null });
  });
});

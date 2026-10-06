import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lintSfc } from '../checks/lint';
import * as ind from './index';

describe('indicators entry point', () => {
  it('one simple moving average: sma (series) and smaLast (last value); no second implementation', () => {
    expect(ind).not.toHaveProperty('movingAverage');
    expect(ind.smaLast([1, 2, 3, 4], 2)).toBe(3.5);
    expect(ind.smaLast([1], 2)).toBeNull();
    expect(ind.smaLast([1, 2, 3, 4], 2)).toBe(ind.sma([1, 2, 3, 4], 2).at(-1));
  });
  it('barsOf turns price-series points into the bars every indicator reads', () => {
    expect(ind.barsOf([{ t: '2026-10-01', o: 1, h: 3, l: 0.5, c: 2, v: 10 }])).toEqual([{ date: '2026-10-01', open: 1, high: 3, low: 0.5, close: 2, volume: 10 }]);
    const snap = ind.technicalSnapshot(ind.barsOf(Array.from({ length: 40 }, (_, i) => ({ t: `2026-01-${String(i + 1).padStart(2, '0')}`, o: 100, h: 101, l: 99, c: 100, v: 1e6 }))));
    expect(snap!.close).toBe(100);
  });
  it('every indicator passes the component lint rules (pure, deterministic, no network)', () => {
    const dir = new URL('.', import.meta.url).pathname;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
      const asScript = `<script setup lang="ts">\n${readFileSync(dir + f, 'utf8')}\n</script>`; // its own relative imports aside
      expect(lintSfc(asScript).filter((x) => !/^\d+: import "\./.test(x)), f).toEqual([]);
    }
  });
});

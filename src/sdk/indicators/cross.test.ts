import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lintSource } from '../lint';
import { maCrossEta } from './cross';

const ramp = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

describe('maCrossEta', () => {
  it('estimates the sessions until MA20 crosses MA50 at the current drift', () => {
    // falling then rising: MA20 below MA50 and closing the gap
    const closes = [...ramp(80, (i) => 200 - i), ...ramp(15, (i) => 121 + i * 3)];
    const r = maCrossEta(closes)!;
    expect(r.fast).toBeLessThan(r.slow);
    expect(r.direction).toBe('up');
    expect(r.inSessions).toBeGreaterThan(0);
    expect(r.inSessions).toBeLessThan(60);
  });
  it('reports a recent cross instead of a forecast', () => {
    const closes = [...ramp(80, (i) => 100 + i), ...ramp(30, (i) => 179 - i * 4)];
    const r = maCrossEta(closes)!;
    expect(r.lastCross?.direction).toBe('down');
    expect(r.lastCross!.sessionsAgo).toBeGreaterThanOrEqual(0);
  });
  it('returns null when the gap is widening or history is short', () => {
    expect(maCrossEta(ramp(40, (i) => 100 + i))).toBeNull();
    const widening = ramp(120, (i) => 100 + i * i * 0.01);
    expect(maCrossEta(widening)?.inSessions ?? null).toBeNull();
  });
});

describe('indicators are safe to run inside components', () => {
  it('pass the component lint rules (pure, deterministic, no network)', () => {
    const dir = new URL('.', import.meta.url).pathname;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
      const v = lintSource(readFileSync(dir + f, 'utf8'), f).filter((x) => x.rule !== 'import');
      expect(v, f).toEqual([]);
    }
  });
});

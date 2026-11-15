import { describe, expect, it } from 'vitest';
import { badgeValue } from './format';

describe('a multiple in the thousands', () => {
  it('reads «>999x»: earnings near zero make a P/E of 6,456 that says nothing (CrowdStrike on www, 2026-11-15)', () => {
    const b = (value: number) => badgeValue({ key: 'pe', label: 'P/E', value, text: null, unit: 'x', delta: null, tone: 'flat', range: null, icon: null, hint: '', asOf: '2026-11-13' } as never);
    expect(b(6456.1)).toBe('>999x');
    expect(b(732.4)).toBe('732.4x');
    expect(b(39.7)).toBe('39.7x');
  });
});

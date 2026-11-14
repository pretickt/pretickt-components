import { describe, expect, it } from 'vitest';
import { picGeometry } from './pic';

describe("an alert's small picture (the bell's panel, later the email's)", () => {
  it('the line, its second line and the levels share one scale; the dot sits on the marked point', () => {
    const g = picGeometry({ c: [1, 2, 3], lv: [4] }, 100, 20);
    expect(Number(g.levels[0])).toBe(2); // the highest value, at the top padding
    const lastY = Number(g.line.split(' ').at(-1)!.split(',')[1]);
    expect(lastY).toBeGreaterThan(2);
    expect(g.line.startsWith('M2.0,')).toBe(true);
    expect(g.dot).toEqual({ x: 98, y: lastY }); // no mark: the last point
    expect(picGeometry({ c: [1, 2, 3], at: 0 }, 100, 20).dot!.x).toBe(2);
    const two = picGeometry({ c: [1, 2], c2: [0, 10] }, 100, 20);
    expect(two.line2).not.toBeNull();
    expect(Number(two.line2!.split(' ')[0]!.split(',')[1])).toBe(18); // 0 is the lowest of both lines: the bottom padding
  });
  it('a band (RSI 30–70) is drawn and widens the scale; a flat line sits in the middle', () => {
    const g = picGeometry({ c: [60, 72], band: [30, 70] }, 100, 20);
    expect(g.band!.y1).toBeLessThan(g.band!.y2);
    const flat = picGeometry({ c: [5, 5, 5] }, 100, 20);
    expect(flat.line).toBe('M2.0,10.0 L50.0,10.0 L98.0,10.0');
  });
});

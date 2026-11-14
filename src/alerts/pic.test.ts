import { describe, expect, it } from 'vitest';
import { picGeometry, picSvg } from './pic';

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
  it("an alert's picture as an SVG of its own (the email's PNG): size, line in its tone, dashed levels, the dot, no text", () => {
    const svg = picSvg({ c: [1, 2, 3], lv: [4], band: [0, 1] }, 280, 80, 'neg', 2);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="560" height="160" viewBox="0 0 280 80"')).toBe(true);
    expect(svg).toContain('stroke="#d64545"');
    expect(svg.match(/stroke-dasharray/g)).toHaveLength(1);
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(svg).toContain('<rect width="280" height="80" fill="#ffffff"/>');
    expect(svg).not.toContain('<text');
    expect(picSvg({ c: [1, 2], c2: [2, 1] }, 280, 80, 'flat')).toContain('width="280"');
  });
});

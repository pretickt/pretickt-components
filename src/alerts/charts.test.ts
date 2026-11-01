import { describe, expect, it } from 'vitest';
import { CONDITION_IDS } from './catalog';
import { chartOf, placeLabels, PLOT_L, PLOT_R, type LevelChart, type LogosChart } from './charts';
import { GLYPHS } from './glyphs';
import { MOCK_UNIVERSE } from './mock';
import { condition } from './rule';
import { rowsOf, type AlertRow } from './rows';

const rows = rowsOf(MOCK_UNIVERSE, null);
const amd = rows.find((r) => r.ticker === 'AMD')!;
const level = (m: ReturnType<typeof chartOf>) => m as LevelChart;

describe("version A's charts", () => {
  it('placeLabels keeps labels apart', () => {
    expect(placeLabels([57, 66, 82], 16, 6, 100)).toEqual([57, 73, 89]);
    expect(placeLabels([82, 57, 66], 16, 6, 100)).toEqual([89, 57, 73]);   // input order kept
  });

  it('placeLabels stays inside the plot', () => {
    expect(placeLabels([90, 95], 16, 6, 100)).toEqual([84, 100]);
  });

  it('session chart marks where the line crosses the alert level', () => {
    const row: AlertRow = { ...amd, prevClose: 100, price: 92.1, move: -0.079 };
    const m = level(chartOf(condition('session-move'), { row, rows, bars: [100, 99, 97, 94.5, 92.1] }));
    expect(m.kind).toBe('level');
    const xs = [1, 2, 3, 4, 5].map((i) => PLOT_L + (i / 78) * (PLOT_R - PLOT_L));
    // -3% at bar 3, -5.5% at bar 4: -5% is 80% of the way
    expect(m.cross!.x).toBeCloseTo(xs[2]! + 0.8 * (xs[3]! - xs[2]!), 6);
  });

  it('session chart zone lies below for falls and above for rises', () => {
    const row: AlertRow = { ...amd, prevClose: 100, price: 92.1, move: -0.079 };
    const down = level(chartOf(condition('session-move'), { row, rows, bars: [100, 97, 92.1] }));
    const alert = down.levels.find((l) => l.caption === 'ALERT')!;
    expect(down.zone!.y).toBeCloseTo(alert.y, 6);
    expect(down.zone!.y + down.zone!.h).toBeGreaterThan(alert.y);
    const upRow: AlertRow = { ...amd, prevClose: 100, price: 107, move: 0.07 };
    const up = level(chartOf(condition('session-move', { dir: 'up' }), { row: upRow, rows, bars: [100, 103, 107] }));
    const upAlert = up.levels.find((l) => l.caption === 'ALERT')!;
    expect(up.zone!.y + up.zone!.h).toBeCloseTo(upAlert.y, 6);
    expect(up.zone!.tone).toBe('pos');
  });

  it('session chart labels -5% ALERT, -7.9% NOW and the previous close', () => {
    const row: AlertRow = { ...amd, prevClose: 100, price: 92.1, move: -0.079 };
    const m = level(chartOf(condition('session-move'), { row, rows, bars: [100, 97, 92.1] }));
    expect(m.levels.map((l) => [l.label, l.caption])).toEqual([['0%', 'PREV CLOSE'], ['-5%', 'ALERT'], ['-7.9%', 'NOW']]);
    expect(m.levels[2]!.now).toBe(true);
    expect(m.ticks.map((t) => t.label)).toEqual(['9:30', '12:00', '4:00']);
  });

  it('average chart measures the distance from the chosen average', () => {
    // 80 flat closes at 100, then the price at 76: 24% under the 50-day average
    const closes = Array.from({ length: 80 }, (_, i) => ({ t: `2026-${String(7 + Math.floor(i / 21)).padStart(2, '0')}-${String(1 + (i % 21)).padStart(2, '0')}`, c: 100 }));
    const row: AlertRow = { ...amd, price: 76, ma50: 100 };
    const m = level(chartOf(condition('below-average'), { row, rows, closes }));
    expect(m.levels.map((l) => [l.label, l.caption])).toEqual([['MA50', 'AVERAGE'], ['-15%', 'ALERT'], ['-24%', 'NOW']]);
    expect(m.line).toMatch(/^M/);
  });

  it('versus chart sets the alert level at times × usual', () => {
    const row: AlertRow = { ...amd, news: 12, newsUsual: 3 };
    const m = level(chartOf(condition('news-spike'), { row, rows }));
    expect(m.levels.find((l) => l.caption === 'ALERT')!.label).toBe('9');
    expect(m.bars.map((b) => b.label)).toEqual(['USUAL', 'OCT 30']);   // the session the count is from, never "today" on a weekend
    expect(m.bars[1]!.tone).toBe('hit');
  });

  it('logos chart lists the 12 largest and counts the rest', () => {
    const m = chartOf(condition('mega-caps'), { row: null, rows }) as LogosChart;
    expect(m.kind).toBe('logos');
    expect(m.rows.map((r) => r.ticker).slice(0, 3)).toEqual(['NVDA', 'MSFT', 'AAPL']);
    expect(m.rows).toHaveLength(12);
    expect(m.more).toBe(49);
  });

  it('no example row → null', () => {
    expect(chartOf(condition('session-move'), { row: null, rows })).toBeNull();
    expect(chartOf(condition('below-average'), { row: null, rows })).toBeNull();
  });

  it('every condition id has a glyph and a chart for the example', () => {
    for (const id of CONDITION_IDS) {
      expect(GLYPHS[id]?.length, id).toBeGreaterThan(0);
      const m = chartOf(condition(id), { row: amd, rows, bars: [160, 155, 151], closes: Array.from({ length: 300 }, (_, i) => ({ t: `2026-01-01`, c: 150 + (i % 7) })) });
      expect(m, id).not.toBeNull();
    }
  });
});

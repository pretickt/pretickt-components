import { describe, expect, it } from 'vitest';
import { checkMarkup } from './markup';
import { helpers as h } from './helpers';
import { closeAt, isoDay, linePath, monthTicks } from '../ds/chart';

describe('no-code controls', () => {
  it('h.set writes an escaped data-set attribute, whatever the value', () => {
    expect(h.set({ range: '5y' })).toBe('data-set="{&quot;range&quot;:&quot;5y&quot;}"');
    expect(h.set({ name: `O'Reilly "x"` })).toBe('data-set="{&quot;name&quot;:&quot;O&#39;Reilly \\&quot;x\\&quot;&quot;}"');
  });
  it('h.toggles is the whole button group, with role, label and the pressed one', () => {
    const t = h.toggles('range', [['1y', '1Y'], ['5y', '5Y']], '5y', 'Range');
    expect(t).toBe('<div class="pt-toggles" role="group" aria-label="Range">' +
      '<button type="button" data-set="{&quot;range&quot;:&quot;1y&quot;}" aria-pressed="false">1Y</button>' +
      '<button type="button" data-set="{&quot;range&quot;:&quot;5y&quot;}" aria-pressed="true">5Y</button></div>');
  });
});

describe('formatters', () => {
  it('h.usd: one dollar formatter, compact or not, signed or not, never "-$0"', () => {
    expect(h.usd(1_234.5)).toBe('$1,234.50');
    expect(h.usd(-1_052_600_000, { compact: true })).toBe('-$1.05B');
    expect(h.usd(5_649_000_000_000, { compact: true })).toBe('$5.65T');
    expect(h.usd(2e8, { compact: true, signed: true })).toBe('+$200M');
    expect(h.usd(-0.3, { compact: true })).toBe('$0');
    expect(h.usd(-0.004)).toBe('$0.00');
    expect(h.usd(null)).toBe('—');
    expect(h.money(-0.004)).toBe('$0.00');
  });
  it('h.level: a fraction shown as a level, without a plus sign', () => {
    expect(h.level(0.1234)).toBe('12.3%');
    expect(h.level(-0.05)).toBe('-5.0%');
    expect(h.level(null)).toBe('—');
  });
  it('h.amount: cash amounts with 2 to 4 decimals (dividends)', () => {
    expect(h.amount(0.2625)).toBe('$0.2625');
    expect(h.amount(0.26)).toBe('$0.26');
    expect(h.amount(0.5)).toBe('$0.50');
    expect(h.amount(1.1)).toBe('$1.10');
    expect(h.amount(-0.00001)).toBe('$0.00');
  });
  it('h.month and h.stockHref', () => {
    expect(h.month('2026-03')).toBe('Mar 26');
    expect(h.month('2026-03-15')).toBe('Mar 26');
    expect(h.stockHref('BRK.B')).toBe('/stocks/brk.b/');
  });
});

describe('chart frame', () => {
  const fr = { w: 800, h: 340, plotW: 754, plotH: 318, id: 'pt NVDA', label: 'NVDA "price"', view: null };
  it('stacks the layers in one order: grab strips under the axis labels, the plot clipped, controls after', () => {
    const out = h.chartFrame(fr, { defs: '<linearGradient id="g"/>', axes: '<text class="pt-axis">$1</text>', plot: '<path class="pt-line"/>', after: '<div class="x"></div>' });
    expect(out.startsWith('<div class="pt-wrap"><svg class="pt-chart-svg" viewBox="0 0 800 340" role="img" aria-label="NVDA &quot;price&quot;" data-zoom=')).toBe(true);
    expect(out.indexOf('pt-axis-strip')).toBeLessThan(out.indexOf('<text class="pt-axis">'));
    expect(out).toContain('<clipPath id="pt-NVDAclip"><rect x="0" y="0" width="754" height="318"/></clipPath><linearGradient id="g"/></defs>');
    expect(out).toContain('<g clip-path="url(#pt-NVDAclip)"><path class="pt-line"/></g>');
    expect(out.endsWith('</svg><div class="x"></div></div>')).toBe(true);
    expect(checkMarkup(out)).toEqual([]);
  });
  it('y axis: grid lines across the plot, price labels in the right strip; time axis anchored inside the plot', () => {
    expect(h.yAxis(fr, [{ y: 100, v: 233.5 }, { y: 200, v: 12.25 }])).toBe(
      '<line class="pt-grid" x1="0" x2="754" y1="100" y2="100"/><text class="pt-axis" x="796" y="103" text-anchor="end">$234</text>' +
      '<line class="pt-grid" x1="0" x2="754" y1="200" y2="200"/><text class="pt-axis" x="796" y="203" text-anchor="end">$12.25</text>');
    expect(h.timeAxis(fr, [{ x: 8, label: 'Jan 26' }, { x: 400, label: 'Jun 26' }, { x: 750, label: 'Dec 26' }])).toBe(
      '<text class="pt-axis" x="8" y="334" text-anchor="start">Jan 26</text><text class="pt-axis" x="400" y="334" text-anchor="middle">Jun 26</text>' +
      '<text class="pt-axis" x="750" y="334" text-anchor="end">Dec 26</text>');
  });
});

describe('chart geometry', () => {
  const pts = [{ t: '2026-01-02', c: 10 }, { t: '2026-01-05', c: 11 }, { t: '2026-01-06', c: 12 }];
  it('closeAt: the last close at or before a date, the first one before the series', () => {
    expect(closeAt(pts, '2026-01-04')).toBe(10);
    expect(closeAt(pts, '2026-01-05')).toBe(11);
    expect(closeAt(pts, '2025-12-01')).toBe(10);
    expect(closeAt(pts, '2027-01-01')).toBe(12);
  });
  it('isoDay counts UTC days; linePath rounds to a tenth', () => {
    expect(isoDay('2026-01-02') - isoDay('2026-01-01')).toBe(1);
    expect(isoDay('2026-01-02T15:00:00Z')).toBe(isoDay('2026-01-02'));
    expect(linePath([[0, 0], [1.234, 5.678]])).toBe('M0 0 L1.2 5.7');
  });
  it('monthTicks: at most `max` month starts across the window, labelled "Mon YY"', () => {
    const t = monthTicks(isoDay('2025-10-14'), isoDay('2027-10-14'), 6);
    expect(t.length).toBeLessThanOrEqual(6);
    expect(t[0]).toEqual({ day: isoDay('2025-10-14'), label: 'Oct 25' });
    expect(t[1]!.label).toBe('Mar 26'); // 25 month starts, every 5th
    expect(monthTicks(isoDay('2026-09-03'), isoDay('2026-09-30'))).toEqual([{ day: isoDay('2026-09-03'), label: 'Sep 26' }]);
  });
});

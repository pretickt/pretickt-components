// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { metricDemo, type MetricItem } from '../src/typologies';
import * as mod from './pt-metric';
import { standardSuite } from './_harness';

describe('pt-metric', () => {
  standardSuite('pt-metric.ts', mod);

  const item = (o: Partial<MetricItem>): MetricItem => ({ key: 'pe', label: 'P/E', value: 29.17, text: null, unit: 'x', delta: null,
    tone: 'flat', range: null, icon: null, hint: 'h', asOf: '2026-10-02', ...o });

  it('formats each unit', () => {
    const out = mod.renderStatic({ metrics: [item({}), item({ key: 'pt_upside', label: 'Target upside', value: 0.4007, unit: '%', tone: 'pos' }),
      item({ key: 'earnings_in', label: 'Earnings in', value: 46, unit: 'd' }), item({ key: 'trend_ma', label: 'Trend', value: 3, text: '3 of 4 above', unit: '' })] }, {}, h);
    expect(out).toContain('29.2x');
    expect(out).toContain('+40.1%');
    expect(out).toContain('46d');
    expect(out).toContain('3 of 4 above');
    expect(out).toContain('pt-tone-pos');
  });
  it('escapes hostile provider strings', () => {
    const out = mod.renderStatic({ metrics: [item({ label: '<img src=x onerror=alert(1)>', hint: '"><script>x</script>' })] }, {}, h);
    expect(out).not.toMatch(/<img|<script/);
  });
  it('places the 52-week dot proportionally and clamps it', () => {
    const at = (value: number) => mod.renderStatic({ metrics: [item({ key: 'range_52w', unit: '$', value, range: { lo: 100, hi: 200, marks: [] } })] }, {}, h);
    expect(at(150)).toContain('left:50.0%');
    expect(at(500)).toContain('left:100.0%');
  });
  it('renders the not-available state for null and empty payloads', () => {
    expect(mod.renderStatic({ metrics: null }, {}, h)).toContain('pt-na');
    expect(mod.renderStatic({ metrics: [] }, {}, h)).toContain('pt-na');
  });
  it('renders every demo metric', () => {
    const demo = metricDemo({ ticker: 'NVDA', metrics: ['pe', 'pe_vs_sector', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in'] });
    expect(mod.renderStatic({ metrics: demo }, {}, h).match(/class="pt-badge /g)).toHaveLength(7);
  });
});

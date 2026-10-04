// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { fundamentalsDemo } from '../src/typologies';
import * as mod from './pt-financials';
import { standardSuite } from './_harness';

describe('pt-financials', () => {
  standardSuite(mod);
  const f = fundamentalsDemo({ ticker: 'NVDA', periods: 8 });
  it('draws revenue and FCF bars per quarter and a table', () => {
    const out = mod.renderStatic({ fin: f }, { ticker: 'NVDA', periods: 8 }, h);
    expect(out.match(/class="pt-fin-rev"/g)).toHaveLength(8);
    expect(out.match(/<tr class="pt-fin-q"/g)).toHaveLength(8);
    expect(out).toContain(f.periods.at(-1)!.fiscal);
    expect(out).toContain('<svg class="pt-chart-svg pt-fin-chart"');
  });
  it('states year-over-year revenue growth when four quarters back exist', () => {
    const out = mod.renderStatic({ fin: f }, { ticker: 'NVDA', periods: 8 }, h);
    const g = f.periods.at(-1)!.revenue! / f.periods.at(-5)!.revenue! - 1;
    expect(out).toContain(`Revenue ${h.pct(g)} year over year`);
  });
  it('renders not-available without quarters', () => {
    expect(mod.renderStatic({ fin: { asOf: '2026-10-02', periods: [] } }, { ticker: 'NVDA', periods: 8 }, h)).toContain('pt-na');
  });
});

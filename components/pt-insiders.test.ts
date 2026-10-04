// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { insiderDemo } from '../src/typologies';
import * as mod from './pt-insiders';
import { standardSuite } from './_harness';

describe('pt-insiders', () => {
  standardSuite(mod);
  it('summarises open-market buys and sells and lists transactions', () => {
    const d = { asOf: '2026-10-02', items: [
      { date: '2026-09-20', filingDate: '2026-09-22', name: 'A <x>', title: 'CEO', type: 'sell' as const, shares: 100, price: 10, value: 1000 },
      { date: '2026-08-01', filingDate: null, name: 'B', title: null, type: 'buy' as const, shares: 10, price: 20, value: 200 },
      { date: '2026-07-01', filingDate: null, name: 'C', title: null, type: 'other' as const, shares: 5, price: null, value: null }] };
    const out = mod.renderStatic({ ins: d }, { ticker: 'NVDA', days: 365 }, h);
    expect(out).toContain('Open-market buys $200');
    expect(out).toContain('sells $1K');
    expect(out.match(/<tr class="pt-ins-row/g)).toHaveLength(3);
    expect(out).toContain('A &lt;x&gt;');
    expect(out).toContain('<div class="pt-meta">CEO</div>');
  });
  it('explains no transactions', () => {
    expect(mod.renderStatic({ ins: { asOf: '2026-10-02', items: [] } }, { ticker: 'NVDA', days: 365 }, h)).toContain('No insider transactions');
  });
  it('demo data renders', () => expect(mod.renderStatic({ ins: insiderDemo({ ticker: 'NVDA', days: 365 }) }, { ticker: 'NVDA', days: 365 }, h)).toContain('pt-ins-row'));
});

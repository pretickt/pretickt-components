// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { analystsDemo, priceSeriesDemo } from '../src/typologies';
import * as mod from './pt-price-target';
import { standardSuite } from './_harness';

const analysts = analystsDemo({ ticker: 'NVDA', window: '1y' });
const series = priceSeriesDemo({ tickers: ['NVDA'], range: '1y', interval: '1d', rebase: false });
const p = { ticker: 'NVDA' };

describe('pt-price-target', () => {
  standardSuite('pt-price-target.ts', mod);

  it('shows low, average, median, high and upside against the last close', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    for (const label of ['Low', 'Average', 'Median', 'High', 'Upside']) expect(out).toContain(`>${label}<`);
    expect(out).toContain(h.money(analysts.summary!.mean));
    expect(out).toContain(h.pct(analysts.summary!.mean / analysts.price! - 1));
  });
  it('draws one dot and one segment per target', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    expect(out.match(/class="pt-dot"/g)).toHaveLength(analysts.targets.length);
    expect(out.match(/class="pt-seg"/g)).toHaveLength(analysts.targets.length);
  });
  it('renders the consensus bar with counts as text', () => {
    const out = mod.renderStatic({ analysts, series }, p, h);
    expect(out).toContain('pt-consensus');
    expect(out).toContain(`Strong buy ${analysts.consensus!.strongBuy}`);
  });
  it('explains missing coverage', () => {
    const none = { ...analysts, summary: null, targets: [], consensus: null, history: [] };
    expect(mod.renderStatic({ analysts: none, series }, p, h)).toContain('No analyst targets in the last 12 months');
    expect(mod.renderStatic({ analysts: null, series }, p, h)).toContain('pt-na');
  });
  it('keeps the stats when the price series is missing', () => {
    const out = mod.renderStatic({ analysts, series: null }, p, h);
    expect(out).toContain('>Average<');
    expect(out).not.toContain('<svg');
  });
});

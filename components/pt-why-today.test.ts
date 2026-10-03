// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { moveBreakdownDemo, type MoveBreakdown } from '../src/typologies';
import * as mod from './pt-why-today';
import { standardSuite } from './_harness';

const base = (o: Partial<MoveBreakdown> = {}): MoveBreakdown => ({ ...moveBreakdownDemo({ ticker: 'NVDA', window: '1d' }), name: 'NVIDIA', sectorName: 'Technology',
  ret: -0.031, marketRet: -0.012, sectorRet: -0.02, market: -0.012, sector: -0.008, specific: -0.011, driver: 'market', ...o });

describe('pt-why-today', () => {
  standardSuite('pt-why-today.ts', mod);
  it('answers first, in one templated sentence, with the three parts', () => {
    const out = mod.renderStatic({ move: base() }, { ticker: 'NVDA', window: '1d' }, h);
    expect(out).toMatch(/NVIDIA \(NVDA\) fell 3\.1% on Sep 30, 2026\./);
    expect(out).toContain('The market (SPY) fell 1.2%');
    expect(out).toContain('Technology stocks fell 2.0%');
    expect(out.match(/class="pt-bd-row"/g)).toHaveLength(3);
  });
  it('names the driver', () => {
    expect(mod.renderStatic({ move: base({ driver: 'stock' }) }, { ticker: 'NVDA', window: '1d' }, h)).toContain('Most of the move is specific to NVDA');
    expect(mod.renderStatic({ move: base({ driver: 'sector' }) }, { ticker: 'NVDA', window: '1d' }, h)).toContain('Most of the move came from its sector');
  });
  it('flags a news spike and lists the top stories', () => {
    const out = mod.renderStatic({ move: base({ news: { today: 9, avg30: 3, spike: true, top: [{ title: 'Probe <x>', site: 'R', url: 'https://x', sentiment: -0.6 }] } }) }, { ticker: 'NVDA', window: '1d' }, h);
    expect(out).toContain('9 stories, 3.0× the 30-day average');
    expect(out).toContain('Probe &lt;x&gt;');
    expect(out).toContain('pt-dot-neg');
  });
  it('does not quote an average it does not have', () => {
    const out = mod.renderStatic({ move: base({ news: { today: 7, avg30: 0, spike: false, top: [] } }) }, { ticker: 'NVDA', window: '1d' }, h);
    expect(out).toContain('7 stories on the day.');
    expect(out).not.toContain('average');
  });
  it('offers 1D, 5D and 1M', () => {
    expect(mod.renderStatic({ move: base() }, { ticker: 'NVDA', window: '1d' }, h)).toContain(`data-set='{"window":"5d"}'`);
  });
  it('renders not-available for null', () => expect(mod.renderStatic({ move: null }, { ticker: 'NVDA', window: '1d' }, h)).toContain('pt-na'));
});

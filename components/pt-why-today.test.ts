// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { moveBreakdownDemo, type MoveBreakdown } from '../src/typologies';
import PtWhyToday from './pt-why-today.vue';
import { render, standardSuite, withData } from './_suite';

const base = (o: Partial<MoveBreakdown> = {}): MoveBreakdown => ({ ...moveBreakdownDemo({ ticker: 'NVDA', window: '1d' }), name: 'NVIDIA', sectorName: 'Technology',
  ret: -0.031, marketRet: -0.012, sectorRet: -0.02, market: -0.012, sector: -0.008, specific: -0.011, driver: 'market', ...o });
const html = async (m: MoveBreakdown) => (await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }))).html;

describe('pt-why-today', () => {
  standardSuite('pt-why-today.vue', PtWhyToday);
  it('answers first, in one templated sentence, with the three parts', async () => {
    const out = await html(base());
    expect(out).toMatch(/NVIDIA \(NVDA\) fell 3\.1% on Sep 30, 2026\./);
    expect(out).toContain('The market (SPY) fell 1.2%');
    expect(out).toContain('Technology stocks fell 2.0%');
    expect(out.match(/class="pt-bd-row"/g)).toHaveLength(3);
  });
  it('names the driver', async () => {
    expect(await html(base({ driver: 'stock' }))).toContain('Most of the move is specific to NVDA');
    expect(await html(base({ driver: 'sector' }))).toContain('Most of the move came from its sector');
  });
  it('flags a news spike and lists the top stories', async () => {
    const out = await html(base({ news: { today: 9, avg30: 3, spike: true, top: [{ title: 'Probe <x>', site: 'R', url: 'https://x', sentiment: -0.6 }] } }));
    expect(out).toContain('9 stories, 3.0× the 30-day average');
    expect(out).toContain('Probe &lt;x&gt;');
    expect(out).toContain('pt-dot-neg');
  });
  it('does not quote an average it does not have', async () => {
    const out = await html(base({ news: { today: 7, avg30: 0, spike: false, top: [] } }));
    expect(out).toContain('7 stories on the day.');
    expect(out).not.toContain('30-day average');
  });
  it('offers 1D, 5D and 1M, the current one pressed', async () => {
    const out = await html(base());
    expect(out).toContain('<div class="pt-head">');
    expect(out.match(/<button type="button" aria-pressed="(true|false)">(1D|5D|1M)<\/button>/g)).toHaveLength(3);
    expect(out).toContain('aria-pressed="true">1D<');
  });
});

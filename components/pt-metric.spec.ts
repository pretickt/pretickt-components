import { metricDemo } from '../src/typologies';
import { PtMetric } from './pt-metric';
import { basics, render, withData } from './_spec';

describe('pt-metric', () => {
  basics(PtMetric, { ticker: 'NVDA', metrics: ['pe', 'rsi14'] });
  it('one badge per catalogue item, in the order asked', async () => {
    const r = await render(PtMetric, { ticker: 'NVDA', metrics: ['pe', 'rsi14', 'off_high'] });
    expect([...r.el.querySelectorAll('ul.pt-badges > li.pt-badge .pt-badge-k')].map((k) => k.textContent))
      .toEqual(metricDemo({ ticker: 'NVDA', metrics: ['pe', 'rsi14', 'off_high'] }).map((m) => m.label));
  });
  it('an empty answer is not available', async () => {
    expect((await render(PtMetric, { ticker: 'NVDA', metrics: ['pe'] }, withData({ 'metric@1': [] }))).html()).toContain('pt-na');
  });
});

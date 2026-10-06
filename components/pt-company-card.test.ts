// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { h, Suspense } from 'vue';
import { createPt, PT } from '../src/context/pt';
import { money, pct, usd } from '../src/ds/format';
import { metricDemo, METRIC_KEYS, priceSeriesDemo } from '../src/typologies';
import PtCompanyCard, { CARD_KEYS } from './pt-company-card.vue';
import { demo, render, standardSuite, withData } from './_suite';

const metrics = metricDemo({ ticker: 'NVDA', metrics: [...METRIC_KEYS] });
const series = priceSeriesDemo({ tickers: ['NVDA'], range: '3m', interval: '1d', rebase: false });
const item = (k: string) => metrics.find((m) => m.key === k)!;
const last60 = series[0]!.points.slice(-60);
const close = last60.at(-1)!.c;

describe('pt-company-card', () => {
  standardSuite('pt-company-card.vue', PtCompanyCard);

  it('shows the company, its price over 60 sessions, the 52-week range, the consensus and the price target', async () => {
    const { html } = await render(PtCompanyCard, { ticker: 'NVDA' }, demo());
    expect(html).toContain('NVIDIA Corporation');
    expect(html).toContain(`NVDA · ${usd(item('market_cap').value!, { compact: true })}`);
    expect(html).toContain(money(close));
    expect(html).toContain(pct(close / last60[0]!.c - 1));
    expect(html).toContain('last 60 sessions');
    expect(html).toContain(`${item('consensus').text} · ${item('consensus').value} analysts`);
    expect(html).toContain(`PT ${money(close * (1 + item('pt_upside').value!))}`);
    expect(html).toMatch(/class="pt-card-range"/);
  });
  it('tags: the default set first, every other catalogue item behind "Show all" (in the HTML, hidden), unknown keys too', async () => {
    const extra = { key: 'zeta_score', label: 'Zeta', value: 2, text: null, unit: '', delta: null, tone: 'flat', range: null, icon: null, hint: 'h', asOf: '2026-10-02' };
    const { html } = await render(PtCompanyCard, { ticker: 'NVDA' }, withData({ 'metric@1': [...metrics, extra] }));
    const shown = html.slice(0, html.indexOf('pt-card-more'));
    for (const k of CARD_KEYS) expect(shown).toContain(`>${item(k).label}<`);
    expect(html).toContain('>Zeta<');
    expect(html).toMatch(/<ul class="pt-badges pt-card-more" style="display:none;">/);
    expect(html).toContain('Show all (');
  });
  it('"Show all" opens the rest in place, with no new request', async () => {
    let calls = 0;
    const resolve = async (t: string, p: unknown) => { calls++; return demo()(t, p); };
    const w = mount({ render: () => h(Suspense, null, { default: () => h(PtCompanyCard, { ticker: 'NVDA', size: 'compact' }) }) },
      { global: { provide: { [PT as symbol]: createPt({ resolve }) } }, attachTo: document.body });
    await flushPromises();
    expect(w.find('.pt-card-more').isVisible()).toBe(false);
    await w.find('.pt-card-all').trigger('click');
    expect(w.find('.pt-card-more').isVisible()).toBe(true);
    expect(calls).toBe(3);
    w.unmount();
  });
  it('compact size, with the tooltip rows of the link as a footer', async () => {
    const { html } = await render(PtCompanyCard, { ticker: 'NVDA', size: 'compact', extra: { NVDA: 'NVIDIA Corporation', Earnings: 'Oct 28, 2026', Time: 'AMC', 'EPS est.': null } }, demo());
    expect(html).toMatch(/class="pt-card pt-card-compact"/);
    expect(html).toContain('<b>Earnings</b> Oct 28, 2026');
    expect(html).not.toContain('EPS est.');
    expect(html).not.toContain('<b>NVDA</b>'); // the company row of a chip's tooltip: the card's header says it already
  });
  it('shows what it has: no profile → the ticker as name; no prices → no sparkline; nothing → not available', async () => {
    const noProfile = (await render(PtCompanyCard, { ticker: 'NVDA' }, withData({ 'company@1': null }))).html;
    expect(noProfile).toMatch(/class="pt-card-name">NVDA</);
    const noPrices = (await render(PtCompanyCard, { ticker: 'NVDA' }, withData({ 'price-series@1': null }))).html;
    expect(noPrices).not.toContain('pt-card-spark');
    expect(noPrices).toContain(`>${item('pe').label}<`);
    expect((await render(PtCompanyCard, { ticker: 'NVDA' }, async () => null)).html).toContain('pt-na');
  });
});

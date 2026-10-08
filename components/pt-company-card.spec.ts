import { money, pct, usd } from '../src/ds/format';
import { metricDemo, METRIC_KEYS, priceSeriesDemo } from '../src/typologies';
import { CARD_KEYS, PtCompanyCard } from './pt-company-card';
import { basics, render, settle, withData } from './_spec';

const metrics = metricDemo({ ticker: 'NVDA', metrics: [...METRIC_KEYS] });
const series = priceSeriesDemo({ tickers: ['NVDA'], range: '3m', interval: '1d', rebase: false });
const item = (k: string) => metrics.find((m) => m.key === k)!;
const last60 = series[0]!.points.slice(-60);
const close = last60.at(-1)!.c;

describe('pt-company-card', () => {
  basics(PtCompanyCard, { ticker: 'NVDA' });

  it('shows the company, its price over 60 sessions, the 52-week range, the consensus and the price target', async () => {
    const out = (await render(PtCompanyCard, { ticker: 'NVDA' })).html();
    expect(out).toContain('NVIDIA Corporation');
    expect(out).toContain(`NVDA · ${usd(item('market_cap').value!, { compact: true })}`);
    expect(out).toContain(money(close));
    expect(out).toContain(pct(close / last60[0]!.c - 1));
    expect(out).toContain('last 60 sessions');
    expect(out).toContain(`${item('consensus').text} · ${item('consensus').value} analysts`);
    expect(out).toContain(`PT ${money(close * (1 + item('pt_upside').value!))}`);
    expect(out).toMatch(/class="pt-card-range"/);
  });
  it('tags: the default set first, every other catalogue item behind "Show all" (in the HTML, hidden), unknown keys too', async () => {
    const extra = { key: 'zeta_score', label: 'Zeta', value: 2, text: null, unit: '', delta: null, tone: 'flat', range: null, icon: null, hint: 'h', asOf: '2026-10-02' };
    const out = (await render(PtCompanyCard, { ticker: 'NVDA' }, withData({ 'metric@1': [...metrics, extra] }))).html();
    const shown = out.slice(0, out.indexOf('pt-card-more'));
    for (const k of CARD_KEYS) expect(shown).toContain(`>${item(k).label}<`);
    expect(out).toContain('>Zeta<');
    expect(out).toMatch(/<ul class="pt-badges pt-card-more" style="display: none;">/);
    expect(out).toContain('Show all (');
  });
  it('"Show all" opens the rest in place, with no new request', async () => {
    const r = await render(PtCompanyCard, { ticker: 'NVDA', size: 'compact' });
    const more = () => (r.el.querySelector('.pt-card-more') as HTMLElement).style.display;
    expect(more()).toBe('none');
    (r.el.querySelector('.pt-card-all') as HTMLButtonElement).click();
    await settle(r.f);
    expect(more()).toBe('');
    expect(r.el.querySelector('.pt-card-all')!.textContent).toBe('Show less');
    expect(r.calls()).toBe(3);
  });
  it('compact size, with the tooltip rows of the link as a footer', async () => {
    const out = (await render(PtCompanyCard, { ticker: 'NVDA', size: 'compact', extra: { NVDA: 'NVIDIA Corporation', Earnings: 'Oct 28, 2026', Time: 'AMC', 'EPS est.': null } })).html();
    expect(out).toMatch(/class="pt-card pt-card-compact"/);
    expect(out).toContain('<b>Earnings</b> Oct 28, 2026');
    expect(out).not.toContain('EPS est.');
    expect(out).not.toContain('<b>NVDA</b>');
  });
  it('shows what it has: no profile → the ticker as name; no prices → no sparkline; nothing → not available', async () => {
    expect((await render(PtCompanyCard, { ticker: 'NVDA' }, withData({ 'company@1': null }))).html()).toMatch(/class="pt-card-name">NVDA</);
    const noPrices = (await render(PtCompanyCard, { ticker: 'NVDA' }, withData({ 'price-series@1': null }))).html();
    expect(noPrices).not.toContain('pt-card-spark');
    expect(noPrices).toContain(`>${item('pe').label}<`);
  });
  it('says when its three calls have settled and whether there is something to show (the hover card waits for it)', async () => {
    const r = await render(PtCompanyCard, { ticker: 'NVDA' });
    expect(r.f.componentInstance.ready()).toEqual({ settled: true, available: true });
    const none = await render(PtCompanyCard, { ticker: 'NVDA' }, async () => null);
    expect(none.f.componentInstance.ready()).toEqual({ settled: true, available: false });
  });
});

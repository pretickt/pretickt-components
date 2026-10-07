// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { pct } from '../src/ds/format';
import { fundamentalsDemo, insiderDemo, metricDemo, type MetricItem } from '../src/typologies';
import PtFinancials from './pt-financials.vue';
import PtInsiders from './pt-insiders.vue';
import PtMetric from './pt-metric.vue';
import { column, mountIsland, render, standardSuite, withData } from './_suite';

describe('pt-metric', () => {
  standardSuite('pt-metric.vue', PtMetric);
  const item = (o: Partial<MetricItem>): MetricItem => ({ key: 'pe', label: 'P/E', value: 29.17, text: null, unit: 'x', delta: null,
    tone: 'flat', range: null, icon: null, hint: 'h', asOf: '2026-10-02', ...o });
  const html = async (metrics: MetricItem[]) => (await render(PtMetric, { ticker: 'NVDA', metrics: ['pe'] }, withData({ 'metric@1': metrics }))).html;
  it('formats each unit', async () => {
    const out = await html([item({}), item({ key: 'pt_upside', label: 'Target upside', value: 0.4007, unit: '%', tone: 'pos' }),
      item({ key: 'earnings_in', label: 'Earnings in', value: 46, unit: 'd' }), item({ key: 'trend_ma', label: 'Trend', value: 3, text: '3 of 4 above', unit: '' })]);
    expect(out).toContain('29.2x'); expect(out).toContain('+40.1%'); expect(out).toContain('46d'); expect(out).toContain('3 of 4 above'); expect(out).toContain('pt-tone-pos');
  });
  it('escapes hostile provider strings', async () => {
    expect(await html([item({ label: '<img src=x onerror=alert(1)>', hint: '"><script>x</script>' })])).not.toMatch(/<img|<script/);
  });
  it('places the 52-week dot proportionally and clamps it', async () => {
    expect(await html([item({ key: 'range_52w', unit: '$', value: 150, range: { lo: 100, hi: 200, marks: [] } })])).toContain('left:50.0%');
    expect(await html([item({ key: 'range_52w', unit: '$', value: 500, range: { lo: 100, hi: 200, marks: [] } })])).toContain('left:100.0%');
  });
  it('renders the not-available state for an empty payload', async () => expect(await html([])).toContain('pt-na'));
  it('renders every demo metric', async () => {
    const demo = metricDemo({ ticker: 'NVDA', metrics: ['pe', 'pe_vs_sector', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in'] });
    expect((await html(demo)).match(/class="pt-badge /g)).toHaveLength(7);
  });
});

describe('sortable tables (insiders, financials)', () => {
  const money = (s: string) => { const n = Number(s.replace(/[$,]|[KMBT]$/g, '').replace('−', '-')); return s.endsWith('B') ? n * 1e9 : s.endsWith('M') ? n * 1e6 : s.endsWith('K') ? n * 1e3 : n; };
  it('insiders: Value high to low', async () => {
    const w = await mountIsland(PtInsiders, { ticker: 'NVDA', days: 365 });
    await w.findAll('thead th button').find((b) => b.text().startsWith('Value'))!.trigger('click');
    const v = column(w, 6).filter((x) => x !== '—').map(money);
    expect(v).toEqual([...v].sort((a, b) => b - a));
    w.unmount();
  });
  it('insiders: a buy and a sell by one insider on one day are two rows, sorted any way', async () => {
    const same = { date: '2026-09-01', filingDate: '2026-09-02', name: 'Jane Doe', title: 'CFO', shares: 100, price: 10, value: 1000 };
    const items = [{ ...same, type: 'buy' }, { ...same, type: 'sell' }, { ...same, name: 'John Roe', type: 'buy' }];
    const w = await mountIsland(PtInsiders, { ticker: 'NVDA', days: 365 }, withData({ 'insider@1': { asOf: '2026-09-30', items } }));
    for (const h of ['Value', 'Type', 'Insider', 'Insider', 'Insider']) {
      await w.findAll('thead th button').find((b) => b.text().startsWith(h))!.trigger('click');
      expect(w.findAll('tbody tr'), h).toHaveLength(3);
    }
    w.unmount();
  });
  it('financials: quarters by revenue, high to low', async () => {
    const w = await mountIsland(PtFinancials, { ticker: 'NVDA', periods: 8 });
    await w.findAll('thead th button').find((b) => b.text().startsWith('Revenue'))!.trigger('click');
    const v = column(w, 3).filter((x) => x !== '—').map(money);
    expect(v).toEqual([...v].sort((a, b) => b - a));
    w.unmount();
  });
});

describe('pt-insiders', () => {
  standardSuite('pt-insiders.vue', PtInsiders);
  it('summarises open-market buys and sells and lists transactions', async () => {
    const d = { asOf: '2026-10-02', items: [
      { date: '2026-09-20', filingDate: '2026-09-22', name: 'A <x>', title: 'CEO', type: 'sell' as const, shares: 100, price: 10, value: 1000 },
      { date: '2026-08-01', filingDate: null, name: 'B', title: null, type: 'buy' as const, shares: 10, price: 20, value: 200 },
      { date: '2026-07-01', filingDate: null, name: 'C', title: null, type: 'other' as const, shares: 5, price: null, value: null }] };
    const { html } = await render(PtInsiders, { ticker: 'NVDA', days: 365 }, withData({ 'insider@1': d }));
    expect(html).toContain('Open-market buys $200');
    expect(html).toContain('sells $1K');
    expect(html.match(/<tr class="pt-ins-row/g)).toHaveLength(3);
    expect(html).toContain('A &lt;x&gt;');
    expect(html).toContain('<div class="pt-meta">CEO</div>');
  });
  it('explains no transactions', async () => {
    expect((await render(PtInsiders, { ticker: 'NVDA' }, withData({ 'insider@1': { asOf: '2026-10-02', items: [] } }))).html).toContain('No insider transactions in the last 365 days');
  });
  it('demo data renders', async () => expect((await render(PtInsiders, { ticker: 'NVDA' }, withData({ 'insider@1': insiderDemo({ ticker: 'NVDA', days: 365 }) }))).html).toContain('pt-ins-row'));
});

describe('pt-financials', () => {
  standardSuite('pt-financials.vue', PtFinancials);
  const f = fundamentalsDemo({ ticker: 'NVDA', periods: 8 });
  const html = async (fin: unknown) => (await render(PtFinancials, { ticker: 'NVDA' }, withData({ 'fundamentals@1': fin }))).html;
  it('draws revenue and FCF bars per quarter and a table', async () => {
    const out = await html(f);
    expect(out.match(/class="pt-fin-rev"/g)).toHaveLength(8);
    expect(out.match(/<tr class="pt-fin-q"/g)).toHaveLength(8);
    expect(out).toContain(f.periods.at(-1)!.fiscal);
    expect(out).toContain('<svg class="pt-chart-svg pt-fin-chart"');
  });
  it('states year-over-year revenue growth when four quarters back exist', async () => {
    const g = f.periods.at(-1)!.revenue! / f.periods.at(-5)!.revenue! - 1;
    expect(await html(f)).toContain(`Revenue ${pct(g)} year over year`);
  });
  it('renders not-available without quarters', async () => expect(await html({ asOf: '2026-10-02', periods: [] })).toContain('pt-na'));
});

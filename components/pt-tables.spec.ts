import { pct } from '../src/ds/format';
import { fundamentalsDemo, insiderDemo, type MetricItem } from '../src/typologies';
import { PtFinancials } from './pt-financials';
import { PtInsiders } from './pt-insiders';
import { PtMetric } from './pt-metric';
import { basics, column, press, render, withData } from './_spec';

const money = (s: string) => { const n = Number(s.replace(/[$,]|[KMBT]$/g, '').replace('−', '-')); return s.endsWith('B') ? n * 1e9 : s.endsWith('M') ? n * 1e6 : s.endsWith('K') ? n * 1e3 : n; };

describe('pt-metric (formats)', () => {
  const item = (o: Partial<MetricItem>): MetricItem => ({ key: 'pe', label: 'P/E', value: 29.17, text: null, unit: 'x', delta: null,
    tone: 'flat', range: null, icon: null, hint: 'h', asOf: '2026-10-02', ...o });
  const html = async (metrics: MetricItem[]) => (await render(PtMetric, { ticker: 'NVDA', metrics: ['pe'] }, withData({ 'metric@1': metrics }))).html();
  it('formats each unit', async () => {
    const out = await html([item({}), item({ key: 'pt_upside', label: 'Target upside', value: 0.4007, unit: '%', tone: 'pos' }),
      item({ key: 'earnings_in', label: 'Earnings in', value: 46, unit: 'd' }), item({ key: 'trend_ma', label: 'Trend', value: 3, text: '3 of 4 above', unit: '' })]);
    expect(out).toContain('29.2x'); expect(out).toContain('+40.1%'); expect(out).toContain('46d'); expect(out).toContain('3 of 4 above'); expect(out).toContain('pt-tone-pos');
  });
  it('escapes hostile provider strings', async () => {
    const r = await render(PtMetric, { ticker: 'NVDA', metrics: ['pe'] }, withData({ 'metric@1': [item({ label: '<img src=x onerror=alert(1)>', hint: '"><script>x</script>' })] }));
    expect(r.el.querySelector('img, script')).toBeNull();
    expect(r.el.querySelector('.pt-badge-k')!.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('places the 52-week dot proportionally and clamps it', async () => {
    expect(await html([item({ key: 'range_52w', unit: '$', value: 150, range: { lo: 100, hi: 200, marks: [] } })])).toContain('left: 50.0%');
    expect(await html([item({ key: 'range_52w', unit: '$', value: 500, range: { lo: 100, hi: 200, marks: [] } })])).toContain('left: 100.0%');
  });
});

describe('pt-insiders', () => {
  basics(PtInsiders, { ticker: 'NVDA', days: 365 });
  it('summarises open-market buys and sells and lists transactions', async () => {
    const d = { asOf: '2026-10-02', items: [
      { date: '2026-09-20', filingDate: '2026-09-22', name: 'A <x>', title: 'CEO', type: 'sell' as const, shares: 100, price: 10, value: 1000 },
      { date: '2026-08-01', filingDate: null, name: 'B', title: null, type: 'buy' as const, shares: 10, price: 20, value: 200 },
      { date: '2026-07-01', filingDate: null, name: 'C', title: null, type: 'other' as const, shares: 5, price: null, value: null }] };
    const r = await render(PtInsiders, { ticker: 'NVDA', days: 365 }, withData({ 'insider@1': d }));
    const out = r.html();
    expect(out).toContain('Open-market buys $200');
    expect(out).toContain('sells $1K');
    expect(r.el.querySelectorAll('tr.pt-ins-row')).toHaveLength(3);
    expect(r.el.querySelectorAll('tr.pt-ins-sell, tr.pt-ins-buy, tr.pt-ins-other')).toHaveLength(3);
    expect(out).toContain('A &lt;x&gt;');
    expect(out).toContain('<div class="pt-meta">CEO</div>');
  });
  it('explains no transactions (default 365 days)', async () => {
    expect((await render(PtInsiders, { ticker: 'NVDA' }, withData({ 'insider@1': { asOf: '2026-10-02', items: [] } }))).html()).toContain('No insider transactions in the last 365 days');
  });
  it('sorts by value, high to low', async () => {
    const r = await render(PtInsiders, { ticker: 'NVDA', days: 365 }, withData({ 'insider@1': insiderDemo({ ticker: 'NVDA', days: 365 }) }));
    await press(r.f, r.el, 'Value↕');
    const v = column(r.el, 6).filter((x) => x !== '—').map(money);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });
  it('a buy and a sell by one insider on one day are two rows, sorted any way', async () => {
    const same = { date: '2026-09-01', filingDate: '2026-09-02', name: 'Jane Doe', title: 'CFO', shares: 100, price: 10, value: 1000 };
    const items = [{ ...same, type: 'buy' }, { ...same, type: 'sell' }, { ...same, name: 'John Roe', type: 'buy' }];
    const r = await render(PtInsiders, { ticker: 'NVDA', days: 365 }, withData({ 'insider@1': { asOf: '2026-09-30', items } }));
    for (const h of ['Value', 'Type', 'Insider', 'Insider', 'Insider']) {
      const b = [...r.el.querySelectorAll('thead th button')].find((x) => x.textContent!.startsWith(h)) as HTMLButtonElement;
      b.click();
      r.f.detectChanges();
      expect(r.el.querySelectorAll('tbody tr'), h).toHaveLength(3);
    }
  });
});

describe('pt-financials', () => {
  basics(PtFinancials, { ticker: 'NVDA', periods: 8 });
  const f = fundamentalsDemo({ ticker: 'NVDA', periods: 8 });
  const html = async (fin: unknown) => (await render(PtFinancials, { ticker: 'NVDA' }, withData({ 'fundamentals@1': fin }))).html();
  it('draws revenue and FCF bars per quarter and a table', async () => {
    const { el, html: out } = await render(PtFinancials, { ticker: 'NVDA' }, withData({ 'fundamentals@1': f }));
    expect(el.querySelectorAll('rect.pt-fin-rev')).toHaveLength(8);
    expect(el.querySelectorAll('tr.pt-fin-q')).toHaveLength(8);
    expect(out()).toContain(f.periods.at(-1)!.fiscal);
    expect(el.querySelector('svg.pt-chart-svg.pt-fin-chart')).not.toBeNull();
  });
  it('states year-over-year revenue growth when four quarters back exist', async () => {
    expect(await html(f)).toContain(`Revenue ${pct(f.periods.at(-1)!.revenue! / f.periods.at(-5)!.revenue! - 1)} year over year`);
  });
  it('renders not-available without quarters', async () => expect(await html({ asOf: '2026-10-02', periods: [] })).toContain('pt-na'));
  it('without periods asks for 8 quarters (the default); sorts by revenue', async () => {
    const asked: unknown[] = [];
    const r = await render(PtFinancials, { ticker: 'NVDA' }, async (t, p) => { asked.push(p); return withData({})(t, p); });
    expect(asked).toEqual([{ ticker: 'NVDA', periods: 8 }]);
    await press(r.f, r.el, 'Revenue↕');
    const v = column(r.el, 3).filter((x) => x !== '—').map(money);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });
});

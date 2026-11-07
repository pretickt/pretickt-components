import { demoFor, type Analysts, type Basket, type Events, type Fundamentals, type Insider, type MetricItem, type Screen, type ScreenRow, type SectorBasket } from '../src/typologies';
import { plainName, PtAnswer } from './pt-answer';
import { PtCalendar } from './pt-calendar';
import { basics, render, withData } from './_spec';

const ASOF = '2026-10-16';
const analysts = (o: Partial<Analysts> = {}): Analysts => ({ asOf: ASOF, price: 182.16, summary: { low: 150, mean: 215.4, median: 210, high: 275, n: 41 },
  consensus: null, history: [], targets: [], accuracy: [], ...o });
const consensus = (text: string | null): MetricItem[] => [
  { key: 'pt_upside', label: 'Target upside', value: 0.182, text: null, unit: '%', delta: null, tone: 'pos', range: null, icon: null, hint: '', asOf: ASOF },
  { key: 'consensus', label: 'Consensus', value: 64, text, unit: '', delta: null, tone: 'pos', range: null, icon: null, hint: '', asOf: ASOF }];
const row = (ticker: string, name: string, o: Partial<ScreenRow> = {}): ScreenRow => ({ ticker, name, sector: 'Technology', logo: null, close: 100, chg1d: 0,
  offHigh: -0.1, pe: 20, ptUpside: 0.1, marketCap: 1e11, insiderNet: 0, volumeRatio: 1, spark: [], self: false, ...o });
const screen = (rows: ScreenRow[]): Screen => ({ asOf: ASOF, rows });
const text = async (inputs: Record<string, unknown>, answers: Record<string, unknown>) =>
  (await render(PtAnswer, inputs, withData(answers))).el.querySelector('.pt-answer')?.textContent ?? '';

describe('pt-answer', () => {
  basics(PtAnswer, { topic: 'price-target', ticker: 'NVDA' });
  basics(PtAnswer, { topic: 'list', list: 'biggest_gainers' });
  basics(PtAnswer, { topic: 'earnings', month: '2026-10' });

  it('names companies as people search them', () => {
    expect(['NVIDIA Corporation', 'Eli Lilly and Company', 'The Coca-Cola Company', 'Merck & Co., Inc.', 'Alphabet Inc. Class A'].map(plainName))
      .toEqual(['Nvidia', 'Eli Lilly', 'Coca-Cola', 'Merck', 'Alphabet']);
  });
  it('forecast (the hub): the average 12-month target against the last close, its range, the rating consensus; the company by its common name', async () => {
    expect(await text({ topic: 'forecast', ticker: 'NVDA' }, { 'analysts@1': analysts(), 'metric@1': consensus('Buy') })).toBe(
      'The average 12-month analyst price target for Nvidia NVDA is $215.40, 18.2% above the last close of $182.16 on Oct 16, 2026; targets range from ' +
      '$150.00 to $275.00. Rating consensus: Buy.');
  });
  it('price target: how many firms, the average against the close, the range and the median; below the close when it is', async () => {
    expect(await text({ topic: 'price-target', ticker: 'NVDA' }, { 'analysts@1': analysts({ price: 230 }), 'metric@1': consensus(null) })).toBe(
      'The average price target of the 41 analyst firms that published one in the last 12 months is $215.40 for Nvidia NVDA, 6.3% below the last close of ' +
      '$230.00 on Oct 16, 2026. Targets range from $150.00 to $275.00, with a median of $210.00.');
  });
  it("technicals (the hub's Technicals, round 16: \"<ticker> 200 day moving average\" is searched): the close against its 200- and 50-day averages and its 52-week range", async () => {
    // 252 sessions: 200 at $100, 48 at $110, then $120; highs and lows a dollar either side, one high of $130
    const points = Array.from({ length: 252 }, (_, i) => {
      const c = i < 200 ? 100 : i < 250 ? 110 : 120;
      return { t: i === 251 ? '2026-10-16' : '2026-01-02', o: c, h: i === 100 ? 130 : c + 1, l: c - 1, c, v: 1e6 };
    });
    expect(await text({ topic: 'technicals', ticker: 'NVDA' }, { 'price-series@1': [{ ticker: 'NVDA', points }], 'metric@1': [] })).toBe(
      'Nvidia NVDA closed at $120.00 on Oct 16, 2026, 16.8% above its 200-day moving average of $102.70 and 8.7% above its 50-day moving average of ' +
      '$110.40. It is 7.7% below its 52-week high of $130.00; its 52-week low is $99.00.');
    // the 52-week range the company card shows beside it (traded highs and lows; the series' are adjusted for dividends)
    const card: MetricItem[] = [{ key: 'range_52w', label: '52w range', value: 120, text: null, unit: '$', delta: null, tone: 'flat',
      range: { lo: 98.5, hi: 131.25, marks: [] }, icon: null, hint: '', asOf: ASOF }];
    expect(await text({ topic: 'technicals', ticker: 'NVDA' }, { 'price-series@1': [{ ticker: 'NVDA', points }], 'metric@1': card })).toBe(
      'Nvidia NVDA closed at $120.00 on Oct 16, 2026, 16.8% above its 200-day moving average of $102.70 and 8.7% above its 50-day moving average of ' +
      '$110.40. It is 8.6% below its 52-week high of $131.25; its 52-week low is $98.50.');
    // a young listing: the 50-day average and its range so far
    expect(await text({ topic: 'technicals', ticker: 'NVDA' }, { 'price-series@1': [{ ticker: 'NVDA', points: points.slice(-60) }], 'metric@1': [] })).toBe(
      'Nvidia NVDA closed at $120.00 on Oct 16, 2026, 8.7% above its 50-day moving average of $110.40. It is 0.8% below its high since ' +
      'Jan 2, 2026 of $121.00; its low since then is $99.00.');
  });

  it('the round-16 lists say who leads them with the number they rank by', async () => {
    const rows = [row('NVDA', 'NVIDIA Corporation', { rating: { dir: 'up', firm: 'Firm A', date: '2026-10-15' }, cross: '2026-10-14', pe: 8.2, fscore: 9,
      volumeRatio: 4.1 }), row('AMD', 'Advanced Micro Devices, Inc.', { rating: { dir: 'down', firm: 'Firm B', date: '2026-10-16' }, cross: '2026-10-09',
      pe: 9.5, fscore: 8, volumeRatio: 3.2 })];
    const said = (list: string) => text({ topic: 'list', list }, { 'screen@1': screen(rows) });
    expect(await said('upgrades_downgrades')).toBe('The latest analyst upgrades and downgrades in the week to Oct 16, 2026: Nvidia NVDA upgraded by Firm A ' +
      'and AMD downgraded by Firm B.');
    expect(await said('golden_cross')).toBe('Stocks whose 50-day average crossed above their 200-day lately (a golden cross), as of Oct 16, 2026: Nvidia NVDA ' +
      '(Oct 14, 2026) and AMD (Oct 9, 2026).');
    expect(await said('death_cross')).toContain('crossed below their 200-day lately (a death cross)');
    expect(await said('low_pe')).toBe('The profitable stocks with the lowest P/E ratios on Oct 16, 2026: Nvidia NVDA 8.2 and AMD 9.5.');
    expect(await said('piotroski')).toBe('The largest companies with a Piotroski F-score of 8 or 9 on Oct 16, 2026: Nvidia NVDA (9 of 9) and AMD (8 of 9).');
    expect(await said('unusual_volume')).toBe('The stocks trading furthest above their usual volume on Oct 16, 2026: Nvidia NVDA 4.1× and AMD 3.2×.');
  });

  it('no target in a year is an answer too, not a missing page', async () => {
    expect(await text({ topic: 'price-target', ticker: 'XYZ' }, { 'analysts@1': analysts({ summary: null }), 'metric@1': consensus('Hold') }))
      .toBe('No analyst published a price target for XYZ Demo XYZ in the last 12 months. Rating consensus: Hold.');
  });
  it('peers: the largest of them, the company\'s rank by market cap and its P/E against the peers\' median', async () => {
    const rows = [row('AVGO', 'Broadcom Inc.', { marketCap: 1.6e12, pe: 30 }), row('NVDA', 'NVIDIA Corporation', { marketCap: 4.4e12, pe: 45.2, self: true }),
      row('AMD', 'Advanced Micro Devices, Inc.', { marketCap: 3e11, pe: 80 }), row('QCOM', 'QUALCOMM Incorporated', { marketCap: 1.8e11, pe: 15 }),
      row('INTC', 'Intel Corporation', { marketCap: 1e11, pe: null })].sort((a, b) => b.marketCap! - a.marketCap!);
    expect(await text({ topic: 'peers', ticker: 'NVDA' }, { 'screen@1': screen(rows) })).toBe(
      'The peers of Nvidia NVDA by industry and size include Broadcom AVGO, AMD and Qualcomm QCOM. Among these 5 companies Nvidia NVDA ranks ' +
      '1st by market cap ($4.4T); its P/E of 45.2 compares with a median of 30.0 for its peers.');
  });
  it('financials: the latest quarter\'s revenue and its growth over a year, then EPS, free cash flow and net margin', async () => {
    const q = (period: string, fiscal: string, revenue: number) => ({ period, fiscal, revenue, eps: 1.05, fcf: 13.45e9, grossMargin: 0.72, operatingMargin: 0.6,
      netMargin: 0.565, pe: 45, shares: 2.4e10 });
    const f: Fundamentals = { asOf: ASOF, periods: [q('2025-07-27', 'Q2 FY26', 30e9), q('2025-10-26', 'Q3 FY26', 35e9), q('2026-01-25', 'Q4 FY26', 39e9),
      q('2026-04-26', 'Q1 FY27', 44e9), q('2026-07-26', 'Q2 FY27', 46.8e9)] };
    expect(await text({ topic: 'financials', ticker: 'NVDA' }, { 'fundamentals@1': f })).toBe(
      'Nvidia NVDA reported revenue of $46.8B for the quarter ended Jul 26, 2026 (Q2 FY27), up 56.0% from a year earlier. It posted diluted EPS of $1.05, ' +
      'free cash flow of $13.45B and a net margin of 56.5%.');
  });
  it('financials of a company reporting half-years in euros: its currency, the half-year, growth over two reports', async () => {
    const h = (period: string, fiscal: string, revenue: number) => ({ period, fiscal, revenue, eps: 2.17, fcf: 1.1e9, grossMargin: 0.36, operatingMargin: 0.14,
      netMargin: 0.09, pe: 22, shares: 4.46e8 });
    const f: Fundamentals = { asOf: ASOF, currency: 'EUR', periodsPerYear: 2, periods: [h('2025-06-27', 'H1 FY2025', 10.27e9), h('2025-12-31', 'H2 FY2025', 10.63e9),
      h('2026-06-30', 'H1 FY2026', 10.72e9)] };
    const ccep = { ticker: 'CCEP', name: 'Coca-Cola Europacific Partners PLC', sector: 'Consumer Defensive', industry: 'Beverages', logo: null };
    expect(await text({ topic: 'financials', ticker: 'CCEP' }, { 'fundamentals@1': f, 'company@1': ccep })).toBe(
      'Coca-Cola Europacific Partners CCEP reported revenue of €10.72B for the half-year ended Jun 30, 2026 (H1 FY2026), up 4.4% from a year earlier. It posted diluted EPS of €2.17, ' +
      'free cash flow of €1.1B and a net margin of 9.0%.');
  });
  it('insiders: purchases and sales over the year, then the latest trade', async () => {
    const i = (date: string, name: string, title: string | null, type: 'buy' | 'sell' | 'other', shares: number, price: number) =>
      ({ date, filingDate: date, name, title, type, shares, price, value: shares * price });
    const ins: Insider = { asOf: ASOF, items: [i('2026-10-10', 'Huang Jen Hsun', 'CEO', 'sell', 75000, 180.1), i('2026-09-01', 'Kress Colette', 'CFO', 'other', 500, 0),
      i('2026-06-02', 'Huang Jen Hsun', 'CEO', 'sell', 100000, 140)] };
    expect(await text({ topic: 'insiders', ticker: 'NVDA' }, { 'insider@1': ins })).toBe(
      'In the last 12 months Nvidia NVDA insiders made 0 open-market purchases and 2 sales worth $27.51M, as reported on SEC Form 4. The latest: ' +
      'Huang Jen Hsun (CEO) sold 75,000 shares at $180.10 on Oct 10, 2026.');
    expect(await text({ topic: 'insiders', ticker: 'KO' }, { 'insider@1': { asOf: ASOF, items: [] } })).toBe(
      'No open-market purchase or sale of Coca-Cola KO stock by its officers and directors was reported in the last 12 months.');
  });
  it('lists: the top three with the number the list ranks by, in the sector when the page has one; an empty list says so', async () => {
    const losers = screen([row('INTC', 'Intel Corporation', { chg1d: -0.081 }), row('MRNA', 'Moderna, Inc.', { chg1d: -0.06 }), row('F', 'Ford Motor Company', { chg1d: -0.052 })]);
    expect(await text({ topic: 'list', list: 'biggest_losers' }, { 'screen@1': losers })).toBe(
      'The biggest losers on Oct 16, 2026: Intel INTC -8.1%, Moderna MRNA -6.0% and Ford F -5.2%.');
    const largest = screen([row('AAPL', 'Apple Inc.', { marketCap: 3.9e12 }), row('MSFT', 'Microsoft Corporation', { marketCap: 3.4e12 })]);
    expect(await text({ topic: 'list', list: 'largest', sector: 'Technology' }, { 'screen@1': largest })).toBe(
      'The largest Technology companies by market capitalization on Oct 16, 2026: Apple AAPL $3.9T and Microsoft MSFT $3.4T.');
    expect(await text({ topic: 'list', list: '52w_high', sector: 'Energy' }, { 'screen@1': screen([]) })).toBe('No Energy stock is near its 52-week high on Oct 16, 2026.');
    const buying = screen([row('RTX', 'RTX Corporation', { insiderNet: 12.3e6 })]);
    expect(await text({ topic: 'list', list: 'insider_buying' }, { 'screen@1': buying })).toBe('The largest net insider buying over the last 90 days: RTX +$12.3M.');
  });
  it('calendars: how many companies, the busiest day and its largest names; for dividends the largest with amount and date', async () => {
    const e = (date: string, ticker: string, name: string, mcap: number, kind: 'earnings' | 'dividend' = 'earnings') => (kind === 'earnings'
      ? { date, ticker, name, logo: null, mcap, kind, meta: { time: null, epsEst: null, epsActual: null, revEst: null, revActual: null } }
      : { date, ticker, name, logo: null, mcap, kind, meta: { amount: 0.26, payDate: null } });
    const earnings: Events = { asOf: ASOF, items: [e('2026-10-28', 'MSFT', 'Microsoft Corporation', 3.4e12), e('2026-10-29', 'META', 'Meta Platforms, Inc.', 1.8e12),
      e('2026-10-29', 'GOOGL', 'Alphabet Inc. Class A', 2.1e12), e('2026-10-29', 'CMG', 'Chipotle Mexican Grill, Inc.', 7e10),
      e('2026-10-29', 'F', 'Ford Motor Company', 4e10), { date: '2026-10-29', kind: 'macro', meta: { label: 'Fed', event: 'FOMC', impact: 'High' } }] as Events['items'] };
    expect(await text({ topic: 'earnings', month: '2026-10' }, { 'events@1': earnings })).toBe(
      '5 companies report earnings in October 2026. The busiest day is Oct 29, 2026, with 4 reports, among them Alphabet GOOGL, Meta and Chipotle CMG.');
    const dividends: Events = { asOf: ASOF, items: [e('2026-11-10', 'AAPL', 'Apple Inc.', 3.9e12, 'dividend')] as Events['items'] };
    expect(await text({ topic: 'dividends', month: '2026-11' }, { 'events@1': dividends })).toBe(
      '1 company goes ex-dividend in November 2026. The largest: Apple AAPL $0.26 on Nov 10, 2026.');
    expect(await text({ topic: 'earnings', month: '2026-12' }, { 'events@1': { asOf: ASOF, items: [] } })).toBe('No earnings report is scheduled for December 2026 yet.');
  });
  it('names each company as a link with its logo (its card on hover): the page\'s own company and the ones its lists name', async () => {
    const company = { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', logo: '/logos/nvda-1.png' };
    const r = await render(PtAnswer, { topic: 'forecast', ticker: 'NVDA' }, withData({ 'analysts@1': analysts(), 'metric@1': consensus('Buy'), 'company@1': company }));
    const a = r.el.querySelector('.pt-answer a.pt-mention')!;
    expect(a.getAttribute('href')).toBe('/stocks/nvda/');
    expect(a.querySelector('img')!.getAttribute('src')).toBe('/logos/nvda-1.png');
    const losers = screen([row('INTC', 'Intel Corporation', { chg1d: -0.081, logo: '/logos/intc-1.png' }), row('F', 'Ford Motor Company', { chg1d: -0.05 })]);
    const l = await render(PtAnswer, { topic: 'list', list: 'biggest_losers' }, withData({ 'screen@1': losers }));
    expect([...l.el.querySelectorAll('.pt-answer a.pt-mention')].map((x) => x.getAttribute('href'))).toEqual(['/stocks/intc/', '/stocks/f/']);
    expect(l.el.querySelector('.pt-answer a.pt-mention img')!.getAttribute('src')).toBe('/logos/intc-1.png');
  });
  it('asks only for what its topic answers from (the page already asked for the same, so the build has it: the company card asks for the name)', async () => {
    const r = await render(PtAnswer, { topic: 'peers', ticker: 'NVDA' });
    expect(Object.keys(r.record).sort()).toEqual(['company@1|{"ticker":"NVDA"}', 'screen@1|{"limit":12,"scope":{"peersOf":"NVDA"}}']);
    const t = await render(PtAnswer, { topic: 'price-target', ticker: 'NVDA' });
    expect(Object.keys(t.record).map((k) => k.split('|')[0]).sort()).toEqual(['analysts@1', 'company@1', 'metric@1']);
    const l = await render(PtAnswer, { topic: 'list', list: 'biggest_gainers' });
    expect(Object.keys(l.record).map((k) => k.split('|')[0])).toEqual(['screen@1']);
  });
  it('a calendar\'s answer asks what the calendar under it asks (its kind with the market dates): the page carries one month, not two', async () => {
    const e = await render(PtAnswer, { topic: 'earnings', month: '2026-10' });
    const c = await render(PtCalendar, { month: '2026-10', kind: 'earnings' });
    expect(Object.keys(e.record)).toEqual(Object.keys(c.record));
    const d = await render(PtAnswer, { topic: 'dividends', month: '2026-11' });
    const dc = await render(PtCalendar, { month: '2026-11', kind: 'dividend' });
    expect(Object.keys(d.record)).toEqual(Object.keys(dc.record));
  });
});

describe('a fund', () => {
  const fund = demoFor({ t: 'basket@1', params: { ticker: 'SMH' } }) as Basket;
  const SMH: Basket = { ...fund, group: 'Semiconductors', fund: { ...fund.fund, holdings: 27 }, target: { ...fund.target!, upside: 0.481, price: 747, share: 0.99 }, holdings: [{ ticker: 'NVDA', name: 'NVIDIA Corporation', logo: null, weight: 0.205, ret: null, upside: null, label: null }] };
  const said = async (b: Basket) => (await render(PtAnswer, { topic: 'basket', ticker: b.ticker }, withData({ 'basket@1': b }))).text().replace(/\s+/g, ' ').trim();
  it('what it holds, what the targets on its covered share say, and that pretickt does not say whether to buy', async () => {
    const t = await said(SMH);
    expect(t).toContain('SMH holds 27 stocks; the largest is Nvidia');
    expect(t).toContain('at 20.5%.');
    expect(t).toContain("Analysts' targets on the 99% of the fund we cover average +48.1%, which would put it at $747.00.");
    expect(t).toContain('pretickt does not say whether to buy or sell.');
  });
  it('the market\'s funds name what they track', async () => {
    expect(await said({ ...SMH, ticker: 'SPY', group: 'Market', tracks: 'tracks the S&P 500' })).toContain('SPY, which tracks the S&P 500, holds 27 stocks');
  });
  it('under 80%: no figure, the coverage in words', async () => {
    const t = await said({ ...SMH, state: 'low', coverage: 0.72, target: null, consensus: null, pe: null, questions: null });
    expect(t).toContain('We cover 72% of this fund');
    expect(t).not.toMatch(/\$\d|average/);
    expect(t).toContain('pretickt does not say whether to buy or sell.');
  });
  it('no target to speak of: the holdings alone', async () => {
    const t = await said({ ...SMH, target: null });
    expect(t).toContain('SMH holds 27 stocks');
    expect(t).not.toContain('average');
  });
  it('not available', async () => {
    expect((await render(PtAnswer, { topic: 'basket', ticker: 'SMH' }, withData({ 'basket@1': null }))).text()).not.toContain('holds');
  });
});


describe('pt-answer, a sector', () => {
  const base = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
  const TECH: SectorBasket = { ...base, companies: 116, value: 22.4e12, holdings: [{ ticker: 'NVDA', name: 'NVIDIA Corporation', logo: null, weight: 0.213, ret: null, upside: null, label: null, close: 180 }],
    target: { ...base.target!, upside: 0.142 } };
  const said = async (b: SectorBasket) => (await render(PtAnswer, { topic: 'sector', sector: b.sector }, withData({ 'sector@1': b }))).text().replace(/\s+/g, ' ').trim();
  basics(PtAnswer, { topic: 'sector', sector: 'Technology' });
  it('how many companies, what they are worth, the largest, what the targets on them average, and that pretickt does not say whether to buy', async () => {
    expect(await said(TECH)).toBe("Technology on pretickt: 116 companies worth $22.4 trillion; the largest is Nvidia NVDA at 21.3%. Analysts' targets on them average +14.2%. pretickt does not say whether to buy or sell.");
  });
  it('a smaller sector in billions; no target, no average', async () => {
    const t = await said({ ...TECH, value: 640e9, target: null });
    expect(t).toContain('116 companies worth $640 billion');
    expect(t).not.toContain('average');
  });
  it('not available', async () => {
    expect((await render(PtAnswer, { topic: 'sector', sector: 'Technology' }, withData({ 'sector@1': null }))).text()).not.toContain('companies');
  });
});

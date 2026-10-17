import type { Analysts, Events, Fundamentals, Insider, MetricItem, Screen, ScreenRow } from '../src/typologies';
import { plainName, PtAnswer } from './pt-answer';
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
      .toEqual(['NVIDIA', 'Eli Lilly', 'Coca-Cola', 'Merck', 'Alphabet']);
  });
  it('forecast (the hub): the average 12-month target against the last close, its range, the rating consensus', async () => {
    expect(await text({ topic: 'forecast', ticker: 'NVDA' }, { 'analysts@1': analysts(), 'metric@1': consensus('Buy') })).toBe(
      'The average 12-month analyst price target for NVDA is $215.40, 18.2% above the last close of $182.16 on Oct 16, 2026; targets range from ' +
      '$150.00 to $275.00. Rating consensus: Buy.');
  });
  it('price target: how many firms, the average against the close, the range and the median; below the close when it is', async () => {
    expect(await text({ topic: 'price-target', ticker: 'NVDA' }, { 'analysts@1': analysts({ price: 230 }), 'metric@1': consensus(null) })).toBe(
      'The average price target of the 41 analyst firms that published one in the last 12 months is $215.40 for NVDA, 6.3% below the last close of ' +
      '$230.00 on Oct 16, 2026. Targets range from $150.00 to $275.00, with a median of $210.00.');
  });
  it('no target in a year is an answer too, not a missing page', async () => {
    expect(await text({ topic: 'price-target', ticker: 'XYZ' }, { 'analysts@1': analysts({ summary: null }), 'metric@1': consensus('Hold') }))
      .toBe('No analyst published a price target for XYZ in the last 12 months. Rating consensus: Hold.');
  });
  it('peers: the largest of them, the company\'s rank by market cap and its P/E against the peers\' median', async () => {
    const rows = [row('AVGO', 'Broadcom Inc.', { marketCap: 1.6e12, pe: 30 }), row('NVDA', 'NVIDIA Corporation', { marketCap: 4.4e12, pe: 45.2, self: true }),
      row('AMD', 'Advanced Micro Devices, Inc.', { marketCap: 3e11, pe: 80 }), row('QCOM', 'QUALCOMM Incorporated', { marketCap: 1.8e11, pe: 15 }),
      row('INTC', 'Intel Corporation', { marketCap: 1e11, pe: null })].sort((a, b) => b.marketCap! - a.marketCap!);
    expect(await text({ topic: 'peers', ticker: 'NVDA' }, { 'screen@1': screen(rows) })).toBe(
      'NVDA’s peers by industry and size include Broadcom (AVGO), Advanced Micro Devices (AMD) and QUALCOMM (QCOM). Among these 5 companies NVDA ranks ' +
      '1st by market cap ($4.4T); its P/E of 45.2 compares with a median of 30.0 for its peers.');
  });
  it('financials: the latest quarter\'s revenue and its growth over a year, then EPS, free cash flow and net margin', async () => {
    const q = (period: string, fiscal: string, revenue: number) => ({ period, fiscal, revenue, eps: 1.05, fcf: 13.45e9, grossMargin: 0.72, operatingMargin: 0.6,
      netMargin: 0.565, pe: 45, shares: 2.4e10 });
    const f: Fundamentals = { asOf: ASOF, periods: [q('2025-07-27', 'Q2 FY26', 30e9), q('2025-10-26', 'Q3 FY26', 35e9), q('2026-01-25', 'Q4 FY26', 39e9),
      q('2026-04-26', 'Q1 FY27', 44e9), q('2026-07-26', 'Q2 FY27', 46.8e9)] };
    expect(await text({ topic: 'financials', ticker: 'NVDA' }, { 'fundamentals@1': f })).toBe(
      'NVDA reported revenue of $46.8B for the quarter ended Jul 26, 2026 (Q2 FY27), up 56.0% from a year earlier. It posted diluted EPS of $1.05, ' +
      'free cash flow of $13.45B and a net margin of 56.5%.');
  });
  it('insiders: purchases and sales over the year, then the latest trade', async () => {
    const i = (date: string, name: string, title: string | null, type: 'buy' | 'sell' | 'other', shares: number, price: number) =>
      ({ date, filingDate: date, name, title, type, shares, price, value: shares * price });
    const ins: Insider = { asOf: ASOF, items: [i('2026-10-10', 'Huang Jen Hsun', 'CEO', 'sell', 75000, 180.1), i('2026-09-01', 'Kress Colette', 'CFO', 'other', 500, 0),
      i('2026-06-02', 'Huang Jen Hsun', 'CEO', 'sell', 100000, 140)] };
    expect(await text({ topic: 'insiders', ticker: 'NVDA' }, { 'insider@1': ins })).toBe(
      'In the last 12 months NVDA insiders made 0 open-market purchases and 2 sales worth $27.51M, as reported on SEC Form 4. The latest: ' +
      'Huang Jen Hsun (CEO) sold 75,000 shares at $180.10 on Oct 10, 2026.');
    expect(await text({ topic: 'insiders', ticker: 'KO' }, { 'insider@1': { asOf: ASOF, items: [] } })).toBe(
      'No open-market purchase or sale of KO stock by its officers and directors was reported in the last 12 months.');
  });
  it('lists: the top three with the number the list ranks by, in the sector when the page has one; an empty list says so', async () => {
    const losers = screen([row('INTC', 'Intel Corporation', { chg1d: -0.081 }), row('MRNA', 'Moderna, Inc.', { chg1d: -0.06 }), row('F', 'Ford Motor Company', { chg1d: -0.052 })]);
    expect(await text({ topic: 'list', list: 'biggest_losers' }, { 'screen@1': losers })).toBe(
      'The biggest losers on Oct 16, 2026: Intel (INTC) -8.1%, Moderna (MRNA) -6.0% and Ford Motor (F) -5.2%.');
    const largest = screen([row('AAPL', 'Apple Inc.', { marketCap: 3.9e12 }), row('MSFT', 'Microsoft Corporation', { marketCap: 3.4e12 })]);
    expect(await text({ topic: 'list', list: 'largest', sector: 'Technology' }, { 'screen@1': largest })).toBe(
      'The largest Technology companies by market capitalization on Oct 16, 2026: Apple (AAPL) $3.9T and Microsoft (MSFT) $3.4T.');
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
      '5 companies report earnings in October 2026. The busiest day is Oct 29, 2026, with 4 reports, among them Alphabet (GOOGL), Meta Platforms (META) and Chipotle Mexican Grill (CMG).');
    const dividends: Events = { asOf: ASOF, items: [e('2026-11-10', 'AAPL', 'Apple Inc.', 3.9e12, 'dividend')] as Events['items'] };
    expect(await text({ topic: 'dividends', month: '2026-11' }, { 'events@1': dividends })).toBe(
      '1 company goes ex-dividend in November 2026. The largest: Apple (AAPL) $0.26 on Nov 10, 2026.');
    expect(await text({ topic: 'earnings', month: '2026-12' }, { 'events@1': { asOf: ASOF, items: [] } })).toBe('No earnings report is scheduled for December 2026 yet.');
  });
  it('asks only for what its topic answers from (the page already asked for the same, so the build has it)', async () => {
    const r = await render(PtAnswer, { topic: 'peers', ticker: 'NVDA' });
    expect(Object.keys(r.record)).toEqual(['screen@1|{"limit":12,"scope":{"peersOf":"NVDA"}}']);
    const t = await render(PtAnswer, { topic: 'price-target', ticker: 'NVDA' });
    expect(Object.keys(t.record).map((k) => k.split('|')[0]).sort()).toEqual(['analysts@1', 'metric@1']);
  });
});

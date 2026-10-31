import type { Events, Fundamentals, PriceSeries } from '../src/typologies';
import { mention, saidText } from '../src/ds/format';
import { dropTest, PtQuality, qualityCards, qualityLead, reactionAfter, rowSentence, slope, verdict, type QCard } from './pt-quality';
import { basics, render, withData } from './_spec';

type Period = Fundamentals['periods'][number];
const q = (period: string, fiscal: string, revenue: number, o: Partial<Period> = {}): Period => ({ period, fiscal, revenue, eps: 1, fcf: 1e8,
  grossMargin: 0.6, operatingMargin: 0.3, netMargin: 0.2, pe: 20, shares: 1e9, ...o });
// eight quarters: growth 10% a year, then 20% in the last one; the margin falls 5 points in the last one
const fund: Fundamentals = { asOf: '2026-10-23', periods: [
  q('2024-09-30', 'Q3 FY24', 100), q('2024-12-31', 'Q4 FY24', 100), q('2025-03-31', 'Q1 FY25', 100), q('2025-06-30', 'Q2 FY25', 100),
  q('2025-09-30', 'Q3 FY25', 110), q('2025-12-31', 'Q4 FY25', 110), q('2026-03-31', 'Q1 FY26', 110),
  q('2026-06-30', 'Q2 FY26', 120, { operatingMargin: 0.25, pe: 14 }),
] };
const co = { ticker: 'XYZ', name: 'XYZ Corp', logo: null, mcap: 1e11 };
const earn = (date: string, epsEst: number, epsActual: number, time: 'bmo' | 'amc' = 'amc') =>
  ({ ...co, date, kind: 'earnings' as const, meta: { time, epsEst, epsActual, revEst: null, revActual: null } });
const events: Events = { asOf: '2026-10-23', items: [earn('2026-07-29', 1, 1.1), earn('2026-04-28', 1, 0.9),
  { ...co, date: '2026-10-01', kind: 'analyst', meta: { firm: 'Firm A', action: 'downgrade', from: 'Buy', to: 'Hold' } },
  { ...co, date: '2026-10-02', kind: 'analyst', meta: { firm: 'Firm B', action: 'reiterate', from: null, to: 'Buy' } }] };

/** Weekdays from 2025-10-27; the company rises to 120 then falls 20% over its last 30 sessions; SPY and two peers barely move. */
function series(): PriceSeries {
  const ts: string[] = [];
  for (let d = Date.parse('2025-10-27T00:00:00Z'); ts.length < 250; d += 86400000) { const w = new Date(d).getUTCDay(); if (w && w < 6) ts.push(new Date(d).toISOString().slice(0, 10)); }
  const line = (f: (i: number) => number) => ts.map((t, i) => ({ t, o: f(i), h: f(i), l: f(i), c: f(i), v: 1 }));
  return [{ ticker: 'XYZ', points: line((i) => (i < 220 ? 100 + i / 11 : 120 - (i - 219) * 0.8)) },
    { ticker: 'SPY', points: line((i) => (i < 220 ? 500 : 500 - (i - 219) * 0.2)) },
    { ticker: 'AAA', points: line((i) => (i < 220 ? 50 : 50 - (i - 219) * 0.05)) },
    { ticker: 'BBB', points: line((i) => (i < 220 ? 80 : 80 - (i - 219) * 0.1)) }];
}

describe('qualityCards (version 1: the numbers pretickt has)', () => {
  const bars = series()[0]!.points;
  const cards = qualityCards('XYZ', fund, events, bars, '2026-10-23');
  const of = (p: string) => cards.filter((c) => c.pillar === p);

  it('demand: revenue against a year earlier, ▲ when growth picks up by 2 points or more, dated at the report', () => {
    const d = of('demand');
    expect(d[0]).toMatchObject({ tone: 'pos', date: '2026-07-29', horizon: 'long', fact: 'Revenue +20.0% from a year earlier (Q2 FY26)',
      why: 'Growth picked up from +10.0% the quarter before.', href: '/stocks/xyz/financials/' });
    expect(d[0]!.viz).toEqual({ kind: 'change', from: expect.closeTo(0.1, 6), to: expect.closeTo(0.2, 6) });
    expect(d.map((c) => c.tone)).toEqual(['pos', 'flat', 'flat']);   // Q3 FY25 was reported 13 months ago: out of the year
  });
  it('economics: the operating margin against a year earlier; a 5-point fall weakens it', () => {
    expect(of('economics')[0]).toMatchObject({ tone: 'neg', fact: 'Operating margin 25.0%, down from 30.0% a year earlier' });
  });
  it('advantage: only a gross margin that moved 3 points or more (the rest comes from filings and news)', () => {
    expect(of('advantage')).toEqual([]);
  });
  it('execution: each report against its estimate, with how the stock took it the next session', () => {
    expect(of('execution').map((c) => [c.date, c.tone, c.fact])).toEqual([
      ['2026-07-29', 'pos', 'EPS $1.10 vs $1.00 expected (+10.0%)'], ['2026-04-28', 'neg', 'EPS $0.90 vs $1.00 expected (-10.0%)']]);
    expect(of('execution')[0]!.reaction).toBeCloseTo(reactionAfter(bars, '2026-07-29')!, 9);
  });
  it('price: up- and downgrades of the last 90 days (a reiteration is not a fact), and the P/E against its 3-year median', () => {
    expect(of('price').map((c) => [c.date, c.tone, c.fact])).toEqual([['2026-10-01', 'neg', 'Firm A downgrades it to Hold'],
      ['2026-07-29', 'pos', 'P/E ratio 14.0× at the last report, below its 3-year median of 20.0×']]);   // the P/E dated at the last report
  });
  it('newest first; nothing without quarters or events', () => {
    expect(cards.map((c) => c.date)).toEqual([...cards.map((c) => c.date)].sort().reverse());
    expect(qualityCards('XYZ', null, null, [], '2026-10-23')).toEqual([]);
  });
});

describe('dropTest: is it the company or the price?', () => {
  const s = series();
  const cards = qualityCards('XYZ', fund, events, s[0]!.points, '2026-10-23');

  it('20% off the high: market, peers and its own part add up to the fall; the pillars since the high', () => {
    const d = dropTest(s, 'XYZ', cards)!;
    expect(d.high).toBe(s[0]!.points[219]!.t);
    expect(d.ret).toBeCloseTo(-0.2, 2);
    expect(d.market).toBeCloseTo(-0.012, 3);
    expect(d.peers).toBeCloseTo(median2(-0.03, -0.0375), 3);
    expect(d.own! + d.peers!).toBeCloseTo(d.ret, 9);
    expect(d.since.price).toEqual(['neg']);   // the downgrade after the high; the P/E reading is of the report before it
    expect(d.since.demand).toEqual([]);
  });
  it('less than 10% off the high and no 5% session: no test', () => {
    const calm = s.map((x) => ({ ...x, points: x.points.slice(0, 225) }));
    expect(dropTest(calm, 'XYZ', cards)).toBeNull();
  });
  function median2(a: number, b: number) { return (a + b) / 2; }
});

describe('the words and the marks', () => {
  const c = (pillar: QCard['pillar'], tone: QCard['tone']) => ({ pillar, tone }) as QCard;
  it('a pillar\'s verdict from its cards; a row\'s sentence', () => {
    expect([verdict([]), verdict(['pos']), verdict(['neg', 'neg']), verdict(['pos', 'neg']), verdict(['pos', 'pos', 'neg']), verdict(['flat'])])
      .toEqual(['no new facts', 'strengthened', 'weakened', 'mixed', 'mostly strengthened', 'steady']);
    expect(rowSentence('Next 1–3 years', ['economics', 'execution'], [c('economics', 'neg'), c('execution', 'pos')]))
      .toBe('Next 1–3 years: Economics weakened, Execution strengthened.');
  });
  it('the answer first: the company, the 12 months to the date, the facts that strengthened and weakened its quality', () => {
    const cards = qualityCards('XYZ', fund, events, series()[0]!.points, '2026-10-23');
    expect(saidText(qualityLead(mention('XYZ', 'Xylo Zen Corp'), cards, '2026-10-23'))).toBe('Xylo Zen XYZ in the 12 months to Oct 23, 2026: 3 facts strengthened its quality, 3 weakened it, 4 to watch.');
    expect(saidText(qualityLead(mention('XYZ'), [c('demand', 'pos')], '2026-10-23'))).toBe('XYZ in the 12 months to Oct 23, 2026: 1 fact strengthened its quality, 0 weakened it.');
    expect(saidText(qualityLead(mention('XYZ'), [], '2026-10-23'))).toBe('XYZ: no new facts in the 12 months to Oct 23, 2026.');
  });
  it('a slope keeps zero in its box', () => {
    expect(slope(0.1, 0.2)).toEqual({ y1: 10, y2: 3, zero: 17 });
    expect(slope(-0.1, 0.1)).toEqual({ y1: 17, y2: 3, zero: 10 });
  });
});

describe('pt-quality', () => {
  basics(PtQuality, { ticker: 'NVDA' });
  const view = () => render(PtQuality, { ticker: 'XYZ' }, withData({ 'fundamentals@1': fund, 'events@1': events, 'price-series@1': series(),
    'screen@1': { asOf: '2026-10-23', rows: [] } }));

  it('six boxes in three rows by horizon, each with its sentence; the box of the newest fact open, the others\' cards in the HTML', async () => {
    const r = await view();
    expect([...r.el.querySelectorAll('.pt-q-row-h')].map((e) => e.textContent!.trim())).toEqual([
      'Beyond 3 years: Demand strengthened, Advantage no new facts.',
      'Next 1–3 years: Economics weakened, Execution mixed.',
      'Next months: Fragility no new facts, Price mixed.']);
    expect([...r.el.querySelectorAll('.pt-q-name')].map((e) => e.textContent)).toEqual(['Demand', 'Advantage', 'Economics', 'Execution', 'Fragility', 'Price']);
    const panels = [...r.el.querySelectorAll<HTMLElement>('.pt-q-panel')];
    expect(panels.filter((p) => !p.hidden).map((p) => p.querySelector('h3')!.textContent)).toEqual(['Price: How much of this is already in the price?']);
    expect(r.text()).toContain('Revenue +20.0% from a year earlier (Q2 FY26)');           // a hidden panel is still text for search engines
    expect(r.text()).toContain('For information only — not investment advice.');
  });
  it('the drop test on top when the stock is well off its high', async () => {
    const r = await view();
    expect(r.el.querySelector('.pt-q-drop-lead')!.textContent!.replace(/\s+/g, ' ').trim()).toMatch(/^XYZ is 19\.9% below its high of .+ Over the same sessions the market \(SPY\) moved -1\.2% and its peers -3\.4%: 16\.6 of the 19\.9 points are its own\.$/);
    expect(r.el.querySelector('.pt-q-drop-since')!.textContent!.replace(/\s+/g, ' ')).toContain('Price weakened: P/E 14.0×');
  });
  it('opens with its answer in a sentence and names the company (from its own row in the peers\' list) instead of the ticker', async () => {
    const self = { ticker: 'XYZ', name: 'Xylo Zen Corporation', sector: 'Technology', logo: null, close: 96, chg1d: 0, offHigh: -0.2, pe: 14, ptUpside: 0.1,
      marketCap: 1e11, insiderNet: 0, volumeRatio: 1, spark: [], self: true };
    const r = await render(PtQuality, { ticker: 'XYZ' }, withData({ 'fundamentals@1': fund, 'events@1': events, 'price-series@1': series(),
      'screen@1': { asOf: '2026-10-23', rows: [self] } }));
    expect(r.el.querySelector('.pt-lede')!.textContent).toBe('Xylo Zen XYZ in the 12 months to Oct 23, 2026: 3 facts strengthened its quality, 3 weakened it, 4 to watch.');
    expect(r.el.querySelector('.pt-q-drop-lead')!.textContent!.trim()).toMatch(/^Xylo Zen XYZ is 19\.9% below/);
    // the company named as a link, its card on hover: in the lead and in the drop test
    expect([...r.el.querySelectorAll('.pt-lede a.pt-mention, .pt-q-drop-lead a.pt-mention')].map((a) => a.getAttribute('href'))).toEqual(['/stocks/xyz/', '/stocks/xyz/']);
    const other = { ...self, ticker: 'AAPL', name: 'Apple Inc.' };          // a row marked self but for another ticker is not its name
    const r2 = await render(PtQuality, { ticker: 'XYZ' }, withData({ 'fundamentals@1': fund, 'events@1': events, 'price-series@1': series(),
      'screen@1': { asOf: '2026-10-23', rows: [other] } }));
    expect(r2.el.querySelector('.pt-lede')!.textContent).toMatch(/^XYZ in the 12 months/);
  });
  it('asks for the peers first, then the prices of the company, SPY and up to six peers', async () => {
    const r = await render(PtQuality, { ticker: 'NVDA' });
    const keys = Object.keys(r.record);
    expect(keys.some((k) => k.startsWith('price-series@1|') && k.includes('"tickers":["NVDA","SPY"'))).toBe(true);
    expect(keys.filter((k) => k.startsWith('price-series@1|'))).toHaveLength(1);
  });
});

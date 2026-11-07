import { money, pct } from '../src/ds/format';
import { bollinger, macd, rsi, smaLast } from '../src/indicators';
import { demoFor, METRIC_KEYS, metricDemo, priceSeriesDemo, type MetricItem, type SectorBasket } from '../src/typologies';
import { bandRows, bandsOf, chartOf, lean, livened, overflowCount, PtCompanyHeader, sectorLine, sessionView, targetOf } from './pt-company-header';
import { basics, demo, liveDay, render, settle, withData } from './_spec';

const m = (key: string, value: number | null, o: Partial<MetricItem> = {}): MetricItem =>
  ({ key, label: key, value, text: null, unit: '%', delta: null, tone: 'flat', range: null, icon: null, hint: '', asOf: '2026-10-02', ...o });
const of = (items: MetricItem[], key: string) => items.find((x) => x.key === key)!;
/** 300 made-up closes that wander: enough for every indicator. */
const CLOSES = Array.from({ length: 300 }, (_, i) => 100 + 12 * Math.sin(i / 9) + 5 * Math.cos(i / 3.1));

describe('pt-company-header: which band a badge goes in', () => {
  it('RSI and Bollinger: oversold is bullish, overbought bearish, whatever the catalogue\'s tone', () => {
    expect(lean(m('rsi14', 23, { tone: 'neg' }))).toBe('g');
    expect(lean(m('rsi14', 30))).toBe('g');
    expect(lean(m('rsi14', 75, { tone: 'neg' }))).toBe('r');
    expect(lean(m('rsi14', 50))).toBe('n');
    expect(lean(m('bollinger', -0.1, { text: 'below lower', tone: 'neg' }))).toBe('g');
    expect(lean(m('bollinger', 1.2, { text: 'above upper', tone: 'neg' }))).toBe('r');
    expect(lean(m('bollinger', 0.4, { text: 'lower half' }))).toBe('n');
  });
  it('a cross counts once it has happened; a projected one is a forecast, so neutral', () => {
    expect(lean(m('ma_cross', 3, { text: 'Golden 3d ago', tone: 'pos' }))).toBe('g');
    expect(lean(m('ma_cross', 3, { text: 'Death 3d ago', tone: 'neg' }))).toBe('r');
    expect(lean(m('ma_cross', 5, { text: '↑ in ~5d', tone: 'pos' }))).toBe('n');
    expect(lean(m('ma_cross', 5, { text: '↓ in ~5d', tone: 'neg' }))).toBe('n');
  });
  it('position and context are always neutral, whatever their tone', () => {
    for (const k of ['support', 'resistance', 'off_high', 'off_ath', 'volume_ratio', 'pe', 'earnings_in', 'range_52w', 'atr_pct']) {
      expect(lean(m(k, 1, { tone: 'neg' })), k).toBe('n');
      expect(lean(m(k, 1, { tone: 'pos' })), k).toBe('n');
    }
  });
  it('the others follow their tone; no data is no badge; an unknown catalogue entry stays neutral', () => {
    for (const k of ['pt_upside', 'consensus', 'pe_vs_own', 'pe_vs_sector', 'fcf_yield', 'insider_net', 'news', 'trend', 'ma_detail', 'macd', 'sector_trend']) {
      expect(lean(m(k, 1, { tone: 'pos' })), k).toBe('g');
      expect(lean(m(k, 1, { tone: 'neg' })), k).toBe('r');
      expect(lean(m(k, 1)), k).toBe('n');
    }
    expect(lean(m('pe', null, { tone: 'na' }))).toBeNull();
    expect(lean(m('zeta_score', 2, { tone: 'pos' }))).toBe('n');
  });
});

describe('pt-company-header: badges at the delayed price', () => {
  const items = [m('pt_upside', 0.2, { tone: 'pos' }), m('pe', 20, { unit: 'x' }), m('pe_vs_own', -0.1), m('pe_vs_sector', 0.05), m('fcf_yield', 0.05, { tone: 'pos' }),
    m('off_high', -0.05), m('off_ath', -0.2), m('support', -0.1), m('resistance', 0.1), m('market_cap', 1e9, { unit: '$c' }),
    m('range_52w', 100, { unit: '$', range: { lo: 80, hi: 120, marks: [] } }), m('consensus', 30, { text: 'Buy', tone: 'pos' }), m('insider_net', -5e6, { tone: 'neg', unit: '$c' }),
    m('news', 4, { tone: 'pos' }), m('trend', null, { text: 'bullish', tone: 'pos' }), m('sector_trend', 0.1, { text: '▲ +10.0%', tone: 'pos' }), m('ma_cross', 3, { text: 'Golden 3d ago', tone: 'pos' }),
    m('atr_pct', 0.03), m('volume_ratio', 2, { tone: 'pos', unit: 'x' }), m('earnings_in', 13, { unit: 'd' }),
    m('rsi14', 40, { text: '40', unit: '' }), m('macd', 1, { tone: 'pos', unit: '' }), m('bollinger', 0.4, { text: 'lower half', unit: '' }),
    m('ma_detail', 0, { text: '20▼ 50▼ 100▼ 200▼', tone: 'neg', unit: '' }), m('trend_ma', 0, { text: '0 of 4 above', tone: 'neg', unit: '' })];
  const at110 = livened(items, 110, 100, null);

  it('the ratios follow the price', () => {
    expect(of(at110, 'pt_upside').value).toBeCloseTo(1.2 / 1.1 - 1, 10);
    expect(of(at110, 'pe').value).toBeCloseTo(22, 10);
    expect(of(at110, 'pe_vs_own').value).toBeCloseTo(0.9 * 1.1 - 1, 10);
    expect(of(at110, 'pe_vs_sector').value).toBeCloseTo(1.05 * 1.1 - 1, 10);
    expect(of(at110, 'fcf_yield').value).toBeCloseTo(0.05 / 1.1, 10);
    expect(of(at110, 'off_ath').value).toBeCloseTo(0.8 * 1.1 - 1, 10);
    expect(of(at110, 'support').value).toBeCloseTo(0.9 / 1.1 - 1, 10);
    expect(of(at110, 'resistance').value).toBeCloseTo(1.1 / 1.1 - 1, 10);
    expect(of(at110, 'market_cap').value).toBeCloseTo(1.1e9, 0);
    expect(of(at110, 'range_52w').value).toBe(110);
  });
  it('a price above the high is at the high, not beyond it', () => {
    expect(of(at110, 'off_high').value).toBe(0);
  });
  it('thresholds apply to the live values, so a badge can change band', () => {
    expect(of(at110, 'pe_vs_own').tone).toBe('flat'); // −1% from −10%
    expect(of(at110, 'pe_vs_sector').tone).toBe('neg'); // +15.5% from +5%
    expect(of(at110, 'fcf_yield').tone).toBe('pos'); // 4.5%, still over 4%
    expect(of(livened(items, 130, 100, null), 'fcf_yield').tone).toBe('flat'); // 3.8%
    expect(of(livened(items, 118, 100, null), 'pt_upside').tone).toBe('flat'); // +1.7%: under +5%
    expect(of(livened(items, 121, 100, null), 'pt_upside').tone).toBe('neg'); // the price is past the target
  });
  it('analysts, insiders, news, trend, sector, cross, ATR, volume and earnings stay at the last close', () => {
    for (const k of ['consensus', 'insider_net', 'news', 'trend', 'sector_trend', 'ma_cross', 'atr_pct', 'volume_ratio', 'earnings_in']) expect(of(at110, k), k).toEqual(of(items, k));
  });
  it('MAs, RSI, MACD and Bollinger: the shared functions on the last 300 closes with the price appended', () => {
    const p = 104, cs = [...CLOSES, p].slice(-300), out = livened(items, p, CLOSES.at(-1)!, CLOSES);
    expect(of(out, 'rsi14').value).toBeCloseTo(rsi(cs).at(-1)!, 8);
    expect(of(out, 'rsi14').text).toBe(String(Math.round(rsi(cs).at(-1)!)));
    const d = macd(cs), hist = d.macd.at(-1)! - d.signal.at(-1)!;
    expect(of(out, 'macd').value).toBeCloseTo(hist, 8);
    expect(of(out, 'macd').tone).toBe(hist > 0 ? 'pos' : 'neg');
    const b = bollinger(cs), lo = b.lower.at(-1)!, hi = b.upper.at(-1)!;
    expect(of(out, 'bollinger').value).toBeCloseTo((p - lo) / (hi - lo), 8);
    const n = [20, 50, 100, 200].filter((w) => p > smaLast(cs, w)!).length;
    expect(of(out, 'ma_detail').value).toBe(n);
    expect(of(out, 'trend_ma').text).toBe(`${n} of 4 above`);
    expect(of(out, 'ma_detail').tone).toBe(n >= 3 ? 'pos' : n <= 1 ? 'neg' : 'flat');
    expect(of(out, 'ma_detail').text).toMatch(/^20[▲▼] 50[▲▼] 100[▲▼] 200[▲▼]$/);
  });
  it('Bollinger names where the price sits, at each side of the bands', () => {
    const cs = CLOSES, top = bollinger(cs).upper.at(-1)! * 1.2, bottom = bollinger(cs).lower.at(-1)! * 0.8;
    expect(of(livened(items, top, cs.at(-1)!, cs), 'bollinger').text).toBe('above upper');
    expect(of(livened(items, bottom, cs.at(-1)!, cs), 'bollinger').text).toBe('below lower');
  });
  it('without the closes the indicators stay at the last close', () => {
    for (const k of ['rsi14', 'macd', 'bollinger', 'ma_detail', 'trend_ma']) expect(of(at110, k), k).toEqual(of(items, k));
  });
  it('a price on another basis (a split, a re-based day) changes nothing', () => {
    expect(livened(items, 40, 100, CLOSES)).toEqual(items);
    expect(livened(items, 151, 100, CLOSES)).toEqual(items);
    expect(of(livened(items, 149, 100, null), 'pe').value).toBeCloseTo(29.8, 8);
  });
  it('a badge with no data stays without data', () => {
    const none = [m('pe', null, { tone: 'na', unit: 'x' }), m('pt_upside', null, { tone: 'na' })];
    expect(livened(none, 110, 100, null)).toEqual(none);
  });
});

describe('pt-company-header: the three bands', () => {
  const items = [m('volume_ratio', 2, { tone: 'pos', unit: 'x' }), m('macd', -1, { tone: 'neg', unit: '' }), m('consensus', 62, { text: 'Buy', tone: 'pos', unit: '' }), m('pt_upside', 0.627, { tone: 'pos' }),
    m('market_cap', 4.8e12, { unit: '$c' }), m('trend_ma', 0, { text: '0 of 4 above', tone: 'neg', unit: '' }), m('ma_detail', 0, { text: '20▼ 50▼ 100▼ 200▼', tone: 'neg', unit: '' }),
    m('support', -0.002, { tone: 'neg' }), m('earnings_in', 13, { unit: 'd' }), m('pe', null, { tone: 'na', unit: 'x' }), m('range_52w', 200, { unit: '$', range: { lo: 164.27, hi: 243.37, marks: [] } }), m('zeta_score', 2, { tone: 'pos', unit: '' })];
  const b = bandsOf(items, { target: 325.66, low: false });
  const keys = (l: MetricItem[]) => l.map((x) => x.key);

  it('sorts them, in the order of the design', () => {
    expect(keys(b.g)).toEqual(['pt_upside', 'consensus']);
    expect(keys(b.r)).toEqual(['ma_detail', 'macd']);
    expect(keys(b.n)).toEqual(['earnings_in', 'support', 'volume_ratio', 'range_52w', 'zeta_score']);
  });
  it('leaves out market cap, Above MAs and what has no data', () => {
    expect(keys([...b.g, ...b.n, ...b.r])).not.toEqual(expect.arrayContaining(['market_cap']));
    expect(keys([...b.g, ...b.n, ...b.r])).not.toEqual(expect.arrayContaining(['trend_ma']));
    expect(keys([...b.g, ...b.n, ...b.r])).not.toEqual(expect.arrayContaining(['pe']));
  });
  it('a badge wears its band\'s colour: a near support is red on the site today, neutral here', () => {
    expect(b.g.every((x) => x.tone === 'pos')).toBe(true);
    expect(b.r.every((x) => x.tone === 'neg')).toBe(true);
    expect(b.n.every((x) => x.tone === 'flat')).toBe(true);
  });
  it('words: the target with its dollars, the consensus with its analysts, MAs with the count, the range in dollars', () => {
    expect(of(b.g, 'pt_upside').text).toBe('$325.66 +62.7%');
    expect(of(b.g, 'consensus').text).toBe('Buy · 62');
    expect(of(b.r, 'ma_detail').text).toBe('0 of 4');
    expect(of(b.n, 'range_52w').text).toBe('$164–$243');
  });
  it('a fund\'s consensus counts thousands of ratings: its figure has its comma', () => {
    const fund = [m('consensus', 11784, { text: 'Buy', tone: 'pos', unit: '' })];
    expect(of(bandsOf(fund, { target: null, low: false }).g, 'consensus').text).toBe('Buy · 11,784');
  });
  it('the low box says PT; without a target the badge keeps its percent', () => {
    expect(of(bandsOf(items, { target: 325.66, low: true }).g, 'pt_upside').label).toBe('PT');
    expect(of(bandsOf(items, { target: null, low: false }).g, 'pt_upside').text).toBeNull();
  });
  it('the target in dollars comes from the build\'s upside and close', () => {
    expect(targetOf([m('pt_upside', 0.5)], 200)).toBeCloseTo(300, 8);
    expect(targetOf([m('pt_upside', null, { tone: 'na' })], 200)).toBeNull();
    expect(targetOf([], 200)).toBeNull();
    expect(targetOf([m('pt_upside', 0.5)], null)).toBeNull();
  });
  it('the heights: in proportion, with a floor so a small band stays readable', () => {
    expect(bandRows(5, 4)).toBe('5.00fr auto 4.00fr');
    expect(bandRows(9, 1)).toBe('9.00fr auto 2.20fr');
    expect(bandRows(8, 0)).toBe('8.00fr auto 1.76fr');
    expect(bandRows(0, 0)).toBe('1.00fr auto 1.00fr');
  });
});

describe('pt-company-header: the session on screen', () => {
  const pts = [{ t: '2026-10-29', c: 98 }, { t: '2026-10-30', c: 100 }];
  const line = { session: '2026-10-31', prev: '2026-10-30', time: '1:20 PM ET', closed: false, closes: [101, 102, null] };

  it('no line yet: the page\'s own data', () => {
    expect(sessionView(pts, null)).toEqual({ hist: pts, slots: [], price: 100, prev: 98, state: 'static' });
  });
  it('a session newer than the data: running, at the newest price', () => {
    expect(sessionView(pts, line)).toEqual({ hist: pts, slots: line.closes, price: 102, prev: 100, state: 'running' });
  });
  it('the same after the close, before the nightly: closing', () => {
    expect(sessionView(pts, { ...line, closed: true }).state).toBe('closing');
  });
  it('the session is the data\'s last day: it moves to the zone, never drawn twice', () => {
    expect(sessionView(pts, { ...line, session: '2026-10-30', prev: '2026-10-29' })).toEqual({ hist: [pts[0]], slots: line.closes, price: 100, prev: 98, state: 'settled' });
  });
  it('a page older than the file keeps its end-of-day data', () => {
    expect(sessionView(pts, { ...line, session: '2026-11-03', prev: '2026-10-31' }).state).toBe('static');
    expect(sessionView(pts, { ...line, session: '2026-10-29' }).state).toBe('static');
  });
  it('a file without prev (uploaded before the field) is read as the next session', () => {
    const { prev: _, ...old } = line;
    expect(sessionView(pts, old).state).toBe('running');
  });
  it('a price on another basis (a split, a re-based day): the whole box keeps the page\'s own data', () => {
    expect(sessionView(pts, { ...line, closes: [25, 24.5] }).state).toBe('static');
    expect(sessionView(pts, { ...line, closes: [401] }).state).toBe('static');
    expect(sessionView(pts, { ...line, session: '2026-10-30', prev: '2026-10-29', closes: [25, 24.5] }).state).toBe('static');
    expect(sessionView(pts, { ...line, closes: [51] }).state).toBe('running');
  });
  it('a ticker with no line, or a line of nulls: the page\'s own data', () => {
    expect(sessionView(pts, { ...line, closes: [] }).state).toBe('static');
    expect(sessionView(pts, { ...line, closes: [null, null] }).state).toBe('static');
  });
  it('no prices at all', () => {
    expect(sessionView([], line)).toEqual({ hist: [], slots: [], price: null, prev: null, state: 'static' });
  });
});

describe('pt-company-header: what a row hides', () => {
  const ul = (tops: number[]) => ({ children: tops.map((offsetTop) => ({ offsetTop })) }) as unknown as HTMLElement;
  it('counts the badges below the first line', () => {
    expect(overflowCount(ul([0, 0, 0, 24, 24]))).toBe(2);
    expect(overflowCount(ul([0, 0, 0]))).toBe(0);
    expect(overflowCount(ul([]))).toBe(0);
  });
});

describe('pt-company-header: the chart', () => {
  const hist = Array.from({ length: 62 }, (_, i) => ({ t: `2026-${i < 30 ? '09' : '10'}-${String((i % 28) + 1).padStart(2, '0')}`, c: 100 + 10 * Math.sin(i / 5) }));
  const slots = [100, 101, 99, null, 104];
  const g = chartOf(hist, slots, hist.at(-1)!.c, 380, 300, false)!;
  const ys = (pts: string) => pts.trim().split(' ').map((q) => Number(q.split(',')[1]));
  const xs = (pts: string) => pts.trim().split(' ').map((q) => Number(q.split(',')[0]));

  it('the session is the last 20% of the plot, after a gutter for the prices', () => {
    expect(g.zoneX).toBe(310);
    expect(xs(g.hist)[0]).toBe(30);
    expect(xs(g.hist).at(-1)).toBe(310);
    expect(xs(g.day)[0]).toBe(310); // from the previous close
    expect(xs(g.day)[1]).toBe(313);
  });
  it('a full session reaches the right edge; one in progress leaves the rest empty', () => {
    const full = chartOf(hist, Array.from({ length: 78 }, () => 100), 100, 380, 300, false)!;
    expect(xs(full.day).at(-1)).toBe(380);
    expect(g.dot!.x).toBeLessThan(330);
  });
  it('one linear scale holds every value inside the plot', () => {
    for (const y of [...ys(g.hist), ...ys(g.day)]) { expect(y).toBeGreaterThanOrEqual(34); expect(y).toBeLessThanOrEqual(282); }
    const at = (v: number) => g.y1 - ((v - g.lo) / (g.hi - g.lo)) * (g.y1 - 34);
    expect(g.dot!.y).toBeCloseTo(at(104), 1);
  });
  it('labels only values and months the chart reaches', () => {
    for (const t of g.ticks) { expect(t.y).toBeGreaterThanOrEqual(34); expect(t.y).toBeLessThanOrEqual(282); expect(t.label).toMatch(/^\$\d+$/); }
    expect(g.months.map((m) => m.label)).toEqual(['Oct']);
    expect(g.ticks.length).toBeGreaterThan(1);
  });
  it('the low box has fewer lines and tighter margins', () => {
    const low = chartOf(hist, slots, hist.at(-1)!.c, 380, 104, true)!;
    expect(low.ticks.length).toBeLessThanOrEqual(g.ticks.length);
    for (const y of ys(low.hist)) expect(y).toBeGreaterThanOrEqual(18);
  });
  it('9:30 only when the zone has room for both ends', () => {
    expect(g.showOpen).toBe(true);
    expect(chartOf(hist, slots, 100, 250, 300, false)!.showOpen).toBe(false);
  });
  it('nothing to draw', () => expect(chartOf([], [], null, 380, 300, false)).toBeNull());
  it('before the prices load the zone stays empty, the last close on its edge', () => {
    const still = chartOf(hist, [], null, 380, 300, false)!;
    expect(still.day).toBe('');
    expect(still.dot!.x).toBe(310);
  });
});

describe('pt-company-header', () => {
  basics(PtCompanyHeader, { ticker: 'NVDA' });

  const metrics = metricDemo({ ticker: 'NVDA', metrics: [...METRIC_KEYS] });
  const series = priceSeriesDemo({ tickers: ['NVDA'], range: '3m', interval: '1d', rebase: false });
  const points = series[0]!.points, close = points.at(-1)!.c, lastDay = points.at(-1)!.t;
  const bands = bandsOf(metrics, { target: targetOf(metrics, close), low: false });
  const lineAt = (p: number | null, o: Record<string, unknown> = {}) => ({ session: '2099-01-02', prev: lastDay, asOf: '2099-01-02T18:20:00.000Z', time: '1:20 PM ET', closed: false, bars: { NVDA: p == null ? [] : [close, p] }, ...o });
  const open = (p: number | null, o = {}, resolve = demo()) => render(PtCompanyHeader, { ticker: 'NVDA' }, resolve, { browser: true, providers: liveDay({}, { bars: () => lineAt(p, o) }) });
  const wait = async (r: Awaited<ReturnType<typeof open>>) => { for (let i = 0; i < 5; i++) { await new Promise((d) => setTimeout(d)); r.f.detectChanges(); } };
  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** A browser that lays each row's first two badges on the first line. */
  const laidOut = () => vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.matches('.pt-hdr-row li:nth-child(n+3)') ? 30 : 0; });

  it('the server HTML has every badge in its band, the note, and nothing live', async () => {
    const r = await render(PtCompanyHeader, { ticker: 'NVDA' });
    for (const b of bands.g) expect(r.el.querySelector(`.pt-band-g [data-key="${b.key}"]`), b.key).not.toBeNull();
    for (const b of bands.r) expect(r.el.querySelector(`.pt-band-r [data-key="${b.key}"]`), b.key).not.toBeNull();
    for (const b of bands.n) expect(r.el.querySelector(`.pt-hdr-row [data-key="${b.key}"]`), b.key).not.toBeNull();
    expect(text(r.el.querySelector('.pt-hdr-note'))).toBe('Updates with the 15-min delayed price; analysts, insiders and news are from the last close. Not a forecast or investment advice.');
    expect(text(r.el.querySelector('.pt-hdr-px'))).not.toContain('delayed');
    expect(text(r.el.querySelector('.pt-card-close'))).toBe(money(close));
    expect(r.el.querySelector('.pt-hdr-svg')).not.toBeNull();
  });
  it('asks only for the company, the badges and three months while the page is being built', async () => {
    expect((await render(PtCompanyHeader, { ticker: 'NVDA' })).calls()).toBe(3);
  });
  it('full: the three words with their counts', async () => {
    const r = await render(PtCompanyHeader, { ticker: 'NVDA' });
    expect(text(r.el.querySelector('.pt-band-g .pt-band-h'))).toBe(`▲ Bullish readings ${bands.g.length}`);
    expect(text(r.el.querySelector('.pt-band-r .pt-band-h'))).toBe(`▼ Bearish readings ${bands.r.length}`);
    expect(text(r.el.querySelector('.pt-hdr-row .pt-hdr-l'))).toBe('Neutral');
  });
  it('low: arrows only, their names for screen readers; PT on the target; the short note; a bar with the proportion', async () => {
    const r = await render(PtCompanyHeader, { ticker: 'NVDA', size: 'low' });
    expect(r.el.querySelector('section')!.className).toContain('pt-hdr-low');
    const rows = [...r.el.querySelectorAll('.pt-hdr-row')];
    expect(rows.map((x) => text(x.querySelector('.pt-hdr-l')))).toEqual([`▲ ${bands.g.length}`, 'Neutral', `▼ ${bands.r.length}`]);
    expect(rows[0]!.querySelector('.pt-hdr-l [aria-label]')!.getAttribute('aria-label')).toBe('Bullish readings');
    expect(rows[2]!.querySelector('.pt-hdr-l [aria-label]')!.getAttribute('aria-label')).toBe('Bearish readings');
    expect(text(r.el.querySelector('[data-key="pt_upside"] .pt-badge-k'))).toBe('PT');
    expect(text(r.el.querySelector('.pt-hdr-note'))).toBe('Updates with the 15-min delayed price. Not a forecast or investment advice.');
    expect(r.el.querySelector<HTMLElement>('.pt-hdr-bar .pt-hdr-bar-g')!.style.flexGrow).toBe(String(bands.g.length));
    expect(r.el.querySelector<HTMLElement>('.pt-hdr-bar .pt-hdr-bar-r')!.style.flexGrow).toBe(String(bands.r.length));
  });
  it('a band with no badges stays, with its 0', async () => {
    const only = [{ key: 'macd', label: 'MACD', value: 1, text: null, unit: '', delta: null, tone: 'pos', range: null, icon: null, hint: 'h', asOf: '2026-10-02' }];
    const r = await render(PtCompanyHeader, { ticker: 'NVDA' }, withData({ 'metric@1': only }));
    expect(text(r.el.querySelector('.pt-band-r'))).toContain('Bearish readings 0');
    expect(text(r.el.querySelector('.pt-band-r'))).toContain('None right now');
  });
  it('the strip in the header finds the name, the ticker and cap, the close and the target', async () => {
    const r = await render(PtCompanyHeader, { ticker: 'NVDA' });
    expect(text(r.el.querySelector('.pt-card-name'))).toBe('Nvidia');
    expect(text(r.el.querySelector('.pt-card-who .pt-meta'))).toMatch(/^NVDA · \$[\d.]+[KMBT]$/);
    const pt = r.el.querySelector('.pt-card-pt') as HTMLElement;
    expect(pt.hidden).toBe(true);
    expect(text(pt)).toBe(`PT ${money(close * (1 + bands.g.concat(bands.n, bands.r).find((b) => b.key === 'pt_upside')!.value!))} ${pct(bands.g.concat(bands.n, bands.r).find((b) => b.key === 'pt_upside')!.value!)}`);
  });
  it('the session running: the delayed price, its change, its label, the badges at that price, the closes asked for once', async () => {
    const p = close * 1.02;
    const r = await open(p);
    await wait(r);
    expect(text(r.el.querySelector('.pt-card-close'))).toBe(money(p));
    const px = text(r.el.querySelector('.pt-hdr-px'));
    expect(px).toContain(pct(p / close - 1));
    expect(px).toContain('today · 1:20 PM ET, 15-min delayed');
    const u = metrics.find((m) => m.key === 'pt_upside')!.value!;
    expect(text(r.el.querySelector('[data-key="pt_upside"] .pt-badge-k'))).toBe('Price target at');
    expect(text(r.el.querySelector('[data-key="pt_upside"] .pt-badge-v'))).toBe(`${money(close * (1 + u))} ${pct((1 + u) / 1.02 - 1)}`);
    expect(r.calls()).toBe(4);
    expect(text(r.el.querySelector('.pt-hdr-svg'))).toContain('15-min delayed');
  });
  it('closed, before the nightly: the existing words', async () => {
    const r = await open(close * 1.02, { closed: true });
    await wait(r);
    expect(text(r.el.querySelector('.pt-hdr-px'))).toContain('today · close Jan 2, 2099, preliminary');
  });
  it('after the nightly: the session in the zone, the build\'s badges, no extra call', async () => {
    const r = await open(close * 1.02, { session: lastDay, prev: points.at(-2)!.t });
    await wait(r);
    expect(text(r.el.querySelector('.pt-card-close'))).toBe(money(close));
    expect(r.calls()).toBe(3);
    expect(text(r.el.querySelector('.pt-hdr-px'))).toContain('close');
    expect(r.el.querySelector('.pt-hdr-day')).not.toBeNull();
  });
  it('a ticker missing from the file stays at the last close, with no NaN anywhere', async () => {
    const r = await open(null);
    await wait(r);
    expect(text(r.el.querySelector('.pt-card-close'))).toBe(money(close));
    expect(r.html()).not.toContain('NaN');
    expect(r.calls()).toBe(3);
  });
  it('a refresh moves a badge to the other band, and the counts and heights follow', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const fixed = metrics.map((m) => (m.key === 'pe_vs_own' ? { ...m, value: -0.12, tone: 'pos' as const } : m));
      let p = close;
      const r = await render(PtCompanyHeader, { ticker: 'NVDA' }, withData({ 'metric@1': fixed }), { browser: true, providers: liveDay({}, { bars: () => lineAt(p), poll: { everyMs: 1000, anyTime: true } }) });
      await wait(r);
      expect(r.el.querySelector('.pt-band-g [data-key="pe_vs_own"]')).not.toBeNull();
      const before = r.el.querySelector<HTMLElement>('.pt-hdr-bands')!.style.gridTemplateRows;
      p = close * 1.1; // −12% × 1.1 → −3.2%: no longer cheaper than its own history by 10%
      vi.advanceTimersByTime(1000);
      await wait(r);
      expect(r.el.querySelector('.pt-band-g [data-key="pe_vs_own"]')).toBeNull();
      expect(r.el.querySelector('.pt-hdr-row [data-key="pe_vs_own"]')).not.toBeNull();
      expect(r.el.querySelector<HTMLElement>('.pt-hdr-bands')!.style.gridTemplateRows).not.toBe(before);
      expect(text(r.el.querySelector('.pt-card-close'))).toBe(money(close * 1.1));
    } finally { vi.useRealTimers(); }
  });
  it('Show all stays open through a refresh', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const top = laidOut();
    try {
      let p = close;
      const r = await render(PtCompanyHeader, { ticker: 'NVDA' }, demo(), { browser: true, providers: liveDay({}, { bars: () => lineAt(p), poll: { everyMs: 1000, anyTime: true } }) });
      await wait(r);
      const more = r.el.querySelector<HTMLElement>('.pt-hdr-row .pt-abtn')!;
      expect(text(more)).toBe('Show all'); // the count is drawn from an attribute: the server's text stays
      expect(more.dataset['n']).toBe(String(r.el.querySelectorAll('.pt-hdr-row li').length - 2));
      expect(more.getAttribute('aria-label')).toBe(`Show all, ${more.dataset['n']} more`);
      r.el.querySelector<HTMLButtonElement>('.pt-hdr-row .pt-abtn')!.click();
      await settle(r.f);
      expect(r.el.querySelector('.pt-hdr-row')!.classList.contains('open')).toBe(true);
      p = close * 1.01;
      vi.advanceTimersByTime(1000);
      await wait(r);
      expect(r.el.querySelector('.pt-hdr-row')!.classList.contains('open')).toBe(true);
      expect(text(r.el.querySelector('.pt-hdr-row .pt-abtn'))).toBe('Show less');
    } finally { vi.useRealTimers(); top.mockRestore(); }
  });
  it('all the Neutral badges fit: no button', async () => {
    const r = await render(PtCompanyHeader, { ticker: 'NVDA' }, demo(), { browser: true });
    await settle(r.f);
    const more = r.el.querySelector<HTMLButtonElement>('.pt-hdr-row .pt-abtn')!;
    expect(more.hidden).toBe(true); // jsdom lays everything on one line
  });
  it('the low box counts what each row hides as +N', async () => {
    const top = laidOut();
    try {
      const r = await render(PtCompanyHeader, { ticker: 'NVDA', size: 'low' }, demo(), { browser: true });
      await settle(r.f);
      const neutral = r.el.querySelector('.pt-band-n.pt-hdr-row')!;
      const more = neutral.querySelector<HTMLElement>('.pt-abtn')!;
      expect(text(more)).toBe('+');
      expect(more.dataset['n']).toBe(String(neutral.querySelectorAll('li').length - 2));
    } finally { top.mockRestore(); }
  });
  describe('the update', () => {
    const fixed = metrics.map((m) => (m.key === 'pe_vs_own' ? { ...m, value: -0.12, tone: 'pos' as const } : m));
    /** A browser with layout: a chip's place depends on its band, the box has a height. */
    function layout() {
      const animate = vi.fn();
      (Element.prototype as unknown as { animate: unknown }).animate = animate;
      const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const top = this.closest?.('.pt-band-g') ? 10 : this.closest?.('.pt-band-r') ? 200 : 100;
        return { left: 0, top, right: 100, bottom: top + 20, width: 100, height: 20, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
      });
      const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
      return { animate, restore: () => { rect.mockRestore(); height.mockRestore(); delete (Element.prototype as unknown as { animate?: unknown }).animate; } };
    }
    const session = async (reduce = false) => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const media = vi.spyOn(window as unknown as { matchMedia: () => unknown }, 'matchMedia').mockReturnValue({ matches: reduce });
      let p = close;
      const r = await render(PtCompanyHeader, { ticker: 'NVDA' }, withData({ 'metric@1': fixed }), { browser: true, providers: liveDay({}, { bars: () => lineAt(p), poll: { everyMs: 1000, anyTime: true } }) });
      await wait(r);
      return { r, up: async () => { p = close * 1.1; vi.advanceTimersByTime(1000); await wait(r); }, done: () => { vi.useRealTimers(); media.mockRestore(); } };
    };
    beforeAll(() => { if (!window.matchMedia) (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false }); });

    it('the box keeps its height while the prices change', async () => {
      const l = layout(), s = await session();
      try {
        const body = s.r.el.querySelector<HTMLElement>('.pt-hdr-body')!;
        expect(body.style.height).toBe('300px');
        await s.up();
        expect(body.style.height).toBe('300px');
      } finally { s.done(); l.restore(); }
    });
    it('a badge that changes band slides there with a transform, 300 ms', async () => {
      const l = layout(), s = await session();
      try {
        l.animate.mockClear();
        await s.up();
        const slid = l.animate.mock.calls.find(([k]) => /translate\(0px, -90px\)/.test(JSON.stringify(k)));
        expect(slid).toBeDefined();
        expect(slid![1]).toMatchObject({ duration: 300 });
        expect(l.animate.mock.instances.some((el) => (el as unknown as Element).getAttribute?.('data-key') === 'pe_vs_own')).toBe(true);
      } finally { s.done(); l.restore(); }
    });
    it('a value that changes flashes', async () => {
      const l = layout(), s = await session();
      try {
        await s.up();
        expect(s.r.el.querySelector('[data-key="pt_upside"] .pt-badge-v')!.classList.contains('pt-hdr-flash')).toBe(true);
        expect(s.r.el.querySelector('.pt-card-close')!.classList.contains('pt-hdr-flash')).toBe(true);
        expect(s.r.el.querySelector('[data-key="consensus"] .pt-badge-v')!.classList.contains('pt-hdr-flash')).toBe(false);
      } finally { s.done(); l.restore(); }
    });
    it('none of this under prefers-reduced-motion', async () => {
      const l = layout(), s = await session(true);
      try {
        l.animate.mockClear();
        await s.up();
        expect(l.animate).not.toHaveBeenCalled();
        expect(s.r.el.querySelector('[data-key="pt_upside"] .pt-badge-v')!.classList.contains('pt-hdr-flash')).toBe(false);
      } finally { s.done(); l.restore(); }
    });
  });
  it('no price series: the bands alone', async () => {
    const r = await render(PtCompanyHeader, { ticker: 'NVDA' }, withData({ 'price-series@1': null }));
    expect(r.el.querySelector('.pt-hdr-svg')).toBeNull();
    expect(r.el.querySelector('.pt-band-g')).not.toBeNull();
    expect(r.html()).not.toContain('NaN');
  });
});

describe('pt-company-header: a fund', () => {
  const fund = { ticker: 'SMH', name: 'VanEck Semiconductor ETF', sector: null, industry: null, logo: null, kind: 'etf', coverage: 0.99 };
  const items = metricDemo({ ticker: 'SMH', metrics: [...METRIC_KEYS] }).filter((m) => !['insider_net', 'pe_vs_own', 'pe_vs_sector', 'sector_trend', 'fcf_yield'].includes(m.key));
  it('its note says how much the basket figures cover, and says nothing of insiders, a stock or a company', async () => {
    const { text } = await render(PtCompanyHeader, { ticker: 'SMH', size: 'full' }, withData({ 'company@1': fund, 'metric@1': items }));
    expect(text()).toContain('Basket figures cover 99% of this fund.');
    expect(text()).not.toMatch(/insiders|\b(this|the) (stock|company)\b/i);
  });
  it('a company\'s note stays as it was', async () => {
    const t = (await render(PtCompanyHeader, { ticker: 'NVDA', size: 'full' })).text();
    expect(t).not.toContain('Basket figures');
    expect(t).toContain('analysts, insiders and news are from the last close');
  });
});

describe('pt-company-header, for a sector', () => {
  const base = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
  const h = (ticker: string, weight: number, close: number | null) => ({ ticker, name: `${ticker} Inc.`, logo: null, weight, ret: 0.01, upside: 0.1, label: 'Buy', close });
  const TECH: SectorBasket = { ...base, value: 1e12, companies: 3, holdings: [h('AAA', 0.5, 100), h('BBB', 0.3, 50), h('CCC', 0.2, 20)],
    series: base.series.map((p) => ({ t: p.t, c: (p.c / base.value) * 1e12 })) };
  const bars = (o: Record<string, unknown> = {}) => ({ session: '2099-01-02', prev: TECH.asOf, asOf: '2099-01-02T18:20:00.000Z', time: '1:20 PM ET', closed: false,
    bars: { AAA: [101, 102], BBB: [null, 51], CCC: [] as (number | null)[] }, ...o });
  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('sectorLine: a weighted line from the companies\' bars; a company not yet traded counts flat; bars of another session give null', () => {
    const l = sectorLine(TECH, bars())!;
    expect(l).toMatchObject({ session: '2099-01-02', prev: TECH.asOf, time: '1:20 PM ET', closed: false });
    expect(l.closes[0]).toBeCloseTo(1e12 * (0.5 * 1.01 + 0.3 * 1 + 0.2 * 1), -3);
    expect(l.closes[1]).toBeCloseTo(1e12 * (0.5 * 1.02 + 0.3 * 1.02 + 0.2 * 1), -3);
    expect(sectorLine(TECH, { ...bars(), bars: { AAA: [null, null] } })!.closes).toEqual([null, null]);
    expect(sectorLine(TECH, bars({ prev: '2099-01-01' }))).toBeNull();
  });
  it("a sector's header: its name, companies and value, a year of its value, the payload's badges only, the fund line linking its page", async () => {
    const r = await render(PtCompanyHeader, { sector: 'Technology' }, withData({ 'sector@1': TECH }));
    expect(text(r.el.querySelector('.pt-card-name'))).toBe('Technology');
    expect(text(r.el.querySelector('.pt-card-who .pt-meta'))).toBe('3 companies · $1T');
    expect(text(r.el.querySelector('.pt-card-close'))).toBe('$1T');
    expect(r.el.querySelector('.pt-hdr-cap')!.textContent).toContain('1 year');
    expect(r.el.querySelector('.pt-hdr-svg')!.getAttribute('aria-label')).toMatch(/^What Technology's companies are worth: today's shares at each day's adjusted close/);
    const keys = [...r.el.querySelectorAll('[data-key]')].map((x) => x.getAttribute('data-key'));
    expect(keys.every((k) => ['pt_upside', 'consensus', 'pe', 'earnings_in', 'news'].includes(k!))).toBe(true);
    const note = r.el.querySelector('.pt-hdr-note')!;
    expect(text(note)).toBe("XLK holds the S&P 500's technology companies; this page weighs every technology company on pretickt. Updates with the 15-min delayed prices of its companies; analysts and news are from the last close. Not a forecast or investment advice.");
    expect(note.querySelector('a')!.getAttribute('href')).toBe('/etfs/xlk/');
    expect(r.calls()).toBe(1);
  });
  it('live: value and move follow the bars, the label says 15-min delayed', async () => {
    const r = await render(PtCompanyHeader, { sector: 'Technology' }, withData({ 'sector@1': TECH }), { browser: true, providers: liveDay({}, { bars: () => bars() }) });
    for (let i = 0; i < 5; i++) { await new Promise((d) => setTimeout(d)); r.f.detectChanges(); }
    expect(text(r.el.querySelector('.pt-hdr-px'))).toContain('1:20 PM ET, 15-min delayed');
    expect(text(r.el.querySelector('.pt-hdr-chg'))).toBe(pct(0.5 * 0.02 + 0.3 * 0.02));
  });
  it('nothing says stock, fund or PT', async () => {
    const r = await render(PtCompanyHeader, { sector: 'Technology' }, withData({ 'sector@1': TECH }));
    const t = text(r.el.querySelector('section')).replace(text(r.el.querySelector('.pt-hdr-note')), '');
    expect(t).not.toMatch(/\bstock\b|\bfund\b|\bPT\b/);
  });
  it('not available', async () => {
    expect((await render(PtCompanyHeader, { sector: 'Technology' }, withData({ 'sector@1': null }))).el.querySelector('.pt-na')).not.toBeNull();
  });
});

describe('pt-company-header: a year on a phone', () => {
  it('month labels keep apart: one is left out rather than overlap the one before', () => {
    const days: { t: string; c: number }[] = [];
    for (let d = new Date('2025-10-01T00:00:00Z'); days.length < 252; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) days.push({ t: d.toISOString().slice(0, 10), c: 100 + days.length });
    const g = chartOf(days, [], null, 340, 300, false)!;
    const xs = g.months.map((m) => m.x);
    expect(xs.length).toBeGreaterThan(3);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(26);
  });
  it("a sector's target badge says its percent, never trillions of dollars", async () => {
    const base = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
    const r = await render(PtCompanyHeader, { sector: 'Technology' }, withData({ 'sector@1': base }));
    const badge = r.el.querySelector('[data-key="pt_upside"]')!.textContent!;
    expect(badge).toMatch(/%/);
    expect(badge).not.toMatch(/\$/);
  });
});

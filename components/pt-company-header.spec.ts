import { bollinger, macd, rsi, smaLast } from '../src/indicators';
import type { MetricItem } from '../src/typologies';
import { bandRows, bandsOf, lean, livened, PtCompanyHeader, sessionView, targetOf } from './pt-company-header';
import { basics } from './_spec';

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
  it('a ticker with no line, or a line of nulls: the page\'s own data', () => {
    expect(sessionView(pts, { ...line, closes: [] }).state).toBe('static');
    expect(sessionView(pts, { ...line, closes: [null, null] }).state).toBe('static');
  });
  it('no prices at all', () => {
    expect(sessionView([], line)).toEqual({ hist: [], slots: [], price: null, prev: null, state: 'static' });
  });
});

describe('pt-company-header', () => {
  basics(PtCompanyHeader, { ticker: 'NVDA' });
});

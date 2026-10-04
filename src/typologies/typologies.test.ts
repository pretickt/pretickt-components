import { describe, expect, it } from 'vitest';
import { getTypology, TYPOLOGIES } from './index';
import { Ticker } from './common';
import { METRIC_KEYS, METRIC_LABELS } from './metric';
import { moveBreakdownDemo } from './move-breakdown';

const samples: Record<string, unknown[]> = {
  'metric@1': [{ ticker: 'NVDA', metrics: ['pe', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in', 'pe_vs_sector'] },
               { ticker: 'NVDA', metrics: [...METRIC_KEYS] }],
  'fundamentals@1': [{ ticker: 'NVDA' }, { ticker: 'BRK.B', periods: 4 }],
  'insider@1': [{ ticker: 'NVDA' }, { ticker: 'AAPL', days: 90 }],
  'news@1': [{ ticker: 'NVDA' }, { ticker: 'AAPL', limit: 5 }],
  'move-breakdown@1': [{ ticker: 'NVDA' }, { ticker: 'BRK.B', window: '5d' }],
  'screen@1': [{ scope: { list: 'biggest_losers' } }, { scope: { peersOf: 'NVDA' }, limit: 8 }, { scope: { list: 'undervalued' }, limit: 25 }],
  'price-series@1': [{ tickers: ['NVDA'], range: '1y' }, { tickers: ['AAPL', 'MSFT'], range: '1m', rebase: true }],
  'events@1': [{ scope: { by: 'ticker', ticker: 'BRK.B', range: '1y', ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] },
               { scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings'] },
               { scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] }],
  'analysts@1': [{ ticker: 'NVDA' }],
};

describe('typologies', () => {
  it('registers exactly the release-1 typologies', () => {
    expect(Object.keys(TYPOLOGIES).sort()).toEqual(['analysts@1', 'events@1', 'fundamentals@1', 'insider@1', 'metric@1', 'move-breakdown@1', 'news@1', 'price-series@1', 'screen@1']);
    expect(getTypology('metric@2')).toBeUndefined();
  });

  for (const [id, list] of Object.entries(samples)) {
    describe(id, () => {
      const t = getTypology(id)!;
      for (const raw of list) {
        it(`demo is valid and deterministic for ${JSON.stringify(raw)}`, () => {
          const p = t.params.parse(raw);
          const a = t.demo(p);
          expect(t.payload.parse(a)).toEqual(a);
          expect(t.demo(p)).toEqual(a);
        });
      }
    });
  }

  it('carries every beta and video badge in the metric catalogue, each with a label and a hint', () => {
    expect(METRIC_KEYS).toHaveLength(25);
    for (const k of ['support', 'resistance', 'rsi14', 'ma_cross', 'ma_detail', 'bollinger', 'macd', 'atr_pct', 'volume_ratio', 'consensus',
      'market_cap', 'off_ath', 'trend', 'sector_trend', 'insider_net', 'fcf_yield', 'pe_vs_own', 'news'] as const) {
      expect(METRIC_KEYS).toContain(k);
      expect(METRIC_LABELS[k].hint.length).toBeGreaterThan(20);
    }
    expect(new Set(Object.values(METRIC_LABELS).map((m) => m.label)).size).toBe(25);
  });

  it('macro events carry a label and no ticker', () => {
    const t = getTypology('events@1')!;
    const out = t.demo(t.params.parse({ scope: { by: 'universe', month: '2026-10' }, kinds: ['macro'] })) as { items: { kind: string; meta: { label: string } }[] };
    expect(out.items.length).toBeGreaterThan(0);
    for (const i of out.items) { expect(i.kind).toBe('macro'); expect(i.meta.label).toMatch(/Fed|CPI|PCE|FOMC|Jobs|GDP/); expect('ticker' in i).toBe(false); }
  });

  it('move-breakdown parts add up to the stock move', () => {
    const t = getTypology('move-breakdown@1')!;
    const m = t.demo(t.params.parse({ ticker: 'NVDA' })) as { ret: number; market: number; sector: number; specific: number };
    expect(m.market + m.sector + m.specific).toBeCloseTo(m.ret, 10);
  });
  it('news urls must be http(s)', () => {
    const t = getTypology('news@1')!;
    const bad = { asOf: '2026-10-02', items: [{ publishedAt: '2026-10-02T10:00:00Z', title: 't', site: 's', url: 'javascript:alert(1)', sentiment: null }] };
    expect(t.payload.safeParse(bad).success).toBe(false);
  });
  it('rejects index symbols and junk tickers', () => {
    for (const bad of ['^GSPC', 'nvda', '', 'TOOLONGTICKERX', 'A B']) expect(Ticker.safeParse(bad).success).toBe(false);
    for (const ok of ['NVDA', 'BRK.B', 'BF.B', 'F']) expect(Ticker.safeParse(ok).success).toBe(true);
  });

  it('caps price-series at 8 tickers', () => {
    const t = getTypology('price-series@1')!;
    expect(t.params.safeParse({ tickers: Array(9).fill('NVDA'), range: '1y' }).success).toBe(false);
  });

  it('price-series demo has one bar per session for the range, ending at DEMO_ASOF or before', () => {
    const t = getTypology('price-series@1')!;
    const out = t.demo(t.params.parse({ tickers: ['NVDA'], range: '1m' })) as { points: { t: string }[] }[];
    expect(out[0]!.points).toHaveLength(21);
    expect(out[0]!.points.at(-1)!.t <= '2026-09-30').toBe(true);
  });
  it('move-breakdown story links must be http(s)', () => {
    const m = moveBreakdownDemo({ ticker: 'NVDA', window: '1d' });
    const bad = { ...m, news: { ...m.news, top: [{ title: 't', site: 's', url: 'javascript:alert(1)', sentiment: null }] } };
    expect(getTypology('move-breakdown@1')!.payload.safeParse(bad).success).toBe(false);
  });
});

describe('range windows', () => {
  it('a range is the last N sessions: events@1 and price-series@1 start on the same day', async () => {
    const { rangeStart, DEMO_ASOF, eventsDemo, priceSeriesDemo } = await import('./index');
    for (const range of ['1m', '1y', '5y'] as const) {
      const first = priceSeriesDemo({ tickers: ['KO'], range, interval: '1d', rebase: false })[0]!.points[0]!.t;
      expect(rangeStart(DEMO_ASOF, range), range).toBe(first);
      const past = eventsDemo({ scope: { by: 'ticker', ticker: 'KO', range, ahead: 0 }, kinds: ['earnings', 'dividend'] }).items;
      expect(past.every((e) => e.date >= first), range).toBe(true);
    }
  });
});

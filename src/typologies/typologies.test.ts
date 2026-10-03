import { describe, expect, it } from 'vitest';
import { getTypology, TYPOLOGIES } from './index';
import { Ticker } from './common';

const samples: Record<string, unknown[]> = {
  'metric@1': [{ ticker: 'NVDA', metrics: ['pe', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in', 'pe_vs_sector'] }],
  'price-series@1': [{ tickers: ['NVDA'], range: '1y' }, { tickers: ['AAPL', 'MSFT'], range: '1m', rebase: true }],
  'events@1': [{ scope: { by: 'ticker', ticker: 'BRK.B', range: '1y', ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] },
               { scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings'] }],
  'analysts@1': [{ ticker: 'NVDA' }],
};

describe('typologies', () => {
  it('registers exactly the four foundation typologies', () => {
    expect(Object.keys(TYPOLOGIES).sort()).toEqual(['analysts@1', 'events@1', 'metric@1', 'price-series@1']);
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
});

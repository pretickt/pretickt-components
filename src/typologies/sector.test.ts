import { describe, expect, it } from 'vitest';
import { basketLead, basketMoved, sectorFundLine } from './basket-words';
import { EventsParams } from './events';
import { demoFor, getTypology } from './index';
import { NewsParams } from './news';
import { SECTOR_BADGES, SECTOR_FUNDS, SectorBasketPayload, type SectorBasket } from './sector';
import { SECTORS } from './values';

const demo = (sector: string) => demoFor({ t: 'sector@1', params: { sector } }) as SectorBasket;
const tech = demo('Technology');
const ok = (v: unknown) => SectorBasketPayload.safeParse(v).success;

describe('sector@1', () => {
  it('is registered; the demo parses and is deterministic', () => {
    expect(getTypology('sector@1')).toBeTruthy();
    expect(ok(tech)).toBe(true);
    expect(demo('Technology')).toEqual(tech);
    expect(tech).toMatchObject({ kind: 'sector', sector: 'Technology', name: 'Technology', tracker: 'XLK', coverage: 1, state: 'ok' });
  });
  it('every sector names the fund that tracks it', () => {
    expect(SECTOR_FUNDS).toEqual({ Technology: 'XLK', 'Financial Services': 'XLF', Healthcare: 'XLV', 'Consumer Cyclical': 'XLY', 'Consumer Defensive': 'XLP',
      Industrials: 'XLI', Energy: 'XLE', 'Basic Materials': 'XLB', Utilities: 'XLU', 'Real Estate': 'XLRE', 'Communication Services': 'XLC' });
    expect(Object.keys(SECTOR_FUNDS).sort()).toEqual([...SECTORS].sort());
  });
  it('a sector payload with coverage under 1 or state low is refused: the basket is the whole sector', () => {
    expect(ok({ ...tech, coverage: 0.99 })).toBe(false);
    expect(ok({ ...tech, state: 'low' })).toBe(false);
  });
  it('series is oldest first, one point a session', () => {
    const t = tech.series.map((p) => p.t);
    expect(t.length).toBeGreaterThan(200);
    expect([...t].sort()).toEqual(t);
    expect(new Set(t).size).toBe(t.length);
    expect(ok({ ...tech, series: [...tech.series].reverse() })).toBe(false);
    expect(ok({ ...tech, series: [tech.series[0], ...tech.series] })).toBe(false);
  });
  it("badges are only the basket's: pt_upside, consensus, pe, earnings_in, news, market_cap", () => {
    expect(SECTOR_BADGES).toEqual(['pt_upside', 'consensus', 'pe', 'earnings_in', 'news', 'market_cap']);
    expect(tech.badges.map((b) => b.key).sort()).toEqual([...SECTOR_BADGES].sort());
    expect(ok({ ...tech, badges: [...tech.badges, { ...tech.badges[0]!, key: 'rsi14' }] })).toBe(false);
  });
  it('every holding has its close at the session, for the live line', () => {
    expect(tech.holdings.every((h) => h.close === null || h.close > 0)).toBe(true);
    expect(tech.holdings.length).toBeGreaterThan(25);
  });
  it('the demo of Financial Services reads Advantage and Fragility not comparable', () => {
    const f = demo('Financial Services');
    expect(f.questions!.filter((q) => !q.comparable).map((q) => q.key).sort()).toEqual(['advantage', 'fragility']);
  });
});

describe("the sector scopes of news@1 and events@1", () => {
  it('news@1 takes a sector and a limit; a ticker and a sector together are refused', () => {
    expect(NewsParams.safeParse({ sector: 'Technology', limit: 10 }).success).toBe(true);
    expect(NewsParams.safeParse({ sector: 'Technology' }).data).toEqual({ sector: 'Technology', limit: 20 });
    expect(NewsParams.safeParse({ sector: 'Tech' }).success).toBe(false);
    expect(NewsParams.safeParse({ ticker: 'NVDA', sector: 'Technology' }).success).toBe(false);
    expect(NewsParams.safeParse({ ticker: 'NVDA' }).data).toEqual({ ticker: 'NVDA', limit: 20 });
    expect(demoFor({ t: 'news@1', params: { sector: 'Technology', limit: 3 } })).toMatchObject({ items: [{}, {}, {}] });
  });
  it('events@1 takes a sector scope with range and ahead', () => {
    const p = EventsParams.safeParse({ scope: { by: 'sector', sector: 'Energy', range: '1y' }, kinds: ['earnings', 'macro'] });
    expect(p.success).toBe(true);
    expect(p.data!.scope).toEqual({ by: 'sector', sector: 'Energy', range: '1y', ahead: 90 });
    expect(demoFor({ t: 'events@1', params: { scope: { by: 'sector', sector: 'Energy', range: '1y', ahead: 90 }, kinds: ['earnings'] } })).toMatchObject({ items: expect.any(Array) });
  });
});

describe('a basket in words, for a sector', () => {
  it('basketLead speaks of the sector', () => {
    const qs = ['demand', 'advantage', 'economics', 'execution', 'fragility'].map((key, i) => ({ key, pos: [0.7, 0.6, 0.5, 0.4, 0.3][i]!, comparable: true, share: 0.98 }));
    expect(basketLead('Technology', qs, 'sector')).toBe("By weight, Technology's companies are strong on 50% of the questions about the business; weakest on fragility. Each reading rests on at least 98% of the sector.");
    expect(basketLead('SMH', qs)).toBe("By weight, SMH's holdings are strong on 50% of the questions about the business; weakest on fragility. Each reading rests on at least 98% of the fund.");
  });
  it('basketMoved names the sector as it names a fund', () => {
    expect(basketMoved('Technology', 0.012, [{ name: 'NVIDIA Corporation', points: 0.004 }], [])).toBe('Technology rose 1.20%. Nvidia added 0.40 points.');
  });
});

describe('the fund line', () => {
  it("names the fund that holds the sector's S&P 500 companies, word for word, the sector in lower case", () => {
    expect(sectorFundLine('Technology', 'XLK')).toBe("XLK holds the S&P 500's technology companies; this page weighs every technology company on pretickt.");
    expect(sectorFundLine('Communication Services', 'XLC')).toBe("XLC holds the S&P 500's communication services companies; this page weighs every communication services company on pretickt.");
  });
});

describe('the largest companies, one per company', () => {
  it('top: at most ten, largest first, the share classes of one company merged into one row', () => {
    const t = demo('Technology').top;
    expect(t.length).toBeGreaterThan(3);
    expect(t.length).toBeLessThanOrEqual(10);
    expect(t.map((x) => x.weight)).toEqual([...t.map((x) => x.weight)].sort((a, b) => b - a));
    expect(new Set(t.map((x) => x.name)).size).toBe(t.length);
    expect(ok({ ...tech, top: Array.from({ length: 11 }, (_, i) => ({ ...tech.top[0]!, name: `C${i}` })) })).toBe(false);
  });
});

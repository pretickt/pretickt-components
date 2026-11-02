import { describe, expect, it } from 'vitest';
import { sourceConditions } from './rule';
import { alertSourceOf, eventHref, SECTION_OF, type AlertSource } from './sources';

describe("the badge each component's bell adds (spec §2)", () => {
  it("each placement of www adds the spec's badge", () => {
    const cases: [string, Record<string, unknown>, AlertSource | null][] = [
      ['pt-movers', { sort: 'cap' }, { c: 'session-move' }],
      ['pt-screen', { list: 'biggest_losers', limit: 20 }, { c: 'session-move', p: { dir: 'down' } }],
      ['pt-screen', { list: 'biggest_gainers' }, { c: 'session-move', p: { dir: 'up' } }],
      ['pt-screen', { list: '52w_low' }, { c: 'near-52w', p: { side: 'low' } }],
      ['pt-screen', { list: '52w_high', sector: 'Energy' }, { c: 'near-52w', p: { side: 'high' }, sector: 'Energy' }],
      ['pt-screen', { list: 'undervalued' }, { c: 'undervalued' }],
      ['pt-screen', { list: 'insider_buying' }, { c: 'insider-buying' }],
      ['pt-screen', { list: 'most_active' }, { c: 'volume-spike' }],
      ['pt-screen', { list: 'largest' }, { c: 'mega-caps' }],
      ['pt-screen', { peersOf: 'NVDA', limit: 8 }, { c: 'session-move' }],
      ['pt-logo-map', {}, { c: 'session-move' }],
      ['pt-logo-map', { lens: 'mega' }, { c: 'session-move', mega: true }],
      ['pt-logo-map', { lens: 'news' }, { c: 'news-spike' }],
      ['pt-logo-map', { lens: 'social' }, { c: 'social-buzz' }],
      ['pt-logo-map', { sector: 'Technology', form: 'card' }, { c: 'session-move', sector: 'Technology' }],
      ['pt-company-card', { ticker: 'NVDA', size: 'wide' }, { c: 'price-crosses', ticker: 'NVDA' }],
      ['pt-why-today', { ticker: 'NVDA', window: '1d' }, { c: 'session-move', ticker: 'NVDA' }],
      ['pt-metric', { ticker: 'NVDA', metrics: ['pe'] }, { c: 'pe-vs-sector', ticker: 'NVDA' }],
      ['pt-price-target', { ticker: 'NVDA' }, { c: 'analyst-upside', ticker: 'NVDA' }],
      ['pt-price-events', { ticker: 'NVDA', range: '1y' }, { c: 'earnings-soon', ticker: 'NVDA' }],
      ['pt-financials', { ticker: 'NVDA', periods: 8 }, { c: 'earnings-surprise', ticker: 'NVDA' }],
      ['pt-insiders', { ticker: 'NVDA', days: 365 }, { c: 'insider-buying', ticker: 'NVDA' }],
      ['pt-news', { ticker: 'NVDA', limit: 5 }, { c: 'news-spike', ticker: 'NVDA' }],
      ['pt-value', { ticker: 'NVDA', compact: true }, { c: 'piotroski', ticker: 'NVDA' }],
      ['pt-answer', { topic: 'forecast', ticker: 'NVDA' }, { c: 'analyst-upside', ticker: 'NVDA' }],
      ['pt-answer', { topic: 'price-target', ticker: 'NVDA' }, { c: 'analyst-upside', ticker: 'NVDA' }],
      ['pt-answer', { topic: 'financials', ticker: 'NVDA' }, { c: 'earnings-surprise', ticker: 'NVDA' }],
      ['pt-answer', { topic: 'insiders', ticker: 'NVDA' }, { c: 'insider-buying', ticker: 'NVDA' }],
      ['pt-answer', { topic: 'peers', ticker: 'NVDA' }, { c: 'session-move', ticker: 'NVDA' }],
      ['pt-answer', { topic: 'list', list: '52w_low', sector: 'Energy' }, { c: 'near-52w', p: { side: 'low' }, sector: 'Energy' }],
      ['pt-answer', { topic: 'technicals', ticker: 'NVDA' }, { c: 'below-average', p: { days: '200' }, ticker: 'NVDA' }],
      ['pt-screen', { list: 'upgrades_downgrades' }, { c: 'grade-change', p: { dir: 'up' } }],
      ['pt-screen', { list: 'golden_cross' }, { c: 'ma-cross', p: { dir: 'golden' } }],
      ['pt-screen', { list: 'death_cross' }, { c: 'ma-cross', p: { dir: 'death' } }],
      ['pt-screen', { list: 'low_pe' }, { c: 'pe-vs-sector' }],
      ['pt-screen', { list: 'piotroski' }, { c: 'piotroski', p: { side: 'high', score: 8 } }],
      ['pt-screen', { list: 'unusual_volume', sector: 'Energy' }, { c: 'volume-spike', p: { times: 2 }, sector: 'Energy' }],
      ['pt-answer', { topic: 'earnings', month: '2026-11' }, { c: 'earnings-soon' }],
      ['pt-answer', { topic: 'dividends', month: '2026-11' }, null],
      ['pt-calendar', { month: '2026-11', kind: 'earnings' }, { c: 'earnings-soon' }],
      ['pt-calendar', { view: 'week', kind: 'earnings' }, { c: 'earnings-soon' }],
      ['pt-calendar', { month: '2026-11', kind: 'dividend' }, null],
    ];
    for (const [tag, props, want] of cases) expect(alertSourceOf(tag, props), `${tag} ${JSON.stringify(props)}`).toEqual(want);
  });

  it('a pt-metric bell adds the badge of the metrics it shows (the Technicals, the Snapshot)', () => {
    expect(alertSourceOf('pt-metric', { ticker: 'NVDA', metrics: ['trend', 'trend_ma', 'ma_detail', 'rsi14', 'range_52w', 'volume_ratio'] }))
      .toEqual({ c: 'below-average', ticker: 'NVDA' });
    expect(alertSourceOf('pt-metric', { ticker: 'NVDA', metrics: ['off_high', 'range_52w'] })).toEqual({ c: 'near-52w', ticker: 'NVDA' });
    expect(alertSourceOf('pt-metric', { ticker: 'NVDA', metrics: ['volume_ratio'] })).toEqual({ c: 'volume-spike', ticker: 'NVDA' });
    expect(alertSourceOf('pt-metric', { ticker: 'NVDA', metrics: ['pt_upside', 'consensus'] })).toEqual({ c: 'analyst-upside', ticker: 'NVDA' });
    expect(alertSourceOf('pt-metric', { ticker: 'NVDA', metrics: ['insider_net'] })).toEqual({ c: 'insider-buying', ticker: 'NVDA' });
    expect(alertSourceOf('pt-metric', { ticker: 'NVDA', metrics: ['news', 'volume_ratio'] })).toEqual({ c: 'news-spike', ticker: 'NVDA' });
    expect(alertSourceOf('pt-metric', { ticker: 'NVDA', metrics: ['pe', 'pe_vs_sector', 'market_cap'] })).toEqual({ c: 'pe-vs-sector', ticker: 'NVDA' });
  });

  it('unknown props fall back', () => {
    expect(alertSourceOf('pt-screen', { list: 'new_list' })).toBeNull();
    expect(alertSourceOf('pt-logo-map', { lens: 'x' })).toEqual({ c: 'session-move' });
    expect(alertSourceOf('pt-feed', { ticker: 'NVDA' })).toBeNull();
    expect(alertSourceOf('pt-something-new', {})).toBeNull();
    expect(alertSourceOf('pt-why-today', { ticker: 42 })).toEqual({ c: 'session-move' });   // not a ticker: no stock
    expect(alertSourceOf('pt-answer', {})).toBeNull();
  });

  it('sourceConditions puts the badge first, then mega caps, sector and the stock', () => {
    expect(sourceConditions({ c: 'session-move', p: { dir: 'up' }, mega: true, sector: 'Energy', ticker: 'XOM' }).map((rc) => rc.c))
      .toEqual(['session-move', 'mega-caps', 'sector', 'one-stock']);
    const [badge, , sector, stock] = sourceConditions({ c: 'session-move', p: { dir: 'up' }, mega: true, sector: 'Energy', ticker: 'XOM' });
    expect(badge!.p).toEqual({ dir: 'up', pct: 5 });
    expect(sector!.p).toEqual({ sector: 'Energy' });
    expect(stock!.p).toEqual({ ticker: 'XOM' });
  });

  it('eventHref lowercases the ticker', () => {
    expect(eventHref('BRK.B', 'e1')).toBe('/stocks/brk.b/?alert=e1');
  });

  it('the conditions shown on the company page link to their section', () => {
    expect(SECTION_OF['session-move']).toBe('why');
    expect(SECTION_OF['analyst-upside']).toBe('targets');
    expect(SECTION_OF['mega-caps']).toBeUndefined();
  });
});

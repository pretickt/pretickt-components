// Type-only imports: the generated slot imports this file by its path, so it is part of the main bundle and must not pull the catalog.
import type { ConditionId, Params } from './catalog';

/**
 * What a bell adds (Romeo, 2026-11-01: "la campanella sta ovunque come share e cliccando aggiunge un badge legato alla sezione"):
 * the condition its section shows, tied to what the section shows — the page's stock, the list's sector, the mega caps' map.
 */
export interface AlertSource { c: ConditionId; p?: Params; ticker?: string; sector?: string; mega?: true }

const TICKER = /^[A-Z][A-Z0-9]{0,5}(\.[A-Z])?$/;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** The badge of a list (pt-screen's `list`): null for a list no condition matches. */
function ofList(list: unknown, sector: string | null): AlertSource | null {
  const by: Record<string, AlertSource> = {
    biggest_losers: { c: 'session-move', p: { dir: 'down' } }, biggest_gainers: { c: 'session-move', p: { dir: 'up' } },
    '52w_low': { c: 'near-52w', p: { side: 'low' } }, '52w_high': { c: 'near-52w', p: { side: 'high' } },
    undervalued: { c: 'undervalued' }, insider_buying: { c: 'insider-buying' }, most_active: { c: 'volume-spike' }, largest: { c: 'mega-caps' },
  };
  const s = typeof list === 'string' && Object.hasOwn(by, list) ? by[list]! : null;
  return s && sector ? { ...s, sector } : s;
}

/** The badge a placement's bell adds, from its component and props; null where no condition fits (no bell there). */
export function alertSourceOf(tag: string, props: Record<string, unknown>): AlertSource | null {
  const t = str(props['ticker']), ticker = t && TICKER.test(t) ? t : null, sector = str(props['sector']);
  const of = (c: ConditionId): AlertSource => (ticker ? { c, ticker } : { c });
  switch (tag) {
    case 'pt-movers': return { c: 'session-move' };
    case 'pt-screen': return props['peersOf'] ? { c: 'session-move' } : ofList(props['list'], sector);
    case 'pt-logo-map': {
      const lens = props['lens'];
      if (lens === 'news') return { c: 'news-spike' };
      if (lens === 'social') return { c: 'social-buzz' };
      const base: AlertSource = lens === 'mega' ? { c: 'session-move', mega: true } : { c: 'session-move' };
      return sector ? { ...base, sector } : base;
    }
    case 'pt-company-card': return of('price-crosses');
    case 'pt-why-today': return of('session-move');
    case 'pt-metric': return of('pe-vs-sector');
    case 'pt-price-target': return of('analyst-upside');
    case 'pt-price-events': return of('earnings-soon');
    case 'pt-financials': return of('earnings-surprise');
    case 'pt-insiders': return of('insider-buying');
    case 'pt-news': return of('news-spike');
    case 'pt-value': return of('piotroski');
    case 'pt-answer':
      switch (props['topic']) {
        case 'forecast': case 'price-target': return of('analyst-upside');
        case 'financials': return of('earnings-surprise');
        case 'insiders': return of('insider-buying');
        case 'peers': return of('session-move');
        case 'list': return ofList(props['list'], sector);
        case 'earnings': return { c: 'earnings-soon' };
        default: return null;   // dividends: no condition is about dividends
      }
    case 'pt-calendar': return props['kind'] === 'dividend' ? null : { c: 'earnings-soon' };
    default: return null;
  }
}

/** Where on a company page each condition shows (the alert card's links); none for the universe and what the page lacks. */
export const SECTION_OF: Partial<Record<ConditionId, string>> = {
  'session-move': 'why', 'price-crosses': 'card', 'below-average': 'technicals', 'near-52w': 'technicals', 'volume-spike': 'technicals',
  'pe-vs-sector': 'snapshot', undervalued: 'targets', 'analyst-upside': 'targets', 'grade-change': 'targets', piotroski: 'value',
  'earnings-surprise': 'financials', 'news-spike': 'news', 'earnings-soon': 'price',
};

/** The company page an alert's email opens, with the event to show on top. */
export const eventHref = (ticker: string, eventId: string) => `/stocks/${ticker.toLowerCase()}/?alert=${encodeURIComponent(eventId)}`;

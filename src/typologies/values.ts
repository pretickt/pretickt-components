/**
 * Plain values components use in the browser (no zod: the schemas stay on the server). The typology schemas are built from these,
 * so the two can never disagree.
 */
export const RANGES = ['1m', '3m', '6m', '1y', '2y', '5y'] as const;
export type RangeValue = (typeof RANGES)[number];

/** |sentiment| at or below this is neutral (news dots, why-today). */
export const SENTIMENT_FLAT = 0.15;

/** Code-unit string order: the same in Node and every browser (localeCompare depends on the locale). */
export const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The metric catalogue in its two page groups, in display order (as on beta's company page). Adding a key is a minor version of metric@1. */
export const METRIC_GROUPS = {
  /** Valuation, analysts, insiders, cash flow, news. */
  snapshot: ['pe', 'pe_vs_sector', 'pe_vs_own', 'pt_upside', 'consensus', 'market_cap', 'fcf_yield', 'insider_net', 'earnings_in', 'news'],
  /** Price and technicals. */
  technicals: ['trend', 'sector_trend', 'ma_detail', 'trend_ma', 'ma_cross', 'rsi14', 'support', 'resistance', 'off_high', 'off_ath', 'range_52w',
    'bollinger', 'macd', 'atr_pct', 'volume_ratio'],
} as const;
export const METRIC_KEYS = [...METRIC_GROUPS.snapshot, ...METRIC_GROUPS.technicals] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/** The market-wide calendar's window around the latest session's month (events@1 universe scopes; the calendar's arrows stop there). */
export const CALENDAR_MONTHS = { back: 1, ahead: 3 } as const;

/** The provider's (FMP) sectors of the universe: sector pages, `screen@1` list scopes, the header's menu. */
export const SECTORS = ['Technology', 'Industrials', 'Financial Services', 'Healthcare', 'Consumer Cyclical', 'Consumer Defensive', 'Utilities',
  'Real Estate', 'Basic Materials', 'Energy', 'Communication Services'] as const;
export type Sector = (typeof SECTORS)[number];

/** The most rows a list (`screen@1`) answers: the whole universe (518 today), so "Show 20 more" can reach every company. */
export const SCREEN_MAX = 600;

/** The window of the insider_net metric (open-market buys minus sales), in calendar days: the badge, the nightly and the screen list. */
export const INSIDER_WINDOW_DAYS = 90;

/** Ongoing moves (`ongoing-moves@1`, the home's chart): the order of each side — market cap, or the size of this week's move. */
export const MOVE_SORTS = ['cap', 'move'] as const;
export type MoveSort = (typeof MOVE_SORTS)[number];
/** At most this many companies a side (this week's losers, this week's gainers). */
export const MOVES_PER_SIDE = 14;
/** A move counts while it is larger than this and has not reversed by as much (beta's 4% zigzag), as a fraction. */
export const MOVES_THRESHOLD = 0.04;
/** The market's structural trend (SPY), as the stocks' "Trend" badge reads it. */
export const MARKET_TRENDS = ['bullish', 'bearish', 'sideways'] as const;
export type MarketTrend = (typeof MARKET_TRENDS)[number];

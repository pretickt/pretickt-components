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
/** A mega cap: a market value of $200 billion or more (pt-logo-map's mega lens, the alerts' Mega caps). */
export const MEGA_CAP = 200e9;
/** The undervalued list's upside: an average analyst target at least this far above the price (with a P/E under the sector's median). */
export const UNDERVALUED_UPSIDE = 0.15;

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

/**
 * The feed (`feed@1`): event cards around the latest session — technical (moves, highs and lows, crosses, RSI), fundamental (earnings,
 * dividends, splits, analyst actions, insiders), news days, and the market's own (macro releases, SPY's signals).
 */
export const FEED_GROUPS = ['technical', 'fundamental', 'news', 'market'] as const;
export type FeedGroup = (typeof FEED_GROUPS)[number];
/**
 * What a card's number is: the move of the session it hit (`day`), the move from that session to the last close (`since`), a signed
 * estimate for a coming event (`expected`: a dividend's drop) or the usual size of the move such an event comes with (`typical`, ±).
 */
export const FEED_IMPACTS = ['day', 'since', 'expected', 'typical'] as const;
export type FeedImpact = (typeof FEED_IMPACTS)[number];
/** The kinds the platform sends today; a payload may carry others (render them generically). */
export const FEED_KINDS = ['earnings', 'dividend', 'split', 'upgrade', 'downgrade', 'insider-buy', 'insider-sell', 'big-move', 'news', 'high-52w',
  'low-52w', 'golden-cross', 'death-cross', 'cross-ahead', 'overbought', 'oversold', 'macro'] as const;
export type FeedKind = (typeof FEED_KINDS)[number];
/** At most this many cards a feed (the most relevant, shown in date order). */
export const FEED_MAX = 40;
/** The window around the latest session, in calendar days. */
export const FEED_DAYS = { back: 120, ahead: 60 } as const;
/** A card's chart: at most this many closes (around a past event, or the last ones before a coming event). */
export const FEED_SPARK_MAX = 40;

/** A fund's share on the site under which no basket figure is shown (design 2026-11-05). */
export const BASKET_MIN_COVERAGE = 0.8;
/** The companies behind a fund's move, a side. */
export const BASKET_MOVERS = 5;
/** Under this a holding's part in a fund's move reads 0.00 points: on a day when almost everything fell, naming it as what pushed the fund up says nothing. */
export const BASKET_MOVER_MIN = 0.00005;
/** The holdings in the server's HTML; `Show all` opens the rest. */
export const BASKET_SHOWN = 25;

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

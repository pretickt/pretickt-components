import * as z from 'zod/mini';
import { DEMO_ASOF, IsoDate, prng, round, Ticker, ToneSchema } from './common';

import { METRIC_GROUPS, METRIC_KEYS, type MetricKey } from './values';
export { METRIC_GROUPS, METRIC_KEYS, type MetricKey };
type Tone = z.infer<typeof ToneSchema>;

/** Above `pos` reads good, below `neg` bad, flat in between. */
const band = (pos: number, neg: number) => (v: number): Tone => (v > pos ? 'pos' : v < neg ? 'neg' : 'flat');
const sign = (v: number): Tone => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat');
const flat = (): Tone => 'flat';

/**
 * Tone rules of the keys whose tone depends on the value alone. The nightly enrichment and the demo both apply them, so the demo shows
 * every state real data can produce. Other keys take their tone from text or context (a regime, a crossing, a level being near).
 */
const VALUE_TONES = {
  pe: flat,
  pe_vs_sector: (v: number): Tone => (v < -0.1 ? 'pos' : v > 0.1 ? 'neg' : 'flat'),
  pe_vs_own: (v: number): Tone => (v < -0.1 ? 'pos' : v > 0.1 ? 'neg' : 'flat'),
  pt_upside: band(0.05, 0),
  market_cap: flat,
  fcf_yield: band(0.04, 0),
  insider_net: sign,
  earnings_in: flat,
  off_high: band(-0.05, -0.2),
  off_ath: band(-0.05, -0.3),
  range_52w: flat,
  rsi14: (v: number): Tone => (v <= 30 || v >= 70 ? 'neg' : 'flat'),
  macd: (v: number): Tone => (v > 0 ? 'pos' : 'neg'),
  atr_pct: flat,
  volume_ratio: (v: number): Tone => (v >= 1.5 ? 'pos' : 'flat'),
} satisfies Partial<Record<MetricKey, (v: number) => Tone>>;
export const VALUE_TONED = Object.keys(VALUE_TONES) as (keyof typeof VALUE_TONES)[];

/** The tone of `value` for a value-toned key ('na' without a value); null for keys whose tone is not a function of the value. */
export function metricTone(key: MetricKey, value: number | null): Tone | null {
  const rule = (VALUE_TONES as Partial<Record<MetricKey, (v: number) => Tone>>)[key];
  if (!rule) return null;
  return value == null || !Number.isFinite(value) ? 'na' : rule(value);
}

export const MetricParams = z.object({
  ticker: Ticker,
  metrics: z.array(z.enum(METRIC_KEYS)).check(z.minLength(1), z.maxLength(32)),
});

/** x = multiple, % = fraction shown as percent, $ = price, $c = compact dollars, d = days, '' = plain number. */
export const BADGE_UNITS = ['x', '%', '$', '$c', 'd', ''] as const;

/** One metric — and the shape of every badge (`Badge` in the SDK): any component can build one from any data and draw it with `h.badge`. */
export const MetricItem = z.object({
  /** A string, not the enum: components must render unknown keys generically. */
  key: z.string(),
  label: z.string(),
  value: z.nullable(z.number()),
  /** Categorical value shown instead of the number (e.g. "3 of 4 above"). */
  text: z.nullable(z.string()),
  unit: z.enum(BADGE_UNITS),
  delta: z.nullable(z.number()),
  tone: ToneSchema,
  range: z.nullable(z.object({ lo: z.number(), hi: z.number(), marks: z.array(z.object({ label: z.string(), value: z.number() })) })),
  icon: z.nullable(z.string()),
  /** One-sentence definition shown in the tooltip. Templated, never LLM prose. */
  hint: z.string(),
  asOf: IsoDate,
  /** Rendered as coloured dots instead of the value (e.g. one per news story, by sentiment). */
  dots: z.optional(z.nullable(z.array(z.enum(['pos', 'neg'])))),
});
export const MetricPayload = z.array(MetricItem);
export type MetricParams = z.output<typeof MetricParams>;
export type MetricItem = z.infer<typeof MetricItem>;
export type MetricPayload = z.infer<typeof MetricPayload>;

/** The window of the insider_net metric (open-market buys minus sales), in calendar days: the badge, the nightly and the screen list. */
export const INSIDER_WINDOW_DAYS = 90;

export const METRIC_LABELS: Record<MetricKey, { label: string; unit: MetricItem['unit']; hint: string }> = {
  pe: { label: 'P/E', unit: 'x', hint: 'Price divided by trailing twelve-month earnings per share.' },
  pe_vs_sector: { label: 'P/E vs sector', unit: '%', hint: 'P/E relative to the median P/E of the same sector in the tracked universe.' },
  pe_vs_own: { label: 'P/E vs own', unit: '%', hint: 'Current P/E versus the average of its last four quarter-end P/E ratios.' },
  pt_upside: { label: 'Target upside', unit: '%', hint: 'Average of the latest target of each analyst firm in the last 12 months, versus the last close.' },
  consensus: { label: 'Consensus', unit: '', hint: 'Analyst rating consensus from the latest monthly snapshot of strong buy to strong sell counts.' },
  market_cap: { label: 'Market cap', unit: '$c', hint: 'Market capitalisation from the company profile.' },
  fcf_yield: { label: 'FCF yield', unit: '%', hint: 'Free cash flow of the last four reported quarters divided by market capitalisation.' },
  // a plain string (a template would keep this table out of tree-shaking); the test pins it to INSIDER_WINDOW_DAYS
  insider_net: { label: 'Insiders', unit: '$c', hint: 'Open-market insider purchases minus sales over the last 90 days (SEC Form 4 filings).' },
  earnings_in: { label: 'Earnings in', unit: 'd', hint: 'Calendar days until the next scheduled earnings report (provider estimate until confirmed).' },
  news: { label: 'News', unit: '', hint: 'Stories published in the last session; each dot is one story, coloured by its sentiment as classified by AI.' },
  off_high: { label: 'Off 52w high', unit: '%', hint: 'Last close versus the highest close of the last 52 weeks.' },
  off_ath: { label: 'Off ATH', unit: '%', hint: 'Last close versus the highest adjusted close in the stored history (since 2006).' },
  range_52w: { label: '52w range', unit: '$', hint: 'Where the last close sits between the 52-week low and high closes.' },
  trend: { label: 'Trend', unit: '', hint: 'Market structure: higher highs and higher lows (bullish), lower highs and lower lows (bearish), or neither (sideways).' },
  trend_ma: { label: 'Above MAs', unit: '', hint: 'How many of the 20, 50, 100 and 200-day moving averages the last close is above.' },
  ma_detail: { label: 'MAs', unit: '', hint: 'Whether the last close is above (▲) or below (▼) its 20, 50, 100 and 200-day moving averages.' },
  ma_cross: { label: 'MA20×50', unit: 'd', hint: 'Sessions until the 20-day average crosses the 50-day at the current drift, or the most recent cross.' },
  sector_trend: { label: 'Sector', unit: '%', hint: 'Three-month change of an equal-weighted index of the same sector in the tracked universe, with its moving-average regime.' },
  rsi14: { label: 'RSI', unit: '', hint: '14-day Relative Strength Index: below 30 is oversold, above 70 overbought.' },
  support: { label: 'Support', unit: '%', hint: 'Nearest support below the last close, where swing lows clustered, and how many times it held.' },
  resistance: { label: 'Resistance', unit: '%', hint: 'Nearest resistance above the last close, where swing highs clustered, and how many times it rejected price.' },
  bollinger: { label: 'Bollinger', unit: '', hint: 'Where the last close sits within the 20-day Bollinger bands (two standard deviations).' },
  macd: { label: 'MACD', unit: '', hint: 'MACD histogram (12, 26, 9): above zero means rising momentum, below zero falling.' },
  atr_pct: { label: 'ATR', unit: '%', hint: 'Average true range over 14 days as a share of the price: the typical daily move.' },
  volume_ratio: { label: 'Volume', unit: 'x', hint: 'Last session volume versus its 20-day average.' },
};

const CONSENSUS = ['Strong Sell', 'Sell', 'Hold', 'Buy', 'Strong Buy'];
const BOLL = ['below lower', 'lower half', 'upper half', 'above upper'];

export const metricSamples: z.input<typeof MetricParams>[] = [
  { ticker: 'NVDA', metrics: ['pe', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in', 'pe_vs_sector'] },
  { ticker: 'NVDA', metrics: [...METRIC_KEYS] },
];

/** A catalogue entry this build has never seen: components must render it generically (checked by the contract). */
export function metricUnknownVariant(payload: MetricPayload): MetricPayload {
  return payload[0] ? [...payload, { ...payload[0], key: 'unknown_metric', label: 'Unknown', icon: 'no-such-icon', text: null }] : payload;
}

export function metricDemo(p: MetricParams): MetricPayload {
  return p.metrics.map((key): MetricItem => {
    const item = demoItem(p.ticker, key);
    return { ...item, tone: metricTone(key, item.value) ?? item.tone };
  });
}

/** One demo item. Value-toned keys leave `tone` to metricTone; the others set it from their text, as the nightly does. */
function demoItem(ticker: string, key: MetricKey): MetricItem {
  const r = prng(`${ticker}:${key}`);
  const meta = METRIC_LABELS[key];
  const base = { key, label: meta.label, unit: meta.unit, hint: meta.hint, asOf: DEMO_ASOF, text: null, delta: null, range: null, icon: null, tone: 'na' as const };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  switch (key) {
    case 'pe': return { ...base, value: round(10 + r() * 40, 1) };
    case 'pe_vs_sector':
    case 'pe_vs_own': return { ...base, value: round(r() * 0.8 - 0.4, 3) };
    case 'pt_upside': return { ...base, value: round(r() * 0.5 - 0.1, 3), icon: 'target' };
    case 'consensus': { const c = pick(CONSENSUS); return { ...base, value: Math.floor(10 + r() * 50), text: c, tone: c.includes('Buy') ? 'pos' : c.includes('Sell') ? 'neg' : 'flat' }; }
    case 'market_cap': return { ...base, value: round(1e10 + r() * 3e12, 0) };
    case 'fcf_yield': return { ...base, value: round(r() * 0.08 - 0.01, 4) };
    case 'insider_net': return { ...base, value: round((r() - 0.7) * 2e8, 0) };
    case 'earnings_in': { const d = 1 + Math.floor(r() * 80); return { ...base, value: d, icon: d <= 7 ? 'alert' : 'calendar' }; }
    case 'news': {
      const n = Math.floor(r() * 7);
      const dots = Array.from({ length: n }, () => (r() > 0.45 ? 'pos' as const : 'neg' as const));
      return { ...base, value: n, tone: 'flat', dots };
    }
    case 'off_high':
    case 'off_ath': return { ...base, value: round(-r() * 0.3, 3), icon: 'peak' };
    case 'range_52w': {
      const lo = round(80 + r() * 40); const hi = round(lo * (1.3 + r() * 0.5)); const v = round(lo + (hi - lo) * r());
      return { ...base, value: v, range: { lo, hi, marks: [{ label: 'Last', value: v }] } };
    }
    case 'trend': { const t = pick(['bullish', 'bearish', 'sideways'] as const); return { ...base, value: null, text: t, tone: t === 'bullish' ? 'pos' : t === 'bearish' ? 'neg' : 'flat', icon: t === 'bearish' ? 'trend-down' : 'trend-up' }; }
    case 'trend_ma': {
      const above = Math.floor(r() * 5);
      return { ...base, value: above, text: `${above} of 4 above`, tone: above >= 3 ? 'pos' : above <= 1 ? 'neg' : 'flat', icon: above >= 3 ? 'trend-up' : 'trend-down' };
    }
    case 'ma_detail': {
      const marks = [20, 50, 100, 200].map((p) => ({ label: `MA${p}`, value: round(r() * 0.2 - 0.1, 3) }));
      const above = marks.filter((m) => m.value > 0).length;
      return { ...base, value: above, text: marks.map((m) => `${m.label.slice(2)}${m.value > 0 ? '▲' : '▼'}`).join(' '), tone: above >= 3 ? 'pos' : above <= 1 ? 'neg' : 'flat' };
    }
    case 'ma_cross': { const d = 1 + Math.floor(r() * 30); const up = r() > 0.5; return { ...base, value: d, text: `${up ? '↑' : '↓'} in ~${d}d`, tone: up ? 'pos' : 'neg' }; }
    case 'sector_trend': { const v = round(r() * 0.3 - 0.1, 3); return { ...base, value: v, text: `${v > 0 ? '▲' : '▼'} ${round(v * 100, 1)}%`, tone: v > 0 ? 'pos' : 'neg' }; }
    case 'rsi14': return { ...base, value: round(15 + r() * 70, 1), delta: round(r() * 20 - 10, 1) };
    case 'support': { const v = round(-r() * 0.08, 3); return { ...base, value: v, tone: v > -0.02 ? 'neg' : 'flat' }; }
    case 'resistance': return { ...base, value: round(r() * 0.08, 3), tone: 'flat' };
    case 'bollinger': { const st = pick(BOLL); return { ...base, value: round(r(), 2), text: st, tone: st.includes('above') || st.includes('below') ? 'neg' : 'flat' }; }
    case 'macd': return { ...base, value: round(r() * 4 - 2, 2) };
    case 'atr_pct': return { ...base, value: round(0.01 + r() * 0.04, 4) };
    case 'volume_ratio': return { ...base, value: round(0.4 + r() * 2.5, 2) };
  }
}

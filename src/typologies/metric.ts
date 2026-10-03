import * as z from 'zod/mini';
import { DEMO_ASOF, IsoDate, prng, round, Ticker, ToneSchema } from './common';

/** The metric catalogue. Adding a key is a minor version of metric@1. */
export const METRIC_KEYS = [
  // valuation and analysts
  'pe', 'pe_vs_sector', 'pe_vs_own', 'pt_upside', 'consensus', 'market_cap', 'fcf_yield', 'insider_net', 'earnings_in', 'news',
  // price and technicals
  'off_high', 'off_ath', 'range_52w', 'trend', 'trend_ma', 'ma_detail', 'ma_cross', 'sector_trend',
  'rsi14', 'support', 'resistance', 'bollinger', 'macd', 'atr_pct', 'volume_ratio',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const MetricParams = z.object({
  ticker: Ticker,
  metrics: z.array(z.enum(METRIC_KEYS)).check(z.minLength(1), z.maxLength(32)),
});

export const MetricItem = z.object({
  /** A string, not the enum: components must render unknown keys generically. */
  key: z.string(),
  label: z.string(),
  value: z.nullable(z.number()),
  /** Categorical value shown instead of the number (e.g. "3 of 4 above"). */
  text: z.nullable(z.string()),
  unit: z.enum(['x', '%', '$', '$c', 'd', '']),
  delta: z.nullable(z.number()),
  tone: ToneSchema,
  range: z.nullable(z.object({ lo: z.number(), hi: z.number(), marks: z.array(z.object({ label: z.string(), value: z.number() })) })),
  icon: z.nullable(z.string()),
  /** One-sentence definition shown in the tooltip. Templated, never LLM prose. */
  hint: z.string(),
  asOf: IsoDate,
  /** Coloured dots instead of the value (news sentiment). */
  dots: z.optional(z.nullable(z.array(z.enum(['pos', 'neg'])))),
});
export const MetricPayload = z.array(MetricItem);
export type MetricItem = z.infer<typeof MetricItem>;
export type MetricPayload = z.infer<typeof MetricPayload>;

export const METRIC_LABELS: Record<MetricKey, { label: string; unit: MetricItem['unit']; hint: string }> = {
  pe: { label: 'P/E', unit: 'x', hint: 'Price divided by trailing twelve-month earnings per share.' },
  pe_vs_sector: { label: 'P/E vs sector', unit: '%', hint: 'P/E relative to the median P/E of the same sector in the tracked universe.' },
  pe_vs_own: { label: 'P/E vs own', unit: '%', hint: 'Current P/E versus the average of its last four quarter-end P/E ratios.' },
  pt_upside: { label: 'Target upside', unit: '%', hint: 'Average of the latest target of each analyst firm in the last 12 months, versus the last close.' },
  consensus: { label: 'Consensus', unit: '', hint: 'Analyst rating consensus from the latest monthly snapshot of strong buy to strong sell counts.' },
  market_cap: { label: 'Market cap', unit: '$c', hint: 'Market capitalisation from the company profile.' },
  fcf_yield: { label: 'FCF yield', unit: '%', hint: 'Free cash flow of the last four reported quarters divided by market capitalisation.' },
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

export function metricDemo(p: z.infer<typeof MetricParams>): MetricPayload {
  return p.metrics.map((key): MetricItem => {
    const r = prng(`${p.ticker}:${key}`);
    const meta = METRIC_LABELS[key];
    const base = { key, label: meta.label, unit: meta.unit, hint: meta.hint, asOf: DEMO_ASOF, text: null, delta: null, range: null, icon: null };
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
    switch (key) {
      case 'pe': return { ...base, value: round(10 + r() * 40, 1), tone: 'flat' };
      case 'pe_vs_sector':
      case 'pe_vs_own': { const v = round(r() * 0.8 - 0.4, 3); return { ...base, value: v, tone: v < 0 ? 'pos' : 'neg' }; }
      case 'pt_upside': { const v = round(r() * 0.5 - 0.1, 3); return { ...base, value: v, tone: v > 0 ? 'pos' : 'neg', icon: 'target' }; }
      case 'consensus': { const c = pick(CONSENSUS); return { ...base, value: Math.floor(10 + r() * 50), text: c, tone: c.includes('Buy') ? 'pos' : c.includes('Sell') ? 'neg' : 'flat' }; }
      case 'market_cap': return { ...base, value: round(1e10 + r() * 3e12, 0), tone: 'flat' };
      case 'fcf_yield': { const v = round(r() * 0.08 - 0.01, 4); return { ...base, value: v, tone: v > 0.04 ? 'pos' : v < 0 ? 'neg' : 'flat' }; }
      case 'insider_net': { const v = round((r() - 0.7) * 2e8, 0); return { ...base, value: v, tone: v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat' }; }
      case 'earnings_in': { const d = 1 + Math.floor(r() * 80); return { ...base, value: d, tone: 'flat', icon: d <= 7 ? 'alert' : 'calendar' }; }
      case 'news': {
        const n = Math.floor(r() * 7);
        const dots = Array.from({ length: n }, () => (r() > 0.45 ? 'pos' as const : 'neg' as const));
        return { ...base, value: n, tone: 'flat', dots };
      }
      case 'off_high':
      case 'off_ath': { const v = round(-r() * 0.3, 3); return { ...base, value: v, tone: v < -0.1 ? 'neg' : 'flat', icon: 'peak' }; }
      case 'range_52w': {
        const lo = round(80 + r() * 40); const hi = round(lo * (1.3 + r() * 0.5)); const v = round(lo + (hi - lo) * r());
        return { ...base, value: v, tone: 'flat', range: { lo, hi, marks: [{ label: 'Last', value: v }] } };
      }
      case 'trend': { const t = pick(['bullish', 'bearish', 'sideways'] as const); return { ...base, value: null, text: t, tone: t === 'bullish' ? 'pos' : t === 'bearish' ? 'neg' : 'flat', icon: t === 'bearish' ? 'trend-down' : 'trend-up' }; }
      case 'trend_ma': {
        const above = Math.floor(r() * 5);
        return { ...base, value: above, text: `${above} of 4 above`, tone: above >= 3 ? 'pos' : above <= 1 ? 'neg' : 'flat', icon: above >= 3 ? 'trend-up' : 'trend-down' };
      }
      case 'ma_detail': {
        const marks = [20, 50, 100, 200].map((p) => ({ label: `MA${p}`, value: round(r() * 0.2 - 0.1, 3) }));
        return { ...base, value: marks.filter((m) => m.value > 0).length, text: marks.map((m) => `${m.label.slice(2)}${m.value > 0 ? '▲' : '▼'}`).join(' '), tone: 'flat', range: null };
      }
      case 'ma_cross': { const d = 1 + Math.floor(r() * 30); const up = r() > 0.5; return { ...base, value: d, text: `${up ? '↑' : '↓'} in ~${d}d`, tone: up ? 'pos' : 'neg' }; }
      case 'sector_trend': { const v = round(r() * 0.3 - 0.1, 3); return { ...base, value: v, text: `${v > 0 ? '▲' : '▼'} ${round(v * 100, 1)}%`, tone: v > 0 ? 'pos' : 'neg' }; }
      case 'rsi14': { const v = round(15 + r() * 70, 1); return { ...base, value: v, delta: round(r() * 20 - 10, 1), tone: v < 30 || v > 70 ? 'neg' : 'flat' }; }
      case 'support': { const v = round(-r() * 0.08, 3); return { ...base, value: v, text: null, tone: v > -0.02 ? 'neg' : 'flat' }; }
      case 'resistance': { const v = round(r() * 0.08, 3); return { ...base, value: v, tone: 'flat' }; }
      case 'bollinger': { const st = pick(BOLL); return { ...base, value: round(r(), 2), text: st, tone: st.includes('above') || st.includes('below') ? 'neg' : 'flat' }; }
      case 'macd': { const v = round(r() * 4 - 2, 2); return { ...base, value: v, tone: v > 0 ? 'pos' : 'neg' }; }
      case 'atr_pct': return { ...base, value: round(0.01 + r() * 0.04, 4), tone: 'flat' };
      case 'volume_ratio': { const v = round(0.4 + r() * 2.5, 2); return { ...base, value: v, tone: v > 1.5 ? 'pos' : 'flat' }; }
    }
  });
}

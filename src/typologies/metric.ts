import * as z from 'zod/mini';
import { DEMO_ASOF, IsoDate, prng, round, Ticker, ToneSchema } from './common';

/** The metric catalogue. Adding a key is a minor version of metric@1. */
export const METRIC_KEYS = ['pe', 'pe_vs_sector', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const MetricParams = z.object({
  ticker: Ticker,
  metrics: z.array(z.enum(METRIC_KEYS)).check(z.minLength(1), z.maxLength(12)),
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
  pt_upside: { label: 'Target upside', unit: '%', hint: 'Average of the latest target of each analyst firm in the last 12 months, versus the last close.' },
  off_high: { label: 'Off 52w high', unit: '%', hint: 'Last close versus the highest close of the last 52 weeks.' },
  range_52w: { label: '52w range', unit: '$', hint: 'Where the last close sits between the 52-week low and high closes.' },
  trend_ma: { label: 'Trend', unit: '', hint: 'How many of the 20, 50, 100 and 200-day moving averages the last close is above.' },
  earnings_in: { label: 'Earnings in', unit: 'd', hint: 'Calendar days until the next scheduled earnings report (provider estimate until confirmed).' },
};

export function metricDemo(p: z.infer<typeof MetricParams>): MetricPayload {
  return p.metrics.map((key): MetricItem => {
    const r = prng(`${p.ticker}:${key}`);
    const meta = METRIC_LABELS[key];
    const base = { key, label: meta.label, unit: meta.unit, hint: meta.hint, asOf: DEMO_ASOF, text: null, delta: null, range: null, icon: null };
    switch (key) {
      case 'pe': return { ...base, value: round(10 + r() * 40, 1), tone: 'flat' };
      case 'pe_vs_sector': { const v = round(r() * 0.8 - 0.4, 3); return { ...base, value: v, tone: v < 0 ? 'pos' : 'neg' }; }
      case 'pt_upside': { const v = round(r() * 0.5 - 0.1, 3); return { ...base, value: v, tone: v > 0 ? 'pos' : 'neg', icon: 'target' }; }
      case 'off_high': { const v = round(-r() * 0.3, 3); return { ...base, value: v, tone: v < -0.1 ? 'neg' : 'flat', icon: 'peak' }; }
      case 'range_52w': {
        const lo = round(80 + r() * 40); const hi = round(lo * (1.3 + r() * 0.5)); const v = round(lo + (hi - lo) * r());
        return { ...base, value: v, tone: 'flat', range: { lo, hi, marks: [{ label: 'Last', value: v }] } };
      }
      case 'trend_ma': {
        const above = Math.floor(r() * 5);
        return { ...base, value: above, text: `${above} of 4 above`, tone: above >= 3 ? 'pos' : above <= 1 ? 'neg' : 'flat', icon: above >= 3 ? 'trend-up' : 'trend-down' };
      }
      case 'earnings_in': { const d = 1 + Math.floor(r() * 80); return { ...base, value: d, tone: 'flat', icon: d <= 7 ? 'alert' : 'calendar' }; }
    }
  });
}

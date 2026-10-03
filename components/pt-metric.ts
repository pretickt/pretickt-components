import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { METRIC_KEYS, Ticker, type MetricPayload } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-metric',
  version: '1.1.0',
  need: {
    question: 'Is this stock cheap, stretched, or close to a catalyst — at a glance?',
    evidence: [
      'beta: the chip strip is the most reused surface (company header, hover card, shorts) — pretickt-frontend/src/app/companies/opp-chip-strip.ts',
      'stockanalysis.com and finance.yahoo.com quote pages open with a key-stats strip; MarketBeat shows scores as percentile badges (checked 2026-10-03)',
    ],
  },
  params: z.object({ ticker: Ticker, metrics: z.array(z.enum(METRIC_KEYS)).check(z.minLength(1), z.maxLength(12)) }),
  user: [],
  uses: [],
  needs: (p) => ({ metrics: { t: 'metric@1', params: { ticker: p.ticker, metrics: p.metrics } } }),
});

export const samples = [
  { ticker: 'NVDA', metrics: ['pe', 'pe_vs_sector', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in'] },
  { ticker: 'BRK.B', metrics: ['pe'] },
];

type Data = DataFor<{ metrics: MetricPayload }>;

export function renderStatic(data: Data, _params: unknown, h: Helpers): string {
  if (!data.metrics || !data.metrics.length) return h.na();
  return `<ul class="pt-badges">${data.metrics.map((m) => h.badge(m)).join('')}</ul>`;
}

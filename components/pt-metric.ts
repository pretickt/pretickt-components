import { z } from 'zod';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { METRIC_KEYS, Ticker, type MetricItem, type MetricPayload } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-metric',
  version: '1.0.0',
  need: {
    question: 'Is this stock cheap, stretched, or close to a catalyst — at a glance?',
    evidence: [
      'beta: the chip strip is the most reused surface (company header, hover card, shorts) — pretickt-frontend/src/app/companies/opp-chip-strip.ts',
      'stockanalysis.com and finance.yahoo.com quote pages open with a key-stats strip; MarketBeat shows scores as percentile badges (checked 2026-10-03)',
    ],
  },
  params: z.object({ ticker: Ticker, metrics: z.array(z.enum(METRIC_KEYS)).min(1).max(12) }),
  user: [],
  uses: [],
  needs: (p) => ({ metrics: { t: 'metric@1', params: { ticker: p.ticker, metrics: p.metrics } } }),
});

export const samples = [
  { ticker: 'NVDA', metrics: ['pe', 'pe_vs_sector', 'pt_upside', 'off_high', 'range_52w', 'trend_ma', 'earnings_in'] },
  { ticker: 'BRK.B', metrics: ['pe'] },
];

type Data = DataFor<{ metrics: MetricPayload }>;

function value(m: MetricItem, h: Helpers): string {
  if (m.text) return m.text;
  if (m.value == null) return '—';
  switch (m.unit) {
    case 'x': return `${h.num(m.value, 1)}x`;
    case '%': return h.pct(m.value);
    case '$': return h.money(m.value);
    case 'd': return `${h.num(m.value, 0)}d`;
    default: return h.num(m.value);
  }
}

function rangeBar(m: MetricItem): string {
  if (!m.range || m.value == null || m.range.hi <= m.range.lo) return '';
  const pos = Math.min(100, Math.max(0, ((m.value - m.range.lo) / (m.range.hi - m.range.lo)) * 100));
  return `<span class="pt-range" aria-hidden="true"><span class="pt-range-dot" style="left:${pos.toFixed(1)}%"></span></span>`;
}

export function renderStatic(data: Data, _params: unknown, h: Helpers): string {
  if (!data.metrics || !data.metrics.length) return h.na();
  const items = data.metrics.map((m) => {
    const tip: Record<string, string> = { [m.label]: m.hint, 'As of': h.date(m.asOf) };
    if (m.range) { tip.Low = h.money(m.range.lo); tip.High = h.money(m.range.hi); }
    return `<li class="pt-badge pt-tone-${h.esc(m.tone)}" tabindex="0" ${h.tip(tip)}>${h.icon(m.icon)}` +
      `<span class="pt-badge-k">${h.esc(m.label)}</span><span class="pt-badge-v">${h.esc(value(m, h))}</span>${rangeBar(m)}</li>`;
  });
  return `<ul class="pt-badges">${items.join('')}</ul>`;
}

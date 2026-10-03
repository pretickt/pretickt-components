import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { Ticker, type Analysts, type PriceSeries } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-price-target',
  version: '1.0.0',
  need: {
    question: 'Where do analysts think this stock is going, and how spread out are they?',
    evidence: [
      'DataForSEO: "{ticker} price target" ~103k searches/month, "{ticker} stock forecast" ~151k (launch/data, public-site spec §4)',
      'beta: pt-chart (pretickt-frontend/src/app/companies/pt-chart.ts); stockanalysis.com /forecast shows low/average/median/high',
    ],
  },
  params: z.object({ ticker: Ticker }),
  user: [],
  uses: [],
  needs: (p) => ({
    analysts: { t: 'analysts@1', params: { ticker: p.ticker, window: '1y' } },
    series: { t: 'price-series@1', params: { tickers: [p.ticker], range: '1y', interval: '1d', rebase: false } },
  }),
});

export const samples = [{ ticker: 'NVDA' }, { ticker: 'BRK.B' }];

const W = 720, H = 260, L = 48, R = 12, T = 12, B = 24;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
type Data = DataFor<{ analysts: Analysts; series: PriceSeries }>;

function stats(a: Analysts, h: Helpers): string {
  const s = a.summary!;
  const up = a.price ? s.mean / a.price - 1 : null;
  const cell = (k: string, v: string) => `<div class="pt-pt-stat"><span>${k}</span><b>${h.esc(v)}</b></div>`;
  return `<div class="pt-pt-summary">${cell('Low', h.money(s.low))}${cell('Average', h.money(s.mean))}${cell('Median', h.money(s.median))}` +
    `${cell('High', h.money(s.high))}${cell('Upside', h.pct(up))}</div>` +
    `<p class="pt-lede">${s.n} firm${s.n === 1 ? '' : 's'} with a target in the last 12 months · last close ${h.money(a.price)} · as of ${h.date(a.asOf)}</p>`;
}

function consensus(a: Analysts): string {
  const c = a.consensus;
  if (!c) return '';
  const parts: [string, string, number][] = [['sb', 'Strong buy', c.strongBuy], ['b', 'Buy', c.buy], ['h', 'Hold', c.hold], ['s', 'Sell', c.sell], ['ss', 'Strong sell', c.strongSell]];
  const total = parts.reduce((n, [, , v]) => n + v, 0);
  if (!total) return '';
  const bar = parts.filter(([, , v]) => v > 0).map(([k, , v]) => `<span class="pt-consensus-${k}" style="width:${((v / total) * 100).toFixed(1)}%"></span>`).join('');
  return `<div class="pt-consensus" aria-hidden="true">${bar}</div><p class="pt-lede">${parts.map(([, label, v]) => `${label} ${v}`).join(' · ')}</p>`;
}

function chart(a: Analysts, s: PriceSeries, h: Helpers): string {
  const pts = s[0]?.points ?? [];
  if (!pts.length) return '';
  const first = pts[0]!.t;
  const end = day(a.asOf) + 365;
  const x = (d: number) => L + ((d - day(first)) / (end - day(first))) * (W - L - R);
  const vals = [...pts.map((p) => p.c), ...a.targets.map((t) => t.target)];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06 || 1;
  lo -= pad;
  hi += pad;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const closeAt = (iso: string) => { let c = pts[0]!.c; for (const p of pts) { if (p.t > iso) break; c = p.c; } return c; };
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(day(p.t)).toFixed(1)},${y(p.c).toFixed(1)}`).join('');
  const targets = a.targets.map((t) => {
    const x0 = x(day(t.date)), y0 = y(t.priceWhenPosted ?? closeAt(t.date));
    const x1 = x(day(t.date) + 365), y1 = y(t.target);
    const implied = t.priceWhenPosted ? t.target / t.priceWhenPosted - 1 : null;
    return `<line class="pt-seg" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>` +
      `<circle class="pt-dot" tabindex="0" cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="4" ${h.tip({ Firm: t.firm, Target: h.money(t.target), Date: h.date(t.date),
        'Price then': t.priceWhenPosted == null ? null : h.money(t.priceWhenPosted), Implied: implied == null ? null : h.pct(implied) })}/>`;
  }).join('');
  const now = x(day(a.asOf)).toFixed(1);
  const mean = a.summary
    ? `<line class="pt-grid" stroke-dasharray="4 4" x1="${now}" x2="${W - R}" y1="${y(a.summary.mean).toFixed(1)}" y2="${y(a.summary.mean).toFixed(1)}"/>` +
      `<text class="pt-axis" x="${W - R}" y="${(y(a.summary.mean) - 4).toFixed(1)}" text-anchor="end">avg ${h.esc(h.money(a.summary.mean))}</text>`
    : '';
  const today = `<line class="pt-grid" x1="${now}" x2="${now}" y1="${T}" y2="${H - B}"/>`;
  return `<svg class="pt-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Analyst price targets over the next 12 months">${today}${mean}<path class="pt-line" d="${line}"/>${targets}</svg>`;
}

export function renderStatic(data: Data, _p: unknown, h: Helpers): string {
  const a = data.analysts;
  if (!a) return h.na();
  if (!a.summary || !a.targets.length) return h.na('No analyst targets in the last 12 months');
  return `<figure class="pt-chart pt-pt">${stats(a, h)}${data.series ? chart(a, data.series, h) : ''}${consensus(a)}</figure>`;
}

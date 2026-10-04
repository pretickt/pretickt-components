import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { intParam, Ticker, type Fundamentals } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-financials',
  version: '1.0.1',
  need: {
    question: 'Is the business growing, and does it turn revenue into cash? Quarterly revenue, free cash flow and margins.',
    evidence: [
      'stockanalysis.com / macrotrends quarterly revenue pages; "<ticker> revenue" long tail (marketing/ per-ticker SEO)',
      'beta: company page growth charts in peers (revenue/FCF bars)',
    ],
  },
  params: z.object({ ticker: Ticker, periods: intParam(4, 40, 8) }),
  user: [],
  uses: [],
  needs: (p) => ({ fin: { t: 'fundamentals@1', params: { ticker: p.ticker, periods: p.periods } } }),
});

export const samples = [{ ticker: 'NVDA' }, { ticker: 'KO', periods: 12 }];

type Data = DataFor<{ fin: Fundamentals }>;
const W = 600, H = 160, PAD = 14;
const usd = (v: number | null, h: Helpers) => h.usd(v, { compact: true });

function chart(ps: Fundamentals['periods'], h: Helpers): string {
  const vals = ps.flatMap((p) => [p.revenue ?? 0, p.fcf ?? 0]);
  const hi = Math.max(...vals, 1), lo = Math.min(...vals, 0);
  const y = (v: number) => PAD + ((hi - v) / (hi - lo)) * (H - 2 * PAD);
  const slot = W / ps.length, bw = Math.max(4, slot * 0.32);
  const bar = (cls: string, x: number, v: number | null, tipObj: Record<string, string>) => {
    if (v == null) return '';
    const top = Math.min(y(v), y(0)), ht = Math.max(1, Math.abs(y(v) - y(0)));
    return `<rect class="${cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${ht.toFixed(1)}" ${h.tip(tipObj)}/>`;
  };
  const body = ps.map((p, i) => {
    const x = i * slot + slot / 2;
    const t = { [p.fiscal]: h.date(p.period), Revenue: usd(p.revenue, h), 'Free cash flow': usd(p.fcf, h) };
    return bar('pt-fin-rev', x - bw - 1, p.revenue, t) + bar('pt-fin-fcf', x + 1, p.fcf, t) +
      `<text class="pt-axis" x="${x.toFixed(1)}" y="${H + 12}" text-anchor="middle">${h.esc(p.fiscal)}</text>`;
  }).join('');
  return `<svg class="pt-chart-svg pt-fin-chart" viewBox="0 0 ${W} ${H + 16}" role="img" aria-label="Quarterly revenue and free cash flow">` +
    `<line class="pt-grid" x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>${body}</svg>`;
}

export function renderStatic(data: Data, _params: z.output<typeof manifest.params>, h: Helpers): string {
  const ps = data.fin?.periods ?? [];
  if (!data.fin || !ps.length) return h.na('Financial statements not available');
  const last = ps.at(-1)!, yearAgo = ps.length >= 5 ? ps.at(-5)! : null;
  const facts: string[] = [];
  if (yearAgo?.revenue && last.revenue != null && yearAgo.revenue > 0) facts.push(`Revenue ${h.pct(last.revenue / yearAgo.revenue - 1)} year over year`);
  if (last.revenue && last.fcf != null) facts.push(`free cash flow ${h.level(last.fcf / last.revenue)} of revenue`);
  if (last.operatingMargin != null) facts.push(`operating margin ${h.level(last.operatingMargin)}`);
  const lede = facts.length ? `<p class="pt-lede">${h.esc(last.fiscal)}: ${facts.join(', ')}.</p>` : '';
  const rows = [...ps].reverse().map((p) => `<tr class="pt-fin-q"><td>${h.esc(p.fiscal)}</td><td>${h.date(p.period)}</td>` +
    `<td class="pt-num">${usd(p.revenue, h)}</td><td class="pt-num">${h.num(p.eps)}</td><td class="pt-num">${usd(p.fcf, h)}</td>` +
    `<td class="pt-num">${h.level(p.grossMargin)}</td><td class="pt-num">${h.level(p.operatingMargin)}</td><td class="pt-num">${h.level(p.netMargin)}</td></tr>`).join('');
  return `<section class="pt-fin">${lede}<div class="pt-legend"><span class="pt-key pt-key-rev">Revenue</span><span class="pt-key pt-key-fcf">Free cash flow</span></div>` +
    `${chart(ps, h)}<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th>Quarter</th><th>Period end</th><th>Revenue</th><th>EPS</th>` +
    `<th>FCF</th><th>Gross</th><th>Operating</th><th>Net</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

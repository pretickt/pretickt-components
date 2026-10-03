import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { Ticker, type Insider } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-insiders',
  version: '1.0.0',
  need: {
    question: 'Are the people running this company buying or selling its stock?',
    evidence: ['openinsider.com / secform4.com tables; "insider buying" searches (launch/data/08a-feature-demand.json)', 'beta: insider_net badge'],
  },
  params: z.object({ ticker: Ticker, days: z._default(z.int().check(z.minimum(30), z.maximum(730)), 365) }),
  user: [],
  uses: [],
  needs: (p) => ({ ins: { t: 'insider@1', params: { ticker: p.ticker, days: p.days } } }),
});

export const samples = [{ ticker: 'NVDA' }, { ticker: 'KO', days: 90 }];

type Data = DataFor<{ ins: Insider }>;
const LABEL = { buy: 'Buy', sell: 'Sell', other: 'Other' } as const;
const usd = (v: number, h: Helpers) => `$${h.compact(v)}`;

export function renderStatic(data: Data, params: { ticker: string; days: number }, h: Helpers): string {
  if (!data.ins) return h.na();
  const items = data.ins.items;
  if (!items.length) return h.na(`No insider transactions in the last ${params.days} days.`);
  const sum = (t: 'buy' | 'sell') => items.filter((i) => i.type === t).reduce((a, i) => a + (i.value ?? 0), 0);
  const buys = sum('buy'), sells = sum('sell');
  const lede = `<p class="pt-lede">Open-market buys ${usd(buys, h)} · sells ${usd(sells, h)} over the last ${params.days} days ` +
    `(${items.filter((i) => i.type === 'buy').length} buys, ${items.filter((i) => i.type === 'sell').length} sells).</p>`;
  const rows = items.map((i) => {
    const kind = (LABEL as Record<string, string>)[i.type] ?? 'Other';
    return `<tr class="pt-ins-row pt-ins-${h.esc(i.type)}"><td>${h.date(i.date)}</td><td>${h.esc(i.name)}${i.title ? `<div class="pt-news-meta">${h.esc(i.title)}</div>` : ''}</td>` +
      `<td><span class="pt-ins-type">${kind}</span></td><td class="pt-num">${h.num(i.shares, 0)}</td><td class="pt-num">${h.money(i.price)}</td>` +
      `<td class="pt-num">${i.value == null ? '—' : usd(i.value, h)}</td></tr>`;
  }).join('');
  return `<section>${lede}<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th>Date</th><th>Insider</th><th>Type</th><th>Shares</th>` +
    `<th>Price</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    `<p class="pt-note">Source: SEC Form 4 filings. "Other" covers awards, option exercises and gifts.</p></section>`;
}

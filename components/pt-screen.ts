import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { SCREEN_LISTS, Ticker, type Screen, type ScreenRow } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-screen',
  version: '1.0.0',
  need: {
    question: 'Which companies are on this list today (biggest movers, 52-week extremes, undervalued, insider buying, peers)?',
    evidence: [
      'DataForSEO: "biggest stock losers today", "52 week low stocks", "undervalued stocks" (launch/data/08c-serp-undervalued-stocks.json)',
      'stockanalysis.com / finviz market-mover tables; beta: peers table on the company page',
    ],
  },
  params: z.object({
    scope: z.union([z.object({ list: z.enum(SCREEN_LISTS) }), z.object({ peersOf: Ticker })]),
    limit: z._default(z.int().check(z.minimum(1), z.maximum(50)), 25),
  }),
  user: [],
  uses: [],
  needs: (p) => ({ rows: { t: 'screen@1', params: { scope: p.scope, limit: p.limit } } }),
});

export const samples = [{ scope: { list: 'biggest_losers' } }, { scope: { list: 'insider_buying' }, limit: 10 }, { scope: { peersOf: 'NVDA' }, limit: 8 }];

type Data = DataFor<{ rows: Screen }>;
type Scope = { list: string } | { peersOf: string };
interface Col { label: string; cell: (r: ScreenRow, h: Helpers) => string }

const signed = (v: number | null, h: Helpers) => `<span class="pt-t-${h.toneOf(v)}">${h.pct(v)}</span>`;
const COLS: Record<string, Col> = {
  offHigh: { label: 'Off 52w high', cell: (r, h) => signed(r.offHigh, h) },
  ptUpside: { label: 'Target upside', cell: (r, h) => signed(r.ptUpside, h) },
  insiderNet: { label: 'Insiders 90d', cell: (r, h) => `<span class="pt-t-${h.toneOf(r.insiderNet)}">${r.insiderNet == null ? '—' : `${r.insiderNet < 0 ? '-' : '+'}$${h.compact(Math.abs(r.insiderNet))}`}</span>` },
  volumeRatio: { label: 'Volume vs 20d', cell: (r, h) => (r.volumeRatio == null ? '—' : `${h.num(r.volumeRatio, 1)}×`) },
};
const EXTRA: Record<string, string[]> = {
  biggest_losers: ['offHigh'], biggest_gainers: ['offHigh'], '52w_low': ['offHigh'], '52w_high': ['offHigh'],
  undervalued: ['ptUpside'], insider_buying: ['insiderNet'], most_active: ['volumeRatio'], peers: ['offHigh', 'ptUpside'],
};

function spark(v: number[]): string {
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((c, i) => `${((i / (v.length - 1)) * 60).toFixed(1)},${(18 - ((c - lo) / span) * 16).toFixed(1)}`).join(' ');
  return `<svg class="pt-spark pt-spark-${v.at(-1)! >= v[0]! ? 'pos' : 'neg'}" viewBox="0 0 60 20" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

export function renderStatic(data: Data, params: { scope: Scope; limit: number }, h: Helpers): string {
  if (!data.rows) return h.na();
  if (!data.rows.rows.length) return h.na('No companies match this list today.');
  const extra = (EXTRA['list' in params.scope ? params.scope.list : 'peers'] ?? []).map((k) => COLS[k]!);
  const head = ['Company', 'Price', '1D', ...extra.map((c) => c.label), 'P/E', 'Market cap', '20D'];
  const rows = data.rows.rows.map((r, i) =>
    `<tr class="pt-scr-row${r.self ? ' pt-scr-self' : ''}"><td class="pt-scr-rank">${i + 1}</td>` +
    `<td><a class="pt-scr-co" href="/stocks/${h.esc(r.ticker.toLowerCase())}/"><strong>${h.esc(r.ticker)}</strong> <span>${h.esc(r.name)}</span></a></td>` +
    `<td class="pt-num">${h.money(r.close)}</td><td class="pt-num">${signed(r.chg1d, h)}</td>` +
    extra.map((c) => `<td class="pt-num">${c.cell(r, h)}</td>`).join('') +
    `<td class="pt-num">${r.pe == null || r.pe <= 0 ? '—' : h.num(r.pe, 1)}</td><td class="pt-num">${r.marketCap == null ? '—' : `$${h.compact(r.marketCap)}`}</td>` +
    `<td>${spark(r.spark)}</td></tr>`).join('');
  return `<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th></th>${head.map((t) => `<th>${t}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows}</tbody></table><p class="pt-note">Data as of ${h.date(data.rows.asOf)} close.</p></div>`;
}

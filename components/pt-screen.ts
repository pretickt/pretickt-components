import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { ScreenParams, type Screen, type ScreenList, type ScreenRow } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-screen',
  version: '1.0.1',
  need: {
    question: 'Which companies are on this list today (biggest movers, 52-week extremes, undervalued, insider buying, peers)?',
    evidence: [
      'DataForSEO: "biggest stock losers today", "52 week low stocks", "undervalued stocks" (launch/data/08c-serp-undervalued-stocks.json)',
      'stockanalysis.com / finviz market-mover tables; beta: peers table on the company page',
    ],
  },
  params: ScreenParams,
  user: [],
  uses: [],
  needs: (p) => ({ rows: { t: 'screen@1', params: { scope: p.scope, limit: p.limit } } }),
});

export const samples = [{ scope: { list: 'biggest_losers' } }, { scope: { list: 'insider_buying' }, limit: 10 }, { scope: { peersOf: 'NVDA' }, limit: 8 }];

type Data = DataFor<{ rows: Screen }>;
interface Col { label: string; cell: (r: ScreenRow, h: Helpers) => string }

const signed = (v: number | null, h: Helpers, text = h.pct(v)) => `<span class="pt-t-${h.toneOf(v)}">${text}</span>`;
const COLS = {
  offHigh: { label: 'Off 52w high', cell: (r, h) => signed(r.offHigh, h) },
  ptUpside: { label: 'Target upside', cell: (r, h) => signed(r.ptUpside, h) },
  insiderNet: { label: 'Insiders 90d', cell: (r, h) => signed(r.insiderNet, h, h.usd(r.insiderNet, { compact: true, signed: true })) },
  volumeRatio: { label: 'Volume vs 20d', cell: (r, h) => (r.volumeRatio == null ? '—' : `${h.num(r.volumeRatio, 1)}×`) },
} satisfies Record<string, Col>;
const EXTRA: Record<ScreenList | 'peers', (keyof typeof COLS)[]> = {
  biggest_losers: ['offHigh'], biggest_gainers: ['offHigh'], '52w_low': ['offHigh'], '52w_high': ['offHigh'],
  undervalued: ['ptUpside'], insider_buying: ['insiderNet'], most_active: ['volumeRatio'], peers: ['offHigh', 'ptUpside'],
};

function spark(v: number[]): string {
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((c, i) => `${((i / (v.length - 1)) * 60).toFixed(1)},${(18 - ((c - lo) / span) * 16).toFixed(1)}`).join(' ');
  return `<svg class="pt-spark pt-spark-${v.at(-1)! >= v[0]! ? 'pos' : 'neg'}" viewBox="0 0 60 20" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

export function renderStatic(data: Data, params: ScreenParams, h: Helpers): string {
  if (!data.rows) return h.na();
  if (!data.rows.rows.length) return h.na('No companies match this list today.');
  const extra = EXTRA['list' in params.scope ? params.scope.list : 'peers'].map((k) => COLS[k]);
  const head = ['Company', 'Price', '1D', ...extra.map((c) => c.label), 'P/E', 'Market cap', '20D'];
  const rows = data.rows.rows.map((r, i) =>
    `<tr class="pt-scr-row${r.self ? ' pt-scr-self' : ''}"><td class="pt-scr-rank">${i + 1}</td>` +
    `<td><a class="pt-scr-co" href="${h.stockHref(r.ticker)}"><strong>${h.esc(r.ticker)}</strong> <span>${h.esc(r.name)}</span></a></td>` +
    `<td class="pt-num">${h.money(r.close)}</td><td class="pt-num">${signed(r.chg1d, h)}</td>` +
    extra.map((c) => `<td class="pt-num">${c.cell(r, h)}</td>`).join('') +
    `<td class="pt-num">${r.pe == null || r.pe <= 0 ? '—' : h.num(r.pe, 1)}</td><td class="pt-num">${h.usd(r.marketCap, { compact: true })}</td>` +
    `<td>${spark(r.spark)}</td></tr>`).join('');
  return `<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th></th>${head.map((t) => `<th>${t}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows}</tbody></table><p class="pt-note">Data as of ${h.date(data.rows.asOf)} close.</p></div>`;
}

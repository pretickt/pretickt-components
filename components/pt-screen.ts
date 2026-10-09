/**
 * Which companies are on this list today (biggest movers, 52-week extremes, undervalued, insider buying, peers)?
 * @version 2.4.0
 * @evidence DataForSEO: "biggest stock losers today", "52 week low stocks", "undervalued stocks" (launch/data/08c-serp-undervalued-stocks.json)
 * @evidence stockanalysis.com / finviz market-mover tables; beta: peers table on the company page
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { MORE_STEP, PtLogo, PtMore, PtSortTh, useSort } from '@pretickt/components/ds';
import { date, money, num, pct, stockHref, tone, usd } from '@pretickt/components/format';
import { SCREEN_MAX, type ScreenList, type ScreenRow, type Sector } from '@pretickt/components/typologies';

type Cell = { text: string; tone?: string };
const signed = (v: number | null, text = pct(v)): Cell => ({ text, tone: `pt-t-${tone(v)}` });
const COLS = {
  offHigh: { label: 'Off 52w high', cell: (r: ScreenRow) => signed(r.offHigh), value: (r: ScreenRow) => r.offHigh },
  ptUpside: { label: 'Target upside', cell: (r: ScreenRow) => signed(r.ptUpside), value: (r: ScreenRow) => r.ptUpside },
  insiderNet: { label: 'Insiders 90d', cell: (r: ScreenRow) => signed(r.insiderNet, usd(r.insiderNet, { compact: true, signed: true })), value: (r: ScreenRow) => r.insiderNet },
  volumeRatio: { label: 'Volume vs 20d', cell: (r: ScreenRow): Cell => ({ text: r.volumeRatio == null ? '—' : `${num(r.volumeRatio, 1)}×` }), value: (r: ScreenRow) => r.volumeRatio },
};
const EXTRA: Record<ScreenList | 'peers', (keyof typeof COLS)[]> = {
  biggest_losers: ['offHigh'], biggest_gainers: ['offHigh'], '52w_low': ['offHigh'], '52w_high': ['offHigh'],
  undervalued: ['ptUpside'], insider_buying: ['insiderNet'], most_active: ['volumeRatio'], largest: ['offHigh'], peers: ['offHigh', 'ptUpside'],
};
function spark(v: number[]) {
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  return { points: v.map((c, i) => `${((i / (v.length - 1)) * 60).toFixed(1)},${(18 - ((c - lo) / span) * 16).toFixed(1)}`).join(' '),
    cls: `pt-spark pt-spark-${v.at(-1)! >= v[0]! ? 'pos' : 'neg'}` };
}
type Row = { r: ScreenRow; rank: number; chg: Cell; extra: Cell[]; spark: ReturnType<typeof spark> };

/** A market list (`list`) or the peers of one company (`peersOf`). */
@Component({
  selector: 'pt-screen',
  imports: [PtLogo, PtMore, PtSortTh],
  template: `
    @let s = screen.value();
    @if (s === null) {<p class="pt-na">Data not available</p>}
    @else if (s && !s.rows.length) {<p class="pt-na">No companies match this list today.</p>}
    @else if (s) {
      <div class="pt-table-wrap" [class.pt-busy]="screen.loading()">
        <table class="pt-table">
          <thead>
            <tr>
              <th></th><th ptSortTh [state]="sort.state('company')" (sort)="sort.toggle('company')">Company</th>
              <th ptSortTh [state]="sort.state('close')" (sort)="sort.toggle('close')">Price</th>
              <th ptSortTh [state]="sort.state('chg')" (sort)="sort.toggle('chg')">1D</th>
              @for (c of extra(); track c.label; let j = $index) {<th ptSortTh [state]="sort.state('x' + j)" (sort)="sort.toggle('x' + j)">{{ c.label }}</th>}
              <th ptSortTh [state]="sort.state('pe')" (sort)="sort.toggle('pe')">P/E</th>
              <th ptSortTh [state]="sort.state('cap')" (sort)="sort.toggle('cap')">Market cap</th><th>20D</th>
            </tr>
          </thead>
          <tbody>
            @for (x of sort.sorted(); track x.r.ticker) {
              <tr [class]="x.r.self ? 'pt-scr-row pt-scr-self' : 'pt-scr-row'">
                <td class="pt-scr-rank">{{ x.rank }}</td>
                <td><a class="pt-scr-co" [href]="stockHref(x.r.ticker)"><pt-logo [ticker]="x.r.ticker" [src]="x.r.logo" /> <strong>{{ x.r.ticker }}</strong> <span>{{ x.r.name }}</span></a></td>
                <td class="pt-num">{{ money(x.r.close) }}</td>
                <td class="pt-num"><span [class]="x.chg.tone">{{ x.chg.text }}</span></td>
                @for (c of x.extra; track $index) {<td class="pt-num">@if (c.tone) {<span [class]="c.tone">{{ c.text }}</span>} @else {<ng-container>{{ c.text }}</ng-container>}</td>}
                <td class="pt-num">{{ x.r.pe == null || x.r.pe <= 0 ? '—' : num(x.r.pe, 1) }}</td>
                <td class="pt-num">{{ usd(x.r.marketCap, { compact: true }) }}</td>
                <td>@if (x.spark; as sp) {<svg [attr.class]="sp.cls" viewBox="0 0 60 20" aria-hidden="true"><polyline [attr.points]="sp.points" /></svg>}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (hasMore()) {<pt-more (more)="more()" />}
        <p class="pt-note">Data as of {{ date(s.asOf) }} close.</p>
      </div>
    }`,
})
export class PtScreen {
  private readonly pt = inject(Pt);
  readonly list = input<ScreenList>();
  readonly peersOf = input<string>();
  readonly limit = input(25);
  /** A list may keep to one sector (the sector pages). */
  readonly sector = input<Sector>();

  private readonly kind = computed<ScreenList | 'peers'>(() => (this.peersOf() ? 'peers' : this.list() ?? 'biggest_losers'));
  /** "Show 20 more" asks the list again with 20 more rows; the shown rows stay until the answer comes. */
  protected readonly shown = linkedSignal(() => this.limit());
  protected readonly screen = this.pt.screen(() => {
    const k = this.kind();
    const sector = this.sector();
    return { scope: k === 'peers' ? { peersOf: this.peersOf()! } : { list: k, ...(sector ? { sector } : {}) }, limit: this.shown() };
  });
  /** More may exist while the last answer filled what it was asked for, up to the whole universe. */
  protected readonly hasMore = computed(() => {
    const asked = (this.screen.params() as { limit?: number } | undefined)?.limit ?? 0;
    return (this.screen.value()?.rows.length ?? 0) >= asked && asked > 0 && asked < SCREEN_MAX;
  });
  protected more() { this.shown.update((n) => Math.min(n + MORE_STEP, SCREEN_MAX)); }
  protected readonly extra = computed(() => EXTRA[this.kind()].map((k) => COLS[k]));
  private readonly rows = computed<Row[]>(() => (this.screen.value()?.rows ?? []).map((r, i) => ({
    r, rank: i + 1, chg: signed(r.chg1d), extra: this.extra().map((c) => c.cell(r)), spark: spark(r.spark) })));
  // headers sort the rows the list already has; the rank stays the list's own
  protected readonly sort = useSort(() => this.rows(), {
    company: (x) => x.r.ticker, close: (x) => x.r.close, chg: (x) => x.r.chg1d, pe: (x) => (x.r.pe == null || x.r.pe <= 0 ? null : x.r.pe),
    cap: (x) => x.r.marketCap, x0: (x) => this.extra()[0]?.value(x.r) ?? null, x1: (x) => this.extra()[1]?.value(x.r) ?? null,
  });
  protected readonly stockHref = stockHref;
  protected readonly money = money;
  protected readonly num = num;
  protected readonly usd = usd;
  protected readonly date = date;
}

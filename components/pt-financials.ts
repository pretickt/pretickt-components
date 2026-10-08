/**
 * Is this company growing, and is the growth turning into cash?
 * @version 2.2.0
 * @evidence "<ticker> revenue / earnings / free cash flow" long tail (marketing/ per-ticker SEO)
 * @evidence beta: growth charts and tables on the company page
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtSortTh, useSort } from '@pretickt/components/ds';
import { date, level, num, pct, tip, usd } from '@pretickt/components/format';

const W = 600, H = 160, PAD = 14;
const compact = (v: number | null) => usd(v, { compact: true });
const COLS = [['quarter', 'Quarter'], ['period', 'Period end'], ['revenue', 'Revenue'], ['eps', 'EPS'], ['fcf', 'FCF'], ['gross', 'Gross'],
  ['operating', 'Operating'], ['net', 'Net']] as const;

@Component({
  selector: 'pt-financials',
  imports: [PtSortTh],
  template: `
    @let f = fin.value();
    @if (f === null || (f && !ps().length)) {<p class="pt-na">Financial statements not available</p>}
    @else if (f) {
      <section class="pt-fin">
        @if (lede()) {<p class="pt-lede">{{ lede() }}</p>}
        <div class="pt-legend"><span class="pt-key pt-key-rev">Revenue</span><span class="pt-key pt-key-fcf">Free cash flow</span></div>
        <svg class="pt-chart-svg pt-fin-chart" [attr.viewBox]="'0 0 ' + W + ' ' + (H + 16)" role="img" aria-label="Quarterly revenue and free cash flow">
          <line class="pt-grid" x1="0" [attr.x2]="W" [attr.y1]="chart().zero" [attr.y2]="chart().zero" />
          @for (q of chart().quarters; track q.fiscal) {
            @if (q.rev; as b) {<rect class="pt-fin-rev" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" [attr.data-tip]="q.tip" />}
            @if (q.fcf; as b) {<rect class="pt-fin-fcf" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" [attr.data-tip]="q.tip" />}
            <text class="pt-axis" [attr.x]="q.x" [attr.y]="H + 12" text-anchor="middle">{{ q.fiscal }}</text>
          }
        </svg>
        <div class="pt-table-wrap">
          <table class="pt-table">
            <thead><tr>@for (c of COLS; track c[0]) {<th ptSortTh [state]="sort.state(c[0])" (sort)="sort.toggle(c[0])">{{ c[1] }}</th>}</tr></thead>
            <tbody>
              @for (p of sort.sorted(); track p.period) {
                <tr class="pt-fin-q">
                  <td>{{ p.fiscal }}</td><td>{{ date(p.period) }}</td><td class="pt-num">{{ compact(p.revenue) }}</td><td class="pt-num">{{ num(p.eps) }}</td>
                  <td class="pt-num">{{ compact(p.fcf) }}</td><td class="pt-num">{{ level(p.grossMargin) }}</td><td class="pt-num">{{ level(p.operatingMargin) }}</td>
                  <td class="pt-num">{{ level(p.netMargin) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }`,
})
export class PtFinancials {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly periods = input(8);
  protected readonly fin = this.pt.fundamentals(() => ({ ticker: this.ticker(), periods: this.periods() }));
  protected readonly ps = computed(() => this.fin.value()?.periods ?? []);
  // the table lists the newest quarter first; its headers sort it
  protected readonly sort = useSort(() => [...this.ps()].reverse(), {
    quarter: (p) => p.period, period: (p) => p.period, revenue: (p) => p.revenue, eps: (p) => p.eps, fcf: (p) => p.fcf,
    gross: (p) => p.grossMargin, operating: (p) => p.operatingMargin, net: (p) => p.netMargin,
  });
  protected readonly W = W;
  protected readonly H = H;
  protected readonly COLS = COLS;
  protected readonly date = date;
  protected readonly num = num;
  protected readonly level = level;
  protected readonly compact = compact;
  protected readonly lede = computed(() => {
    const list = this.ps(), last = list.at(-1);
    if (!last) return '';
    const yearAgo = list.length >= 5 ? list.at(-5)! : null;
    const facts: string[] = [];
    if (yearAgo?.revenue && last.revenue != null && yearAgo.revenue > 0) facts.push(`Revenue ${pct(last.revenue / yearAgo.revenue - 1)} year over year`);
    if (last.revenue && last.fcf != null) facts.push(`free cash flow ${level(last.fcf / last.revenue)} of revenue`);
    if (last.operatingMargin != null) facts.push(`operating margin ${level(last.operatingMargin)}`);
    return facts.length ? `${last.fiscal}: ${facts.join(', ')}.` : '';
  });
  protected readonly chart = computed(() => {
    const list = this.ps();
    const vals = list.flatMap((p) => [p.revenue ?? 0, p.fcf ?? 0]);
    const hi = Math.max(...vals, 1), lo = Math.min(...vals, 0);
    const y = (v: number) => PAD + ((hi - v) / (hi - lo)) * (H - 2 * PAD);
    const slot = W / Math.max(1, list.length), bw = Math.max(4, slot * 0.32);
    const bar = (v: number | null, x: number) => (v == null ? null
      : { x: x.toFixed(1), y: Math.min(y(v), y(0)).toFixed(1), w: bw.toFixed(1), h: Math.max(1, Math.abs(y(v) - y(0))).toFixed(1) });
    return { zero: y(0).toFixed(1), quarters: list.map((p, i) => {
      const x = i * slot + slot / 2;
      return { fiscal: p.fiscal, x: x.toFixed(1), rev: bar(p.revenue, x - bw - 1), fcf: bar(p.fcf, x + 1),
        tip: tip({ [p.fiscal]: date(p.period), Revenue: compact(p.revenue), 'Free cash flow': compact(p.fcf) }) };
    }) };
  });
}

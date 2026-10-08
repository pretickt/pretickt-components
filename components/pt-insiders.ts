/**
 * Are the people running this company buying or selling its stock?
 * @version 2.2.0
 * @evidence "<ticker> insider trading" long tail (marketing/ per-ticker SEO)
 * @evidence beta: insider net flow badge and Form 4 list
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtSortTh, useSort } from '@pretickt/components/ds';
import { date, money, num, usd } from '@pretickt/components/format';

const LABEL: Record<string, string> = { buy: 'Buy', sell: 'Sell', other: 'Other' };
const COLS = [['date', 'Date'], ['name', 'Insider'], ['type', 'Type'], ['shares', 'Shares'], ['price', 'Price'], ['value', 'Value']] as const;
const compact = (v: number | null) => usd(v, { compact: true });

@Component({
  selector: 'pt-insiders',
  imports: [PtSortTh],
  template: `
    @let ins = insider.value();
    @if (ins === null) {<p class="pt-na">Data not available</p>}
    @else if (ins && !ins.items.length) {<p class="pt-na">No insider transactions in the last {{ days() }} days.</p>}
    @else if (ins) {
      <section>
        <p class="pt-lede">{{ summary() }}</p>
        <div class="pt-table-wrap">
          <table class="pt-table">
            <thead><tr>@for (c of COLS; track c[0]) {<th ptSortTh [state]="sort.state(c[0])" (sort)="sort.toggle(c[0])">{{ c[1] }}</th>}</tr></thead>
            <tbody>
              @for (i of sort.sorted(); track i) {
                <tr [class]="'pt-ins-row pt-ins-' + i.type">
                  <td>{{ date(i.date) }}</td>
                  <td>{{ i.name }}@if (i.title) {<div class="pt-meta">{{ i.title }}</div>}</td>
                  <td><span class="pt-ins-type">{{ LABEL[i.type] ?? 'Other' }}</span></td>
                  <td class="pt-num">{{ num(i.shares, 0) }}</td>
                  <td class="pt-num">{{ money(i.price) }}</td>
                  <td class="pt-num">{{ compact(i.value) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="pt-note">Source: SEC Form 4 filings. "Other" covers awards, option exercises and gifts.</p>
      </section>
    }`,
})
export class PtInsiders {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly days = input(365);
  protected readonly insider = this.pt.insider(() => ({ ticker: this.ticker(), days: this.days() }));
  protected readonly sort = useSort(() => this.insider.value()?.items ?? [], {
    date: (i) => i.date, name: (i) => i.name, type: (i) => i.type, shares: (i) => i.shares, price: (i) => i.price, value: (i) => i.value });
  protected readonly COLS = COLS;
  protected readonly LABEL = LABEL;
  protected readonly date = date;
  protected readonly money = money;
  protected readonly num = num;
  protected readonly compact = compact;
  protected readonly summary = computed(() => {
    const items = this.insider.value()?.items ?? [];
    const sum = (t: 'buy' | 'sell') => items.filter((i) => i.type === t).reduce((a, i) => a + (i.value ?? 0), 0);
    const count = (t: 'buy' | 'sell') => items.filter((i) => i.type === t).length;
    return `Open-market buys ${compact(sum('buy'))} · sells ${compact(sum('sell'))} over the last ${this.days()} days (${count('buy')} buys, ${count('sell')} sells).`;
  });
}

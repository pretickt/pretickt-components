/**
 * DRAFT · H5 What changed in companies (mock data, stories only): the week's new quality facts across the companies, on the six
 * questions of the quality card — a column each, the companies that strengthened it above, those that weakened it below; a logo
 * opens its company's quality card. Its data (the cards of every company, computed each night: `qualityCards` of pt-quality is
 * pure, the nightly can run it) has no pipeline yet, so it comes as an input.
 * @version 0.0.1
 */
import { Component, computed, input } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { dayMonth, date, tip } from '@pretickt/components/format';
import { PILLARS, type Pillar, type QTone } from '../pt-quality';

export interface BoardItem { ticker: string; name: string; logo: string | null; pillar: Pillar; tone: QTone; fact: string; date: string; href: string }
export interface Board { asOf: string; from: string; to: string; items: BoardItem[] }

const ORDER: Pillar[] = ['demand', 'advantage', 'economics', 'execution', 'fragility', 'price'];
/** The six columns: above, the companies a fact strengthened; below, those it weakened or that have one to watch. */
export const boardColumns = (b: Board) => ORDER.map((p) => ({ pillar: p, name: PILLARS[p].name,
  up: b.items.filter((i) => i.pillar === p && i.tone === 'pos'), down: b.items.filter((i) => i.pillar === p && i.tone !== 'pos') }));
/** "This week Execution strengthened at 8 companies; Economics weakened at META." — the two busiest columns. */
export function boardSentence(b: Board): string {
  const cols = boardColumns(b).map((c) => ({ ...c, n: c.up.length + c.down.length })).filter((c) => c.n).sort((x, y) => y.n - x.n);
  const say = (c: (typeof cols)[number]) => c.up.length >= c.down.length
    ? `${c.name} strengthened at ${c.up.length > 2 ? `${c.up.length} companies` : c.up.map((i) => i.ticker).join(' and ')}`
    : `${c.name} weakened or needs watching at ${c.down.length > 2 ? `${c.down.length} companies` : c.down.map((i) => i.ticker).join(' and ')}`;
  return cols.length ? `This week ${cols.slice(0, 2).map(say).join('; ')}.` : '';
}

@Component({
  selector: 'pt-quality-strip',
  imports: [PtLogo],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <figure class="dr-fig">
        <div class="dr-head"><b>This week across the six questions</b><span class="pt-meta">{{ dayMonth(d.from) }}–{{ dayMonth(d.to) }}</span></div>
        @if (d.items.length) {
          <p class="pt-lede">{{ sentence() }}</p>
          <div class="dr-board">
            @for (c of columns(); track c.pillar) {
              <div class="dr-col">
                <b class="dr-col-h">{{ c.name }}</b>
                <div class="dr-half dr-up">@for (i of c.up; track i.ticker + i.fact) {<a [href]="i.href" [attr.data-tip]="itemTip(i)" [attr.aria-label]="i.name + ': ' + i.fact"><pt-logo [ticker]="i.ticker" [src]="i.logo" [size]="26" /></a>}</div>
                <div class="dr-mid" aria-hidden="true">▲ · ▼</div>
                <div class="dr-half dr-down">@for (i of c.down; track i.ticker + i.fact) {<a [href]="i.href" [class.dr-watch]="i.tone === 'flat'" [attr.data-tip]="itemTip(i)" [attr.aria-label]="i.name + ': ' + i.fact"><pt-logo [ticker]="i.ticker" [src]="i.logo" [size]="26" /></a>}</div>
              </div>
            }
          </div>
          <figcaption class="pt-legend">
            <span class="pt-key"><i class="dr-sw dr-sw-up"></i>strengthened</span>
            <span class="pt-key"><i class="dr-sw dr-sw-down"></i>weakened</span>
            <span class="pt-key"><i class="dr-sw dr-sw-watch"></i>to watch</span>
            <span class="pt-meta">a logo opens its quality card</span>
          </figcaption>
        } @else {<p class="pt-na">No new facts this week.</p>}
      </figure>
    }`,
})
export class PtQualityStrip {
  readonly data = input.required<Board | null>();
  protected readonly columns = computed(() => { const d = this.data(); return d ? boardColumns(d) : []; });
  protected readonly sentence = computed(() => { const d = this.data(); return d ? boardSentence(d) : ''; });
  protected readonly itemTip = (i: BoardItem) => tip({ [i.ticker]: i.name, [PILLARS[i.pillar].name]: i.fact, Date: date(i.date) });
  protected readonly dayMonth = dayMonth;
}

/**
 * DRAFT · H5 What changed in companies (mock data, stories only): the week's new quality facts across the companies, on the six
 * questions of the quality card — a column each, the companies that strengthened it above, those that weakened it below; a logo
 * opens its company's quality card. Its data (the cards of every company, computed each night: `qualityCards` of pt-quality is
 * pure, the nightly can run it) has no pipeline yet, so it comes as an input.
 * It chases no search of its own ("quality stocks", "stocks with strong fundamentals": under 5,000 a month, DataForSEO 2026-10-28):
 * it is the home's weekly, dated block the links to each company start from, so the heading carries the week, the sentence the date
 * and the companies' common names, and each logo's link says where it goes ("Nvidia's quality this week").
 * @version 0.0.2
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
/** "In the week to Oct 23, 2026, Execution strengthened at 8 companies; Economics weakened at Meta." — the two busiest columns. */
export function boardSentence(b: Board): string {
  const cols = boardColumns(b).map((c) => ({ ...c, n: c.up.length + c.down.length })).filter((c) => c.n).sort((x, y) => y.n - x.n);
  const names = (xs: BoardItem[]) => [...new Set(xs.map((i) => i.name))].join(' and ');
  const say = (c: (typeof cols)[number]) => c.up.length >= c.down.length
    ? `${c.name} strengthened at ${c.up.length > 2 ? `${c.up.length} companies` : names(c.up)}`
    : `${c.name} weakened or needs watching at ${c.down.length > 2 ? `${c.down.length} companies` : names(c.down)}`;
  return cols.length ? `In the week to ${date(b.to)}, ${cols.slice(0, 2).map(say).join('; ')}.` : '';
}
/** The heading's week: "Oct 19–Oct 23, 2026". */
export const boardWeek = (b: Pick<Board, 'from' | 'to'>) => `${dayMonth(b.from)}–${dayMonth(b.to)}, ${b.to.slice(0, 4)}`;

@Component({
  selector: 'pt-quality-strip',
  imports: [PtLogo],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <figure class="dr-fig">
        <div class="dr-head"><b>Quality this week across the six questions</b><span class="pt-meta">{{ week(d) }}</span></div>
        @if (d.items.length) {
          <p class="pt-lede">{{ sentence() }}</p>
          <div class="dr-board">
            @for (c of columns(); track c.pillar) {
              <div class="dr-col">
                <b class="dr-col-h">{{ c.name }}</b>
                <div class="dr-half dr-up">@for (i of c.up; track i.ticker + i.fact) {<a [href]="i.href" [attr.data-tip]="itemTip(i)" [attr.aria-label]="label(i)"><pt-logo [ticker]="i.ticker" [src]="i.logo" [size]="26" /></a>}</div>
                <div class="dr-mid" aria-hidden="true">▲ · ▼</div>
                <div class="dr-half dr-down">@for (i of c.down; track i.ticker + i.fact) {<a [href]="i.href" [class.dr-watch]="i.tone === 'flat'" [attr.data-tip]="itemTip(i)" [attr.aria-label]="label(i)"><pt-logo [ticker]="i.ticker" [src]="i.logo" [size]="26" /></a>}</div>
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
  /** the link's words: where it goes, then the fact */
  protected readonly label = (i: BoardItem) => `${i.name}’s quality this week: ${i.fact}`;
  protected readonly week = boardWeek;
}

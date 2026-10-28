/**
 * DRAFT · H2 Questions people are asking, answered (mock data, stories only): the week's real questions about a stock from Reddit
 * and X, each with the number that answers it, a small graphic and the pretickt page that explains it. Its data (the pulse's
 * questions, typed by need and matched to a page) has no pipeline yet, so it comes as an input.
 * It chases no search of its own (DataForSEO, 2026-10-28): it sends weight to the company pages, where the questions are searched —
 * so each question is in the searched words with the company's common name ("Why is Meta stock down this week?"), and each card ends
 * with descriptive link words ("Why Meta is down this week"), not "the answer on pretickt".
 * @version 0.0.2
 */
import { Component, input } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { date, level, num } from '@pretickt/components/format';

export type AskViz =
  | { kind: 'split'; market: number; sector: number; own: number }
  | { kind: 'rail'; price: number; high: number; target: number }
  | { kind: 'bars'; values: number[]; labels: string[] }
  | { kind: 'off'; off: number }
  | { kind: 'pe'; pe: number; sector: number };
/** `link`: the words of the page it leads to (an internal link: descriptive, as a search engine reads it). */
export interface AskedItem { ticker: string; name: string; logo: string | null; question: string; asks: number; answer: string;
  tone: 'pos' | 'neg' | 'flat'; sub: string; href: string; link: string; viz: AskViz | null }
export interface Asked { asOf: string; items: AskedItem[] }

const W = 200;
/** The split of a move as three bars: market and sector in greys, the company's own part in its tone. */
export function splitBars(v: { market: number; sector: number; own: number }) {
  const parts = [Math.abs(v.market), Math.abs(v.sector), Math.abs(v.own)], total = parts.reduce((a, b) => a + b, 0) || 1;
  let x = 0;
  return parts.map((p, i) => { const w = Math.max(2, (p / total) * (W - 4)); const r = { x: Math.round(x), w: Math.round(w), k: ['m', 's', 'o'][i]! }; x += w + 2; return r; });
}
/** A rail from the lowest to the highest of price, high and target, each placed on it. */
export function railMarks(v: { price: number; high: number; target: number }) {
  const lo = Math.min(v.price, v.high, v.target), hi = Math.max(v.price, v.high, v.target), span = hi - lo || 1;
  const x = (p: number) => Math.round(8 + ((p - lo) / span) * (W - 16));
  return { price: x(v.price), high: x(v.high), target: x(v.target) };
}

@Component({
  selector: 'pt-asked',
  imports: [PtLogo],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <div class="dr-fig">
        <div class="dr-head"><b>Questions people are asking, answered</b><span class="pt-meta">from Reddit and X · as of {{ date(d.asOf) }}</span></div>
        @if (d.items.length) {
          <ul class="dr-ask-grid">
            @for (a of d.items; track a.ticker + a.question) {
              <li><a class="dr-ask" [href]="a.href">
                <span class="dr-ask-q"><pt-logo [ticker]="a.ticker" [src]="a.logo" [size]="26" />{{ a.question }}</span>
                <span [class]="'dr-ask-big pt-t-' + a.tone">{{ a.answer }}</span>
                <span class="dr-ask-sub">{{ a.sub }}</span>
                @if (a.viz; as v) {
                  <svg class="dr-ask-viz" viewBox="0 0 200 30" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
                    @switch (v.kind) {
                      @case ('split') {
                        @for (b of split(v); track b.k) {<rect [class]="'dr-v-' + b.k" [attr.x]="b.x" y="8" [attr.width]="b.w" height="12" rx="2" />}
                        <text class="dr-v-l dr-v-on" x="196" y="17" text-anchor="end">own {{ num(own(v) * 100, 1) }} pts</text>
                      }
                      @case ('rail') {
                        @let m = rail(v);
                        <line class="dr-v-track" x1="8" x2="192" y1="14" y2="14" />
                        <line [class]="'dr-v-run ' + (v.target >= v.price ? 'dr-v-pos' : 'dr-v-neg')" [attr.x1]="m.price" [attr.x2]="m.target" y1="14" y2="14" />
                        <circle class="dr-v-dot" [attr.cx]="m.price" cy="14" r="5" /><circle class="dr-v-high" [attr.cx]="m.high" cy="14" r="3" />
                        <text class="dr-v-l" [attr.x]="clamp(m.price)" y="29" text-anchor="middle">price</text>
                        <text class="dr-v-l" [attr.x]="m.target" y="29" text-anchor="end">target</text>
                      }
                      @case ('bars') {
                        @let mx = maxAbs(v.values);
                        <line class="dr-v-track" x1="0" x2="200" y1="15" y2="15" />
                        @for (x of v.values; track $index) {<rect [class]="x < 0 ? 'dr-v-neg-f' : 'dr-v-pos-f'" [attr.x]="$index * 50 + 12" [attr.y]="x < 0 ? 15 : 15 - (x / mx) * 13" width="26" [attr.height]="(Math.abs(x) / mx) * 13 || 1" rx="2" />}
                      }
                      @case ('off') {
                        <rect class="dr-v-m" x="0" y="8" width="200" height="12" rx="3" />
                        <rect class="dr-v-neg-f" [attr.x]="200 * (1 + v.off)" y="8" [attr.width]="200 * -v.off" height="12" rx="3" />
                        <text class="dr-v-l" x="4" y="17">{{ level(1 + v.off, 0) }} of its high</text>
                      }
                      @case ('pe') {
                        @let mx = v.pe > v.sector ? v.pe : v.sector;
                        <rect [class]="'dr-v-' + a.tone + '-f'" x="0" y="4" [attr.width]="(v.pe / mx) * 150" height="9" rx="2" /><text class="dr-v-l" [attr.x]="(v.pe / mx) * 150 + 4" y="12">{{ num(v.pe, 1) }}×</text>
                        <rect class="dr-v-m" x="0" y="17" [attr.width]="(v.sector / mx) * 150" height="9" rx="2" /><text class="dr-v-l" [attr.x]="(v.sector / mx) * 150 + 4" y="25">sector {{ num(v.sector, 1) }}×</text>
                      }
                    }
                  </svg>
                }
                <span class="pt-meta">asked {{ a.asks }} times · {{ a.link }}&nbsp;→</span>
              </a></li>
            }
          </ul>
        } @else {<p class="pt-na">No question about a stock today.</p>}
      </div>
    }`,
})
export class PtAsked {
  readonly data = input.required<Asked | null>();
  protected readonly split = splitBars;
  protected readonly rail = railMarks;
  protected readonly own = (v: { own: number }) => v.own;
  protected readonly maxAbs = (xs: number[]) => Math.max(...xs.map(Math.abs), 1e-9);
  protected readonly Math = Math;
  /** a label under a rail mark, kept whole inside the 200-unit box */
  protected readonly clamp = (x: number) => Math.max(16, Math.min(184, x));
  protected readonly date = date;
  protected readonly num = num;
  protected readonly level = level;
}

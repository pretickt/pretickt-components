/**
 * DRAFT · H1 Hot right now (mock data, stories only): the companies the retail crowd talks about on Reddit and X in the last 24
 * hours, each a bubble as large as its posts, the ring red when it draws twice its usual or more. Its data (posts per ticker every
 * 30 minutes against a usual day, from the pulse) has no pipeline yet, so it comes as an input; once it has one, this becomes a
 * component in components/ that asks its typology for it.
 * @version 0.0.1
 */
import { Component, computed, input } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { date, num, pct, stockHref, tip } from '@pretickt/components/format';

export interface HotRow { ticker: string; name: string; logo: string | null; mentions: number; usual: number; move: number | null; theme: string | null }
export interface Hot { asOf: string; window: '24h'; rows: HotRow[] }

/** Posts against a usual day; null without a usual day. */
export const heat = (r: Pick<HotRow, 'mentions' | 'usual'>) => (r.usual > 0 ? r.mentions / r.usual : null);
/** A bubble's side in px: its area grows with the posts. */
export const bubbleSize = (mentions: number) => Math.round(34 + Math.sqrt(Math.max(0, mentions)) * 5.4);
export const ring = (x: number | null) => (x === null ? 'cool' : x >= 2 ? 'hot' : x >= 0.8 ? 'usual' : 'cool');

/** "Most discussed in the last 24 hours: SPCX (220 posts, 3.1× its usual), GOOGL (170) and AMZN (150)." and the hottest. */
export function hotSentence(rows: HotRow[]): string {
  const top = [...rows].sort((a, b) => b.mentions - a.mentions).slice(0, 3);
  if (!top.length) return '';
  const hottest = rows.filter((r) => (heat(r) ?? 0) >= 2).sort((a, b) => heat(b)! - heat(a)!)[0];
  const first = `${top[0]!.ticker} (${top[0]!.mentions} posts${heat(top[0]!) !== null ? `, ${num(heat(top[0]!), 1)}× its usual` : ''})`;
  const parts = [first, ...top.slice(1).map((r) => `${r.ticker} (${r.mentions})`)];
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  return `Most discussed in the last 24 hours: ${list}.` +
    (hottest ? ` ${hottest.ticker} draws ${num(heat(hottest), 1)}× its usual.` : '');
}

@Component({
  selector: 'pt-hot',
  imports: [PtLogo],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <figure class="dr-fig">
        <div class="dr-head"><b>Hot right now</b><span class="pt-meta">Reddit and X · last 24 hours · as of {{ date(d.asOf) }}</span></div>
        @if (bubbles().length) {
          <p class="pt-lede">{{ sentence() }}</p>
          <ul class="dr-bubbles">
            @for (b of bubbles(); track b.ticker) {
              <li class="dr-bub-li">
                <a [class]="'dr-bub dr-' + b.ring" [href]="stockHref(b.ticker)" [style.width.px]="b.size" [style.height.px]="b.size"
                  [attr.data-tip]="b.tip" [attr.aria-label]="b.label"><pt-logo [ticker]="b.ticker" [src]="b.logo" [size]="b.logoSize" /></a>
                <span class="dr-bub-t">{{ b.ticker }}@if (b.ring === 'hot') { <b class="pt-t-neg">{{ b.x }}×</b>}</span>
              </li>
            }
          </ul>
          <figcaption class="pt-legend">
            <span class="pt-key"><i class="dr-sw dr-hot"></i>2× its usual or more</span>
            <span class="pt-key"><i class="dr-sw dr-usual"></i>around its usual</span>
            <span class="pt-key"><i class="dr-sw dr-cool"></i>below its usual</span>
            <span class="pt-meta">size = posts</span>
          </figcaption>
        } @else {<p class="pt-na">A quiet day: nobody is talking about a stock more than usual.</p>}
      </figure>
    }`,
})
export class PtHot {
  readonly data = input.required<Hot | null>();
  protected readonly bubbles = computed(() => [...(this.data()?.rows ?? [])].sort((a, b) => b.mentions - a.mentions).map((r) => {
    const x = heat(r), size = bubbleSize(r.mentions);
    return { ticker: r.ticker, logo: r.logo, size, logoSize: Math.round(size * 0.5), ring: ring(x), x: x === null ? '' : num(x, x >= 10 ? 0 : 1),
      label: `${r.name}: ${r.mentions} posts in 24 hours${x === null ? '' : `, ${num(x, 1)} times its usual`}`,
      tip: tip({ [r.ticker]: r.name, Posts: `${r.mentions} in 24 hours`, 'Usual day': x === null ? null : `${num(r.usual, 0)} posts`, Today: r.move === null ? null : pct(r.move), Talk: r.theme }) };
  }));
  protected readonly sentence = computed(() => hotSentence(this.data()?.rows ?? []));
  protected readonly date = date;
  protected readonly stockHref = stockHref;
}

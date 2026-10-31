/**
 * DRAFT · H1 Hot right now (mock data, stories only): the companies the retail crowd talks about on Reddit and X in the last 24
 * hours, each a bubble as large as its posts, the ring red when it draws twice its usual or more. Its data (posts per ticker every
 * 30 minutes against a usual day, from the pulse) has no pipeline yet, so it comes as an input; once it has one, this becomes a
 * component in components/ that asks its typology for it.
 * In the words people use (DataForSEO, 2026-10-28): Google searches are few ("trending stocks"), but the AI answers to "which stocks
 * are people talking about on Reddit today" cite trackers that give the time, the counts and the sources — so the heading (an h2)
 * says the searched words, "Trending stocks on Reddit and X today", the sentence names each company with its ticker, its posts and
 * its usual day, the time (ET) and where the posts come from, and a bubble opens what people ask on the company's page
 * (`#people-ask`, the section of pt-people-ask). A "today" that is not today loses trust: with `stale` (the resolver's call, at
 * build time: the pulse runs on a Mac and can stop) the heading drops "today" and says when the counts are from. On its own page
 * (/trending) the page's h1 is the heading (`head` false) and `rank` lists the most talked about with their counts, as text.
 * Every company it names, in the sentence and in the list, is a link with its logo: the card opens on any ticker.
 * @version 0.0.4
 */
import { Component, computed, input } from '@angular/core';
import { PtLogo, PtMention, PtSay } from '@pretickt/components/ds';
import { andSaid, dayMonth, mention, num, pct, plainName, say, stockHref, tip, type Said } from '@pretickt/components/format';
import { weekdayOf } from '../pt-calendar';

export interface HotRow { ticker: string; name: string; logo: string | null; mentions: number; usual: number; move: number | null; theme: string | null }
/** `time`: the count's time in New York, "HH:MM"; `sources`: where the posts come from, the most first; `stale`: older than a day's cycle. */
export interface Hot { asOf: string; time: string | null; window: '24h'; sources: string[]; stale: boolean; rows: HotRow[] }

/** Posts against a usual day; null without a usual day. */
export const heat = (r: Pick<HotRow, 'mentions' | 'usual'>) => (r.usual > 0 ? r.mentions / r.usual : null);
/** A bubble's side in px: its area grows with the posts. */
export const bubbleSize = (mentions: number) => Math.round(34 + Math.sqrt(Math.max(0, mentions)) * 5.4);
export const ring = (x: number | null) => (x === null ? 'cool' : x >= 2 ? 'hot' : x >= 0.8 ? 'usual' : 'cool');

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "10:30" → "10:30 a.m. ET", "14:00" → "2 p.m. ET". */
export function etTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'a.m.' : 'p.m.'} ET`;
}
/** "10:30 a.m. ET, Mon, Oct 26, 2026" — or the date alone without a time. */
export const hotWhen = (d: Pick<Hot, 'asOf' | 'time'>) =>
  `${d.time ? `${etTime(d.time)}, ` : ''}${WEEKDAY[weekdayOf(d.asOf)]}, ${dayMonth(d.asOf)}, ${d.asOf.slice(0, 4)}`;
const nameOf = (r: HotRow) => (r.name && r.name !== r.ticker ? plainName(r.name) : r.ticker);
const listed = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * "Most discussed on Reddit and X in the 24 hours to 10:30 a.m. ET, Mon, Oct 26, 2026: SpaceX SPCX (220 posts, 3.1× its usual), Alphabet
 * GOOGL (170) and Amazon AMZN (150). Amgen AMGN draws 6.7× its usual. Posts from r/wallstreetbets, r/stocks and X."
 */
export function hotSentence(rows: HotRow[], when = '', sources: string[] = []): Said {
  const top = [...rows].sort((a, b) => b.mentions - a.mentions).slice(0, 3);
  if (!top.length) return [];
  const who = (r: HotRow) => mention(r.ticker, r.name, r.logo);
  const hottest = rows.filter((r) => (heat(r) ?? 0) >= 2).sort((a, b) => heat(b)! - heat(a)!)[0];
  const h0 = heat(top[0]!);
  const parts = [say`${who(top[0]!)} (${top[0]!.mentions} posts${h0 !== null ? `, ${num(h0, 1)}× its usual` : ''})`,
    ...top.slice(1).map((r) => say`${who(r)} (${r.mentions})`)];
  const draws = hottest ? say` ${who(hottest)} draws ${num(heat(hottest), 1)}× its usual.` : [];
  return say`Most discussed on Reddit and X ${when ? `in the 24 hours to ${when}` : 'in the last 24 hours'}: ${andSaid(parts)}.${draws}${sources.length ? ` Posts from ${listed(sources)}.` : ''}`;
}

@Component({
  selector: 'pt-hot',
  imports: [PtLogo, PtMention, PtSay],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <figure class="dr-fig">
        <div class="dr-head">@if (head()) {<h2 class="dr-head-t">{{ d.stale ? 'Trending stocks on Reddit and X' : 'Trending stocks on Reddit and X today' }}</h2>}
          <span class="pt-meta">{{ d.stale ? 'last updated ' + when() + ' — not today’s counts' : 'last 24 hours · as of ' + when() }}</span></div>
        @if (bubbles().length) {
          <p class="pt-lede"><pt-say [parts]="sentence()" /></p>
          <ul class="dr-bubbles">
            @for (b of bubbles(); track b.ticker) {
              <li class="dr-bub-li">
                <a [class]="'dr-bub dr-' + b.ring" [href]="b.href" [style.width.px]="b.size" [style.height.px]="b.size"
                  [attr.data-tip]="b.tip" [attr.aria-label]="b.label"><pt-logo [ticker]="b.ticker" [src]="b.logo" [size]="b.logoSize" /></a>
                <span class="dr-bub-t">{{ b.ticker }}@if (b.ring === 'hot') { <b class="pt-t-neg">{{ b.x }}×</b>}</span>
              </li>
            }
          </ul>
          @if (ranked().length) {
            <ol class="dr-rank">
              @for (r of ranked(); track r.ticker) {<li><a ptMention [ticker]="r.ticker" [name]="r.name" [logo]="r.logo" section="people-ask"></a>: {{ r.say }}</li>}
            </ol>
          }
          <figcaption class="pt-legend">
            <span class="pt-key"><i class="dr-sw dr-hot"></i>2× its usual or more</span>
            <span class="pt-key"><i class="dr-sw dr-usual"></i>around its usual</span>
            <span class="pt-key"><i class="dr-sw dr-cool"></i>below its usual</span>
            <span class="pt-meta">size = posts · a bubble opens what people ask about it</span>
          </figcaption>
        } @else {<p class="pt-na">A quiet day: nobody is talking about a stock more than usual.</p>}
      </figure>
    }`,
})
export class PtHot {
  readonly data = input.required<Hot | null>();
  /** The heading: off on the /trending page, whose h1 says it. */
  readonly head = input(true);
  /** How many of the most talked about to list as text under the bubbles (the /trending page); 0: none. */
  readonly rank = input(0);
  protected readonly ranked = computed(() => [...(this.data()?.rows ?? [])].sort((a, b) => b.mentions - a.mentions).slice(0, this.rank()).map((r) => {
    const x = heat(r);
    return { ticker: r.ticker, name: r.name, logo: r.logo, say: `${r.mentions} posts in 24 hours${x === null ? '' : `, ${num(x, 1)}× its usual day`}` };
  }));
  protected readonly when = computed(() => { const d = this.data(); return d ? hotWhen(d) : ''; });
  protected readonly bubbles = computed(() => [...(this.data()?.rows ?? [])].sort((a, b) => b.mentions - a.mentions).map((r) => {
    const x = heat(r), size = bubbleSize(r.mentions);
    return { ticker: r.ticker, logo: r.logo, size, logoSize: Math.round(size * 0.5), ring: ring(x), x: x === null ? '' : num(x, x >= 10 ? 0 : 1),
      href: `${stockHref(r.ticker)}#people-ask`,
      label: `What people ask about ${nameOf(r)}: ${r.mentions} posts in 24 hours${x === null ? '' : `, ${num(x, 1)} times its usual`}`,
      tip: tip({ [r.ticker]: r.name, Posts: `${r.mentions} in 24 hours`, 'Usual day': x === null ? null : `${num(r.usual, 0)} posts`, Today: r.move === null ? null : pct(r.move), Talk: r.theme }) };
  }));
  protected readonly sentence = computed(() => { const d = this.data(); return d ? hotSentence(d.rows, this.when(), d.sources) : []; });
}

/**
 * DRAFT · What people ask about a company, answered (mock data, stories only): for the company page, the questions retail asks
 * about this stock on Reddit and X (pretickt-pulse: the week's posts and the kind of question, its need), each a heading answered
 * in its first sentence with a number and a date from pretickt's data, then the page that explains it. For search engines and
 * answer engines (SEO, AEO): the questions in the words people search with, a different text on every page. The pulse only picks
 * and orders the questions; a company nobody talks about keeps the usual ones. The sentences come in the payload, templated by the
 * resolver, so the generator can put the same questions and answers in the page's FAQPage structured data. Its data has no
 * pipeline yet, so it comes as an input. Two looks on the same text: `faq` (the number beside each answer) and `cards`.
 * @version 0.0.1
 */
import { Component, input } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { date, level, num } from '@pretickt/components/format';
import { railMarks, splitBars, type AskViz } from './pt-asked';

/** The pulse's needs that a company page answers (pretickt-pulse `config.ANSWERABLE_NEEDS` and two more). */
export type AskNeed = 'why_moving' | 'buy_or_not' | 'when_sell' | 'dip_pullback' | 'earnings_events' | 'dividends_income' | 'trust_track_record';
export interface PeopleAskItem {
  need: AskNeed; question: string; answer: string; big: string; tone: 'pos' | 'neg' | 'flat';
  /** the page that explains the answer, and the link's words (descriptive: they are an internal link) */
  href: string; link: string;
  /** questions of this kind about the company this week; null when nobody asked it (the usual question) */
  asked: number | null; viz: AskViz | null;
}
export interface PeopleAskChatter {
  /** posts naming the company in the 7 days to asOf, the average of the 4 weeks before, the posts of each day (oldest first) */
  posts: number; usual: number | null; days: number[]; bySource: { reddit: number; x: number };
}
export interface PeopleAsk {
  ticker: string; name: string; logo: string | null; asOf: string;
  chatter: PeopleAskChatter | null; needs: { need: AskNeed; share: number }[]; items: PeopleAskItem[];
}

export const NEEDS: Record<AskNeed, { label: string; phrase: string }> = {
  why_moving: { label: 'Why it is moving', phrase: 'why it is moving' },
  buy_or_not: { label: 'Buy or not', phrase: 'whether to buy' },
  when_sell: { label: 'When to sell', phrase: 'when to sell' },
  dip_pullback: { label: 'Buying the dip', phrase: 'whether to buy the dip' },
  earnings_events: { label: 'Earnings', phrase: 'about earnings' },
  dividends_income: { label: 'Dividends', phrase: 'about the dividend' },
  trust_track_record: { label: 'Analysts', phrase: 'about the analysts' },
};
const QUIET = 10, HOT = 1.5, TOP_SHARE = 0.15;
const known = (n: { need: string }): n is { need: AskNeed; share: number } => n.need in NEEDS;

/** This week's posts against a usual week; null without a usual week to compare with. */
export const weekHeat = (c: PeopleAskChatter): number | null => (c.usual && c.usual > 0 ? c.posts / c.usual : null);

/** The first sentence, the answer to "what are people saying about it": the week's posts, the heat, the two most asked kinds. */
export function askLede(d: PeopleAsk): string {
  const c = d.chatter, day = date(d.asOf);
  if (!c || c.posts <= 0) return `The questions people ask about ${d.name}, answered with the data as of ${day}.`;
  const h = weekHeat(c);
  const top = d.needs.filter(known).filter((n) => n.share >= TOP_SHARE).sort((a, b) => b.share - a.share).slice(0, 2)
    .map((n) => `${NEEDS[n.need].phrase} (${level(n.share, 0)})`);
  const posts = `${c.posts} ${c.posts === 1 ? 'post' : 'posts'} on Reddit and X mentioned ${d.name} in the week to ${day}`;
  return (c.posts < QUIET ? `A quiet week: ${posts}.` : `${posts}${h !== null && h >= HOT ? `, ${num(h, 1)}× its usual week` : ''}.`) +
    (top.length ? ` Most asked ${top.join(' and ')}.` : '');
}

/** The kinds of question as one bar, the largest first; kinds the page does not know go to "Other" with the rest. */
export function needBar(needs: PeopleAsk['needs']): { key: string; label: string; share: number; rank: number }[] {
  const sorted = needs.filter(known).filter((n) => n.share > 0).sort((a, b) => b.share - a.share || a.need.localeCompare(b.need));
  const rest = Math.max(0, 1 - sorted.reduce((s, n) => s + n.share, 0));
  return [...sorted.map((n, i) => ({ key: n.need as string, label: NEEDS[n.need].label, share: n.share, rank: Math.min(i, 4) })),
    ...(rest >= 0.005 ? [{ key: 'other', label: 'Other', share: rest, rank: -1 }] : [])];
}

@Component({
  selector: 'pt-people-ask',
  imports: [PtLogo],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <div class="dp">
        <div class="dp-top"><pt-logo [ticker]="d.ticker" [src]="d.logo" [size]="32" /><p class="dp-lede">{{ lede(d) }}</p></div>
        @if (d.chatter; as c) {
          @if (c.posts > 0) {
            @let h = heat(c);
            @let mx = max(c.days);
            <div class="dp-pulse">
              <span class="dp-week">
                <svg class="dp-days" viewBox="0 0 70 24" aria-hidden="true">
                  @for (n of c.days; track $index) {<rect [class]="$last ? 'dp-day dp-day-last' : 'dp-day'" [attr.x]="$index * 10 + 1" [attr.y]="24 - (n / mx) * 22 - 1" width="8" [attr.height]="(n / mx) * 22 + 1" rx="1.5" />}
                </svg>
                <span class="pt-meta">{{ c.bySource.reddit }} Reddit · {{ c.bySource.x }} X</span>
                @if (h !== null && h >= hot) {<span class="dp-heat">{{ num(h, 1) }}× usual</span>}
              </span>
              @let bar = segments(d.needs);
              @if (bar.length) {
                <span class="dp-mix" aria-hidden="true">
                  @for (s of bar; track s.key) {<span [class]="'dp-seg dp-r' + s.rank" [style.width.%]="s.share * 100"></span>}
                </span>
                <ul class="dp-legend">
                  @for (s of bar; track s.key) {<li><i [class]="'dp-seg dp-r' + s.rank"></i>{{ s.label }} {{ level(s.share, 0) }}</li>}
                </ul>
              }
            </div>
          }
        }
        <div [class]="variant() === 'cards' ? 'dp-cards' : 'dp-faq'">
          @for (a of d.items; track a.question) {
            <article class="dp-qa">
              <span [class]="'dp-big pt-t-' + a.tone" aria-hidden="true">{{ a.big }}</span>
              <div class="dp-body">
                <h3 class="dp-q">{{ a.question }}</h3>
                <p class="dp-a">{{ a.answer }}</p>
                @if (a.viz; as v) {
                  <svg class="dr-ask-viz" viewBox="0 0 200 30" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
                    @switch (v.kind) {
                      @case ('split') {
                        @for (b of split(v); track b.k) {<rect [class]="'dr-v-' + b.k" [attr.x]="b.x" y="8" [attr.width]="b.w" height="12" rx="2" />}
                      }
                      @case ('rail') {
                        @let m = rail(v);
                        <line class="dr-v-track" x1="8" x2="192" y1="14" y2="14" />
                        <line [class]="'dr-v-run ' + (v.target >= v.price ? 'dr-v-pos' : 'dr-v-neg')" [attr.x1]="m.price" [attr.x2]="m.target" y1="14" y2="14" />
                        <circle class="dr-v-dot" [attr.cx]="m.price" cy="14" r="5" /><circle class="dr-v-high" [attr.cx]="m.high" cy="14" r="3" />
                      }
                      @case ('bars') {
                        @let bm = max(abs(v.values));
                        <line class="dr-v-track" x1="0" x2="200" y1="15" y2="15" />
                        @for (x of v.values; track $index) {<rect [class]="x < 0 ? 'dr-v-neg-f' : 'dr-v-pos-f'" [attr.x]="$index * 50 + 12" [attr.y]="x < 0 ? 15 : 15 - (x / bm) * 13" width="26" [attr.height]="(abs1(x) / bm) * 13 || 1" rx="2" />}
                      }
                      @case ('off') {
                        <rect class="dr-v-m" x="0" y="8" width="200" height="12" rx="3" />
                        <rect class="dr-v-neg-f" [attr.x]="200 * (1 + v.off)" y="8" [attr.width]="200 * -v.off" height="12" rx="3" />
                      }
                    }
                  </svg>
                }
                <p class="pt-meta">@if (a.asked) {asked {{ a.asked }} {{ a.asked === 1 ? 'time' : 'times' }} this week · }<a [href]="a.href">{{ a.link }} →</a></p>
              </div>
            </article>
          }
        </div>
      </div>
    }`,
})
export class PtPeopleAsk {
  readonly data = input.required<PeopleAsk | null>();
  readonly variant = input<'faq' | 'cards'>('faq');
  protected readonly lede = askLede;
  protected readonly heat = weekHeat;
  protected readonly hot = HOT;
  protected readonly segments = needBar;
  protected readonly split = splitBars;
  protected readonly rail = railMarks;
  protected readonly max = (xs: number[]) => Math.max(...xs, 1e-9);
  protected readonly abs = (xs: number[]) => xs.map(Math.abs);
  protected readonly abs1 = Math.abs;
  protected readonly num = num;
  protected readonly level = level;
}

/**
 * What changed for this company since the session before — and, when the page carries it, what is close to the last close?
 * @version 1.1.0
 * @evidence Romeo, 2026-11-12: «per ogni azienda, mostriamo quel summary ogni giorno diverso con il confronto col giorno prima, fatto ogni notte alla chiusura»
 * @evidence Romeo, 2026-11-13: «le principali devono sempre avere scheda in company page (almeno con niente di rilevante)»
 * @evidence Romeo, 2026-11-14: «Sempre la più vicina e usa badge e grassetto per aiutare la lettura»
 */
import { Component, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { date, named } from '@pretickt/components/format';
import type { DailyFact } from '@pretickt/components/typologies';

/** The half's heading (spec 2026-11-14 what-to-watch, Open #3: the name is Romeo's; one constant until he picks it). */
export const WATCH_TITLE = 'What to watch';
/** The note under a card whose "What to watch" half the model worded too. */
export const AI_NOTE_BOTH = 'Wording by an AI model from pretickt\'s data; the levels, dates and dated facts are the platform\'s own. Not investment advice.';
const AI_NOTE = 'Wording by an AI model from pretickt\'s data; the dated facts under it are the platform\'s own. Not investment advice.';

/** A body's `**bold**` phrases as segments (the server keeps only well-formed ones); text with an unpaired mark is one plain segment, marks and all. */
export function segments(text: string): { t: string; b: boolean }[] {
  const parts = text.split('**');
  if (parts.length % 2 === 0) return [{ t: text, b: false }];
  return parts.map((t, i) => ({ t, b: i % 2 === 1 })).filter((s) => s.t !== '');
}
/** The facts that carry a chip, in their cited order (the lead first). */
export const withChips = (facts: readonly DailyFact[]): DailyFact[] => facts.filter((f) => f.chip);

@Component({
  selector: 'pt-daily',
  template: `
    @let d = daily.value();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else if (d) {
      @let c = d.card;
      @let facts = c ? c.facts : d.facts;
      @let w = d.watch;
      @if (c || facts.length) {
        <section class="pt-daily">
          <p class="pt-meta">{{ named(d.name, d.ticker) }} · @if (c && c.session !== d.asOf) {Latest: }{{ date(c ? c.session : d.asOf) }}</p>
          @if (c) {
            <p class="pt-daily-message">{{ c.message }}</p>
            <p class="pt-daily-body">@for (s of segments(c.body); track $index) {@if (s.b) {<b>{{ s.t }}</b>} @else {{{ s.t }}}}</p>
          }
          @if (withChips(facts).length) {
            <ul class="pt-badges pt-daily-chips">
              @for (f of withChips(facts); track $index) {<li class="pt-badge pt-badge-mini"><span class="pt-badge-k">{{ f.chip!.label }}</span>@if (f.chip!.value) { · <span class="pt-badge-v">{{ f.chip!.value }}</span>}</li>}
            </ul>
          }
          @if (facts.length) {
            <ul class="pt-daily-facts">
              @for (f of facts; track $index) {
                <li>{{ f.text }}@if (f.was) {<span class="pt-daily-was">Before: {{ f.was }}</span>}</li>
              }
            </ul>
          }
          @if (w) {
            <div class="pt-daily-watch">
              <h3 class="pt-daily-half">{{ title }}</h3>
              @if (w.kind === 'half') {
                <p class="pt-daily-message">{{ w.message }}</p>
                <p class="pt-daily-body">@for (s of segments(w.body); track $index) {@if (s.b) {<b>{{ s.t }}</b>} @else {{{ s.t }}}}</p>
                @if (withChips(w.facts).length) {
                  <ul class="pt-badges pt-daily-chips">
                    @for (f of withChips(w.facts); track $index) {<li class="pt-badge pt-badge-mini"><span class="pt-badge-k">{{ f.chip!.label }}</span>@if (f.chip!.value) { · <span class="pt-badge-v">{{ f.chip!.value }}</span>}</li>}
                  </ul>
                }
                @if (w.facts.length) {
                  <ul class="pt-daily-facts">
                    @for (f of w.facts; track $index) {<li>{{ f.text }}</li>}
                  </ul>
                }
              } @else if (w.kind === 'fact') {
                <p class="pt-daily-line">{{ w.fact.text }}</p>
                @if (w.fact.chip; as k) {
                  <ul class="pt-badges pt-daily-chips"><li class="pt-badge pt-badge-mini"><span class="pt-badge-k">{{ k.label }}</span>@if (k.value) { · <span class="pt-badge-v">{{ k.value }}</span>}</li></ul>
                }
              } @else {
                <p class="pt-meta">{{ w.text }}</p>
              }
            </div>
          }
          @if (w && w.kind === 'half') {<p class="pt-note">{{ noteBoth }}</p>}
          @else if (c) {<p class="pt-note">{{ note }}</p>}
        </section>
      } @else {
        <!-- every night's facts hold something new (the day's move): no card and no fact means the night did not read this company, so the line claims nothing about it -->
        <p class="pt-na">No daily summary for {{ named(d.name, d.ticker) }} on {{ date(d.asOf) }}</p>
      }
    }`,
})
export class PtDaily {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  protected readonly daily = this.pt.daily(() => ({ ticker: this.ticker() }));
  protected readonly date = date;
  protected readonly named = named;
  protected readonly segments = segments;
  protected readonly withChips = withChips;
  protected readonly title = WATCH_TITLE;
  protected readonly note = AI_NOTE;
  protected readonly noteBoth = AI_NOTE_BOTH;
}

/**
 * What changed for this company since the session before?
 * @version 1.0.0
 * @evidence Romeo, 2026-11-12: «per ogni azienda, mostriamo quel summary ogni giorno diverso con il confronto col giorno prima, fatto ogni notte alla chiusura»
 * @evidence Romeo, 2026-11-13: «le principali devono sempre avere scheda in company page (almeno con niente di rilevante)»
 */
import { Component, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { date, named } from '@pretickt/components/format';

@Component({
  selector: 'pt-daily',
  template: `
    @let d = daily.value();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else if (d) {
      @let c = d.card;
      @let facts = c ? c.facts : d.facts;
      @if (c || facts.length) {
        <section class="pt-daily">
          <p class="pt-meta">{{ named(d.name, d.ticker) }} · @if (c && c.session !== d.asOf) {Latest: }{{ date(c ? c.session : d.asOf) }}</p>
          @if (c) {
            <p class="pt-daily-message">{{ c.message }}</p>
            <p class="pt-daily-body">{{ c.body }}</p>
          }
          @if (facts.length) {
            <ul class="pt-daily-facts">
              @for (f of facts; track $index) {
                <li>{{ f.text }}@if (f.was) {<span class="pt-daily-was">Before: {{ f.was }}</span>}</li>
              }
            </ul>
          }
          @if (c) {<p class="pt-note">Wording by an AI model from pretickt's data; the dated facts under it are the platform's own. Not investment advice.</p>}
        </section>
      } @else {<p class="pt-na">Nothing new recorded for {{ named(d.name, d.ticker) }} on {{ date(d.asOf) }}</p>}
    }`,
})
export class PtDaily {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  protected readonly daily = this.pt.daily(() => ({ ticker: this.ticker() }));
  protected readonly date = date;
  protected readonly named = named;
}

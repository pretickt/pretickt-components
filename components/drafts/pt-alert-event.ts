/**
 * DRAFT · The alert that fired, at the top of the company page (Romeo, 2026-11-01: «l'email porta all'asset Company page su cui
 * quell'evento si è verificato»): the alert's name, what happened with the day and the time, then one line per condition with the
 * section of the page that shows it. Its data (`alert-event@1`) has no pipeline yet, so it comes as an input; on www the component will
 * read the event the page's address names (`?alert=`), and render nothing without one.
 * @version 0.0.1
 */
import { Component, computed, input } from '@angular/core';
import { CONDITIONS, SECTION_OF, type ConditionId, type Params } from '@pretickt/components/alerts';
import { PtIcon, PtLogo } from '@pretickt/components/ds';
import { dayMonth, named } from '@pretickt/components/format';

/** The shape `alert-event@1` will have: the alert, the company, when it fired, each condition's value at that moment. */
export interface AlertEventPayload {
  id: string; name: string; ticker: string; companyName: string; logo: string | null;
  /** the New York session it fired in, and the time in the reader's words ("3:45 PM ET") */
  session: string; firedAt: string;
  conditions: { c: ConditionId; p: Params; value: number | null }[];
}

/** The company page's sections, as the page titles them (plant/src/generate/pages.ts). */
const SECTION_LABEL: Record<string, string> = {
  why: 'Why it moved', card: 'The price today', technicals: 'Technicals', snapshot: 'Snapshot', targets: 'Analyst price targets',
  value: 'Quality checks', financials: 'Revenue and free cash flow', news: 'Latest news', price: 'Price and events',
};

@Component({
  selector: 'pt-alert-event',
  imports: [PtIcon, PtLogo],
  template: `
    @if (event(); as e) {
      <aside class="pt-alev" aria-label="Your alert">
        <p class="pt-alev-k"><svg ptIcon="bell"></svg>Your alert · {{ e.name }}</p>
        <p class="pt-alev-h"><pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="22" /><b>{{ headline() }}</b></p>
        <ul class="pt-alev-l">
          @for (l of lines(); track $index) {
            <li><span>{{ l.fact }}</span>@if (l.href) {<a [href]="l.href">{{ l.label }}&nbsp;→</a>}</li>
          }
        </ul>
      </aside>
    }`,
})
export class PtAlertEvent {
  readonly event = input<AlertEventPayload | null>(null);

  /** the conditions that say what happened (the universe's only say which stocks were watched) */
  protected readonly lines = computed(() => (this.event()?.conditions ?? [])
    .filter((x) => CONDITIONS[x.c] && CONDITIONS[x.c].group !== 'universe')
    .map((x) => {
      const section = SECTION_OF[x.c];
      return { fact: CONDITIONS[x.c].fact(x.p, x.value), href: section ? `#${section}` : null, label: section ? SECTION_LABEL[section] ?? 'See it' : '' };
    })
    .filter((l) => l.fact));
  protected readonly headline = computed(() => {
    const e = this.event();
    if (!e) return '';
    const first = this.lines()[0];
    return `${named(e.companyName, e.ticker)} ${first ? first.fact + ' ' : ''}on ${dayMonth(e.session)}, fired at ${e.firedAt}`;
  });
}

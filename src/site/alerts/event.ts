import { type ApplicationRef, Component, computed, createComponent, type EnvironmentInjector, input } from '@angular/core';
import { FAILED, PT_STORE } from '@pretickt/components/context';
import { PtIcon, PtLogo } from '@pretickt/components/ds';
import { dayMonth, named } from '@pretickt/components/format';
import { CONDITIONS, seenOf } from '../../alerts/catalog';
import { SECTION_OF } from '../../alerts/sources';
import type { AlertEvent } from '../../typologies/alerts';
import { landingOf } from './landing';

/** The company page's sections, as the page titles them (plant/src/generate/pages.ts). */
const SECTION_LABEL: Record<string, string> = {
  why: 'Why it moved', card: 'The price today', technicals: 'Technicals', snapshot: 'Snapshot', targets: 'Analyst price targets',
  value: 'Quality checks', financials: 'Revenue and free cash flow', news: 'Latest news', price: 'Price and events',
};

/**
 * The alert that fired, at the top of the company page (Romeo, 2026-11-01: «l'email porta all'asset Company page su cui quell'evento si
 * è verificato»): the alert's name, what happened with the day and the time, then one line per condition with the section of the
 * page that shows it. A part of the page app (ruling I-11), mounted above the page by `showEvent` from the email link's `?alert=`.
 */
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
  readonly event = input<AlertEvent | null>(null);

  /** the conditions that say what happened (the universe's only say which stocks were watched) */
  protected readonly lines = computed(() => (this.event()?.conditions ?? [])
    .filter((x) => CONDITIONS[x.c] && CONDITIONS[x.c].group !== 'universe')
    .map((x) => {
      const section = SECTION_OF[x.c];
      return { fact: CONDITIONS[x.c].fact(x.p, x.value, seenOf(x)), href: section ? `#${section}` : null, label: section ? SECTION_LABEL[section] ?? 'See it' : '' };
    })
    .filter((l) => l.fact));
  protected readonly headline = computed(() => {
    const e = this.event();
    if (!e) return '';
    const first = this.lines()[0];
    return `${named(e.companyName, e.ticker)} ${first ? first.fact + ' ' : ''}on ${dayMonth(e.session)}, fired at ${e.firedAt}`;
  });
}

/**
 * An alert email's link (`/stocks/amd/?alert=<id>`): the alert that fired (`alert-event@1`), above the company page. Nothing for a
 * malformed link, an event the API does not have, or one about another company than the page's.
 */
export async function showEvent(doc: Document, appRef: ApplicationRef, env: EnvironmentInjector, search: string, subject?: string): Promise<void> {
  const id = landingOf(search).alert, root = doc.querySelector('pt-page');
  if (!id || !root) return;
  const e = await env.get(PT_STORE).ask('alert-event@1', { id });
  if (!e || e === FAILED || (subject && (e as AlertEvent).ticker !== subject)) return;
  const host = doc.createElement('pt-alert-event');
  root.before(host);
  const ref = createComponent(PtAlertEvent, { environmentInjector: env, hostElement: host });
  ref.setInput('event', e);
  appRef.attachView(ref.hostView);
}

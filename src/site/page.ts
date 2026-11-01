import { afterNextRender, ApplicationRef, Component, EnvironmentInjector, inject, PLATFORM_ID, TransferState } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { sendBeacon, startBeacon } from './beacon';
import { attachCards, attachCardSlots, CARD_TARGET, companyOf } from './cards';
import { attachCompanyBar } from './cobar';
import { attachHeader } from './header';
import { PAGE_KEY, PT_PAGE } from './model';
import { PtSlot, REGISTRY } from './registry.generated';
import { attachShare } from './share';
import { attachTips } from './tips';

const CARD = 'pt-company-card';

/**
 * The page app (one per page): the generator's sections — heading, "see all" link, placements. In the browser, once rendered:
 * the beacon, the tooltips, and the company card on hover over company links and where a component leaves room for it.
 */
@Component({
  selector: 'pt-page',
  imports: [PtSlot],
  template: `
    @for (s of model.sections; track s.id) {
      <section class="pt-section" [class.pt-strip]="s.strip" [id]="s.id">
        @if (s.more; as more) {
          <div class="pt-section-head">
            @if (s.title) {<h2 class="pt-section-title">{{ s.title }}</h2>}
            <a class="pt-section-more" [href]="more.href" [attr.aria-label]="s.title ? more.label + ': ' + s.title : null">{{ more.label }} →</a>
          </div>
        } @else if (s.title) {<h2 class="pt-section-title">{{ s.title }}</h2>}
        @if (s.strip) {
          <div class="pt-strip-row" tabindex="0" role="group" [attr.aria-label]="s.title ?? null">
            @for (it of s.items; track $index) {
              @if (it.off || !known(it.c)) {<div class="pt-island"><p class="pt-na">Data not available</p></div>}
              @else {<div ptSlot [c]="it.c" [p]="it.props" [a]="it.alert ?? null"></div>}
            }
          </div>
        } @else {
          @for (it of s.items; track $index) {
            @if (it.off || !known(it.c)) {<div class="pt-island"><p class="pt-na">Data not available</p></div>}
            @else {<div ptSlot [c]="it.c" [p]="it.props" [a]="it.alert ?? null"></div>}
          }
        }
      </section>
    }`,
})
export class PtPage {
  protected readonly model = inject(PT_PAGE);
  protected readonly known = (c: string) => Object.hasOwn(REGISTRY, c);

  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) inject(TransferState).set(PAGE_KEY, this.model);
    const appRef = inject(ApplicationRef);
    const env = inject(EnvironmentInjector);
    afterNextRender(() => {
      const doc = document;
      startBeacon(doc, this.model.api, sendBeacon);
      attachHeader(doc, { buildId: this.model.buildId });
      attachCompanyBar(doc); // company pages: the company in the header once its card has scrolled away
      attachShare(doc); // each placement's "Share": the placement as an image, and the link back
      // a page with alerts: each placement's bell opens the editor with its section's badge (a chunk of its own, loaded on the first press)
      if (this.model.alerts) doc.addEventListener('click', (e) => {
        const bell = (e.target as Element | null)?.closest?.('[data-alert]');
        if (bell) void import('./alerts/editor').then((m) => m.pressBell(bell, appRef, env));
      });
      const card = REGISTRY[CARD];
      const load = () => import('../../components/pt-company-card').then((m) => m.PtCompanyCard);
      const cards = card ? attachCards(doc, appRef, {
        id: `${CARD}@${card.version}`,
        hover: !!doc.defaultView?.matchMedia?.('(hover: hover) and (pointer: fine)').matches,
        load,
      }) : { active: () => false };
      if (card) attachCardSlots(doc, appRef, { id: `${CARD}@${card.version}`, load }); // where a component leaves room for the card (a calendar's event)
      // where a card opens on hover, a company link shows it instead of its text tooltip (the keyboard still gets the tooltip)
      const root = doc.querySelector<HTMLElement>('pt-page');
      if (root) attachTips(root, (t) => cards.active() && companyOf(t.closest(CARD_TARGET)) !== null);
    });
  }
}

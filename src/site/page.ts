import { afterNextRender, ApplicationRef, Component, inject, PLATFORM_ID, TransferState } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { sendBeacon, startBeacon } from './beacon';
import { attachCards, companyOf } from './cards';
import { attachHeader } from './header';
import { PAGE_KEY, PT_PAGE } from './model';
import { PtSlot, REGISTRY } from './registry.generated';
import { attachTips } from './tips';

const CARD = 'pt-company-card';

/**
 * The page app (one per page): the generator's sections — heading, "see all" link, placements. In the browser, once rendered:
 * the beacon, the tooltips, and the company card on hover over company links.
 */
@Component({
  selector: 'pt-page',
  imports: [PtSlot],
  template: `
    @for (s of model.sections; track s.id) {
      <section class="pt-section" [id]="s.id">
        @if (s.more; as more) {
          <div class="pt-section-head">
            @if (s.title) {<h2 class="pt-section-title">{{ s.title }}</h2>}
            <a class="pt-section-more" [href]="more.href" [attr.aria-label]="s.title ? more.label + ': ' + s.title : null">{{ more.label }} →</a>
          </div>
        } @else if (s.title) {<h2 class="pt-section-title">{{ s.title }}</h2>}
        @for (it of s.items; track $index) {
          @if (it.off || !known(it.c)) {<div class="pt-island"><p class="pt-na">Data not available</p></div>}
          @else {<div ptSlot [c]="it.c" [p]="it.props"></div>}
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
    afterNextRender(() => {
      const doc = document;
      startBeacon(doc, this.model.api, sendBeacon);
      attachHeader(doc, { buildId: this.model.buildId });
      const card = REGISTRY[CARD];
      const cards = card ? attachCards(doc, appRef, {
        id: `${CARD}@${card.version}`, subject: this.model.subject,
        hover: !!doc.defaultView?.matchMedia?.('(hover: hover) and (pointer: fine)').matches,
        load: () => import('../../components/pt-company-card').then((m) => m.PtCompanyCard),
      }) : { active: () => false };
      // where a card opens on hover, a company link shows it instead of its text tooltip (the keyboard still gets the tooltip)
      const root = doc.querySelector<HTMLElement>('pt-page');
      if (root) attachTips(root, (t) => cards.active() && companyOf(t.closest('a[href]')) !== null);
    });
  }
}

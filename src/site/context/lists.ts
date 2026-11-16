import { Component, computed, input } from '@angular/core';
import type { CtxCol, ListCtx, PeersCtx } from '@pretickt/components/context';
import { possessive } from '../../typologies/basket-words';

/** Where "back" goes: the list's page, or its section on the page the reader was on (`#list`), or that page. */
export const backTo = (href: string, from: string) => (!href ? from : href.startsWith('#') ? `${from}${href}` : href);

/** A list row's columns as the list printed them: "Today −5.1% · Off 52w high −22.0%", each figure in its tone. */
@Component({
  selector: 'pt-ctx-cols',
  host: { class: 'pt-ctx-cols' },
  template: `@for (c of cols(); track $index) {@if ($index) { · }{{ c.label }} <span [class]="c.tone ?? null">{{ c.text }}</span>}`,
})
export class PtCtxCols {
  readonly cols = input.required<CtxCol[]>();
}

/** A market list (pt-screen): the row's rank in the list as the page titled it, its columns, back to the list. */
@Component({
  selector: 'pt-ctx-list',
  imports: [PtCtxCols],
  template: `
    @let l = d();
    <p class="pt-ctx-lead">#{{ l.rank }} of {{ l.of }} in {{ l.title || 'the list' }}</p>
    <div class="pt-ctx-more">
      <p><pt-ctx-cols [cols]="l.cols" /></p>
      <p class="pt-ctx-go"><a [href]="back()">Back to the list →</a></p>
    </div>`,
})
export class PtCtxList {
  readonly d = input.required<ListCtx>();
  readonly from = input.required<string>();
  protected readonly back = computed(() => backTo(this.d().href, this.from()));
}

/** A company's peers (pt-screen peersOf): a peer of the company the reader was on, the row's columns, back to its peers. */
@Component({
  selector: 'pt-ctx-peers',
  imports: [PtCtxCols],
  template: `
    @let p = d();
    <p class="pt-ctx-lead">A peer of {{ p.of.name }}</p>
    <div class="pt-ctx-more">
      <p><pt-ctx-cols [cols]="p.cols" /></p>
      <p class="pt-ctx-go"><a [href]="back()">Back to {{ possessive(p.of.name) }} peers →</a></p>
    </div>`,
})
export class PtCtxPeers {
  readonly d = input.required<PeersCtx>();
  readonly from = input.required<string>();
  protected readonly possessive = possessive;
  protected readonly back = computed(() => backTo(this.d().href, this.from()));
}

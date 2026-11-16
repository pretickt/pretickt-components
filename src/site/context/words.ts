import { Component, computed, input } from '@angular/core';
import type { FollowingCtx, HolderCtx, MentionCtx } from '@pretickt/components/context';
import { isMention, named, type Mention } from '../../ds/format';
import { PtMention } from '../../ds/pt-mention';
import { possessive } from '../../typologies/basket-words';
import { backTo } from './lists';

/** A listed company in a value card (pt-value: holders, customers, competitors): its value as the card printed it, back to the card. */
@Component({
  selector: 'pt-ctx-holder',
  template: `
    @let h = d();
    <p class="pt-ctx-lead">{{ h.label }} in {{ possessive(h.of.name) }} “{{ h.question }}”</p>
    <div class="pt-ctx-more"><p class="pt-ctx-go"><a [href]="back()">Back to the card →</a></p></div>`,
})
export class PtCtxHolder {
  readonly d = input.required<HolderCtx>();
  readonly from = input.required<string>();
  protected readonly possessive = possessive;
  protected readonly back = computed(() => backTo(this.d().href, this.from()));
}

/** A company named in a sentence (PtSay): the sentence itself, this company in bold, the others as links. */
@Component({
  selector: 'pt-ctx-mention',
  imports: [PtMention],
  template: `<p class="pt-ctx-lead">@for (p of d().said; track $index) {@if (asMention(p); as m) {@if (m.ticker === to()) {<b>{{ named(m.name, m.ticker) }}</b>} @else {<a ptMention [ticker]="m.ticker" [name]="m.name"></a>}} @else {{{ p }}}}</p>`,
})
export class PtCtxMention {
  readonly d = input.required<MentionCtx>();
  readonly to = input.required<string>();
  protected readonly named = named;
  protected readonly asMention = (p: string | Mention): Mention | null => (isMention(p) ? p : null);
}

/** A company the reader follows (/alerts/): its alerts of the last 5 sessions as the list showed them, the reader's alerts. */
@Component({
  selector: 'pt-ctx-following',
  template: `
    @let f = d();
    <p class="pt-ctx-lead">You follow {{ f.name }} · {{ f.alerts ? f.alerts + (f.alerts === 1 ? ' alert' : ' alerts') : 'no alerts' }} in the last 5 sessions</p>
    <div class="pt-ctx-more"><p class="pt-ctx-go"><a href="/alerts/">Your alerts →</a></p></div>`,
})
export class PtCtxFollowing {
  readonly d = input.required<FollowingCtx>();
}

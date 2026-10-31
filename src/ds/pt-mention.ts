import { Component, computed, input } from '@angular/core';
import { isMention, plainName, stockHref, type Mention, type Said } from './format';
import { PtLogo } from './pt-logo';

/**
 * A company named in a sentence: a link to its page with its logo beside its common name and its ticker ("Nvidia NVDA"); the name
 * alone when it is the ticker in other letters ("Meta"). On the site its card opens when the pointer rests on it, on the company's own
 * page too (class `pt-mention`, cards.ts). Only the site's own logo files are drawn, and never initials: the sentence's text stays the
 * words. `<a ptMention ticker="NVDA" name="NVIDIA Corporation" logo="/logos/nvda-1.png"></a>`
 */
@Component({
  selector: 'a[ptMention]',
  imports: [PtLogo],
  host: { class: 'pt-mention', '[attr.href]': 'href()' },
  template: `@if (logoSrc(); as s) {<pt-logo [ticker]="ticker()" [src]="s" [size]="16" />}<span class="pt-mention-n">{{ label().name }}</span>@if (label().ticker; as t) {{{ ' ' }}<span class="pt-mention-t">{{ t }}</span>}`,
})
export class PtMention {
  readonly ticker = input.required<string>();
  readonly name = input<string | null>(null);
  readonly logo = input<string | null>(null);
  /** A section of the company's page to open at (`people-ask`): the card opens all the same. */
  readonly section = input<string | null>(null);
  protected readonly href = computed(() => { const s = this.section(); return `${stockHref(this.ticker())}${s ? `#${s}` : ''}`; });
  protected readonly logoSrc = computed(() => { const s = this.logo(); return s && /^\/logos\/[a-z0-9.-]{1,40}$/.test(s) ? s : null; });
  protected readonly label = computed(() => {
    const t = this.ticker(), n = plainName(this.name() || t);
    return n.toUpperCase() === t.toUpperCase() ? { name: n, ticker: null } : { name: n, ticker: t };
  });
}

/** A sentence in parts (`say`): its text as text, each company it names as a PtMention. `<pt-say [parts]="said" />` */
@Component({
  selector: 'pt-say',
  imports: [PtMention],
  host: { style: 'display: contents' },
  template: `@for (p of parts(); track $index) {@if (asMention(p); as m) {<a ptMention [ticker]="m.ticker" [name]="m.name" [logo]="m.logo"></a>} @else {{{ p }}}}`,
})
export class PtSay {
  readonly parts = input.required<Said>();
  protected readonly asMention = (p: string | Mention): Mention | null => (isMention(p) ? p : null);
}

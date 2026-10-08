import { Component, computed, input } from '@angular/core';
import { stockHref } from './format';
import { PtLogo } from './pt-logo';

/** A company as a link to its page: logo, ticker, name. On pages the runtime gives every such link its hover card. `<a ptCompany ticker="NVDA" …></a>` */
@Component({
  selector: 'a[ptCompany]',
  imports: [PtLogo],
  host: { class: 'pt-co', '[attr.href]': 'href()' },
  template: `<pt-logo [ticker]="ticker()" [src]="logo()" [size]="size()" /><span class="pt-co-t">{{ ticker() }}</span>@if (name()) {<span class="pt-co-n">{{ name() }}</span>}`,
})
export class PtCompany {
  readonly ticker = input.required<string>();
  readonly name = input<string | null>(null);
  readonly logo = input<string | null>(null);
  readonly size = input(20);
  protected readonly href = computed(() => stockHref(this.ticker()));
}

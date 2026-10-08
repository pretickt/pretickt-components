import { Component, computed, input } from '@angular/core';

/** A company logo: a fixed-size square image the site publishes (`/logos/<file>`, lazy); with no source, the initials (no request). */
@Component({
  selector: 'pt-logo',
  host: { style: 'display: contents' },
  template: `@if (site(); as s) {<img class="pt-logo" [src]="s" alt="" [attr.width]="size()" [attr.height]="size()" loading="lazy" decoding="async">}
    @else {<span class="pt-logo pt-logo-initials" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true">{{ initials() }}</span>}`,
})
export class PtLogo {
  readonly ticker = input.required<string>();
  readonly src = input<string | null>(null);
  readonly size = input(20);
  // only the site's own logo paths: anything else (an external URL from old data) draws the initials
  protected readonly site = computed(() => { const s = this.src(); return s && /^\/logos\/[a-z0-9.-]{1,40}$/.test(s) ? s : null; });
  protected readonly initials = computed(() => this.ticker().replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase());
}

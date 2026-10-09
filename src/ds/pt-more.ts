import { Component, ElementRef, inject, input, output } from '@angular/core';

/**
 * "Show 20 more", centered under a table: emits `more` on every press (a `pt-interact` "more"); the table decides what more means
 * (rows it already has, or a bigger call) and leaves the button out when there is nothing more.
 * `@if (hasMore()) {<pt-more (more)="more()" />}`
 */
/** How many rows a press adds. */
export const MORE_STEP = 20;

@Component({
  selector: 'pt-more',
  host: { class: 'pt-more' },
  template: `<button type="button" class="pt-more-btn" (click)="press()">Show {{ step() }} more</button>`,
})
export class PtMore {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly step = input(MORE_STEP);
  readonly more = output<void>();

  protected press() {
    this.more.emit();
    this.el.nativeElement.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'more' } }));
  }
}

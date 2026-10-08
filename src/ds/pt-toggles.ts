import { Component, ElementRef, inject, input, output } from '@angular/core';

/**
 * A button group switching one value: `[value, label]` options, the current one pressed. Emits `choose` on every press, the
 * pressed option included (after a request failed, pressing it again asks again); a change is a `pt-interact` "set".
 * `<div ptToggles [value]="win()" [options]="WINDOWS" aria-label="Window" (choose)="pick($event)"></div>` (the group's name is its own aria-label)
 */
@Component({
  selector: '[ptToggles]',
  host: { class: 'pt-toggles', role: 'group' },
  template: `@for (o of options(); track o[0]) {<button type="button" [attr.aria-pressed]="o[0] === value()" (click)="pick(o[0])">{{ o[1] }}</button>}`,
})
export class PtToggles<V extends string | number> {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly value = input.required<V>();
  readonly options = input.required<ReadonlyArray<readonly [V, string]>>();
  readonly choose = output<V>();

  protected pick(v: V) {
    const changed = v !== this.value();
    this.choose.emit(v);
    if (changed) this.el.nativeElement.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'set' } }));
  }
}

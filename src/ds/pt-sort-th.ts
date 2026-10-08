import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import type { SortState } from './sort';

/** A sortable column header (`<th ptSortTh [state]="…" (sort)="…">Name</th>`): the label as a button that emits `sort`; `state` shows the order (aria-sort on the sorted column only). */
@Component({
  selector: 'th[ptSortTh]',
  host: { '[attr.aria-sort]': 'state() ? aria() : null' },
  template: `<button type="button" class="pt-sort" (click)="press()"><ng-content /><span class="pt-sort-i" aria-hidden="true">{{ arrow() }}</span></button>`,
})
export class PtSortTh {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly state = input<SortState>(null);
  readonly sort = output<void>();
  protected readonly aria = computed(() => (this.state() === 'asc' ? 'ascending' : this.state() === 'desc' ? 'descending' : 'none'));
  protected readonly arrow = computed(() => (this.state() === 'asc' ? '↑' : this.state() === 'desc' ? '↓' : '↕'));
  protected press() {
    this.sort.emit();
    this.el.nativeElement.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'sort' } }));
  }
}

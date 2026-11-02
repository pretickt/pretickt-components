import { afterNextRender, Component, computed, type ElementRef, input, output, signal, viewChild } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import type { AlertRow } from '../../alerts/rows';
import { searchCompanies } from '../../alerts/search';

type Company = Pick<AlertRow, 'ticker' | 'name' | 'logo' | 'marketCap'>;
let uid = 0;

/**
 * A company by symbol or name, the alert editor's (Romeo, 2026-11-02: a portfolio's search, One stock's field): what is typed finds
 * up to six; ↓ and ↑ mark one (round the ends), Enter or a click takes it; Escape empties the field and, on an empty one, closes it
 * when asked to — otherwise that Escape goes on to the editor. The focus stays in the field (the options are its activedescendant).
 */
@Component({
  selector: 'pt-alert-find',
  imports: [PtLogo],
  template: `
    <input #box class="pt-al-find" type="search" role="combobox" aria-autocomplete="list" autocomplete="off"
      [attr.aria-expanded]="found().length > 0" [attr.aria-controls]="id" [attr.aria-activedescendant]="found().length ? id + '-' + marked() : null"
      [attr.aria-label]="label()" [placeholder]="placeholder()" [value]="query()" (input)="typed($event)" (keydown)="key($event)" />
    @if (found().length) {
      <div class="pt-al-found" role="listbox" [id]="id" [attr.aria-label]="label()">
        @for (r of found(); track r.ticker; let i = $index) {
          <div role="option" [id]="id + '-' + i" [attr.aria-selected]="i === marked()" [class.pt-al-found-on]="i === marked()"
            (pointerdown)="$event.preventDefault()" (pointerenter)="marked.set(i)" (click)="take(r)">
            <pt-logo [ticker]="r.ticker" [src]="r.logo" [size]="16" /><b>{{ r.ticker }}</b><span>{{ r.name }}</span>
          </div>
        }
      </div>
    }`,
})
export class PtAlertFind {
  readonly rows = input.required<readonly Company[]>();
  readonly exclude = input<readonly string[]>([]);
  readonly label = input('Add a company');
  readonly placeholder = input('Add a company: symbol or name');
  /** Escape on an empty field closes it (One stock's field) */
  readonly closeOnEscape = input(false);
  /** the focus in the field once it shows (One stock's: it takes the place of the pill just pressed) */
  readonly focus = input(false);
  readonly picked = output<string>();
  readonly cancel = output<void>();

  protected readonly id = `pt-al-find-${++uid}`;
  protected readonly query = signal('');
  protected readonly marked = signal(0);
  protected readonly found = computed(() => searchCompanies(this.rows(), this.query(), this.exclude()));
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  constructor() {
    afterNextRender(() => { if (this.focus()) this.box().nativeElement.focus(); });
  }

  protected typed(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.marked.set(0);
  }

  protected key(e: KeyboardEvent): void {
    const n = this.found().length;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n) {
      e.preventDefault();
      this.marked.set((this.marked() + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = this.found()[this.marked()];
      if (r) this.take(r);
    } else if (e.key === 'Escape' && (this.query() || this.closeOnEscape())) {
      e.stopPropagation();
      if (this.query()) { this.query.set(''); this.marked.set(0); }
      else this.cancel.emit();
    }
  }

  protected take(r: Company): void {
    this.picked.emit(r.ticker);
    this.query.set('');
    this.marked.set(0);
  }
}

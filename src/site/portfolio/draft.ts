import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { plainName, withoutSuffixes } from '@pretickt/components/format';
import type { FactsFile } from '@pretickt/components/typologies';
import { lookupOf, type PasteRow, type Unit } from './parse';
import type { StoredRow } from './store';

/**
 * The preview of a paste, editable before it is saved (Romeo, 2026-11-08: «anteprima anche modificabile con aggiunta e rimozione e autocomplete»,
 * «date editabili»): each line's symbol with suggestions by symbol or name, its amount, its purchase date, a line removed or added; what the amounts
 * are, chosen by the reader when the paste mixed kinds. Save gives exactly what it shows.
 */
export interface DraftSave { unit: Unit; rows: StoredRow[] }
interface Line { key: number; t: string; text: string; n: string; d: string }
const MATCHES = 8;
const UNITS: { k: Unit; label: string }[] = [{ k: 'shares', label: 'Shares' }, { k: 'usd', label: 'Dollars' }, { k: 'pct', label: 'Percent' }, { k: 'equal', label: 'No amounts' }];
const val = (e: Event) => (e.target as HTMLInputElement).value;
const amount = (s: string) => Number(s.replace(/[$,%\s]/g, ''));

/** The site's companies and funds for a query: symbols that start with it first, then names that hold it (the filed name or the everyday one). */
export function suggest(facts: FactsFile, query: string): { t: string; name: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = [...Object.values(facts.companies).map((c) => ({ t: c.ticker, name: withoutSuffixes(c.name), also: plainName(c.name).toLowerCase() })),
    ...Object.entries(facts.funds).map(([t, f]) => ({ t, name: f.name, also: '' }))].sort((a, b) => (a.t < b.t ? -1 : 1));
  const starts = all.filter((m) => m.t.toLowerCase().startsWith(q));
  return [...starts, ...all.filter((m) => !starts.includes(m) && (m.name.toLowerCase().includes(q) || m.also.includes(q)))].slice(0, MATCHES).map(({ t, name }) => ({ t, name }));
}

@Component({
  selector: 'pt-portfolio-draft',
  template: `
    <div class="pt-pf-draft">
      @if (kind() === 'portfolio') {
        <div class="pt-pf-units" role="group" aria-label="What the amounts are">
          @for (u of UNITS; track u.k) {<button type="button" class="pt-pf-unit" [class.pt-pf-unit-on]="chosen() === u.k" [attr.aria-pressed]="chosen() === u.k" (click)="chosen.set(u.k)">{{ u.label }}</button>}
        </div>
        @if (chosen() === null) {<p class="pt-pf-err">Choose what the amounts are: the paste mixed kinds.</p>}
      }
      <div class="pt-pf-drows">
        @for (l of lines(); track l.key) {
          @let e = errors().get(l.key);
          <div class="pt-pf-dr">
            <div class="pt-pf-dsym">
              <input class="pt-pf-input pt-pf-sym" [value]="l.text" aria-label="Symbol or company" autocomplete="off" spellcheck="false"
                (input)="typed(l.key, val($event))" (focus)="active.set(l.key)" (blur)="left(l.key)" (keydown.enter)="first(l.key, $event)" />
              <span class="pt-pf-co">{{ nameOf(l.t) }}</span>
              @if (active() === l.key && suggestions().length) {
                <ul class="pt-pf-sugg">@for (s of suggestions(); track s.t) {<li><button type="button" (mousedown)="$event.preventDefault()" (click)="pick(l.key, s.t)">{{ s.t }} · {{ s.name }}</button></li>}</ul>
              }
            </div>
            @if (amounts()) {<input class="pt-pf-input pt-pf-n" inputmode="decimal" [value]="l.n" [placeholder]="unitWord()" [attr.aria-label]="unitWord()" (input)="set(l.key, 'n', val($event))" />}
            @if (dates()) {<input class="pt-pf-input pt-pf-d" type="date" [max]="today()" [value]="l.d" aria-label="Purchase date (optional)" (input)="set(l.key, 'd', val($event))" />}
            <button type="button" class="pt-pf-rm" [attr.aria-label]="'Remove ' + (l.text || 'this line')" (click)="remove(l.key)">×</button>
            @if (e) {<span class="pt-pf-err pt-pf-lerr">{{ e }}</span>}
          </div>
        }
      </div>
      <div class="pt-pf-acts"><button type="button" (click)="add()">Add a line</button><button type="button" class="pt-pf-go" [disabled]="!ready()" (click)="done()">Save</button></div>
    </div>`,
})
export class PtPortfolioDraft {
  readonly rows = input.required<readonly PasteRow[]>();
  /** What the paste's amounts were; null when it mixed kinds and the reader chooses. */
  readonly unit = input.required<Unit | null>();
  readonly kind = input.required<'portfolio' | 'watchlist'>();
  readonly facts = input.required<FactsFile>();
  readonly today = input.required<string>();
  readonly save = output<DraftSave>();

  private next = 0;
  private readonly line = (t: string, n: number | null, d: string | null): Line => ({ key: this.next++, t, text: t, n: n == null ? '' : String(n), d: d ?? '' });
  protected readonly lines = linkedSignal(() => this.rows().map((r) => this.line(r.t, r.n, r.d)));
  protected readonly chosen = linkedSignal<Unit | null>(() => (this.kind() === 'watchlist' ? 'equal' : this.unit()));
  /** The line whose symbol is being typed: its suggestions show under it. */
  protected readonly active = signal<number | null>(null);
  private readonly look = computed(() => lookupOf(this.facts()));
  protected readonly amounts = computed(() => this.kind() === 'portfolio' && this.chosen() !== null && this.chosen() !== 'equal');
  protected readonly dates = computed(() => this.kind() === 'portfolio');
  protected readonly unitWord = computed(() => ({ shares: 'Shares', usd: 'Dollars', pct: 'Percent', equal: '' })[this.chosen() ?? 'equal']);
  protected readonly suggestions = computed(() => {
    const l = this.lines().find((x) => x.key === this.active());
    return !l || (l.t && l.text.toUpperCase() === l.t) ? [] : suggest(this.facts(), l.text);
  });
  /** Each line's problem, said on it: no symbol, no amount where amounts are given, a date after today. */
  protected readonly errors = computed(() => new Map(this.lines().map((l) => [l.key,
    !l.t ? 'Give a symbol or pick a company' : this.amounts() && !(amount(l.n) > 0) ? 'Give an amount' : this.dates() && l.d && l.d > this.today() ? 'After today' : null])));
  protected readonly ready = computed(() => this.chosen() !== null && this.lines().length > 0 && [...this.errors().values()].every((e) => e == null));

  protected readonly UNITS = UNITS;
  protected readonly val = val;
  protected readonly nameOf = (t: string) => { const f = this.facts(); return !t ? '' : f.companies[t] ? plainName(f.companies[t]!.name) : f.funds[t]?.name ?? 'not on pretickt'; };

  protected typed(key: number, text: string) {
    this.active.set(key);
    this.lines.update((ls) => ls.map((l) => (l.key === key ? { ...l, text, t: this.look().symbol(text) ?? '' } : l)));
  }
  protected pick(key: number, t: string) {
    this.lines.update((ls) => ls.map((l) => (l.key === key ? { ...l, t, text: t } : l)));
    this.active.set(null);
  }
  /** Enter takes the first suggestion. */
  protected first(key: number, e: Event) {
    const s = this.suggestions()[0];
    if (!s) return;
    e.preventDefault();
    this.pick(key, s.t);
  }
  /** Leaving a symbol nobody picked: a symbol-like text stays, as a symbol not on pretickt. */
  protected left(key: number) {
    this.lines.update((ls) => ls.map((l) => (l.key === key && !l.t && /^\$?[A-Za-z][A-Za-z0-9./-]{0,9}$/.test(l.text.trim()) ? { ...l, t: l.text.trim().replace(/^\$/, '').toUpperCase() } : l)));
    if (this.active() === key) this.active.set(null);
  }
  protected set(key: number, field: 'n' | 'd', v: string) { this.lines.update((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: v } : l))); }
  protected remove(key: number) { this.lines.update((ls) => ls.filter((l) => l.key !== key)); }
  protected add() { const l = this.line('', null, null); this.lines.update((ls) => [...ls, l]); this.active.set(l.key); }
  protected done() {
    const unit = this.chosen();
    if (!this.ready() || unit === null) return;
    this.save.emit({ unit, rows: this.lines().map((l) => ({ t: l.t, n: this.amounts() ? amount(l.n) : null, d: this.dates() && l.d ? l.d : null })) });
  }
}

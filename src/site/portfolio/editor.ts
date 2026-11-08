import { Component, computed, input, output, signal } from '@angular/core';
import { date, plainName, withoutSuffixes } from '@pretickt/components/format';
import type { FactsFile } from '@pretickt/components/typologies';
import { parsePaste, serialize, type Parsed } from './parse';
import { withPortfolio, type Stored, type StoredPortfolio } from './store';

/**
 * The reader's portfolios and watchlists (design 2026-11-07 Part B, amended 2026-11-08: «possibilità di crearne altri per monitoraggio, dicendolo
 * esplicitamente»): a switcher, "New portfolio" and "New watchlist" (the kind is chosen there, never guessed), a paste read into a preview before it is
 * saved, a line added by hand with its amount and purchase date, rename, copy as text, delete after a confirm in the page. A part of the page app, not
 * a placeable component; it emits every change and the page keeps it in this browser.
 */
type Kind = StoredPortfolio['kind'];
interface Form { kind: Kind; name: string; text: string; id: string | null }
const MATCHES = 8;
const newId = () => `pf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const val = (e: Event) => (e.target as HTMLInputElement).value;

@Component({
  selector: 'pt-portfolio-editor',
  template: `
    <section class="pt-pf-ed">
      <div class="pt-pf-tabs">
        @for (p of stored().list; track p.id) {
          <button type="button" class="pt-pf-tab" [class.pt-pf-tab-on]="p.id === active()?.id" [attr.aria-pressed]="p.id === active()?.id" (click)="choose(p.id)">
            {{ p.name }} <span class="pt-pf-kind">{{ p.kind === 'watchlist' ? 'Watchlist' : 'Portfolio' }}</span></button>
        }
        <button type="button" class="pt-pf-new" (click)="start('portfolio')">New portfolio</button>
        <button type="button" class="pt-pf-new" (click)="start('watchlist')">New watchlist</button>
      </div>

      @if (form(); as fm) {
        <div class="pt-pf-form">
          <label class="pt-pf-label">Name <input class="pt-pf-input pt-pf-title" [value]="fm.name" (input)="form.set({ ...fm, name: val($event) })" /></label>
          <label class="pt-pf-label">
            {{ fm.kind === 'watchlist' ? 'Symbols, one a line' : 'Your holdings, one a line — AAPL 10, AAPL 25% or AAPL $5,000, and a purchase date if you like (AAPL 10 2025-03-14) — or a broker\\'s CSV export' }}
            <textarea class="pt-pf-paste" rows="8" [value]="fm.text" (input)="form.set({ ...fm, text: val($event) }); parsed.set(null)"></textarea>
          </label>
          <div class="pt-pf-acts"><button type="button" (click)="read()">Read</button><button type="button" (click)="cancel()">Cancel</button></div>
          @if (parsed(); as r) {
            @if (r.refused) {<p class="pt-pf-err" role="alert">{{ r.refused }}</p>}
            @else {
              @if (r.rows.length) {
                <div class="pt-table-wrap">
                  <table class="pt-table pt-pf-preview">
                    <thead><tr><th>Symbol</th><th>Company</th><th class="pt-num">Amount</th><th class="pt-num">Bought</th></tr></thead>
                    <tbody>@for (row of r.rows; track $index) {<tr><td>{{ row.t }}</td><td>{{ nameOf(row.t) }}</td><td class="pt-num">{{ amount(row.n, r.unit) }}</td><td class="pt-num">{{ row.d ? date(row.d) : '' }}</td></tr>}</tbody>
                  </table>
                </div>
              } @else {<p class="pt-note">No symbol on pretickt in this text.</p>}
              @if (r.notOnSite.length) {<p class="pt-note">Not on pretickt, left out: {{ r.notOnSite.join(', ') }}.</p>}
              @if (r.dropped) {<p class="pt-note">A watchlist keeps the symbols: amounts and dates are not kept.</p>}
              @if (r.rows.length) {<div class="pt-pf-acts"><button type="button" class="pt-pf-go" (click)="save(r)">Save</button></div>}
            }
          }
        </div>
      }
      @if (error(); as e) {<p class="pt-pf-err" role="alert">{{ e }}</p>}

      @if (active(); as p) {
        @if (!form()) {
          <div class="pt-pf-acts">
            <button type="button" (click)="edit(p)">Edit lines</button>
            <button type="button" (click)="renaming.set(p.name)">Rename</button>
            <button type="button" (click)="copy(p)">Copy as text</button>
            <button type="button" (click)="confirming.set(true)">Delete</button>
          </div>
          @if (renaming() !== null) {
            <div class="pt-pf-acts">
              <input class="pt-pf-input pt-pf-name" [value]="renaming()" (input)="renaming.set(val($event))" aria-label="New name" />
              <button type="button" class="pt-pf-go" (click)="rename(p)">Save name</button><button type="button" (click)="renaming.set(null)">Cancel</button>
            </div>
          }
          @if (confirming()) {
            <p class="pt-pf-ask">Delete “{{ p.name }}”? This cannot be undone.
              <button type="button" class="pt-pf-del" (click)="remove(p)">Yes, delete</button><button type="button" (click)="confirming.set(false)">Keep it</button></p>
          }
          @if (copied() !== null) {
            <textarea class="pt-pf-paste pt-pf-copy" rows="6" readonly [value]="copied()" aria-label="This portfolio as text"></textarea>
            <p class="pt-note">{{ clip() ? 'Copied to the clipboard.' : 'Select the text above to copy it: pasted on another device, it reads back the same.' }}</p>
          }
          <div class="pt-pf-add">
            <input class="pt-pf-input pt-pf-find" placeholder="Add a company or fund: symbol or name" [value]="query()" (input)="query.set(val($event)); picked.set(null)" aria-label="Add a company or fund" />
            @if (matches().length && !picked()) {
              <ul class="pt-pf-matches">@for (m of matches(); track m.t) {<li><button type="button" (click)="picked.set(m.t)">{{ m.t }} · {{ m.name }}</button></li>}</ul>
            }
            @if (picked(); as t) {
              <div class="pt-pf-acts">
                <span class="pt-pf-picked">{{ t }}</span>
                @if (p.kind === 'portfolio' && p.unit !== 'equal') {<input class="pt-pf-input pt-pf-amount" inputmode="decimal" [placeholder]="unitWord(p.unit)" [attr.aria-label]="unitWord(p.unit)" (input)="amountIn.set(val($event))" />}
                @if (p.kind === 'portfolio') {<input class="pt-pf-input pt-pf-date" type="date" [max]="today()" aria-label="Purchase date (optional)" (input)="dateIn.set(val($event))" />}
                <button type="button" class="pt-pf-go" (click)="add(p, t)">Add</button>
              </div>
            }
          </div>
        }
      }
      <p class="pt-note">{{ saving() ? 'Saved only in this browser. Clearing the site\\'s data removes it.' : 'This browser does not keep data: nothing is saved after this visit.' }}</p>
    </section>`,
})
export class PtPortfolioEditor {
  readonly stored = input.required<Stored>();
  readonly facts = input.required<FactsFile>();
  readonly saving = input(true);
  /** The reader's date: a purchase date after it is refused. */
  readonly today = input.required<string>();
  readonly changed = output<Stored>();

  protected readonly form = signal<Form | null>(null);
  protected readonly parsed = signal<Parsed | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly renaming = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly copied = signal<string | null>(null);
  protected readonly clip = signal(false);
  protected readonly query = signal('');
  protected readonly picked = signal<string | null>(null);
  protected readonly amountIn = signal('');
  protected readonly dateIn = signal('');

  protected readonly active = computed(() => { const s = this.stored(); return s.list.find((p) => p.id === s.active) ?? s.list[0] ?? null; });
  /** The site's companies and funds by symbol or name: symbols that start with the query first, then names that hold it. */
  protected readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase(), f = this.facts();
    if (!q) return [];
    // the name as the company files it (Advanced Micro Devices), found by it or by its everyday name (AMD)
    const all = [...Object.values(f.companies).map((c) => ({ t: c.ticker, name: withoutSuffixes(c.name), also: plainName(c.name).toLowerCase() })), ...Object.entries(f.funds).map(([t, x]) => ({ t, name: x.name, also: '' }))]
      .sort((a, b) => (a.t < b.t ? -1 : 1));
    return [...all.filter((m) => m.t.toLowerCase().startsWith(q)), ...all.filter((m) => !m.t.toLowerCase().startsWith(q) && (m.name.toLowerCase().includes(q) || m.also.includes(q)))].slice(0, MATCHES);
  });

  protected readonly date = date;
  protected readonly val = val;
  protected readonly nameOf = (t: string) => { const f = this.facts(); return f.companies[t] ? plainName(f.companies[t]!.name) : f.funds[t]?.name ?? t; };
  protected readonly amount = (n: number | null, unit: string) => (n == null ? '' : unit === 'pct' ? `${n}%` : unit === 'usd' ? `$${n.toLocaleString('en-US')}` : String(n));
  protected readonly unitWord = (u: string) => ({ shares: 'Shares', usd: 'Dollars', pct: 'Percent' } as Record<string, string>)[u] ?? '';
  private readonly known = (s: string) => { const t = s.toUpperCase().replace(/[/-]/g, '.'), f = this.facts(); return f.companies[t] || f.funds[t] ? t : null; };

  protected choose(id: string) { this.reset(); this.changed.emit({ ...this.stored(), active: id }); }
  protected start(kind: Kind) {
    this.reset();
    const n = this.stored().list.filter((p) => p.kind === kind).length + 1;
    this.form.set({ kind, name: `${kind === 'watchlist' ? 'Watchlist' : 'Portfolio'} ${n}`, text: '', id: null });
  }
  protected edit(p: StoredPortfolio) { this.reset(); this.form.set({ kind: p.kind, name: p.name, text: serialize(p.rows, p.unit), id: p.id }); }
  protected cancel() { this.reset(); }
  protected read() { const fm = this.form(); if (fm) this.parsed.set(parsePaste(fm.text, this.known, this.today(), fm.kind)); }
  protected save(r: Parsed) {
    const fm = this.form();
    if (!fm || r.refused || !r.rows.length) return;
    this.apply(withPortfolio(this.stored(), { id: fm.id ?? newId(), name: fm.name.trim() || 'Portfolio', kind: fm.kind, unit: r.unit, rows: r.rows.map(({ t, n, d }) => ({ t, n, d })) }));
  }
  protected rename(p: StoredPortfolio) { const name = (this.renaming() ?? '').trim(); if (name) this.apply(withPortfolio(this.stored(), { ...p, name })); }
  protected copy(p: StoredPortfolio) {
    const text = serialize(p.rows, p.unit);
    this.copied.set(text);
    this.clip.set(false);
    void globalThis.navigator?.clipboard?.writeText(text).then(() => this.clip.set(true), () => undefined);
  }
  protected remove(p: StoredPortfolio) {
    const list = this.stored().list.filter((x) => x.id !== p.id);
    this.reset();
    this.changed.emit({ v: 1, active: list[0]?.id ?? null, list });
  }
  protected add(p: StoredPortfolio, t: string) {
    const n = p.kind === 'portfolio' && p.unit !== 'equal' ? Number(this.amountIn()) : null;
    if (n !== null && !(n > 0)) { this.error.set(`Give an amount: ${this.unitWord(p.unit).toLowerCase()}.`); return; }
    const d = p.kind === 'portfolio' && /^\d{4}-\d{2}-\d{2}$/.test(this.dateIn()) ? this.dateIn() : null;
    if (d && d > this.today()) { this.error.set(`The date ${d} is after today.`); return; }
    this.apply(withPortfolio(this.stored(), { ...p, rows: [...p.rows, { t, n, d }] }));
  }

  private apply(next: Stored | string) {
    if (typeof next === 'string') { this.error.set(next); return; }
    this.reset();
    this.changed.emit(next);
  }
  private reset() {
    this.form.set(null); this.parsed.set(null); this.error.set(null); this.renaming.set(null); this.confirming.set(false); this.copied.set(null);
    this.query.set(''); this.picked.set(null); this.amountIn.set(''); this.dateIn.set('');
  }
}

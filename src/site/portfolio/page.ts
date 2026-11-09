import { afterNextRender, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { date, dayMonth, href, level, money, num, pct, plainName, stockHref, tone } from '@pretickt/components/format';
import { Pt } from '@pretickt/components/context';
import type { ClosesFile, FactsFile } from '@pretickt/components/typologies';
import { PtBasket } from '../../../components/pt-basket';
import { closesNeeded, computePortfolio, yearLine } from './compute';
import { PtPortfolioEditor } from './editor';
import { PT_PORTFOLIO_FILES, PT_PORTFOLIO_STORAGE } from './files';
import { PortfolioLogos } from './logos';
import { loadPortfolios, PORTFOLIO_KEY, savePortfolios, type Stored, type StoredPortfolio } from './store';
import { PtPortfolioLine } from './value-line';

/**
 * The portfolio page (design 2026-11-07 Part B, amended 2026-11-08): the reader's portfolios and watchlists, kept in this browser, and what the site
 * says of each — the funds' and sectors' sections computed on the page from the nightly's files. With nothing saved, an example. A part of the page
 * app, mounted on /portfolio/ from a chunk of its own; it counts how many portfolios a browser keeps, in words, never a symbol.
 */
const BEACON = 'pt-portfolio@1.0.0';
const EXAMPLE: StoredPortfolio = { id: 'example', name: 'Example', kind: 'watchlist', unit: 'equal', rows: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'].map((t) => ({ t, n: null, d: null })) };
/** The reader's own date (a purchase date after it is refused): the local day, not the UTC one an evening in New York is already past. */
export const localToday = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const holds = (n: number) => (n === 0 ? 'holds-none' : n === 1 ? 'holds-one' : n <= 3 ? 'holds-few' : 'holds-many');

@Component({
  selector: 'pt-portfolio-page',
  imports: [PtBasket, PtPortfolioEditor, PtPortfolioLine],
  // pt-basket's context (a placement gets it from its slot): with a payload it asks nothing; the logos' cut-outs, shared with the preview of a paste
  providers: [Pt, PortfolioLogos],
  // the site's hover cards listen on the document and ask the API for the ticker they show: here a hover stays inside, so no request names a holding
  host: { 'data-beacon': BEACON, '(pointerover)': '$event.stopPropagation()', '(pointerout)': '$event.stopPropagation()' },
  template: `
    @let f = facts();
    @if (f === undefined) {<p class="pt-note pt-busy">Loading the companies…</p>}
    @else if (f === null) {<p class="pt-na">Data not available</p>}
    @else {
      <div class="pt-pf">
        <pt-portfolio-editor [stored]="stored()" [facts]="f" [saving]="saving()" [today]="today" (changed)="keep($event)" />
        @if (unread) {<p class="pt-note">What this browser had saved could not be read: it is kept aside, and the page starts empty.</p>}
        @if (example()) {<p class="pt-note">An example: five large companies, weighted equally. Make your own with New portfolio or New watchlist.</p>}
        @if (basket(); as b) {
          <dl class="pt-pf-sum">
            @if (b.value != null) {<div><dt>{{ b.unit === 'usd' ? 'Value you entered' : 'Value at the last close' }}</dt><dd>{{ money(b.value) }}</dd></div>}
            @if (b.ret != null) {<div><dt>Last session</dt><dd [class]="'pt-t-' + tone(b.ret)">{{ pct(b.ret) }}</dd></div>}
            @if (b.since; as s) {<div><dt>Since {{ date(s.from) }}</dt><dd [class]="'pt-t-' + tone(s.ret)">{{ pct(s.ret) }}</dd></div>}
            @if (b.target; as t) {<div><dt>Analysts' target · on {{ level(t.share, 0) }}</dt><dd [class]="'pt-t-' + tone(t.upside)">{{ pct(t.upside) }}</dd></div>}
            @if (b.consensus; as c) {<div><dt>Consensus · on {{ level(c.share, 0) }}</dt><dd>{{ c.label }}</dd></div>}
            @if (b.pe; as p) {<div><dt>P/E · on {{ level(p.share, 0) }}</dt><dd>{{ num(p.value, 1) }}x</dd></div>}
            @if (b.earnings[0]; as e) {<div><dt>Next earnings</dt><dd>{{ plainName(e.name) }} {{ dayMonth(e.date) }}</dd></div>}
            <div><dt>Covered</dt><dd>{{ unpriced(b) ? 'not known' : level(b.coverage, 0) }}</dd></div>
          </dl>
          <h2 class="pt-pf-h">Why it moved</h2><pt-basket [payload]="b" section="moves" />
          <h2 class="pt-pf-h">{{ b.kind === 'watchlist' ? 'Companies' : 'Holdings' }}</h2><pt-basket [payload]="b" section="holdings" />
          <h2 class="pt-pf-h">Analyst price target and consensus</h2><pt-basket [payload]="b" section="analysts" />
          <h2 class="pt-pf-h">{{ b.kind === 'watchlist' ? 'What the questions say about these companies' : 'What the questions say about your holdings' }}</h2>
          <pt-basket [payload]="b" section="questions" />
          <p class="pt-note">Not investment advice: these figures add up what analysts and the questions say about each company.</p>
          <h2 class="pt-pf-h">The year</h2>
          <div class="pt-pf-linebox" #lineBox>@if (line(); as l) {<pt-portfolio-line [line]="l" />} @else if (failed().has('1y')) {<p class="pt-note">The year is not available right now.</p>} @else {<p class="pt-note pt-busy">Loading the year…</p>}</div>
          @if (b.earnings.length) {
            <h2 class="pt-pf-h">Earnings ahead</h2>
            <ul class="pt-pf-list">@for (e of b.earnings; track e.ticker) {<li><a [href]="stock(e.ticker)">{{ plainName(e.name) }}</a> <span class="pt-meta">{{ dayMonth(e.date) }}</span></li>}</ul>
          }
          @if (b.headlines.length) {
            <h2 class="pt-pf-h">{{ b.kind === 'watchlist' ? 'News of these companies' : 'News of the largest holdings' }}</h2>
            <ul class="pt-pf-list">@for (n of b.headlines; track n.ticker) {<li><a [href]="stock(n.ticker)">{{ plainName(n.name) }}</a> · <a class="pt-meta" [href]="href(n.url)" target="_blank" rel="nofollow noopener noreferrer">{{ n.title }}</a></li>}</ul>
          }
        }
      </div>
    }`,
})
export class PtPortfolioPage {
  private readonly files = inject(PT_PORTFOLIO_FILES);
  private readonly storage = inject(PT_PORTFOLIO_STORAGE);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly start = loadPortfolios(this.storage);

  protected readonly today = localToday();
  /** A value this browser held that could not be read: kept aside, and said. */
  protected readonly unread = this.start.unread;
  /** The files that did not come: the page says so instead of waiting for them. */
  protected readonly failed = signal<ReadonlySet<string>>(new Set());
  protected readonly facts = signal<FactsFile | null | undefined>(undefined);
  protected readonly stored = signal<Stored>(this.start.stored);
  protected readonly saving = signal(this.start.saving);
  private readonly closes = signal<ReadonlyMap<string, ClosesFile>>(new Map());
  private readonly asked = new Set<string>();
  /** The lines' logos, cut out of the one sheet every reader loads (a company's own logo file would name it). */
  private readonly logos = inject(PortfolioLogos);
  private readonly needLine = signal(false);
  private readonly lineBox = viewChild<ElementRef<HTMLElement>>('lineBox');

  protected readonly current = computed(() => { const s = this.stored(); return s.list.find((p) => p.id === s.active) ?? s.list[0] ?? EXAMPLE; });
  protected readonly example = computed(() => this.current() === EXAMPLE);
  protected readonly basket = computed(() => { const f = this.facts(); return f ? computePortfolio(this.current(), f, this.closes(), this.logos.map()) : null; });
  protected readonly line = computed(() => { const f = this.facts(), one = this.closes().get('1y'); return f && one ? yearLine(this.current(), f, one) : null; });

  constructor() {
    void this.files.facts().then((f) => this.facts.set(f));
    // the logos of the lines on the sheet, each cut once
    effect(() => this.logos.want(this.facts()?.sprite, this.current().rows.map((r) => r.t)));
    // the year's file when the line comes into view, or at once for purchase dates; then the calendar years older dates need
    effect(() => {
      const p = this.current(), f = this.facts();
      if (!f || !(this.needLine() || p.rows.some((r) => r.d))) return;
      this.ensure(['1y']);
      const one = this.closes().get('1y');
      if (one) this.ensure(closesNeeded(p, one.from));
    });
    effect((clean) => {
      const box = this.lineBox()?.nativeElement;
      if (!box || this.needLine()) return;
      if (typeof IntersectionObserver === 'undefined') { this.needLine.set(true); return; }
      const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { this.needLine.set(true); io.disconnect(); } }, { rootMargin: '200px' });
      io.observe(box);
      clean(() => io.disconnect());
    });
    afterNextRender(() => this.host.nativeElement.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: holds(this.start.stored.list.length) } })));
    // another tab saved: this one shows it, so its next save does not wipe the other's
    const other = (e: StorageEvent) => { if (e.key === PORTFOLIO_KEY || e.key === null) this.stored.set(loadPortfolios(this.storage).stored); };
    // an effect that reads no signal runs once; its cleanup runs when the page goes (DestroyRef would cost the main bundle an export)
    effect((clean) => { globalThis.addEventListener?.('storage', other); clean(() => globalThis.removeEventListener?.('storage', other)); });
  }

  protected keep(next: Stored) {
    this.stored.set(next);
    if (this.saving() && !savePortfolios(this.storage, next)) this.saving.set(false);
  }
  private ensure(keys: readonly string[]) {
    for (const k of keys) {
      if (this.asked.has(k)) continue;
      this.asked.add(k);
      void this.files.closes(k).then((c) => {
        if (c) this.closes.set(new Map([...this.closes(), [k, c]]));
        else this.failed.set(new Set([...this.failed(), k]));
      });
    }
  }

  protected readonly date = date;
  protected readonly dayMonth = dayMonth;
  protected readonly href = href;
  protected readonly level = level;
  protected readonly money = money;
  protected readonly num = num;
  protected readonly pct = pct;
  protected readonly plainName = plainName;
  protected readonly stock = stockHref;
  protected readonly tone = tone;
  /** A holding in shares we cannot price: the share we cover is not known. */
  protected readonly unpriced = (b: { uncovered: { weight: number | null }[] }) => b.uncovered.some((u) => u.weight == null);
}

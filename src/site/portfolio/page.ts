import { afterNextRender, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { date, dayMonth, href, level, money, num, pct, plainName, stockHref, tone } from '@pretickt/components/format';
import { Pt } from '@pretickt/components/context';
import type { ClosesFile, FactsFile } from '@pretickt/components/typologies';
import { PtBasket } from '../../../components/pt-basket';
import { closesNeeded, computePortfolio, yearLine } from './compute';
import { PtPortfolioEditor } from './editor';
import { PT_PORTFOLIO_FILES, PT_PORTFOLIO_STORAGE } from './files';
import { loadPortfolios, savePortfolios, type Stored, type StoredPortfolio } from './store';
import { PtPortfolioLine } from './value-line';

/**
 * The portfolio page (design 2026-11-07 Part B, amended 2026-11-08): the reader's portfolios and watchlists, kept in this browser, and what the site
 * says of each — the funds' and sectors' sections computed on the page from the nightly's files. With nothing saved, an example. A part of the page
 * app, mounted on /portfolio/ from a chunk of its own; it counts how many portfolios a browser keeps, in words, never a symbol.
 */
const BEACON = 'pt-portfolio@1.0.0';
const EXAMPLE: StoredPortfolio = { id: 'example', name: 'Example', kind: 'watchlist', unit: 'equal', rows: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'].map((t) => ({ t, n: null, d: null })) };
const holds = (n: number) => (n === 0 ? 'holds-none' : n === 1 ? 'holds-one' : n <= 3 ? 'holds-few' : 'holds-many');

@Component({
  selector: 'pt-portfolio-page',
  imports: [PtBasket, PtPortfolioEditor, PtPortfolioLine],
  // pt-basket's context (a placement gets it from its slot): with a payload it asks nothing
  providers: [Pt],
  // the site's hover cards listen on the document and ask the API for the ticker they show: here a hover stays inside, so no request names a holding
  host: { 'data-beacon': BEACON, '(pointerover)': '$event.stopPropagation()', '(pointerout)': '$event.stopPropagation()' },
  template: `
    @let f = facts();
    @if (f === undefined) {<p class="pt-note pt-busy">Loading the companies…</p>}
    @else if (f === null) {<p class="pt-na">Data not available</p>}
    @else {
      <div class="pt-pf">
        <pt-portfolio-editor [stored]="stored()" [facts]="f" [saving]="saving()" [today]="today" (changed)="keep($event)" />
        @if (example()) {<p class="pt-note">An example: five large companies, weighted equally. Make your own with New portfolio or New watchlist.</p>}
        @if (basket(); as b) {
          <dl class="pt-pf-sum">
            @if (b.value != null) {<div><dt>Value at the last close</dt><dd>{{ money(b.value) }}</dd></div>}
            @if (b.ret != null) {<div><dt>Last session</dt><dd [class]="'pt-t-' + tone(b.ret)">{{ pct(b.ret) }}</dd></div>}
            @if (b.since; as s) {<div><dt>Since {{ date(s.from) }}</dt><dd [class]="'pt-t-' + tone(s.ret)">{{ pct(s.ret) }}</dd></div>}
            @if (b.target; as t) {<div><dt>Analysts' target · on {{ level(t.share, 0) }}</dt><dd [class]="'pt-t-' + tone(t.upside)">{{ pct(t.upside) }}</dd></div>}
            @if (b.consensus; as c) {<div><dt>Consensus · on {{ level(c.share, 0) }}</dt><dd>{{ c.label }}</dd></div>}
            @if (b.pe; as p) {<div><dt>P/E · on {{ level(p.share, 0) }}</dt><dd>{{ num(p.value, 1) }}x</dd></div>}
            @if (b.earnings[0]; as e) {<div><dt>Next earnings</dt><dd>{{ plainName(e.name) }} {{ dayMonth(e.date) }}</dd></div>}
            <div><dt>Covered</dt><dd>{{ unpriced(b) ? 'not known' : level(b.coverage, 0) }}</dd></div>
          </dl>
          <h2 class="pt-pf-h">Why it moved</h2><pt-basket [payload]="b" section="moves" />
          <h2 class="pt-pf-h">Holdings</h2><pt-basket [payload]="b" section="holdings" />
          <h2 class="pt-pf-h">Analyst price target and consensus</h2><pt-basket [payload]="b" section="analysts" />
          <h2 class="pt-pf-h">{{ b.kind === 'watchlist' ? 'What the questions say about these companies' : 'What the questions say about your holdings' }}</h2>
          <pt-basket [payload]="b" section="questions" />
          <p class="pt-note">Not investment advice: these figures add up what analysts and the questions say about each company.</p>
          <h2 class="pt-pf-h">The year</h2>
          <div class="pt-pf-linebox" #lineBox>@if (line(); as l) {<pt-portfolio-line [line]="l" />} @else {<p class="pt-note pt-busy">Loading the year…</p>}</div>
          @if (b.earnings.length) {
            <h2 class="pt-pf-h">Earnings ahead</h2>
            <ul class="pt-pf-list">@for (e of b.earnings; track e.ticker) {<li><a [href]="stock(e.ticker)">{{ plainName(e.name) }}</a> <span class="pt-meta">{{ dayMonth(e.date) }}</span></li>}</ul>
          }
          @if (b.headlines.length) {
            <h2 class="pt-pf-h">News of the largest holdings</h2>
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

  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly facts = signal<FactsFile | null | undefined>(undefined);
  protected readonly stored = signal<Stored>(this.start.stored);
  protected readonly saving = signal(this.start.saving);
  private readonly closes = signal<ReadonlyMap<string, ClosesFile>>(new Map());
  private readonly asked = new Set<string>();
  private readonly needLine = signal(false);
  private readonly lineBox = viewChild<ElementRef<HTMLElement>>('lineBox');

  protected readonly current = computed(() => { const s = this.stored(); return s.list.find((p) => p.id === s.active) ?? s.list[0] ?? EXAMPLE; });
  protected readonly example = computed(() => this.current() === EXAMPLE);
  protected readonly basket = computed(() => { const f = this.facts(); return f ? computePortfolio(this.current(), f, this.closes()) : null; });
  protected readonly line = computed(() => { const f = this.facts(), one = this.closes().get('1y'); return f && one ? yearLine(this.current(), f, one) : null; });

  constructor() {
    void this.files.facts().then((f) => this.facts.set(f));
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
  }

  protected keep(next: Stored) {
    this.stored.set(next);
    if (this.saving() && !savePortfolios(this.storage, next)) this.saving.set(false);
  }
  private ensure(keys: readonly string[]) {
    for (const k of keys) {
      if (this.asked.has(k)) continue;
      this.asked.add(k);
      void this.files.closes(k).then((c) => { if (c) this.closes.set(new Map([...this.closes(), [k, c]])); });
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

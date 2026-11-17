import { afterNextRender, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { date, dayMonth, href, level, money, num, pct, plainName, stockHref, tone } from '@pretickt/components/format';
import { answer, Pt } from '@pretickt/components/context';
import { PtIcon } from '@pretickt/components/ds';
import { PtFollow } from '@pretickt/components/follow';
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
const watch = (name: string, tickers: readonly string[]): StoredPortfolio => ({ id: 'example', name, kind: 'watchlist', unit: 'equal', rows: tickers.map((t) => ({ t, n: null, d: null })) });
const FIVE = watch('Example', ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL']);
/** The example (Romeo, 2026-11-15: «il portafoglio base fallo delle mega caps»): the nightly's mega caps on the site, else five large companies. */
export function examplePortfolio(f: FactsFile | null | undefined): StoredPortfolio {
  const mega = (f?.mega ?? []).filter((t) => f?.companies[t]);
  return mega.length ? watch('Mega caps', mega) : FIVE;
}
/**
 * The ready-made lists (Romeo, 2026-11-17: «aggiungi portafogli predefiniti: mega caps, tech top 20, sp500 top 20, e dei settori con allarmi»): read-only
 * watchlists computed from the facts, the largest first by their weight in SPY (the companies it does not hold after them), one line a company (GOOGL,
 * not GOOG too). `d` is what the page says of the list. The bell follows its companies as they are tonight.
 */
export interface Ready { p: StoredPortfolio; d: string }
export function readyMade(f: FactsFile): { top: Ready[]; sectors: Ready[] } {
  const w = new Map(f.funds['SPY']?.weights), names = new Set<string>();
  const all = Object.values(f.companies).sort((a, b) => (w.get(b.ticker) ?? 0) - (w.get(a.ticker) ?? 0))
    .filter((c) => !names.has(c.name) && names.add(c.name));
  const list = (id: string, name: string, cs: typeof all, d: string): Ready => ({ p: { ...watch(name, cs.map((c) => c.ticker)), id }, d });
  const mega = examplePortfolio(f);
  const top: Ready[] = [{ p: mega, d: mega === FIVE ? 'five large companies' : `the ${mega.rows.length} companies worth $200 billion or more` }];
  if (w.size) top.push(list('sp20', 'S&P 500 top 20', all.filter((c) => w.has(c.ticker)).slice(0, 20), 'the 20 largest companies of the S&P 500'),
    list('tech20', 'Tech top 20', all.filter((c) => c.sector === 'Technology').slice(0, 20), 'the 20 largest technology companies'));
  const sectors = [...new Set(all.map((c) => c.sector!).filter(Boolean))].sort().map((s) => {
    const cs = all.filter((c) => c.sector === s);
    return list(`sector:${s}`, s, cs, `the ${cs.length} ${s} companies on pretickt, largest first`);
  });
  return { top, sectors };
}
/** The reader's own date (a purchase date after it is refused): the local day, not the UTC one an evening in New York is already past. */
export const localToday = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const holds = (n: number) => (n === 0 ? 'holds-none' : n === 1 ? 'holds-one' : n <= 3 ? 'holds-few' : 'holds-many');

@Component({
  selector: 'pt-portfolio-page',
  imports: [PtBasket, PtIcon, PtPortfolioEditor, PtPortfolioLine],
  // pt-basket's context (a placement gets it from its slot): with a payload it asks nothing; the logos' cut-outs, shared with the preview of a paste
  providers: [Pt, PortfolioLogos],
  // the site's hover cards listen on the document and ask the API for the ticker they show: here a hover stays inside, so no request names a holding
  host: { 'data-beacon': BEACON, '(pointerover)': '$event.stopPropagation()', '(pointerout)': '$event.stopPropagation()', '(pt-ctx-ask)': 'ask($event)' },
  template: `
    @let f = facts();
    @if (f === undefined) {<p class="pt-note pt-busy">Loading the companies…</p>}
    @else if (f === null) {<p class="pt-na">Data not available</p>}
    @else {
      <div class="pt-pf">
        @let r = ready()!;
        <div class="pt-pf-tabs pt-pf-ready"><span class="pt-meta">Ready-made</span>
          @for (q of r.top; track q.p.id) {<button type="button" class="pt-pf-tab" [class.pt-pf-tab-on]="current() === q.p" [attr.aria-pressed]="current() === q.p" (click)="pick(q.p.id)">{{ q.p.name }}</button>}
          @if (r.sectors.length) {<select class="pt-pf-input" [class.pt-pf-tab-on]="pre()?.p?.id?.startsWith('sector:')" aria-label="A sector" (change)="pick($any($event.target).value)"><option value="">Sectors</option>@for (q of r.sectors; track q.p.id) {<option [value]="q.p.id" [selected]="current() === q.p">{{ q.p.name }}</option>}</select>}
        </div>
        <pt-portfolio-editor [stored]="stored()" [facts]="f" [saving]="saving()" [today]="today" [away]="!!pre()" (changed)="keep($event)" />
        @if (unread) {<p class="pt-note">What this browser had saved could not be read: it is kept aside, and the page starts empty.</p>}
        @if (pre(); as q) {<p class="pt-note">Ready-made: {{ q.d }}, weighted equally.</p>}
        @else if (example()) {<p class="pt-note">An example: {{ ready()!.top[0]!.d }}, weighted equally. Make your own with New portfolio or New watchlist.</p>}
        @if (follow.on && group().length; as n) {
          <button type="button" class="pt-abtn pt-abtn-wide pt-pf-bell" [attr.aria-pressed]="groupOn()" (click)="bell($event)"><svg ptIcon="bell"></svg>{{ (groupOn() ? 'Alerts on for ' : 'Get alerts for ') + (n === 1 ? 'this company' : 'these ' + n + ' companies') }}</button>
        }
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
            <ul class="pt-pf-list">@for (e of b.earnings; track e.ticker) {<li [attr.data-k]="'e' + e.ticker"><a [href]="stock(e.ticker)">{{ plainName(e.name) }}</a> <span class="pt-meta">{{ dayMonth(e.date) }}</span></li>}</ul>
          }
          @if (b.headlines.length) {
            <h2 class="pt-pf-h">{{ b.kind === 'watchlist' ? 'News of these companies' : 'News of the largest holdings' }}</h2>
            <ul class="pt-pf-list">@for (n of b.headlines; track n.ticker) {<li [attr.data-k]="'n' + n.ticker"><a [href]="stock(n.ticker)">{{ plainName(n.name) }}</a> · <a class="pt-meta" [href]="href(n.url)" target="_blank" rel="nofollow noopener noreferrer">{{ n.title }}</a></li>}</ul>
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

  protected readonly ready = computed(() => { const f = this.facts(); return f ? readyMade(f) : null; });
  private readonly sample = computed(() => this.ready()?.top[0]!.p ?? FIVE);
  /** The ready-made list chosen, until the reader picks one of their own. */
  private readonly picked = signal<string | null>(null);
  protected readonly pre = computed(() => { const r = this.ready(), id = this.picked(); return id && r ? [...r.top, ...r.sectors].find((q) => q.p.id === id) ?? null : null; });
  protected readonly current = computed(() => { const s = this.stored(); return this.pre()?.p ?? s.list.find((p) => p.id === s.active) ?? s.list[0] ?? this.sample(); });
  protected readonly example = computed(() => this.current() === this.sample());

  /** The bells (FOLLOW_ENABLED): the companies of the portfolio shown that the site follows (a fund has no bell yet), one press for all. */
  protected readonly follow = inject(PtFollow);
  protected readonly group = computed(() => { const f = this.facts(); return f ? [...new Set(this.current().rows.map((r) => r.t).filter((t) => f.companies[t]))] : []; });
  protected readonly groupOn = this.follow.followingAll(() => this.group());
  protected bell(e: MouseEvent): void {
    e.stopPropagation(); // the page's panel closes on a click outside it: this one opens it
    this.follow.press({ ticker: `group:${this.current().id}`, name: this.current().name, alerts: [], rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), tickers: this.group() });
  }
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

  protected pick(id: string) { this.picked.set(id || null); }
  protected keep(next: Stored) {
    this.picked.set(null);
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
  /**
   * The click's ask on a company of the earnings or news list (pt-ctx-ask; the basket's own sections answer theirs): your line's weight
   * and move, with the date it reports or the headline beside it. Nothing leaves this browser: the note stays in it too.
   * `data-k` is the list's letter and the ticker (`eNVDA`, `nNVDA`): short, because this page's chunk sits at its budget.
   */
  protected ask(e: Event) {
    const k = (e.target as Element).closest?.('.pt-pf-list [data-k]')?.getAttribute('data-k') ?? '', t = k.slice(1);
    const b = this.basket(), h = b?.holdings.find((x) => x.ticker === t);
    if (!b || !t) return;
    const weight = h?.weight ?? null, ret = h?.ret ?? null, points = weight == null || ret == null ? null : weight * ret;
    const ev = k[0] == 'e' ? b.earnings.find((x) => x.ticker === t) : undefined, n = k[0] == 'n' ? b.headlines.find((x) => x.ticker === t) : undefined;
    if (ev || n) answer(e, { kind: 'portfolio', d: { weight, ret, points, earnings: ev?.date ?? null, headline: n ? { title: n.title, url: n.url } : null } });
  }
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

/**
 * What does the whole fund, or the whole sector, say: why it moved and who moved it, what it holds, what analysts say of its companies, how they read on the business.
 * Every figure says how much of the fund or the sector it rests on, and a fund we cover under 80% shows none of them. Facts only, never a yes or a no.
 * @version 1.2.0
 * @evidence Romeo, 2026-11-05: «voglio creare una pagina con price target preso dalle aziende del paniere e mediato, consensus preso dalle aziende e sommato, is good to buy mediato»
 * @evidence DataForSEO round 17 (US, per month, over 87 ETFs): `{etf} holdings` 123k, market-level "why is it down" 265k, `{etf} price target` 3,550, `is {etf} a good investment` (launch/data/17-summary.json)
 * @evidence design: pretickt/docs/superpowers/specs/2026-11-05-etf-basket-pages-design.md
 * @evidence Romeo, 2026-11-07: «anche le pagine Sector devono aggiungere le visualizzazioni come per gli ETF con il loro paniere di aziende» (1.1: `sector`, every company in the server's HTML)
 * @evidence Romeo, 2026-11-08: «da fare la sezione portafogli con aziende incollate e possibilità di crearne altri per monitoraggio» (1.2: `payload`, a reader's portfolio or watchlist computed on the page, never fetched)
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt, PtLive } from '@pretickt/components/context';
import { PtCompany, PtLogo } from '@pretickt/components/ds';
import { date, href, level, money, num, pct, plainName, stockHref, tone, usd } from '@pretickt/components/format';
import { BASKET_MIN_COVERAGE, BASKET_MOVER_MIN, BASKET_MOVERS, BASKET_SHOWN, basketLead, basketMoved, OTHER_BASIS, oneMover, type Basket, type BasketMover, type PortfolioBasket, type PortfolioHolding, type Sector, type SectorBasket } from '@pretickt/components/typologies';

const QUESTION: Record<string, string> = { demand: 'Demand', advantage: 'Advantage', economics: 'Economics', execution: 'Execution', fragility: 'Fragility', price: 'Price' };
const SOURCE = 'https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_092322.pdf';
/** Always five rows a side, empty ones held open: this section does not shift when the delayed prices arrive (pt-why-today's 80 px). */
const slots = (rows: readonly BasketMover[]) => Array.from({ length: BASKET_MOVERS }, (_, i) => rows[i] ?? null);
type AnyBasket = Basket | SectorBasket | PortfolioBasket;
const isSector = (b: AnyBasket): b is SectorBasket => 'kind' in b && b.kind === 'sector';
/** A reader's portfolio or watchlist, computed on the page (Part B): summed like a sector, its lines its own. */
const isPortfolio = (b: AnyBasket): b is PortfolioBasket => 'kind' in b && (b.kind === 'portfolio' || b.kind === 'watchlist');

/**
 * The moves at the delayed prices. A fund's holding missing from the quotes keeps its last figures, and the move is the fund's own price. A sector's
 * move is the sum of its companies' points (its weights are the last close's, so the sum is exact); a company not yet in the quotes counts flat, with no row,
 * and so does one off its close by more than OTHER_BASIS: a split on the session (the quotes' previous close is the pre-split one), not a move.
 */
export function liveMoves(b: AnyBasket, q: Record<string, { r: number }>, news: Record<string, { top: { title: string; url: string }[] }>): { ret: number | null; up: BasketMover[]; down: BasketMover[] } {
  // a sector's and a portfolio's move is the sum of their lines' points; a fund's is its own price
  const sector = isSector(b) || isPortfolio(b);
  const known = new Map([...b.moves.up, ...b.moves.down].map((m) => [m.ticker, m.headline]));
  const rows = oneMover(b.holdings.flatMap((h): BasketMover[] => {
    const ret = h.ticker ? q[h.ticker]?.r ?? (sector ? null : h.ret) : null;
    if (!h.ticker || ret == null || (sector && Math.abs(ret) > OTHER_BASIS)) return [];
    const top = news[h.ticker]?.top[0];
    return [{ ticker: h.ticker, name: h.name, logo: h.logo, weight: h.weight, ret, points: h.weight * ret, headline: top ? { title: top.title, url: top.url } : known.get(h.ticker) ?? null }];
  }));
  return {
    ret: sector ? (rows.length ? rows.reduce((s, m) => s + m.points, 0) : b.ret) : q[(b as Basket).ticker]?.r ?? b.ret,
    up: rows.filter((m) => m.points >= BASKET_MOVER_MIN).sort((x, y) => y.points - x.points).slice(0, BASKET_MOVERS),
    down: rows.filter((m) => m.points <= -BASKET_MOVER_MIN).sort((x, y) => x.points - y.points).slice(0, BASKET_MOVERS),
  };
}

@Component({
  selector: 'pt-basket',
  imports: [PtCompany, PtLogo],
  template: `
    @let b = data();
    @if (b === null) {<p class="pt-na">Data not available</p>}
    @else if (b) {
      @switch (section()) {
        @case ('moves') {
          <section class="pt-bk">
            <p class="pt-answer pt-bk-moved">{{ moved() }}</p>
            <p class="pt-meta">{{ when() }}</p>
            <div class="pt-bk-moves">
              @for (s of sides(); track s.label) {
                <div class="pt-bk-side">
                  <h3 class="pt-bk-h">{{ s.label }}</h3>
                  @for (m of s.rows; track $index) {
                    @if (m) {
                      <div class="pt-bk-mv">
                        <a class="pt-bk-co" [href]="why(m.ticker)"><pt-logo [ticker]="m.ticker" [src]="m.logo" [size]="20" /><span class="pt-bk-name">{{ plainName(m.name) }}</span></a>
                        <span class="pt-num pt-meta">{{ level(m.weight) }}</span>
                        <span [class]="'pt-num pt-t-' + tone(m.ret)">{{ pct(m.ret) }}</span>
                        <span [class]="'pt-num pt-bk-pts pt-t-' + tone(m.points)">{{ points(m.points) }}</span>
                        @if (m.headline; as h) {<a class="pt-bk-head pt-meta" [href]="href(h.url)" target="_blank" rel="nofollow noopener noreferrer">{{ h.title }}</a>}
                      </div>
                    } @else if ($first) {<div class="pt-bk-mv pt-bk-mv-empty"><span class="pt-meta">{{ s.none }}</span></div>}
                    @else {<div class="pt-bk-mv pt-bk-mv-empty" aria-hidden="true"></div>}
                  }
                </div>
              }
            </div>
            @if (pf()) {<p class="pt-note">Weight at the last close, move and points: the lines' points add up to the move above.</p>}
            @else if (sec()) {<p class="pt-note">Weight at the previous close, move and points of the sector's move: its companies' points add up to the sector's move.</p>}
            @else {<p class="pt-note">Weight, move and points of the fund's move. The move above is the fund's own price; the gap from its companies is the part we do not cover, and fees.</p>}
          </section>
        }
        @case ('holdings') {
          <section class="pt-bk">
            @if (pf(); as p) {<p class="pt-note">{{ linesNote() }}</p>}
            @else if (sec(); as s) {<p class="pt-note">Every {{ s.name }} company on pretickt, weighted by market value at the last close. A company listed under two tickers counts once, split between them.</p>}
            @else if (fund(); as f) {
              <p class="pt-note">We cover {{ level(f.coverage, 0) }} of this fund. Weights recomputed at the last close.</p>
              @if (f.stale) {<p class="pt-note">This fund publishes its holdings less often; the list may be a few weeks old.</p>}
              @if (f.note) {<p class="pt-note">{{ f.note }}</p>}
            }
            <div class="pt-table-wrap">
              <table class="pt-table" [class.pt-bk-dated]="dated()">
                <thead><tr><th>{{ sec() ? 'Company' : 'Holding' }}</th><th class="pt-num">Weight</th><th class="pt-num">Day</th><th class="pt-num">Upside</th><th class="pt-bk-lab">Consensus</th>@if (dated()) {<th class="pt-num">Since</th>}</tr></thead>
                <tbody [class.pt-bk-rows]="!!sec()" [class.pt-bk-all]="!!sec() && all()">
                  @for (h of shown(); track h.ticker ?? h.name; let i = $index) {
                    <tr [class.pt-bk-later]="!!sec() && i >= SHOWN">
                      @let p = line(h);
                      <td>@if (p?.fund) {<a class="pt-co" [href]="etf(p!.ticker)"><pt-logo [ticker]="p!.ticker" [src]="p!.logo" [size]="20" /><span class="pt-co-t">{{ p!.ticker }}</span><span class="pt-co-n">{{ p!.name }}</span></a>}
                        @else if (h.ticker; as t) {<a ptCompany [ticker]="t" [name]="h.name" [logo]="h.logo"></a>} @else {<span class="pt-bk-other">{{ plainName(h.name) }}</span>}</td>
                      <td class="pt-num">{{ level(h.weight) }}</td>
                      <td [class]="'pt-num pt-t-' + tone(h.ret)">{{ h.ret == null ? '' : pct(h.ret) }}</td>
                      <td [class]="'pt-num pt-t-' + tone(h.upside)">{{ h.upside == null ? '' : pct(h.upside) }}</td>
                      <td class="pt-bk-lab">{{ h.label ?? '' }}</td>
                      @if (dated()) {
                        <td [class]="'pt-num pt-t-' + tone(p?.since ?? null)">@if (p?.noSince) {<span title="No close within a week after this date">—</span>} @else {{{ p?.since == null ? '' : pct(p!.since!) }}}
                          @if (p?.bought; as d) {<span class="pt-bk-bought">{{ date(d) }}</span>}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (more()) {<div class="pt-more"><button type="button" class="pt-more-btn" (click)="all.set(true)">Show all {{ b.holdings.length }}</button></div>}
          </section>
        }
        @case ('analysts') {
          <section class="pt-bk">
            @if (b.state === 'low') {<p class="pt-note">{{ lowLine() }}</p>}
            @else {
              <div class="pt-bk-figs">
                @if (b.target; as t) {
                  <div class="pt-bk-fig">
                    @if (pf() && pf()!.value == null) {<p class="pt-bk-big"><span [class]="'pt-t-' + tone(t.upside)">{{ pct(t.upside) }}</span></p>}
                    @else {<p class="pt-bk-big">{{ sec() ? usd(t.price, { compact: true }) : money(t.price) }} <span [class]="'pt-t-' + tone(t.upside)">{{ pct(t.upside) }}</span></p>}
                    @if (pf()) {<p class="pt-meta">What analysts' targets on {{ level(t.share, 0) }} of {{ of() }} would put it at. The median company reads {{ pct(t.median) }}.</p>}
                    @else if (sec()) {<p class="pt-meta">What analysts' targets on {{ level(t.share, 0) }} of the sector would put its companies at. The median company reads {{ pct(t.median) }}.</p>}
                    @else {<p class="pt-meta">What analysts' targets on {{ level(t.share, 0) }} of the fund would put it at. The median holding reads {{ pct(t.median) }}.</p>}
                    <ul class="pt-bk-top">@for (c of t.top; track c.ticker) {<li><a [href]="stock(c.ticker)">{{ plainName(c.name) }}</a> adds {{ pointsAbs(c.points) }} points</li>}</ul>
                  </div>
                }
                @if (b.consensus; as c) {
                  <div class="pt-bk-fig">
                    <p class="pt-bk-big">{{ level(c.buy, 0) }} Buy of {{ num(c.n, 0) }} ratings</p>
                    <div class="pt-bk-bar" aria-hidden="true"><i class="pt-bk-pos" [style.flex-grow]="c.buy"></i><i class="pt-bk-flat" [style.flex-grow]="c.hold"></i><i class="pt-bk-neg" [style.flex-grow]="c.sell"></i></div>
                    <p class="pt-meta">{{ level(c.hold, 0) }} Hold · {{ level(c.sell, 0) }} Sell. Each {{ sec() || pf() ? 'company' : 'holding' }}'s counts, summed, on {{ level(c.share, 0) }} of {{ of() }}.</p>
                  </div>
                }
                @if (b.pe; as p) {
                  <div class="pt-bk-fig">
                    <p class="pt-bk-big">P/E {{ num(p.value, 1) }}x</p>
                    <p class="pt-meta">Weighted harmonic mean on {{ level(p.share, 0) }} of {{ of() }}: companies with losses are left out.</p>
                  </div>
                }
              </div>
              @if (fund()?.note; as n) {<p class="pt-note">{{ n }}</p>}
              <p class="pt-note">{{ pf() ? 'Weighted by your lines, a fund through its companies. Price only, with no dividends.' : sec() ? 'Weighted by market value. Price only, with no dividends.' : 'Weighted by the fund. Price only, with no dividends or fees.' }} Targets added up this way have run high: FactSet's for the S&amp;P 500 ran 9.7% above the index on average over 20 years and 0.1% over 10 (<a [href]="SOURCE" target="_blank" rel="nofollow noopener noreferrer">FactSet, Sept. 2022</a>).</p>
            }
          </section>
        }
        @case ('questions') {
          <section class="pt-bk">
            @if (b.questions; as qs) {
              @if (lead(); as l) {<p class="pt-answer">{{ l }}</p>}
              <div class="pt-bk-qs">
                @for (q of qs; track q.key) {
                  <div class="pt-bk-q">
                    <span class="pt-bk-qk">{{ QUESTION[q.key] }}</span>
                    @if (q.comparable) {
                      <div class="pt-bk-bar" aria-hidden="true"><i class="pt-bk-pos" [style.flex-grow]="q.pos"></i><i class="pt-bk-flat" [style.flex-grow]="q.flat"></i><i class="pt-bk-neg" [style.flex-grow]="q.neg"></i></div>
                      <span class="pt-meta pt-bk-qv">{{ level(q.pos, 0) }} strong · {{ level(q.flat, 0) }} in between · {{ level(q.neg, 0) }} weak · on {{ level(q.share, 0) }} of {{ of() }}</span>
                    } @else {<span class="pt-meta pt-bk-qv pt-bk-qn">not comparable for this {{ whole() }}</span>}
                  </div>
                }
              </div>
              <p class="pt-note">Shares of the weight with a reading on each question; a card our public checks contradict stays out. Fragility leaves out utilities and real estate: its score reads their normal debt as distress.@if (sec()?.sector === 'Financial Services') { Banks have no reading on Advantage and Fragility: their rules do not apply to a bank, so this sector reads neither.}</p>
            } @else {<p class="pt-note">{{ lowLine() }}</p>}
            @if (sec(); as s) {
              <dl class="pt-bk-facts">
                <div><dt>Companies</dt><dd>{{ s.companies }}</dd></div>
                <div><dt>Market value</dt><dd>{{ usd(s.value, { compact: true }) }}</dd></div>
                @if (s.top[0]; as h) {<div><dt>Largest</dt><dd>{{ plainName(h.name) }} {{ level(h.weight) }}</dd></div>}
                <div><dt>Top 10</dt><dd>{{ level(top10(), 0) }} of the sector</dd></div>
              </dl>
            } @else if (fund(); as f) {
              <dl class="pt-bk-facts">
                @if (f.fund.expenseRatio != null) {<div><dt>Fee</dt><dd>{{ level(f.fund.expenseRatio, 2) }} a year</dd></div>}
                @if (f.fund.assets != null) {<div><dt>Assets</dt><dd>{{ usd(f.fund.assets, { compact: true }) }}</dd></div>}
                @if (f.fund.holdings != null) {<div><dt>Holdings</dt><dd>{{ f.fund.holdings }}</dd></div>}
                @if (f.fund.top10 != null) {<div><dt>Top 10</dt><dd>{{ level(f.fund.top10, 0) }} of the fund</dd></div>}
                @if (f.fund.ret1y != null) {<div><dt>1 year</dt><dd>{{ versus(f.fund.ret1y, f.fund.spy1y) }}</dd></div>}
                @if (f.fund.ret5y != null) {<div><dt>5 years</dt><dd>{{ versus(f.fund.ret5y, f.fund.spy5y) }}</dd></div>}
                @if (f.fund.yield != null) {<div><dt>Dividend yield</dt><dd>{{ level(f.fund.yield) }}</dd></div>}
              </dl>
            }
            <p class="pt-note">pretickt does not say whether to buy or sell.</p>
          </section>
        }
        @case ('faq') {
          <section class="dv-faq">
            @for (f of faq(); track f.q) {<div class="dv-faq-i" data-faq><h3 class="dv-faq-q" data-faq-q>{{ f.q }}</h3><p class="dv-faq-a" data-faq-a>{{ f.a }}</p></div>}
          </section>
        }
      }
    }`,
})
export class PtBasket {
  private readonly pt = inject(Pt);
  private readonly live = inject(PtLive);
  /** A fund's ticker; or `sector`, for a sector's page. */
  readonly ticker = input<string | null>(null);
  readonly sector = input<Sector | null>(null);
  readonly section = input<'moves' | 'holdings' | 'analysts' | 'questions' | 'faq'>('moves');
  /** A reader's portfolio or watchlist computed on the page (Part B): shown as given, nothing fetched. */
  readonly payload = input<PortfolioBasket | null>(null);

  private readonly fundCall = this.pt.basket(() => { const t = this.ticker(); return t && !this.sector() && !this.payload() ? { ticker: t } : null; });
  private readonly sectorCall = this.pt.sector(() => { const s = this.sector(); return s && !this.payload() ? { sector: s } : null; });
  /** Neither a fund, a sector nor a payload: nothing to show, not available. */
  protected readonly data = computed<AnyBasket | null | undefined>(() => this.payload() ?? (this.sector() ? this.sectorCall.value() : this.ticker() ? this.fundCall.value() : null));
  protected readonly sec = computed(() => { const b = this.data(); return b && isSector(b) ? b : null; });
  protected readonly pf = computed(() => { const b = this.data(); return b && isPortfolio(b) ? b : null; });
  protected readonly fund = computed(() => { const b = this.data(); return b && !isSector(b) && !isPortfolio(b) ? b : null; });
  protected readonly whole = computed(() => { const p = this.pf(); return p ? (p.kind === 'watchlist' ? 'list' : 'portfolio') : this.sector() ? 'sector' : 'fund'; });
  /** What a figure rests on a share of: "the fund", "the sector", "your portfolio", "the list". */
  protected readonly of = computed(() => (this.whole() === 'portfolio' ? 'your portfolio' : `the ${this.whole()}`));
  /** Who moved, in the sentences: the fund's ticker, the sector's name, the reader's name for the portfolio. */
  private readonly label = computed(() => this.pf()?.name ?? this.sec()?.name ?? this.ticker() ?? '');
  protected readonly faq = computed(() => { const b = this.data(); return b && 'faq' in b ? b.faq : []; });
  /** A portfolio whose lines carry a purchase date: the holdings add Bought and Since. */
  protected readonly dated = computed(() => !!this.pf()?.holdings.some((h) => h.bought != null));
  protected readonly line = (h: AnyBasket['holdings'][number]): PortfolioHolding | null => ('fund' in h ? (h as PortfolioHolding) : null);
  protected readonly linesNote = computed(() => {
    const p = this.pf();
    if (!p) return '';
    if (p.kind === 'watchlist') return 'Your list, each company weighted equally.';
    const by = { shares: 'their value at the last close', usd: 'the dollars you entered', pct: 'the percentages you entered', equal: 'equally' }[p.unit];
    return `Your lines, weighted by ${by}. A fund is one line here; its companies count in the figures.`.replace('weighted by equally', 'weighted equally');
  });

  private readonly day = this.live.after(() => (this.section() === 'moves' ? this.data()?.asOf : null));
  protected readonly all = linkedSignal({ source: () => this.data(), computation: () => false });
  /** A fund's list opens on click; a sector's is all in the server's HTML (every company's link), its rows after the 25th hidden by CSS until then. */
  protected readonly shown = computed(() => { const h = this.data()?.holdings ?? []; return this.sec() || this.all() ? h : h.slice(0, BASKET_SHOWN); });
  protected readonly more = computed(() => (this.data()?.holdings.length ?? 0) > BASKET_SHOWN && !this.all());
  /** The ten largest companies' share, each company once (its share classes merged). */
  protected readonly top10 = computed(() => (this.sec()?.top ?? []).reduce((s, h) => s + h.weight, 0));

  private readonly view = computed(() => {
    const b = this.data(), d = this.day();
    if (!b) return null;
    return d ? liveMoves(b, d.q, d.news) : { ret: b.ret, up: b.moves.up, down: b.moves.down };
  });
  protected readonly sides = computed(() => {
    const v = this.view(), who = this.sector() ? 'company' : 'holding';
    return [{ label: 'Pushed it up', rows: slots(v?.up ?? []), none: `No ${who} added as much as 0.01 points.` }, { label: 'Pulled it down', rows: slots(v?.down ?? []), none: `No ${who} took off as much as 0.01 points.` }];
  });
  protected readonly moved = computed(() => { const v = this.view(); return v ? basketMoved(this.label(), v.ret, v.up, v.down) : ''; });
  protected readonly when = computed(() => {
    const d = this.day(), b = this.data();
    if (d) return d.closed ? `Close of ${date(d.session)}, preliminary` : `Today · ${d.time}, 15-min delayed`;
    return b ? `Close of ${date(b.asOf)}` : '';
  });
  protected readonly lead = computed(() => basketLead(this.label(), this.data()?.questions ?? null, this.whole()));
  protected readonly lowLine = computed(() => {
    const c = this.data()?.coverage ?? 0, p = this.pf();
    const unpriced = p?.uncovered.filter((u) => u.weight == null).map((u) => u.name) ?? [];
    if (unpriced.length) return `We cannot price ${unpriced.join(', ')}, so we cannot say how much of ${this.of()} we cover: its figures need ${level(BASKET_MIN_COVERAGE, 0)}.`;
    if (p) return `We cover ${level(c, 0)} of ${this.of()}: its figures need ${level(BASKET_MIN_COVERAGE, 0)}.${p.uncovered.length ? ` Not covered: ${p.uncovered.slice(0, 5).map((u) => u.name).join(', ')}.` : ''}`;
    return c < BASKET_MIN_COVERAGE ? `We cover ${level(c, 0)} of this fund, under the ${level(BASKET_MIN_COVERAGE, 0)} these figures need.`
      : 'We have no good read of this fund\'s holdings in the last 7 days, so these figures are off for now.';
  });

  protected readonly QUESTION = QUESTION;
  protected readonly SOURCE = SOURCE;
  protected readonly SHOWN = BASKET_SHOWN;
  protected readonly date = date;
  protected readonly href = href;
  protected readonly level = level;
  protected readonly money = money;
  protected readonly num = num;
  protected readonly pct = pct;
  protected readonly plainName = plainName;
  protected readonly tone = tone;
  protected readonly usd = usd;
  protected readonly stock = stockHref;
  /** A mover's link: a company's "why it moved", a fund's own page (a portfolio's fund line). */
  protected why = (t: string) => (this.pf()?.holdings.find((h) => h.ticker === t)?.fund ? this.etf(t) : `${stockHref(t)}why-moving/`);
  protected etf = (t: string) => `/etfs/${t.toLowerCase()}/`;
  protected points = (p: number) => `${p < 0 ? '-' : '+'}${Math.abs(p * 100).toFixed(2)}`;
  protected pointsAbs = (p: number) => Math.abs(p * 100).toFixed(1);
  protected versus = (own: number, spy: number | null) => (spy == null || this.ticker() === 'SPY' ? pct(own) : `${pct(own)} (SPY ${pct(spy)})`);
}

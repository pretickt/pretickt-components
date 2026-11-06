/**
 * What does the whole fund say: why it moved and who moved it, what it holds, what analysts say of its holdings, how they read on the business. Every figure says how
 * much of the fund it rests on, and a fund we cover under 80% shows none of them. Facts only, never a yes or a no.
 * @version 1.0.0
 * @evidence Romeo, 2026-11-05: «voglio creare una pagina con price target preso dalle aziende del paniere e mediato, consensus preso dalle aziende e sommato, is good to buy mediato»
 * @evidence DataForSEO round 17 (US, per month, over 87 ETFs): `{etf} holdings` 123k, market-level "why is it down" 265k, `{etf} price target` 3,550, `is {etf} a good investment` (launch/data/17-summary.json)
 * @evidence design: pretickt/docs/superpowers/specs/2026-11-05-etf-basket-pages-design.md
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt, PtLive } from '@pretickt/components/context';
import { PtCompany, PtLogo } from '@pretickt/components/ds';
import { date, href, level, money, num, pct, plainName, stockHref, tone, usd } from '@pretickt/components/format';
import { BASKET_MIN_COVERAGE, BASKET_MOVERS, BASKET_SHOWN, basketLead, basketMoved, oneMover, type Basket, type BasketMover } from '@pretickt/components/typologies';

const QUESTION: Record<string, string> = { demand: 'Demand', advantage: 'Advantage', economics: 'Economics', execution: 'Execution', fragility: 'Fragility', price: 'Price' };
const SOURCE = 'https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_092322.pdf';
/** Always five rows a side, empty ones held open: this section does not shift when the delayed prices arrive (pt-why-today's 80 px). */
const slots = (rows: readonly BasketMover[]) => Array.from({ length: BASKET_MOVERS }, (_, i) => rows[i] ?? null);

/** The moves at the delayed prices: a holding missing from the quotes keeps its last figures. */
export function liveMoves(b: Basket, q: Record<string, { r: number }>, news: Record<string, { top: { title: string; url: string }[] }>): { ret: number | null; up: BasketMover[]; down: BasketMover[] } {
  const known = new Map([...b.moves.up, ...b.moves.down].map((m) => [m.ticker, m.headline]));
  const rows = oneMover(b.holdings.flatMap((h): BasketMover[] => {
    const ret = h.ticker ? q[h.ticker]?.r ?? h.ret : null;
    if (!h.ticker || ret == null) return [];
    const top = news[h.ticker]?.top[0];
    return [{ ticker: h.ticker, name: h.name, logo: h.logo, weight: h.weight, ret, points: h.weight * ret, headline: top ? { title: top.title, url: top.url } : known.get(h.ticker) ?? null }];
  }));
  return {
    ret: q[b.ticker]?.r ?? b.ret,
    up: rows.filter((m) => m.points > 0).sort((x, y) => y.points - x.points).slice(0, BASKET_MOVERS),
    down: rows.filter((m) => m.points < 0).sort((x, y) => x.points - y.points).slice(0, BASKET_MOVERS),
  };
}

@Component({
  selector: 'pt-basket',
  imports: [PtCompany, PtLogo],
  template: `
    @let b = basket.value();
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
                    } @else {<div class="pt-bk-mv pt-bk-mv-empty" aria-hidden="true"></div>}
                  }
                </div>
              }
            </div>
            <p class="pt-note">Weight, move and points of the fund's move. The move above is the fund's own price; the gap from its companies is the part we do not cover, and fees.</p>
          </section>
        }
        @case ('holdings') {
          <section class="pt-bk">
            <p class="pt-note">We cover {{ level(b.coverage, 0) }} of this fund. Weights recomputed at the last close.</p>
            @if (b.stale) {<p class="pt-note">This fund publishes its holdings less often; the list may be a few weeks old.</p>}
            @if (b.note) {<p class="pt-note">{{ b.note }}</p>}
            <div class="pt-table-wrap">
              <table class="pt-table">
                <thead><tr><th>Holding</th><th class="pt-num">Weight</th><th class="pt-num">Day</th><th class="pt-num">Upside</th><th class="pt-bk-lab">Consensus</th></tr></thead>
                <tbody>
                  @for (h of shown(); track h.ticker ?? h.name) {
                    <tr>
                      <td>@if (h.ticker; as t) {<a ptCompany [ticker]="t" [name]="h.name" [logo]="h.logo"></a>} @else {<span class="pt-bk-other">{{ plainName(h.name) }}</span>}</td>
                      <td class="pt-num">{{ level(h.weight) }}</td>
                      <td [class]="'pt-num pt-t-' + tone(h.ret)">{{ h.ret == null ? '' : pct(h.ret) }}</td>
                      <td [class]="'pt-num pt-t-' + tone(h.upside)">{{ h.upside == null ? '' : pct(h.upside) }}</td>
                      <td class="pt-bk-lab">{{ h.label ?? '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (b.holdings.length > shown().length) {<div class="pt-more"><button type="button" class="pt-more-btn" (click)="all.set(true)">Show all {{ b.holdings.length }}</button></div>}
          </section>
        }
        @case ('analysts') {
          <section class="pt-bk">
            @if (b.state === 'low') {<p class="pt-note">{{ lowLine() }}</p>}
            @else {
              <div class="pt-bk-figs">
                @if (b.target; as t) {
                  <div class="pt-bk-fig">
                    <p class="pt-bk-big">{{ money(t.price) }} <span [class]="'pt-t-' + tone(t.upside)">{{ pct(t.upside) }}</span></p>
                    <p class="pt-meta">What analysts' targets on {{ level(t.share, 0) }} of the fund would put it at. The median holding reads {{ pct(t.median) }}.</p>
                    <ul class="pt-bk-top">@for (c of t.top; track c.ticker) {<li><a [href]="stock(c.ticker)">{{ plainName(c.name) }}</a> adds {{ pointsAbs(c.points) }} points</li>}</ul>
                  </div>
                }
                @if (b.consensus; as c) {
                  <div class="pt-bk-fig">
                    <p class="pt-bk-big">{{ level(c.buy, 0) }} Buy of {{ num(c.n, 0) }} ratings</p>
                    <div class="pt-bk-bar" aria-hidden="true"><i class="pt-bk-pos" [style.flex-grow]="c.buy"></i><i class="pt-bk-flat" [style.flex-grow]="c.hold"></i><i class="pt-bk-neg" [style.flex-grow]="c.sell"></i></div>
                    <p class="pt-meta">{{ level(c.hold, 0) }} Hold · {{ level(c.sell, 0) }} Sell. Each holding's counts, summed, on {{ level(c.share, 0) }} of the fund.</p>
                  </div>
                }
                @if (b.pe; as p) {
                  <div class="pt-bk-fig">
                    <p class="pt-bk-big">P/E {{ num(p.value, 1) }}x</p>
                    <p class="pt-meta">Weighted harmonic mean on {{ level(p.share, 0) }} of the fund: companies with losses are left out.</p>
                  </div>
                }
              </div>
              @if (b.note) {<p class="pt-note">{{ b.note }}</p>}
              <p class="pt-note">Weighted by the fund. Price only, with no dividends or fees. Targets added up this way have run high: FactSet's for the S&amp;P 500 ran 9.7% above the index on average over 20 years and 0.1% over 10 (<a [href]="SOURCE" target="_blank" rel="nofollow noopener noreferrer">FactSet, Sept. 2022</a>).</p>
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
                      <span class="pt-meta pt-bk-qv">{{ level(q.pos, 0) }} strong · {{ level(q.flat, 0) }} in between · {{ level(q.neg, 0) }} weak · on {{ level(q.share, 0) }} of the fund</span>
                    } @else {<span class="pt-meta pt-bk-qv pt-bk-qn">not comparable for this fund</span>}
                  </div>
                }
              </div>
              <p class="pt-note">Shares of the weight with a reading on each question; a card our public checks contradict stays out. Fragility leaves out utilities and real estate: its score reads their normal debt as distress.</p>
            } @else {<p class="pt-note">{{ lowLine() }}</p>}
            <dl class="pt-bk-facts">
              @if (b.fund.expenseRatio != null) {<div><dt>Fee</dt><dd>{{ level(b.fund.expenseRatio, 2) }} a year</dd></div>}
              @if (b.fund.assets != null) {<div><dt>Assets</dt><dd>{{ usd(b.fund.assets, { compact: true }) }}</dd></div>}
              @if (b.fund.holdings != null) {<div><dt>Holdings</dt><dd>{{ b.fund.holdings }}</dd></div>}
              @if (b.fund.top10 != null) {<div><dt>Top 10</dt><dd>{{ level(b.fund.top10, 0) }} of the fund</dd></div>}
              @if (b.fund.ret1y != null) {<div><dt>1 year</dt><dd>{{ versus(b.fund.ret1y, b.fund.spy1y) }}</dd></div>}
              @if (b.fund.ret5y != null) {<div><dt>5 years</dt><dd>{{ versus(b.fund.ret5y, b.fund.spy5y) }}</dd></div>}
              @if (b.fund.yield != null) {<div><dt>Dividend yield</dt><dd>{{ level(b.fund.yield) }}</dd></div>}
            </dl>
            <p class="pt-note">pretickt does not say whether to buy or sell.</p>
          </section>
        }
        @case ('faq') {
          <section class="dv-faq">
            @for (f of b.faq; track f.q) {<div class="dv-faq-i" data-faq><h3 class="dv-faq-q" data-faq-q>{{ f.q }}</h3><p class="dv-faq-a" data-faq-a>{{ f.a }}</p></div>}
          </section>
        }
      }
    }`,
})
export class PtBasket {
  private readonly pt = inject(Pt);
  private readonly live = inject(PtLive);
  readonly ticker = input.required<string>();
  readonly section = input<'moves' | 'holdings' | 'analysts' | 'questions' | 'faq'>('moves');

  protected readonly basket = this.pt.basket(() => ({ ticker: this.ticker() }));
  private readonly day = this.live.after(() => (this.section() === 'moves' ? this.basket.value()?.asOf : null));
  protected readonly all = linkedSignal({ source: () => this.basket.value(), computation: () => false });
  protected readonly shown = computed(() => { const h = this.basket.value()?.holdings ?? []; return this.all() ? h : h.slice(0, BASKET_SHOWN); });

  private readonly view = computed(() => {
    const b = this.basket.value(), d = this.day();
    if (!b) return null;
    return d ? liveMoves(b, d.q, d.news) : { ret: b.ret, up: b.moves.up, down: b.moves.down };
  });
  protected readonly sides = computed(() => {
    const v = this.view();
    return [{ label: 'Pushed it up', rows: slots(v?.up ?? []) }, { label: 'Pulled it down', rows: slots(v?.down ?? []) }];
  });
  protected readonly moved = computed(() => { const v = this.view(); return v ? basketMoved(this.ticker(), v.ret, v.up, v.down) : ''; });
  protected readonly when = computed(() => {
    const d = this.day(), b = this.basket.value();
    if (d) return d.closed ? `Close of ${date(d.session)}, preliminary` : `Today · ${d.time}, 15-min delayed`;
    return b ? `Close of ${date(b.asOf)}` : '';
  });
  protected readonly lead = computed(() => basketLead(this.ticker(), this.basket.value()?.questions ?? null));
  protected readonly lowLine = computed(() => {
    const c = this.basket.value()?.coverage ?? 0;
    return c < BASKET_MIN_COVERAGE ? `We cover ${level(c, 0)} of this fund, under the ${level(BASKET_MIN_COVERAGE, 0)} these figures need.`
      : 'We have no good read of this fund\'s holdings in the last 7 days, so these figures are off for now.';
  });

  protected readonly QUESTION = QUESTION;
  protected readonly SOURCE = SOURCE;
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
  protected why = (t: string) => `${stockHref(t)}why-moving/`;
  protected points = (p: number) => `${p < 0 ? '-' : '+'}${Math.abs(p * 100).toFixed(2)}`;
  protected pointsAbs = (p: number) => Math.abs(p * 100).toFixed(1);
  protected versus = (own: number, spy: number | null) => (spy == null || this.ticker() === 'SPY' ? pct(own) : `${pct(own)} (SPY ${pct(spy)})`);
}

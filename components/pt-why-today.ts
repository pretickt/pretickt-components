/**
 * Why did this stock move today: the whole market, its sector, or something specific to the company? While the market is open, today's
 * move so far (prices 15 minutes late), the news since the last close and the results just reported.
 * @version 2.2.0
 * @evidence DataForSEO: "why is <ticker> stock down today" family (launch/data/08c-serp-why-is-stock-down-today.json, 10a-why-moving-ticker.json)
 * @evidence beta: news spike detector (market-relative story spikes, validated 1.92x abnormal move)
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt, PtLive } from '@pretickt/components/context';
import { PtToggles } from '@pretickt/components/ds';
import { date, href, level, money, num, pct, tone, usd } from '@pretickt/components/format';
import { SENTIMENT_FLAT, type MoveBreakdown } from '@pretickt/components/typologies';

type Window = '1d' | '5d' | '1m';
const FLAT = 0.0005;
const BAR = { pos: 'pt-bd-bar pt-bd-pos', neg: 'pt-bd-bar pt-bd-neg', flat: 'pt-bd-bar pt-bd-flat', na: 'pt-bd-bar pt-bd-na' } as const;
const DOT = { pos: 'pt-dot-pos', neg: 'pt-dot-neg', flat: 'pt-dot-flat', na: 'pt-dot-na' } as const;
const verb = (v: number) => (Math.abs(v) < FLAT ? 'was flat' : `${v > 0 ? 'rose' : 'fell'} ${level(Math.abs(v))}`);
/** The same, for a session still open. */
const verbNow = (v: number, plural = false) => `${plural ? 'are' : 'is'} ${Math.abs(v) < FLAT ? 'flat' : `${v > 0 ? 'up' : 'down'} ${level(Math.abs(v))}`}`;
const WHEN_REPORTED = { amc: 'after the close on', bmo: 'before the open on' } as const;
/** The largest of the three parts (the typology's rule, which the browser bundle does not carry). */
const driverOf = (market: number, sector: number, specific: number) => {
  const a = [Math.abs(market), Math.abs(sector), Math.abs(specific)], i = a.indexOf(Math.max(...a));
  return i === 0 ? 'market' : i === 1 ? 'sector' : 'stock';
};
const surprise = (a: number, e: number | null) => (e != null && e > 0 ? ` (${pct(a / e - 1)})` : '');
const when = (m: MoveBreakdown) =>
  m.window === '1d' ? `on ${date(m.asOf)}` : `over the ${m.window === '5d' ? 'five sessions' : 'month'} to ${date(m.asOf)}`;

@Component({
  selector: 'pt-why-today',
  imports: [PtToggles],
  template: `
    @let m = move.value();
    @if (m === null) {<p class="pt-na">Data not available</p>}
    @else if (m) {
      <section class="pt-why" [class.pt-busy]="move.loading()">
        <div class="pt-head">
          <p class="pt-why-lead">{{ lead() }}</p>
          <div ptToggles [value]="win()" [options]="windows()" aria-label="Window" (choose)="pick($event)"></div>
        </div>
        <p class="pt-lede">{{ context() }}</p>
        @if (reported(); as r) {<p class="pt-lede">{{ r }}</p>}
        <div class="pt-bd">
          @for (b of bars(); track b.label) {
            <div class="pt-bd-row">
              <span class="pt-bd-k">{{ b.label }}</span>
              <span class="pt-bd-track"><span [class]="BAR[tone(b.v, FLAT)]" [style]="b.style"></span></span>
              <span class="pt-bd-v">{{ pct(b.v) }}</span>
            </div>
          }
        </div>
        <p class="pt-bd-news-head">@if (!today() && m.news.spike) {<strong>News spike: </strong>}{{ newsHead() }}</p>
        @if (stories().length) {
          <ul class="pt-news">
            @for (s of stories(); track s.url) {
              <li class="pt-news-item">
                <span [class]="DOT[tone(s.sentiment, SENTIMENT_FLAT)]"></span>
                <a [href]="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a> <span class="pt-meta">{{ s.site }}</span>
              </li>
            }
          </ul>
        }
        @if (today()) {<p class="pt-note">{{ before() }}</p>}
        <p class="pt-note">Market = SPY. Sector = equal-weight average of the tracked companies in the same sector, net of the market.@if (today(); as t) { Prices {{ t.d.delayMin }} minutes delayed.}</p>
      </section>
    }`,
})
export class PtWhyToday {
  private readonly pt = inject(Pt);
  private readonly live = inject(PtLive);
  readonly ticker = input.required<string>();
  readonly window = input<Window>('1d');

  protected readonly win = linkedSignal(() => this.window());
  protected readonly move = this.pt.moveBreakdown(() => ({ ticker: this.ticker(), window: this.win() }));
  protected readonly WINDOWS = [['1d', '1D'], ['5d', '5D'], ['1m', '1M']] as const;
  protected readonly BAR = BAR;
  protected readonly DOT = DOT;
  protected readonly FLAT = FLAT;
  protected readonly SENTIMENT_FLAT = SENTIMENT_FLAT;
  protected readonly tone = tone;
  protected readonly pct = pct;
  protected readonly href = href;

  protected pick(w: Window) { this.win.set(w); this.move.retry(); }

  private readonly day = this.live.after(() => this.move.value()?.asOf);
  /** Today's move so far, in place of the last session's while the 1D window is open (the window then reads "Today"). */
  protected readonly today = computed(() => {
    const d = this.day(), q = d?.q[this.ticker()];
    return this.win() === '1d' && d && q ? { d, q, news: d.news[this.ticker()] ?? { n: 0, top: [] }, earned: d.earnings[this.ticker()] ?? null } : null;
  });
  protected readonly windows = computed(() => (this.day() ? ([['1d', 'Today'], ['5d', '5D'], ['1m', '1M']] as const) : this.WINDOWS));

  protected readonly lead = computed(() => {
    const m = this.move.value(), t = this.today();
    if (m && t) return `${m.name} (${m.ticker}) ${t.d.closed ? `${verb(t.q.r)} today` : `${verbNow(t.q.r)} today, as of ${t.d.time}`}.`;
    return m ? `${m.name} (${m.ticker}) ${verb(m.ret)} ${when(m)}.` : '';
  });
  /** One market / sector / specific reading, from the last session's breakdown or from today's. */
  private readonly parts = computed(() => {
    const m = this.move.value(), t = this.today();
    if (!m) return null;
    if (!t) return { ret: m.ret, marketRet: m.marketRet, sectorRet: m.sectorRet, market: m.market, sector: m.sector, specific: m.specific, driver: m.driver, past: true };
    const { r, m: market, s: sector, x: specific } = t.q;
    if (market == null || specific == null) return null;
    return { ret: r, marketRet: market, sectorRet: sector == null ? null : sector + market, market, sector: sector ?? 0, specific,
      driver: driverOf(market, sector ?? 0, specific), past: t.d.closed };
  });
  protected readonly context = computed(() => {
    const m = this.move.value(), p = this.parts();
    if (!m || !p) return '';
    const v = (x: number, plural = false) => (p.past ? verb(x) : verbNow(x, plural));
    const ctx = `The market (SPY) ${v(p.marketRet)}` + (p.sectorRet != null && m.sectorName ? `; ${m.sectorName} stocks ${v(p.sectorRet, true)}` : '') + '.';
    const driver = Math.abs(p.ret) < FLAT ? '' : p.driver === 'market' ? 'Most of the move came from the market as a whole.'
      : p.driver === 'sector' ? 'Most of the move came from its sector.' : `Most of the move is specific to ${m.ticker}.`;
    return `${ctx} ${driver}`.trim();
  });
  /** The results reported since the last close, against what analysts expected. */
  protected readonly reported = computed(() => {
    const e = this.today()?.earned, t = this.ticker();
    if (!e || (e.eps == null && e.rev == null)) return null;
    const eps = e.eps != null ? `EPS ${money(e.eps)}${e.epsEst != null ? ` vs ${money(e.epsEst)} expected${surprise(e.eps, e.epsEst)}` : ''}` : '';
    const rev = e.rev != null ? `revenue ${usd(e.rev, { compact: true })}${e.revEst != null ? ` vs ${usd(e.revEst, { compact: true })}${surprise(e.rev, e.revEst)}` : ''}` : '';
    return `${t} reported ${e.time ? WHEN_REPORTED[e.time] : 'on'} ${date(e.date)}: ${[eps, rev].filter(Boolean).join('; ')}.`;
  });
  protected readonly stories = computed(() => {
    const t = this.today();
    return t ? t.news.top.map((s) => ({ title: s.title, site: s.site, url: s.url, sentiment: null })) : (this.move.value()?.news.top ?? []);
  });
  /** Under today's move: how the last session ended, which the page's other numbers still stand on. */
  protected readonly before = computed(() => { const m = this.move.value(); return m ? `On ${date(m.asOf)} ${m.ticker} ${verb(m.ret)}.` : ''; });
  protected readonly bars = computed(() => {
    const m = this.move.value(), p = this.parts();
    if (!m || !p) return [];
    const parts = [['Market (SPY)', p.market], [m.sectorName ? `${m.sectorName} sector` : 'Sector', p.sector], [`${m.ticker} specific`, p.specific]] as const;
    const max = Math.max(...parts.map(([, v]) => Math.abs(v)), 1e-9);
    return parts.map(([label, v]) => ({ label, v, style: { [v < 0 ? 'right' : 'left']: '50%', width: `${Math.round((Math.abs(v) / max) * 50)}%` } }));
  });
  protected readonly newsHead = computed(() => {
    const t = this.today();
    if (t) return t.news.n ? `${t.news.n} ${t.news.n === 1 ? 'story' : 'stories'} since the close on ${date(t.d.prev)}.` : `No company news since the close on ${date(t.d.prev)}.`;
    const n = this.move.value()?.news;
    if (!n) return '';
    return n.spike ? `${n.today} stories, ${num(n.avg30 > 0 ? n.today / n.avg30 : 0, 1)}× the 30-day average.`
      : `${n.today} ${n.today === 1 ? 'story' : 'stories'} on the day${n.avg30 > 0 ? ` (30-day average ${num(n.avg30, 1)})` : ''}.`;
  });
}

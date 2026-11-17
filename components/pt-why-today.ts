/**
 * Why did this stock move today: the whole market, its sector, or something specific to the company? While the market is open, today's
 * move so far (prices 15 minutes late), the news since the last close and the results just reported.
 * @version 2.4.0
 * @evidence DataForSEO: "why is <ticker> stock down today" family (launch/data/08c-serp-why-is-stock-down-today.json, 10a-why-moving-ticker.json)
 * @evidence beta: news spike detector (market-relative story spikes, validated 1.92x abnormal move)
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt, PtLive } from '@pretickt/components/context';
import { PtSay, PtToggles } from '@pretickt/components/ds';
import { date, href, level, mention, money, num, pct, say, tone, usd, type Said } from '@pretickt/components/format';
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
/** Past participle, for «it would have fallen 3.1%». */
const fallen = (v: number) => (Math.abs(v) < FLAT ? 'been flat' : `${v > 0 ? 'risen' : 'fallen'} ${level(Math.abs(v))}`);
/** A fraction in tenths of a point, the precision the card shows. */
const tenths = (v: number) => Math.round(v * 1000);
/** A bar's place on the track, in % of its width, to four decimals. */
const at = (v: number) => `${Math.round(v * 1e4) / 1e4}%`;
const NAMES = { market: 'the market', sector: 'its sector', stock: 'its own move' } as const;
const surprise = (a: number, e: number | null) => (e != null && e > 0 ? ` (${pct(a / e - 1)})` : '');
const when = (m: MoveBreakdown) =>
  m.window === '1d' ? `on ${date(m.asOf)}` : `over the ${m.window === '5d' ? 'five sessions' : 'month'} to ${date(m.asOf)}`;

@Component({
  selector: 'pt-why-today',
  imports: [PtSay, PtToggles],
  template: `
    @let m = move.value();
    @if (m === null) {<p class="pt-na">Data not available</p>}
    @else if (m) {
      <section class="pt-why" [class.pt-busy]="move.loading()">
        <div class="pt-head">
          <p class="pt-why-lead"><pt-say [parts]="lead()" /></p>
          <div ptToggles [value]="win()" [options]="windows()" aria-label="Window" (choose)="pick($event)"></div>
        </div>
        <p class="pt-lede"><pt-say [parts]="context()" /></p>
        @if (reported(); as r) {<p class="pt-lede"><pt-say [parts]="r" /></p>}
        <div class="pt-bd">
          @for (b of bars(); track b.label) {
            <div class="pt-bd-row" [class.pt-bd-total]="b.total">
              <span class="pt-bd-k">{{ b.label }}</span>
              <span class="pt-bd-track"><span class="pt-bd-zero" [style.left]="b.zero"></span><span [class]="BAR[tone(b.v, FLAT)]" [style]="b.style"></span></span>
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
        @if (today()) {<p class="pt-note"><pt-say [parts]="before()" /></p>}
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
  /** The company's logo for its name in the sentences: the card at the top of its pages asks for the same. */
  protected readonly co = this.pt.company(() => ({ ticker: this.ticker() }));
  /** The company as the sentences name it: a link with its logo, its card on hover. */
  private readonly self = computed(() => { const m = this.move.value(); return m ? mention(m.ticker, m.name, this.co.value()?.logo ?? null) : null; });
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

  protected readonly lead = computed((): Said => {
    const m = this.move.value(), t = this.today(), n = this.self();
    if (m && n && t) return say`${n} ${t.d.closed ? `${verb(t.q.r)} today` : `${verbNow(t.q.r)} today, as of ${t.d.time}`}.`;
    return m && n ? say`${n} ${verb(m.ret)} ${when(m)}.` : [];
  });
  /**
   * The reading as the card shows it, in tenths of a point: the running sums (market, market + sector, the whole move) are rounded and
   * each part is the step between two of them, so the parts add up to the total and to the sentence's figures (www, AAPL on
   * 2026-11-16: −1.9 −1.1 +2.1 under «fell 1.0%»).
   */
  private readonly shown = computed(() => {
    const p = this.parts();
    if (!p) return null;
    const c1 = tenths(p.market), c2 = tenths(p.market + p.sector), c3 = tenths(p.ret);
    return { market: c1, sector: c2 - c1, stock: c3 - c2, sectorRet: c2, ret: c3 };
  });
  /** One market / sector / specific reading, from the last session's breakdown or from today's. */
  private readonly parts = computed(() => {
    const m = this.move.value(), t = this.today();
    if (!m) return null;
    if (!t) return { ret: m.ret, marketRet: m.marketRet, sectorRet: m.sectorRet, market: m.market, sector: m.sector, specific: m.specific, driver: m.driver, past: true };
    const { r, m: market, s: sector, x: specific } = t.q;
    if (market == null || specific == null) return null;
    return { ret: r, marketRet: market, sectorRet: sector == null ? null : sector + market, market, sector: sector ?? 0, specific,
      driver: driverOf(market, sector ?? 0, specific) as MoveBreakdown['driver'], past: t.d.closed };
  });
  protected readonly context = computed((): Said => {
    const m = this.move.value(), p = this.parts(), s = this.shown(), n = this.self();
    if (!m || !p || !s || !n) return [];
    const v = (x: number, plural = false) => (p.past ? verb(x) : verbNow(x, plural));
    const ctx = `The market (SPY) ${v(s.market / 1000)}` + // the average company of the sector (equal weights): a sector's page weighs them by value and has another figure, so this one says what it is
      (p.sectorRet != null && m.sectorName ? `; the average ${m.sectorName} stock ${v(s.sectorRet / 1000)}` : '') + '.';
    const driver = Math.abs(p.ret) < FLAT ? '' : this.why(m, p, s, n);
    return driver.length ? say`${ctx} ${driver}` : [ctx];
  });
  /**
   * What drove the move. «Most of the move …» only for a part that went the move's way: one that went the other way is what held the stock
   * back or pushed it on, and the sentence says so (www, AAPL on 2026-11-16: «Most of the move is specific to Apple» beside «fell 1.0%» and a
   * green +2.1% — Romeo, 2026-11-17: «perché … vedo scritto Apple fell e poi nel grafico è salita?»).
   */
  private why(m: MoveBreakdown, p: { driver: 'market' | 'sector' | 'stock'; past: boolean }, s: { market: number; sector: number; stock: number; sectorRet: number; ret: number }, n: Said[number]): Said | string {
    const part = s[p.driver];
    if (!part || Math.sign(part) === Math.sign(s.ret))
      return p.driver === 'market' ? 'Most of the move came from the market as a whole.'
        : p.driver === 'sector' ? 'Most of the move came from its sector.' : say`Most of the move is specific to ${n}.`;
    if (p.driver === 'stock') {
      const peer = m.sectorName ? `the average ${m.sectorName} stock` : 'its sector';
      const better = part > 0 ? 'better' : 'worse', own = pct(part / 1000), rest = s.sectorRet / 1000;
      return p.past ? say`${n} did ${better} than ${peer}: without its own ${own} it would have ${fallen(rest)}.`
        : say`${n} is doing ${better} than ${peer}: without its own ${own} it would be ${Math.abs(rest) < FLAT ? 'flat' : `${rest > 0 ? 'up' : 'down'} ${level(Math.abs(rest))}`}.`;
    }
    const others = (['market', 'sector', 'stock'] as const).filter((k) => k !== p.driver && s[k] && Math.sign(s[k]) === Math.sign(s.ret)).map((k) => NAMES[k]);
    const down = s.ret < 0;
    const against = p.driver === 'market' ? (p.past ? `the market ${part > 0 ? 'rose' : 'fell'}` : `the market is ${part > 0 ? 'up' : 'down'}`)
      : `its sector ${p.past ? 'did' : 'is doing'} ${part > 0 ? 'better' : 'worse'} than the market`;
    const moved = p.past ? (down ? 'fell' : 'rose') : (down ? 'is down' : 'is up');
    const pulled = p.past ? (down ? 'pulled it down' : 'lifted it') : (down ? `${others.length > 1 ? 'are' : 'is'} pulling it down` : `${others.length > 1 ? 'are' : 'is'} lifting it`);
    return say`${n} ${moved} even though ${against}: ${others.join(' and ')} ${pulled}.`;
  }
  /** The results reported since the last close, against what analysts expected. */
  protected readonly reported = computed(() => {
    const e = this.today()?.earned, t = this.ticker();
    if (!e || (e.eps == null && e.rev == null)) return null;
    const eps = e.eps != null ? `EPS ${money(e.eps)}${e.epsEst != null ? ` vs ${money(e.epsEst)} expected${surprise(e.eps, e.epsEst)}` : ''}` : '';
    const rev = e.rev != null ? `revenue ${usd(e.rev, { compact: true })}${e.revEst != null ? ` vs ${usd(e.revEst, { compact: true })}${surprise(e.rev, e.revEst)}` : ''}` : '';
    return say`${this.self() ?? t} reported ${e.time ? WHEN_REPORTED[e.time] : 'on'} ${date(e.date)}: ${[eps, rev].filter(Boolean).join('; ')}.`;
  });
  protected readonly stories = computed(() => {
    const t = this.today();
    return t ? t.news.top.map((s) => ({ title: s.title, site: s.site, url: s.url, sentiment: null })) : (this.move.value()?.news.top ?? []);
  });
  /** Under today's move: how the last session ended, which the page's other numbers still stand on. */
  protected readonly before = computed((): Said => { const m = this.move.value(), n = this.self(); return m && n ? say`On ${date(m.asOf)} ${n} ${verb(m.ret)}.` : []; });
  protected readonly bars = computed(() => {
    const m = this.move.value(), s = this.shown();
    if (!m || !s) return [];
    // the sector's part is what it did beside the market (the sentence above gives its whole move): the label says so, or «Technology
    // stocks fell 1.4%» and «Technology sector -1.0%» read as two figures for one thing (www, 2026-11-15)
    // A waterfall: each part starts where the one before ended and the last row is the whole move from zero, so a green part under a fall
    // reads as what held it back, not as the stock rising (www, AAPL on 2026-11-16)
    const steps = [['Market (SPY)', 0, s.market], [`${m.sectorName ?? 'Sector'} vs market`, s.market, s.sectorRet], [`${m.ticker} specific`, s.sectorRet, s.ret],
      [`${m.ticker} total`, 0, s.ret]] as const;
    const lo = Math.min(0, s.market, s.sectorRet, s.ret), span = Math.max(0, s.market, s.sectorRet, s.ret) - lo || 1;
    return steps.map(([label, a, b], i) => ({ label, v: (b - a) / 1000, total: i === 3, zero: at(((0 - lo) / span) * 100),
      style: { left: at(((Math.min(a, b) - lo) / span) * 100), width: at((Math.abs(b - a) / span) * 100) } }));
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

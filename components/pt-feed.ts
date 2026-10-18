/**
 * What happened around this stock — or a sector, or the market — lately, what is coming, and how much did the price move with each?
 * @version 1.0.0
 * @evidence Romeo, 2026-10-18: "un componente timeline che mostra per piccole card eventi sia tecnici che fondamentali che news
 *   rilevanti, nel passato e nel futuro, ferma oggi, con la percentuale di prezzo impattata … una tooltip su desktop mostra la versione
 *   testuale utile per seo … chiamiamolo proprio feed. vale per le company e per la home e per i settori"
 * @evidence Romeo, 2026-10-18: "per ogni card voglio una componente visuale che chiarisce meglio" (each card's price chart around its event)
 */
import { afterRenderEffect, Component, computed, type ElementRef, inject, input, viewChild } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtIcon, PtLogo } from '@pretickt/components/ds';
import { date, dayMonth, href, level, pct, tip } from '@pretickt/components/format';
import { FEED_DAYS, FEED_GROUPS, type FeedItem, type Sector } from '@pretickt/components/typologies';

/** The glyph of each kind the platform sends today; any other kind gets the generic dot. */
const GLYPHS: Record<string, string> = {
  earnings: 'earnings', dividend: 'dividend', split: 'split', upgrade: 'upgrade', downgrade: 'downgrade', 'insider-buy': 'insider',
  'insider-sell': 'insider', 'big-move': 'bolt', news: 'news', 'high-52w': 'peak', 'low-52w': 'valley', 'golden-cross': 'cross',
  'death-cross': 'cross', 'cross-ahead': 'cross', overbought: 'gauge', oversold: 'gauge', macro: 'bank',
};
const GROUP_LABELS: Record<string, string> = { technical: 'Technical', fundamental: 'Fundamental', news: 'News', market: 'Market' };
/** A move smaller than this (a twentieth of a percent) reads as flat. */
const FLAT = 0.0005;
/** The card's chart: a 100 × 24 box (stretched to the card's width), 2 units of margin; a coming event sits at x = 90, after the closes (0–80). */
const SW = 100, SH = 24, PAD = 2, PAST_W = 80, EVENT_X = 90, BAND_W = 8;
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface FeedPill { text: string; since: boolean; cls: string }
export interface FeedSparkGeom {
  /** Every close; `hot` the part the event explains (its session's jump, or the move since), in the event's tone. */
  line: string; hot: string | null; tone: 'pos' | 'neg' | 'flat';
  dot: { x: number; y: number } | null;
  /** The event's x (a dashed rule), and for a coming event the band of its usual (±) or expected move. */
  at: number | null; band: { x: number; y: number; w: number; h: number } | null;
}

/**
 * A card's chart from its closes: the line; a past event's session marked with a dot, its jump (a session's move) or the line from it
 * to the last close (a move since) drawn in its tone; a coming event as a dashed rule after the last close with the band of the move it
 * usually comes with (± typical) or its expected drop. One scale holds the closes and the band.
 */
export function sparkGeom(i: FeedItem): FeedSparkGeom | null {
  const s = i.spark;
  if (!s || s.closes.length < 2) return null;
  const { closes, at } = s, n = closes.length, coming = at >= n, last = closes[n - 1]!;
  const v = i.impact;
  const ends = !coming || v == null || !i.impactKind ? [] : i.impactKind === 'typical' ? [last * (1 - Math.abs(v)), last * (1 + Math.abs(v))] : [last, last * (1 + v)];
  const lo = Math.min(...closes, ...ends), hi = Math.max(...closes, ...ends), span = hi - lo || 1;
  const x = (k: number) => r1((k / (n - 1)) * (coming ? PAST_W : SW));
  const y = (c: number) => r1(SH - PAD - ((c - lo) / span) * (SH - 2 * PAD));
  const pts = closes.map((c, k) => `${x(k)},${y(c)}`);
  const line = `M${pts.join('L')}`;
  const tone = v == null || Math.abs(v) < FLAT ? 'flat' : v > 0 ? 'pos' : 'neg';
  if (coming) {
    const band = ends.length ? { x: EVENT_X - BAND_W / 2, y: y(Math.max(...ends)), w: BAND_W, h: Math.max(1, r1(y(Math.min(...ends)) - y(Math.max(...ends)))) } : null;
    return { line, hot: null, tone: i.impactKind === 'expected' ? tone : 'flat', dot: null, at: EVENT_X, band };
  }
  const hot = i.impactKind === 'since' ? (at < n - 1 ? `M${pts.slice(at).join('L')}` : null) : at >= 1 ? `M${pts[at - 1]}L${pts[at]}` : null;
  return { line, hot, tone, dot: { x: x(at), y: y(closes[at]!) }, at: x(at), band: null };
}

export interface FeedCard {
  key: string; future: boolean; group: string; glyph: string; label: string; sub: string | null; day: string; pill: FeedPill | null; spark: FeedSparkGeom | null;
  href: string; tip: string; text: string;
  /** The company chip off a company's own feed ({ticker, logo}), "market" for the market's own items, null on the company's feed. */
  co: { ticker: string; logo: string | null } | 'market' | null;
}

/** The number a card shows: the session's move or the move since (toned), a coming event's usual or expected move (dashed). */
export function pill(i: FeedItem): FeedPill | null {
  const v = i.impact;
  if (v == null || !i.impactKind) return null;
  if (i.impactKind === 'typical') return { text: `±${level(Math.abs(v))}`, since: false, cls: 'pt-feed-pill pt-feed-pill-est' };
  if (i.impactKind === 'expected') return { text: pct(v), since: false, cls: 'pt-feed-pill pt-feed-pill-est' };
  const tone = Math.abs(v) < FLAT ? 'flat' : v > 0 ? 'pos' : 'neg';
  return { text: pct(v), since: i.impactKind === 'since', cls: `pt-feed-pill pt-feed-pill-${tone}` };
}

/**
 * The cards in date order (as the payload sends them) and where the Today marker goes: before the first event after the latest
 * session — an event on the session itself has happened. `own`: the company's own feed, where a card needs no company chip.
 */
export function feedCards(items: readonly FeedItem[], asOf: string, own: boolean): { cards: FeedCard[]; todayAt: number } {
  const cards = items.map((i, k): FeedCard => ({
    key: `${i.date}|${i.kind}|${i.ticker ?? ''}|${k}`, future: i.date > asOf, group: i.group, glyph: (Object.hasOwn(GLYPHS, i.kind) && GLYPHS[i.kind]) || 'dot',
    label: i.label, sub: i.sub, day: dayMonth(i.date), pill: pill(i), spark: sparkGeom(i), href: href(i.href),
    tip: tip({ [`${!own && i.ticker ? `${i.ticker} · ` : ''}${i.label} · ${date(i.date)}`]: i.text }), text: i.text,
    co: i.ticker == null ? 'market' : own ? null : { ticker: i.ticker, logo: i.logo },
  }));
  const at = cards.findIndex((c) => c.future);
  return { cards, todayAt: at < 0 ? cards.length : at };
}

@Component({
  selector: 'pt-feed',
  imports: [PtIcon, PtLogo],
  template: `
    @let d = feed.value();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else if (d) {
      <div [class.pt-busy]="feed.loading()">
        @let v = view();
        @if (v.cards.length) {
          <div class="pt-head">
            <p class="pt-lede">The last {{ DAYS.back }} days and the next {{ DAYS.ahead }}: each event with the move it came with; dashed, still to come.</p>
            <div class="pt-feed-nav">
              <button type="button" aria-label="Earlier events" (click)="page(-1, $event)">‹</button>
              <button type="button" aria-label="Later events" (click)="page(1, $event)">›</button>
            </div>
          </div>
          <ol class="pt-feed-strip" #strip role="list" tabindex="0" [attr.aria-label]="label()">
            @for (c of v.cards; track c.key; let i = $index) {
              @if (i === v.todayAt) {<li class="pt-feed-today" #today>Today <time [attr.datetime]="d.asOf">{{ dayMonth(d.asOf) }}</time></li>}
              <li class="pt-feed-item" [class.pt-feed-future]="c.future">
                <a [class]="'pt-feed-card pt-feed-' + c.group" [attr.href]="c.href" [attr.data-tip]="c.tip">
                  <span class="pt-feed-face" aria-hidden="true">
                    <span class="pt-feed-top">
                      <span class="pt-feed-glyph"><svg [ptIcon]="c.glyph"></svg></span>
                      @if (c.co === 'market') {<span class="pt-feed-co">Market</span>}
                      @else if (c.co) {<span class="pt-feed-co">@if (c.co.logo) {<pt-logo [ticker]="c.co.ticker" [src]="c.co.logo" [size]="16" />}{{ c.co.ticker }}</span>}
                    </span>
                    <span class="pt-feed-label">{{ c.label }}</span>
                    @if (c.sub) {<span class="pt-feed-sub">{{ c.sub }}</span>}
                    @if (c.spark; as g) {
                      <svg class="pt-feed-spark" viewBox="0 0 100 24" preserveAspectRatio="none">
                        @if (g.at !== null) {<line class="pt-feed-spark-at" [attr.x1]="g.at" [attr.x2]="g.at" y1="0" y2="24" />}
                        @if (g.band; as b) {<rect class="pt-feed-spark-band" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" />}
                        <path class="pt-feed-spark-line" [attr.d]="g.line" />
                        @if (g.hot) {<path [attr.class]="'pt-feed-spark-hot pt-feed-spark-' + g.tone" [attr.d]="g.hot" />}
                        @if (g.dot; as p) {<circle [attr.class]="'pt-feed-spark-dot pt-feed-spark-' + g.tone" [attr.cx]="p.x" [attr.cy]="p.y" r="1.8" />}
                      </svg>
                    }
                    <span class="pt-feed-foot">
                      <span class="pt-feed-date">{{ c.day }}</span>
                      @if (c.pill; as p) {<span [class]="p.cls">{{ p.text }}@if (p.since) {<span class="pt-feed-since"> since</span>}</span>}
                    </span>
                  </span>
                  <span class="pt-sr">{{ c.text }}</span>
                </a>
              </li>
            }
            @if (v.todayAt === v.cards.length) {<li class="pt-feed-today" #today>Today <time [attr.datetime]="d.asOf">{{ dayMonth(d.asOf) }}</time></li>}
          </ol>
          <div class="pt-legend">
            @for (g of groups(); track g) {<span [class]="'pt-feed-key pt-feed-key-' + g">{{ GROUP_LABELS[g] ?? g }}</span>}
          </div>
        } @else {<p class="pt-note">No events in the last {{ DAYS.back }} days or the next {{ DAYS.ahead }}.</p>}
      </div>
    }`,
})
export class PtFeed {
  private readonly pt = inject(Pt);
  /** A company's feed; or `sector` for a sector's; neither: the market's. */
  readonly ticker = input<string>();
  readonly sector = input<Sector>();

  protected readonly feed = this.pt.feed(() => {
    const t = this.ticker(), s = this.sector();
    return { scope: t ? { by: 'ticker' as const, ticker: t } : s ? { by: 'sector' as const, sector: s } : { by: 'market' as const } };
  });
  protected readonly view = computed(() => { const d = this.feed.value(); return feedCards(d?.items ?? [], d?.asOf ?? '', !!this.ticker()); });
  /** The groups on screen, in the catalogue's order (then any newer one). */
  protected readonly groups = computed(() => {
    const on = new Set(this.view().cards.map((c) => c.group));
    return [...FEED_GROUPS.filter((g) => on.delete(g)), ...on];
  });
  protected readonly label = computed(() => `Feed of ${this.ticker() ?? this.sector() ?? 'the market'}: events of the last ${FEED_DAYS.back} days and the next ${FEED_DAYS.ahead}`);

  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  private readonly today = viewChild<ElementRef<HTMLElement>>('today');

  private opened = false;

  constructor() {
    // in the browser, the first time the strip is drawn: it opens on today (the marker in the middle), whatever the screen's width —
    // unless the reader already moved it (a swipe before the page woke up)
    afterRenderEffect(() => {
      const s = this.strip()?.nativeElement, t = this.today()?.nativeElement;
      if (this.opened || !s || !t) return;
      this.opened = true;
      if (s.scrollLeft === 0) s.scrollTo?.({ left: Math.max(0, t.offsetLeft + t.offsetWidth / 2 - s.clientWidth / 2), behavior: 'instant' });
    });
  }

  /** ‹ › for a mouse: most of a screen of cards at a time. */
  protected page(dir: -1 | 1, e: Event) {
    const s = this.strip()?.nativeElement;
    s?.scrollBy?.({ left: dir * s.clientWidth * 0.8 });
    (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'scroll' } }));
  }

  protected readonly DAYS = FEED_DAYS;
  protected readonly GROUP_LABELS = GROUP_LABELS;
  protected readonly dayMonth = dayMonth;
}

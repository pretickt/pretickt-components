/**
 * Which companies are in a move that is still running, and which way did they go this week — the largest first?
 * @version 1.0.0
 * @evidence beta: the home's "Ongoing moves" chart (pretickt-frontend/src/app/home/ongoing-swings-page.*, ongoing-swings.logic.ts)
 * @evidence Romeo, 2026-10-17: "i market mover per cap come in beta … con una leggenda per le sfumature verde e rosso. nella home"
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtToggles } from '@pretickt/components/ds';
import { date, pct, stockHref, tip } from '@pretickt/components/format';
import { type MarketTrend, type MoveSort, type OngoingMoveRow } from '@pretickt/components/typologies';

// beta's tornado (buildWeekChart), in fractions: the viewBox, the baseline, the top margin a bar may reach
const W = 800, H = 230, ZERO = 120, TOP = 26;
/** A site logo path (as pt-logo accepts): anything else draws the initials, never a request. */
const SITE_LOGO = /^\/logos\/[a-z0-9.-]{1,40}$/;
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface MoverRect { cls: string; x: number; y: number; w: number; h: number; rx: number | null }
export interface MoverBar {
  ticker: string; x: number; up: boolean; logo: string | null; initials: string;
  /** The tip of this week's bar (below the baseline for a loser). */
  weekY: number;
  /** 90 days, 30 days, this week: back to front, each in the tone of its own move. */
  rects: MoverRect[];
  logoY: number; labelY1: number; labelY2: number; pctLabel: string; capLabel: string;
  alert: boolean; alertY: number; alertPath: string;
  /** The tooltip rows (the hover card's footer) and the spoken label. */
  tip: string; label: string;
}
export interface MoversChart { w: number; h: number; zeroY: number; bars: MoverBar[] }

/** This week's move for a label: one decimal under 10%, whole percent above (beta). */
export function pctShort(f: number): string {
  const p = Math.abs(f * 100);
  return `${f < 0 ? '-' : '+'}${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}
/** A market cap for a label: "$5.2T", "$453B", "$94B"; empty when unknown. */
export function capShort(v: number | null): string {
  if (v == null || !(v > 0)) return '';
  const [d, u] = v >= 1e12 ? [1e12, 'T'] : v >= 1e9 ? [1e9, 'B'] : [1e6, 'M'];
  const x = v / d;
  return `$${x >= 10 ? Math.round(x) : x.toFixed(1)}${u}`;
}

const tipOf = (r: OngoingMoveRow): string => tip({
  'This week': pct(r.week), 'Last 30 days': pct(r.month), 'Last 90 days': pct(r.quarter),
  [r.kind === 'rally' ? 'Rally' : 'Drawdown']: `${pct(r.move)} since ${date(r.since)} (${r.days} days)`,
  ...(r.industry ? { 'Industry moving too': `median ${pct(r.industry.median)}`, Peers: r.industry.peers.map((p) => `${p.ticker} ${pct(p.move)}`).join(' · ') } : {}),
});

/**
 * Beta's tornado: this week's losers on the left, gainers on the right, the rows' order (most important first) placed next to the
 * centre and fading outwards. One scale for the three windows; per company the 90 days (widest, lightest), the 30 days and the
 * week (narrow, solid) from the shared baseline; the logo on the bar-free side, under it the week's % and the market cap.
 */
export function buildMovers(rows: readonly OngoingMoveRow[]): MoversChart | null {
  const drawn = rows.filter((r) => r.week != null);
  const ordered = [...drawn.filter((r) => r.week! < 0).reverse(), ...drawn.filter((r) => r.week! >= 0)];
  if (!ordered.length) return null;
  const slot = W / (ordered.length + 1), barW = Math.min(14, slot * 0.5);
  const maxAbs = Math.max(0.01, ...ordered.flatMap((r) => [r.week, r.month, r.quarter].filter((v): v is number => v != null).map(Math.abs)));
  const sy = (v: number) => ZERO - (v / maxAbs) * (ZERO - TOP);
  const rect = (cls: string, v: number | null, x: number, half: number, rx: number | null): MoverRect[] => {
    if (v == null) return [];
    const y = sy(v);
    return [{ cls: `${cls} pt-mv-bar-${v >= 0 ? 'pos' : 'neg'}`, x: r1(x - half), y: r1(v >= 0 ? y : ZERO), w: r1(half * 2), h: r1(Math.abs(ZERO - y) || 0.5), rx }];
  };
  const bars = ordered.map((r, i): MoverBar => {
    const w = r.week!, up = w >= 0, x = r1(slot * (i + 1));
    const logoY = up ? ZERO + 4 : ZERO - 18, labelY1 = up ? ZERO + 28 : ZERO - 24, labelY2 = up ? ZERO + 37 : ZERO - 33;
    const alertY = up ? labelY2 + 4 : labelY2 - 16;
    return {
      ticker: r.ticker, x, up, logo: r.logo && SITE_LOGO.test(r.logo) ? r.logo : null,
      initials: r.ticker.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase(), weekY: r1(sy(w)),
      rects: [...rect('pt-mv-q', r.quarter, x, barW, null), ...rect('pt-mv-m', r.month, x, barW * 0.72, null), ...rect('pt-mv-w', w, x, barW / 2, 2)],
      logoY, labelY1, labelY2, pctLabel: pctShort(w), capLabel: capShort(r.marketCap),
      alert: !!r.industry, alertY, alertPath: `M${r1(x - 3.5)} ${alertY + 7} L${r1(x + 3.5)} ${alertY + 7} L${x} ${alertY} Z`,
      tip: tipOf(r), label: `${r.name}, ${pct(w)} this week`,
    };
  });
  return { w: W, h: H, zeroY: ZERO, bars };
}

const ARROWS: Record<MarketTrend, string> = { bullish: '▲', bearish: '▼', sideways: '→' };
const MARKET_HINTS: Record<MarketTrend, string> = { bullish: 'higher highs and higher lows', bearish: 'lower highs and lower lows', sideways: 'no clear direction' };

@Component({
  selector: 'pt-movers',
  imports: [PtToggles],
  template: `
    @let d = moves.value();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else if (d) {
      <figure class="pt-mv" [class.pt-busy]="moves.loading()">
        <div class="pt-head">
          <p class="pt-lede">Companies in a rally or drawdown of more than {{ thr() }} that is still running: no reversal of {{ thr() }} since it started · as of {{ date(d.asOf) }}</p>
          <div class="pt-mv-ctl">
            @if (d.market; as m) {<span [class]="'pt-mv-market pt-mv-market-' + m" [attr.data-tip]="marketTip(m)">Market {{ ARROWS[m] }}</span>}
            <div ptToggles [value]="picked()" [options]="SORTS" aria-label="Order of each side" (choose)="pick($event)"></div>
          </div>
        </div>
        @if (g(); as g) {
          <div class="pt-mv-frame">
            <svg class="pt-mv-svg" [attr.viewBox]="'0 0 ' + g.w + ' ' + g.h" role="group" aria-label="Ongoing moves: this week's losers on the left, gainers on the right">
              <line class="pt-mv-zero" x1="0" [attr.x2]="g.w" [attr.y1]="g.zeroY" [attr.y2]="g.zeroY" />
              @for (b of g.bars; track b.ticker) {
                <a class="pt-mv-co" [attr.href]="stockHref(b.ticker)" [attr.data-tip]="b.tip" [attr.aria-label]="b.label">
                  @for (r of b.rects; track r.cls) {<rect [attr.class]="r.cls" [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h" [attr.rx]="r.rx" />}
                  @if (b.logo) {<image [attr.href]="b.logo" [attr.x]="b.x - 7" [attr.y]="b.logoY" width="14" height="14" />}
                  @else {<text class="pt-mv-tk" [attr.x]="b.x" [attr.y]="b.logoY + 10" text-anchor="middle">{{ b.initials }}</text>}
                  <text [attr.class]="'pt-mv-lab pt-mv-lab-' + (b.up ? 'pos' : 'neg')" [attr.x]="b.x" [attr.y]="b.labelY1" text-anchor="middle">{{ b.pctLabel }}</text>
                  @if (b.capLabel) {<text class="pt-mv-lab pt-mv-cap" [attr.x]="b.x" [attr.y]="b.labelY2" text-anchor="middle">{{ b.capLabel }}</text>}
                  @if (b.alert) {
                    <path class="pt-mv-alert" [attr.d]="b.alertPath" />
                    <text class="pt-mv-alert-mark" [attr.x]="b.x" [attr.y]="b.alertY + 6.2" text-anchor="middle">!</text>
                  }
                </a>
              }
            </svg>
          </div>
          <div class="pt-legend pt-mv-legend">
            @for (k of KEYS; track k[0]) {
              <span class="pt-mv-key"><i [class]="'pt-mv-sw pt-mv-sw-' + k[0] + ' pt-mv-sw-pos'"></i><i [class]="'pt-mv-sw pt-mv-sw-' + k[0] + ' pt-mv-sw-neg'"></i>{{ k[1] }}</span>
            }
            <span class="pt-mv-key"><i class="pt-mv-warn">⚠</i>Industry moving too</span>
          </div>
          <p class="pt-note">{{ note() }}</p>
        } @else {<p class="pt-note">Quiet market: no stock is in a move of more than {{ thr() }} right now.</p>}
      </figure>
    }`,
})
export class PtMovers {
  private readonly pt = inject(Pt);
  readonly sort = input<MoveSort>('cap');

  /** The reader's choice (the toggle); the note follows the data on screen (`moves.params()`). */
  protected readonly picked = linkedSignal(() => this.sort());
  protected readonly moves = this.pt.ongoingMoves(() => ({ sort: this.picked() }));
  protected readonly g = computed(() => buildMovers(this.moves.value()?.rows ?? []));
  protected readonly thr = computed(() => `${Math.round((this.moves.value()?.threshold ?? 0.04) * 100)}%`);
  protected readonly note = computed(() => {
    const shown = (this.moves.params() as { sort?: MoveSort } | undefined)?.sort ?? this.picked();
    return `This week's losers on the left, gainers on the right; ${shown === 'move' ? 'the biggest moves' : 'the largest companies'} in the middle. ` +
      'A company\'s numbers are in its tooltip; click it for its page.';
  });

  protected readonly SORTS = [['cap', 'Market cap'], ['move', '% move']] as const;
  protected readonly KEYS = [['w', 'This week'], ['m', 'Last 30 days'], ['q', 'Last 90 days']] as const;
  protected readonly ARROWS = ARROWS;
  protected readonly date = date;
  protected readonly stockHref = stockHref;
  protected readonly marketTip = (m: MarketTrend) => tip({ 'The market (SPY)': `${m}: ${MARKET_HINTS[m]}` });

  protected pick(s: MoveSort) { this.picked.set(s); this.moves.retry(); }
}

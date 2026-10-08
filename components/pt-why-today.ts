/**
 * Why did this stock move today: the whole market, its sector, or something specific to the company?
 * @version 2.1.0
 * @evidence DataForSEO: "why is <ticker> stock down today" family (launch/data/08c-serp-why-is-stock-down-today.json, 10a-why-moving-ticker.json)
 * @evidence beta: news spike detector (market-relative story spikes, validated 1.92x abnormal move)
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtToggles } from '@pretickt/components/ds';
import { date, href, level, num, pct, tone } from '@pretickt/components/format';
import { SENTIMENT_FLAT, type MoveBreakdown } from '@pretickt/components/typologies';

type Window = '1d' | '5d' | '1m';
const FLAT = 0.0005;
const BAR = { pos: 'pt-bd-bar pt-bd-pos', neg: 'pt-bd-bar pt-bd-neg', flat: 'pt-bd-bar pt-bd-flat', na: 'pt-bd-bar pt-bd-na' } as const;
const DOT = { pos: 'pt-dot-pos', neg: 'pt-dot-neg', flat: 'pt-dot-flat', na: 'pt-dot-na' } as const;
const verb = (v: number) => (Math.abs(v) < FLAT ? 'was flat' : `${v > 0 ? 'rose' : 'fell'} ${level(Math.abs(v))}`);
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
          <div ptToggles [value]="win()" [options]="WINDOWS" aria-label="Window" (choose)="pick($event)"></div>
        </div>
        <p class="pt-lede">{{ context() }}</p>
        <div class="pt-bd">
          @for (b of bars(); track b.label) {
            <div class="pt-bd-row">
              <span class="pt-bd-k">{{ b.label }}</span>
              <span class="pt-bd-track"><span [class]="BAR[tone(b.v, FLAT)]" [style]="b.style"></span></span>
              <span class="pt-bd-v">{{ pct(b.v) }}</span>
            </div>
          }
        </div>
        <p class="pt-bd-news-head">@if (m.news.spike) {<strong>News spike: </strong>}{{ newsHead() }}</p>
        @if (m.news.top.length) {
          <ul class="pt-news">
            @for (s of m.news.top; track s.url) {
              <li class="pt-news-item">
                <span [class]="DOT[tone(s.sentiment, SENTIMENT_FLAT)]"></span>
                <a [href]="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a> <span class="pt-meta">{{ s.site }}</span>
              </li>
            }
          </ul>
        }
        <p class="pt-note">Market = SPY. Sector = equal-weight average of the tracked companies in the same sector, net of the market.</p>
      </section>
    }`,
})
export class PtWhyToday {
  private readonly pt = inject(Pt);
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

  protected readonly lead = computed(() => { const m = this.move.value(); return m ? `${m.name} (${m.ticker}) ${verb(m.ret)} ${when(m)}.` : ''; });
  protected readonly context = computed(() => {
    const m = this.move.value();
    if (!m) return '';
    const ctx = `The market (SPY) ${verb(m.marketRet)}` + (m.sectorRet != null && m.sectorName ? `; ${m.sectorName} stocks ${verb(m.sectorRet)}` : '') + '.';
    const driver = Math.abs(m.ret) < FLAT ? '' : m.driver === 'market' ? 'Most of the move came from the market as a whole.'
      : m.driver === 'sector' ? 'Most of the move came from its sector.' : `Most of the move is specific to ${m.ticker}.`;
    return `${ctx} ${driver}`.trim();
  });
  protected readonly bars = computed(() => {
    const m = this.move.value();
    if (!m) return [];
    const parts = [['Market (SPY)', m.market], [m.sectorName ? `${m.sectorName} sector` : 'Sector', m.sector], [`${m.ticker} specific`, m.specific]] as const;
    const max = Math.max(...parts.map(([, v]) => Math.abs(v)), 1e-9);
    return parts.map(([label, v]) => ({ label, v, style: { [v < 0 ? 'right' : 'left']: '50%', width: `${Math.round((Math.abs(v) / max) * 50)}%` } }));
  });
  protected readonly newsHead = computed(() => {
    const n = this.move.value()?.news;
    if (!n) return '';
    return n.spike ? `${n.today} stories, ${num(n.avg30 > 0 ? n.today / n.avg30 : 0, 1)}× the 30-day average.`
      : `${n.today} ${n.today === 1 ? 'story' : 'stories'} on the day${n.avg30 > 0 ? ` (30-day average ${num(n.avg30, 1)})` : ''}.`;
  });
}

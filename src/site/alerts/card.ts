import { Component, computed, input, output, signal } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { date } from '@pretickt/components/format';
import { CONDITIONS, GROUPS, pillText, type ParamSpec } from '../../alerts/catalog';
import { chartOf, dollars, LABEL_X, PLOT_L, PLOT_R, type ChartData, type Tone } from '../../alerts/charts';
import type { RuleCondition } from '../../alerts/rule';
import { SECTORS } from '../../typologies/values';

interface Part { text: string; key: string | null; spec: ParamSpec | null }
const TICKER = /^[A-Z][A-Z0-9]{0,5}(\.[A-Z])?$/;
let uid = 0;

/**
 * One condition of an alert, as the editor shows it (version A, Romeo 2026-11-01 — mockup `condizioni-A.png`): its group, its title
 * with the example stock, the chart with the alert level dashed and the values on the right (the price target's classes), the
 * sentence whose pills change the values, and how many stocks pass today. Rendered in the browser only (the editor).
 */
@Component({
  selector: 'pt-alert-card',
  imports: [PtLogo],
  template: `
    @let rcv = rc();
    <article class="pt-al-card" [attr.data-group]="group()">
      <header class="pt-al-card-h">
        <span class="pt-al-kind">{{ groupLabel() }}</span>
        <button type="button" class="pt-al-x" aria-label="Remove this condition" (click)="remove.emit()">×</button>
      </header>
      <p class="pt-al-title">
        @if (example(); as r) {<pt-logo [ticker]="r.ticker" [src]="r.logo" [size]="16" />}
        <span>{{ title() }}</span>
      </p>
      @if (chart(); as m) {
        @switch (m.kind) {
          @case ('level') {
            <svg class="pt-al-viz" [attr.viewBox]="'0 0 300 ' + m.h" role="img" [attr.aria-label]="sentence()">
              @if (m.zone; as z) {
                <defs><clipPath [attr.id]="clip"><rect x="0" [attr.y]="z.y" width="300" [attr.height]="z.h" /></clipPath></defs>
                <rect [attr.class]="'pt-al-zone-' + z.tone" [attr.x]="PLOT_L" [attr.y]="z.y" [attr.width]="PLOT_R - PLOT_L" [attr.height]="z.h" />
              }
              @for (l of m.levels; track $index) {
                @if (!l.now) {<line [attr.class]="'pt-lvl pt-lvl-' + tone(l.tone)" [attr.x1]="PLOT_L" [attr.x2]="PLOT_R + 8" [attr.y1]="l.y" [attr.y2]="l.y" />}
              }
              @for (b of m.bars; track $index) {
                <rect [attr.class]="'pt-al-bar-' + b.tone" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="2" />
                @if (b.label) {<text class="pt-al-ax" [attr.x]="b.x + b.w / 2" [attr.y]="m.h - 3" text-anchor="middle">{{ b.label }}</text>}
              }
              @if (m.line) {<path class="pt-price" [attr.d]="m.line" />}
              @if (m.past && m.zone) {<path [attr.class]="'pt-al-past pt-al-past-' + m.zone.tone" [attr.d]="m.past" [attr.clip-path]="'url(#' + clip + ')'" />}
              @if (m.cross; as c) {
                <circle class="pt-al-fire" [attr.cx]="c.x" [attr.cy]="c.y" r="3" />
                <text class="pt-al-fire-t" [attr.x]="c.x - 6" [attr.y]="c.y + 9" text-anchor="end">fires here</text>
              }
              @for (l of m.levels; track $index) {
                @if (l.now) {<rect class="pt-lvl-pill" [attr.x]="LABEL_X - 22" [attr.y]="l.labelY - 6.5" width="44" height="13" rx="6.5" />}
                <text [attr.class]="'pt-lvl-t pt-lvl-t-' + (l.now ? 'now' : tone(l.tone))" [attr.x]="LABEL_X" [attr.y]="l.labelY"
                  text-anchor="middle" dominant-baseline="central">{{ l.label }}</text>
                <text [attr.class]="'pt-lvl-n pt-lvl-n-' + (l.now ? 'now' : tone(l.tone))" [attr.x]="LABEL_X" [attr.y]="l.labelY + (l.now ? 13 : 9)"
                  text-anchor="middle" dominant-baseline="central">{{ l.caption }}</text>
              }
              @for (t of m.ticks; track $index) {
                <text class="pt-al-ax" [attr.x]="t.x" [attr.y]="t.y" [attr.text-anchor]="$first ? 'start' : $last ? 'end' : 'middle'">{{ t.label }}</text>
              }
            </svg>
          }
          @case ('range') {
            <svg class="pt-al-viz" viewBox="0 0 300 56" role="img" [attr.aria-label]="sentence()">
              <line class="pt-lvl pt-lvl-flat" x1="16" x2="284" y1="26" y2="26" />
              <rect [attr.class]="'pt-al-zone-' + (m.side === 'low' ? 'neg' : 'pos')" [attr.x]="rangeX(m.band[0], m)" y="18"
                [attr.width]="rangeX(m.band[1], m) - rangeX(m.band[0], m)" height="16" rx="3" />
              <circle class="pt-al-dot" [attr.cx]="rangeX(m.price, m)" cy="26" r="4" />
              <text class="pt-lvl-n pt-lvl-n-now" [attr.x]="rangeX(m.price, m)" y="11" text-anchor="middle">NOW {{ dollars(m.price) }}</text>
              <text class="pt-al-ax" x="16" y="50">52W LOW {{ dollars(m.low) }}</text>
              <text class="pt-al-ax" x="284" y="50" text-anchor="end">52W HIGH {{ dollars(m.high) }}</text>
            </svg>
          }
          @case ('checks') {
            <div class="pt-al-checks">
              <span class="pt-al-marks">
                @for (k of m.marks; track $index) {
                  <svg class="pt-al-mark" [class.pt-al-mark-on]="k === true" [class.pt-al-mark-off]="k === false" viewBox="0 0 12 12" aria-hidden="true">
                    <path [attr.d]="k === true ? CHECK : k === false ? CROSS : DASH" />
                  </svg>
                }
              </span>
              <span><b>{{ m.score ?? '—' }}</b> of 9 checks</span>
            </div>
          }
          @case ('countdown') {
            <p class="pt-al-fact">
              @if (m.days !== null && m.days >= 0) {<b>{{ m.days === 0 ? 'Today' : m.days + (m.days === 1 ? ' day' : ' days') }}</b> to results{{ m.date ? ' · ' + date(m.date) : '' }}}
              @else {No upcoming earnings date}
            </p>
          }
          @case ('grade') {
            <p class="pt-al-fact">
              @if (m.dir) {{{ m.dir === 'down' ? 'Downgraded' : 'Upgraded' }} by {{ m.firm }}{{ m.date ? ' on ' + date(m.date) : '' }}} @else {No analyst grade change}
            </p>
          }
          @case ('flag') {<p class="pt-al-fact">{{ m.on ? 'On the undervalued list' : 'Not on the undervalued list' }}</p>}
          @case ('logos') {
            <div class="pt-al-logos">
              @for (r of m.rows; track r.ticker) {<pt-logo [ticker]="r.ticker" [src]="r.logo" [size]="22" />}
              @if (m.more) {<span class="pt-al-more">+{{ m.more }}</span>}
            </div>
          }
        }
      } @else {<p class="pt-al-nodata">No data{{ example() ? ' for ' + example()!.ticker : '' }}</p>}
      <p class="pt-al-say">
        @for (part of parts(); track $index) {
          @if (part.key === null) {{{ part.text }}}
          @else {<button type="button" class="pt-al-pill" [attr.aria-expanded]="open() === part.key" [attr.aria-label]="'Change ' + part.text"
            (click)="press(part)">{{ part.text }}</button>}
        }
      </p>
      @if (stepper(); as st) {
        <div class="pt-al-step" role="group" [attr.aria-label]="'Change ' + st.text">
          <button type="button" aria-label="Less" [disabled]="!st.down" (click)="step(-1)">−</button>
          <span>{{ st.text }}</span>
          <button type="button" aria-label="More" [disabled]="!st.up" (click)="step(1)">+</button>
        </div>
      }
      @if (open() !== null && openSpec()?.kind === 'sector') {
        <div class="pt-al-choices">@for (s of SECTORS; track s) {<button type="button" (click)="choose(s)">{{ s }}</button>}</div>
      }
      @if (open() !== null && isPrice()) {
        <input class="pt-al-num" type="number" inputmode="decimal" step="0.01" aria-label="Price level" [value]="rcv.p[open()!]"
          (keydown.enter)="typedPrice($event)" (change)="typedPrice($event)" />
      }
      @if (open() !== null && openSpec()?.kind === 'ticker') {
        <input class="pt-al-ticker" aria-label="Ticker" [value]="rcv.p[open()!]" (keydown.enter)="typed($event)" (change)="typed($event)" />
      }
      @if (count(); as c) {<p class="pt-al-count">Today: <b>{{ c.pass }}</b> of {{ c.of }} {{ ofLabel() }}</p>}
    </article>`,
})
export class PtAlertCard {
  readonly rc = input.required<RuleCondition>();
  readonly data = input.required<ChartData>();
  readonly count = input<{ pass: number; of: number } | null>(null);
  readonly ofLabel = input('stocks');
  readonly change = output<{ key: string; value: string | number }>();
  readonly remove = output<void>();

  protected readonly open = signal<string | null>(null);
  protected readonly clip = `pt-al-clip-${++uid}`;
  protected readonly PLOT_L = PLOT_L;
  protected readonly PLOT_R = PLOT_R;
  protected readonly LABEL_X = LABEL_X;
  protected readonly SECTORS = SECTORS;
  protected readonly CHECK = 'M2.5 6.5l2.5 2.5l4.5-5';
  protected readonly CROSS = 'M3.5 3.5l5 5M8.5 3.5l-5 5';
  protected readonly DASH = 'M3.5 6h5';
  protected readonly date = date;

  private readonly def = computed(() => CONDITIONS[this.rc().c]);
  protected readonly group = computed(() => this.def().group);
  protected readonly groupLabel = computed(() => GROUPS.find(([g]) => g === this.def().group)?.[1] ?? '');
  protected readonly chart = computed(() => chartOf(this.rc(), this.data()));
  /** the stock the chart draws: none for the universe's logos */
  protected readonly example = computed(() => (this.def().chart === 'logos' ? null : this.data().row));
  protected readonly title = computed(() => this.def().name + (this.example() ? ` · example: ${this.example()!.ticker}` : ''));
  protected readonly parts = computed<Part[]>(() => {
    const rc = this.rc(), def = this.def();
    return def.say(rc.p).map((part) => {
      if (typeof part === 'string') return { text: part, key: null, spec: null };
      const spec = def.params.find((s) => s.key === part.key) ?? null;
      return { key: part.key, spec, text: spec ? pillText(spec, rc.p[part.key] ?? def.defaults[part.key] ?? '') : '' };
    });
  });
  protected readonly sentence = computed(() => this.parts().map((p) => p.text).join(''));
  protected readonly openSpec = computed(() => this.def().params.find((s) => s.key === this.open()) ?? null);
  /** a price level is typed (a stepper would move it a cent at a time) */
  protected readonly isPrice = computed(() => { const s = this.openSpec(); return s?.kind === 'number' && s.unit === 'price'; });
  protected readonly stepper = computed(() => {
    const s = this.openSpec();
    if (!s || s.kind !== 'number' || s.unit === 'price') return null;
    const v = Number(this.rc().p[s.key]);
    return { text: pillText(s, v), down: v - s.step >= s.min - 1e-9, up: v + s.step <= s.max + 1e-9 };
  });

  protected tone(t: Tone): string { return t === 'ink' ? 'flat' : t; }
  protected readonly dollars = dollars;
  protected rangeX(v: number, m: { low: number; high: number }): number {
    const f = m.high > m.low ? (v - m.low) / (m.high - m.low) : 0.5;
    return 16 + Math.max(0, Math.min(1, f)) * 268;
  }

  /** A choice moves to its next option; a number opens − and +, a price a field; a sector the list; a ticker a field. */
  protected press(part: Part): void {
    const s = part.spec;
    if (!s || !part.key) return;
    if (s.kind === 'choice') {
      const i = s.options.findIndex(([o]) => o === String(this.rc().p[part.key!]));
      this.change.emit({ key: part.key, value: s.options[(i + 1) % s.options.length]![0] });
      return;
    }
    this.open.set(this.open() === part.key ? null : part.key);
  }

  protected step(dir: 1 | -1): void {
    const s = this.openSpec();
    if (!s || s.kind !== 'number') return;
    const v = Number(this.rc().p[s.key]) + dir * s.step;
    if (v < s.min - 1e-9 || v > s.max + 1e-9) return;
    const decimals = (String(s.step).split('.')[1] ?? '').length;   // 0.5 + 1 = 1.5, never 1.5000000000000002
    this.change.emit({ key: s.key, value: Number((Math.round(v / s.step) * s.step).toFixed(decimals)) });
  }

  protected choose(sector: string): void {
    const s = this.openSpec();
    if (!s) return;
    this.change.emit({ key: s.key, value: sector });
    this.open.set(null);
  }

  protected typedPrice(e: Event): void {
    const s = this.openSpec(), raw = (e.target as HTMLInputElement).value.trim(), v = Number(raw);
    if (!s || s.kind !== 'number' || !raw || !Number.isFinite(v) || v < s.min || v > s.max) return;
    this.change.emit({ key: s.key, value: Math.round(v * 100) / 100 });
    this.open.set(null);
  }

  protected typed(e: Event): void {
    const s = this.openSpec(), v = (e.target as HTMLInputElement).value.trim().toUpperCase();
    if (!s || !TICKER.test(v)) return;
    this.change.emit({ key: s.key, value: v });
    this.open.set(null);
  }
}

import { afterRenderEffect, Component, computed, type ElementRef, input, output, signal, viewChild } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { date, dayMonth } from '@pretickt/components/format';
import { CONDITIONS, GROUPS, LIST_MAX, listOf, pillText, type ParamSpec } from '../../alerts/catalog';
import { chartOf, dollars, LABEL_X, PLOT_L, PLOT_R, type ChartData, type Tone } from '../../alerts/charts';
import { companiesIn } from '../../alerts/extract';
import { presets } from '../../alerts/presets';
import { condition, type RuleCondition } from '../../alerts/rule';
import type { AlertRow } from '../../alerts/rows';
import { MEGA_CAP, SECTORS } from '../../typologies/values';
import { PtAlertFind } from './find';

interface Part { text: string; key: string | null; spec: ParamSpec | null }
type NumberSpec = Extract<ParamSpec, { kind: 'number' }>;
type Member = Pick<AlertRow, 'ticker' | 'name' | 'logo' | 'marketCap'>;
/** a group of the universe the list adds or takes away whole: its companies, and how many of them are in */
interface ListGroup { name: string; tickers: string[]; state: 'all' | 'some' | 'none'; label: string }
const byCap = (a: Member, b: Member) => (b.marketCap ?? -1) - (a.marketCap ?? -1) || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0);
/** the list's groups by size (MEGA_CAP the mega caps' line, as the condition's) */
const SIZES: readonly (readonly [string, (cap: number) => boolean])[] = [
  ['Mega caps', (c) => c >= MEGA_CAP], ['Large caps', (c) => c >= 10e9 && c < MEGA_CAP], ['Mid caps', (c) => c < 10e9]];
/** a value on its step: 0.5 + 1 = 1.5, never 1.5000000000000002 */
const onStep = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed((String(step).split('.')[1] ?? '').length));
let uid = 0;

/**
 * One condition of an alert, as the editor shows it (version A, Romeo 2026-11-01 — mockup `condizioni-A.png`): its group, its title
 * with the example stock, the chart with the alert level dashed and the values on the right (the price target's classes), the
 * sentence whose pills change the values, and how many stocks pass today. Rendered in the browser only (the editor).
 */
@Component({
  selector: 'pt-alert-card',
  imports: [PtLogo, PtAlertFind],
  template: `
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
                @if (!l.now && !l.bare) {<line [attr.class]="'pt-lvl pt-lvl-' + tone(l.tone)" [attr.x1]="PLOT_L" [attr.x2]="PLOT_R + 8" [attr.y1]="l.y" [attr.y2]="l.y" />}
              }
              @for (b of m.bars; track $index) {
                <rect [attr.class]="'pt-al-bar-' + b.tone" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="2" />
                @if (b.label) {<text class="pt-al-ax" [attr.x]="b.x + b.w / 2" [attr.y]="m.h - 3" text-anchor="middle">{{ b.label }}</text>}
              }
              @if (m.line2) {<path class="pt-al-line2" [attr.d]="m.line2" />}
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
            <!-- the coming days (Romeo, 2026-11-02: visual): today on the left, the alert's window shaded, the report dated on the line -->
            <svg class="pt-al-viz" viewBox="0 0 300 56" role="img" [attr.aria-label]="sentence()">
              <rect class="pt-al-zone-pos" [attr.x]="dayX(0, m.span)" y="18" [attr.width]="dayX(m.limit, m.span) - dayX(0, m.span)" height="16" rx="3" />
              <line class="pt-lvl pt-lvl-flat" x1="16" x2="284" y1="26" y2="26" />
              @if (m.date && m.days !== null && m.days >= 0 && m.days <= m.span) {
                <circle class="pt-al-dot" [attr.cx]="dayX(m.days, m.span)" cy="26" r="4" />
                <text class="pt-lvl-n pt-lvl-n-now" [attr.x]="dayX(m.days, m.span)" y="11" [attr.text-anchor]="m.days > m.span * 0.8 ? 'end' : m.days < m.span * 0.2 ? 'start' : 'middle'">RESULTS {{ upper(dayMonth(m.date)) }}</text>
              }
              <text class="pt-al-ax" x="16" y="50">TODAY</text>
              <text class="pt-al-ax" x="284" y="50" text-anchor="end">IN {{ m.span }} DAYS</text>
            </svg>
            @if (!m.date || m.days === null || m.days < 0) {<p class="pt-al-fact">No earnings date announced yet</p>}
            @else if (m.days > m.span) {<p class="pt-al-fact">Results on {{ date(m.date) }}, in {{ m.days }} days</p>}
          }
          @case ('grade') {
            @if (m.dir) {
              <p class="pt-al-grade" [class.pt-al-grade-up]="m.dir === 'up'" [class.pt-al-grade-down]="m.dir === 'down'">
                <svg viewBox="0 0 12 12" aria-hidden="true"><path [attr.d]="m.dir === 'up' ? 'M6 1.5L11 10H1Z' : 'M6 10.5L11 2H1Z'" /></svg>
                <span><b>{{ m.dir === 'down' ? 'Downgraded' : 'Upgraded' }}</b> by {{ m.firm }}{{ m.date ? ' on ' + date(m.date) : '' }}</span></p>
            } @else {<p class="pt-al-fact">No upgrade or downgrade on its last session</p>}
          }
          @case ('flag') {
            <!-- the undervalued list's two tests, each passed or missed (Romeo, 2026-11-02: visual) -->
            <ul class="pt-al-crit">
              @let peOk = m.pe !== null && m.pe < 0;
              @let upOk = m.upside !== null && m.upside >= m.need;
              <li [class.pt-al-crit-ok]="peOk"><svg class="pt-al-mark" [class.pt-al-mark-on]="peOk" [class.pt-al-mark-off]="!peOk" viewBox="0 0 12 12" aria-hidden="true">
                <path [attr.d]="peOk ? CHECK : CROSS" /></svg>
                @if (m.pe === null) {No P/E against its sector} @else {P/E {{ whole(m.pe) }} {{ m.pe < 0 ? 'below' : 'above' }} its sector's median}</li>
              <li [class.pt-al-crit-ok]="upOk"><svg class="pt-al-mark" [class.pt-al-mark-on]="upOk" [class.pt-al-mark-off]="!upOk" viewBox="0 0 12 12" aria-hidden="true">
                <path [attr.d]="upOk ? CHECK : CROSS" /></svg>
                @if (m.upside === null) {No analyst target} @else {Average analyst target {{ whole(m.upside) }} {{ m.upside < 0 ? 'below' : 'above' }} the price, {{ whole(m.need) }} needed}</li>
            </ul>
          }
          @case ('logos') {
            @if (listOpen()) {
              <!-- the companies, editable (Romeo, 2026-11-02): by logo and symbol, a search, whole groups, a pasted portfolio -->
              <div class="pt-al-list" role="group" aria-label="The companies">
                <pt-alert-find [rows]="data().rows" [exclude]="memberTickers()" (picked)="addCompanies([$event])" />
                <div class="pt-al-chips">
                  @for (r of members(); track r.ticker) {
                    <span class="pt-al-chip"><pt-logo [ticker]="r.ticker" [src]="r.logo" [size]="16" /><b>{{ r.ticker }}</b>
                      <button type="button" [attr.aria-label]="'Remove ' + r.ticker" (click)="dropCompany(r.ticker)">×</button></span>
                  } @empty {<p class="pt-al-hint">No companies yet: add them by symbol, by group, or paste your portfolio.</p>}
                </div>
                @for (g of groups(); track g.title) {
                  <p class="pt-al-gt">{{ g.title }}</p>
                  <div class="pt-al-groups">
                    @for (x of g.items; track x.name) {
                      <button type="button" [class]="'pt-al-grp pt-al-grp-' + x.state" [attr.aria-pressed]="x.state === 'all'" (click)="toggleGroup(x)">
                        {{ x.name }} <span>{{ x.label }}</span></button>
                    }
                  </div>
                }
                @if (pasteOpen()) {
                  <textarea class="pt-al-paste" rows="3" placeholder="Paste your portfolio: symbols or company names, in any format"
                    aria-label="Paste a list of companies" [value]="pasteText()" (input)="pasteText.set(text($event))"></textarea>
                }
                <div class="pt-al-list-foot">
                  @if (pasteOpen()) {<button type="button" [disabled]="!pasteText().trim()" (click)="pasteAdd()">Add from text</button>}
                  @else {<button type="button" (click)="pasteChoice.set(true)">Paste a list</button>}
                  @if (note(); as n) {<span class="pt-al-note">{{ n }}</span>}
                  <button type="button" class="pt-al-done" (click)="closeList()">Done</button>
                </div>
              </div>
            } @else {
              <button type="button" class="pt-al-logos" aria-label="Edit the companies" (click)="openList()">
                @for (r of m.rows; track r.ticker) {<pt-logo [ticker]="r.ticker" [src]="r.logo" [size]="22" />}
                @if (m.more) {<span class="pt-al-more">+{{ m.more }}</span>}
                <span class="pt-al-logos-edit">Edit</span>
              </button>
            }
          }
        }
      } @else {<p class="pt-al-nodata">No data{{ example() ? ' for ' + example()!.ticker : '' }}</p>}
      <p class="pt-al-say">
        @for (part of parts(); track $index) {
          @if (part.key === null) {{{ part.text }}}
          @else if (part.key === open() && inline(); as s) {
            <!-- a percentage or a price is typed in place, with round values above and below (Romeo, 2026-11-02) -->
            <span class="pt-al-edit" [class.pt-al-closing]="shutting()" [attr.data-unit]="s.unit" (focusout)="leave($event)">
              <span class="pt-al-pre pt-al-pre-up">
                @for (v of shown()!.up; track v) {<button type="button" (pointerdown)="pick(v, $event)" (click)="pick(v)">{{ label(s, v) }}</button>}
              </span>
              <!-- − and + move it finely, the field staying open (Romeo, 2026-11-02) -->
              <button type="button" class="pt-al-nudge" aria-label="Less" [disabled]="!nudgeable(s, -1)"
                (pointerdown)="nudgeDown(-1, $event)" (click)="nudgeClick(-1)">−</button>
              @if (s.unit === 'price') {<span class="pt-al-unit">$</span>}
              <input #field class="pt-al-in" inputmode="decimal" autocomplete="off" [attr.aria-label]="s.unit === 'price' ? 'Price level' : 'Percentage'"
                [value]="raw()" [style.width]="fieldWidth()" (input)="typing.set(text($event))" (keydown.enter)="enter($event)" (keydown.escape)="escape($event)" />
              @if (s.unit === 'pct') {<span class="pt-al-unit">%</span>}
              <button type="button" class="pt-al-nudge" aria-label="More" [disabled]="!nudgeable(s, 1)"
                (pointerdown)="nudgeDown(1, $event)" (click)="nudgeClick(1)">+</button>
              <span class="pt-al-pre pt-al-pre-down">
                @for (v of shown()!.down; track v) {<button type="button" (pointerdown)="pick(v, $event)" (click)="pick(v)">{{ label(s, v) }}</button>}
              </span>
            </span>
          }
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
      @if (open() !== null && openSpec()?.kind === 'ticker') {
        <!-- One stock's symbol: the same search as a portfolio's, by keyboard too (Romeo, 2026-11-02) -->
        <pt-alert-find class="pt-al-one" [rows]="data().rows" label="Change the stock" placeholder="Symbol or name" [closeOnEscape]="true"
          [focus]="true" (picked)="chooseTicker($event)" (cancel)="open.set(null)" />
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
  /** the condition changed for another: a universe card edited company by company becomes the reader's own list */
  readonly replace = output<RuleCondition>();

  protected readonly open = signal<string | null>(null);
  protected readonly clip = `pt-al-clip-${++uid}`;

  protected readonly PLOT_L = PLOT_L;
  protected readonly PLOT_R = PLOT_R;
  protected readonly LABEL_X = LABEL_X;
  protected readonly SECTORS = SECTORS;
  /** the countdown's line: a day's x between 16 and 284 */
  protected dayX(d: number, span: number): number { return 16 + (Math.max(0, Math.min(d, span)) / span) * 268; }
  /** a fraction as a whole percent, without its sign: 0.224 → "22%" */
  protected whole(v: number): string { return `${Math.round(Math.abs(v) * 100)}%`; }
  protected upper(s: string): string { return s.toUpperCase(); }
  protected readonly dayMonth = dayMonth;
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
  /** the open percentage or price: typed in place, round values above and below; the other numbers (counts) keep − and + */
  protected readonly inline = computed<NumberSpec | null>(() => {
    const s = this.openSpec();
    return s?.kind === 'number' && (s.unit === 'pct' || s.unit === 'price') ? s : null;
  });
  protected readonly raw = computed(() => { const s = this.inline(); return s ? String(this.rc().p[s.key] ?? '') : ''; });
  /** what is in the field while it is typed (null: its value as it opened) */
  protected readonly typing = signal<string | null>(null);
  /** as wide as its number (the font is monospaced), growing as it is typed */
  protected readonly fieldWidth = computed(() => `${Math.max(1, (this.typing() ?? this.raw()).length) + 0.4}ch`);
  /** the number in the field: what is typed, else the condition's; null while it is not one */
  private readonly fieldNumber = computed(() => {
    const t = (this.typing() ?? this.raw()).replace(/[\s$%,]/g, ''), v = Number(t);
    return t && Number.isFinite(v) ? v : null;
  });
  /** the field's pieces fading out: it closes once they are gone */
  protected readonly shutting = signal(false);
  private shutAt = 0;
  /** a press of − or + already acted on its pointerdown: its click is the same press */
  private pressed = false;
  /** the field's round values: the farther on top above it, the nearer first below */
  protected readonly shown = computed(() => {
    const s = this.inline();
    if (!s) return null;
    const p = presets(s, Number(this.rc().p[s.key]));
    return { up: [...p.up].reverse(), down: p.down };
  });
  protected readonly stepper = computed(() => {
    const s = this.openSpec();
    if (!s || s.kind !== 'number' || this.inline()) return null;
    const v = Number(this.rc().p[s.key]);
    return { text: pillText(s, v), down: v - s.step >= s.min - 1e-9, up: v + s.step <= s.max + 1e-9 };
  });
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  /** a universe card's list: null until the reader opens or closes it (an empty portfolio opens on its own) */
  private readonly listChoice = signal<boolean | null>(null);
  protected readonly listOpen = computed(() => this.listChoice() ?? (this.rc().c === 'companies' && !listOf(this.rc().p).length));
  protected readonly pasteText = signal('');
  protected readonly pasteChoice = signal<boolean | null>(null);
  protected readonly note = signal<string | null>(null);
  /** the companies a universe card covers, the largest first: a portfolio's symbols the universe lacks stay as bare symbols */
  protected readonly members = computed<Member[]>(() => {
    const rc = this.rc(), def = this.def(), rows = this.data().rows;
    if (def.group !== 'universe') return [];
    if (rc.c !== 'companies') return rows.filter((r) => def.test(r, rc.p).pass).sort(byCap);
    const by = new Map(rows.map((r) => [r.ticker, r]));
    return listOf(rc.p).map((t) => by.get(t) ?? { ticker: t, name: t, logo: null, marketCap: null }).sort(byCap);
  });
  /** the paste box shows on an empty list, or when asked for */
  protected readonly pasteOpen = computed(() => this.pasteChoice() ?? !this.members().length);
  /** the list's symbols: the search offers the others */
  protected readonly memberTickers = computed(() => this.members().map((m) => m.ticker));
  /** the universe by size and by sector: each group added or taken away whole, with how many of it are in */
  protected readonly groups = computed(() => {
    const rows = this.data().rows, have = new Set(this.members().map((m) => m.ticker));
    const view = (name: string, of: AlertRow[]): ListGroup => {
      const n = of.filter((r) => have.has(r.ticker)).length;
      return { name, tickers: [...of].sort(byCap).map((r) => r.ticker), state: n === 0 ? 'none' : n === of.length ? 'all' : 'some',
        label: n && n < of.length ? `${n}/${of.length}` : `${of.length}` };
    };
    return [
      { title: 'By size', items: SIZES.map(([name, f]) => view(name, rows.filter((r) => r.marketCap !== null && f(r.marketCap)))).filter((g) => g.tickers.length) },
      { title: 'By sector', items: SECTORS.map((s) => view(s, rows.filter((r) => r.sector === s))).filter((g) => g.tickers.length) },
    ];
  });

  constructor() {
    // the field opens focused, its value selected: typing replaces it
    afterRenderEffect(() => { const f = this.field()?.nativeElement; if (f) { f.focus(); f.select(); } });
  }

  protected tone(t: Tone): string { return t === 'ink' ? 'flat' : t; }
  protected readonly dollars = dollars;
  protected rangeX(v: number, m: { low: number; high: number }): number {
    const f = m.high > m.low ? (v - m.low) / (m.high - m.low) : 0.5;
    return 16 + Math.max(0, Math.min(1, f)) * 268;
  }

  /** A choice moves to its next option; a percentage or a price becomes its field; a count opens − and +; a sector the list; a ticker a field. */
  protected press(part: Part): void {
    const s = part.spec;
    if (!s || !part.key) return;
    if (s.kind === 'choice') {
      const i = s.options.findIndex(([o]) => o === String(this.rc().p[part.key!]));
      this.change.emit({ key: part.key, value: s.options[(i + 1) % s.options.length]![0] });
      return;
    }
    if (s.kind === 'tickers') { if (this.listOpen()) this.closeList(); else this.openList(); return; }
    this.typing.set(null);
    this.shutAt++;                                                       // a close on its way gives in to the pill just pressed
    this.shutting.set(false);
    this.open.set(this.open() === part.key ? null : part.key);
  }

  protected text(e: Event): string { return (e.target as HTMLInputElement).value; }

  protected step(dir: 1 | -1): void {
    const s = this.openSpec();
    if (!s || s.kind !== 'number') return;
    const v = Number(this.rc().p[s.key]) + dir * s.step;
    if (v < s.min - 1e-9 || v > s.max + 1e-9) return;
    this.change.emit({ key: s.key, value: onStep(v, s.step) });
  }

  protected label(s: NumberSpec, v: number): string { return pillText(s, v); }

  protected openList(): void { this.listChoice.set(true); this.note.set(null); }
  protected closeList(): void { this.listChoice.set(false); this.note.set(null); this.pasteChoice.set(null); }
  /** The list as it now is: a portfolio's own param; any other universe card becomes the reader's portfolio with it. */
  private commitList(tickers: string[]): void {
    if (tickers.length > LIST_MAX) this.note.set(`${LIST_MAX} companies at most`);
    this.listChoice.set(true);
    const value = tickers.slice(0, LIST_MAX).join(',');
    if (this.rc().c === 'companies') this.change.emit({ key: 'tickers', value });
    else this.replace.emit(condition('companies', { tickers: value }));
  }
  protected dropCompany(ticker: string): void { this.commitList(this.members().map((m) => m.ticker).filter((t) => t !== ticker)); }
  /** Companies after those already in, in the order given; how many were new. */
  protected addCompanies(tickers: string[]): number {
    const have = this.members().map((m) => m.ticker), add = tickers.filter((t) => !have.includes(t));
    if (add.length) this.commitList([...have, ...add]);
    return add.length;
  }
  /** A group all in goes away whole; otherwise what of it is missing comes in. */
  protected toggleGroup(g: ListGroup): void {
    if (g.state === 'all') this.commitList(this.members().map((m) => m.ticker).filter((t) => !g.tickers.includes(t)));
    else this.addCompanies(g.tickers);
  }
  /** The companies a pasted text names (My portfolio): added after the list's, and how many came in. */
  protected pasteAdd(): void {
    this.note.set(null);
    const named = companiesIn(this.pasteText(), this.data().rows), n = this.addCompanies(named);
    if (n) this.pasteText.set('');
    // the list's limit, when it cut the paste, is the note to read
    if (!this.note()) this.note.set(n ? `${n} ${n === 1 ? 'company' : 'companies'} added` : named.length ? 'Already in the list' : 'No company found in the text');
  }

  /** What was typed in the field ($ and % allowed), on its step (a price to the cent), within its limits; null when it is not one. */
  private typedValue(raw: string): number | null {
    const s = this.inline(), t = raw.replace(/[\s$%,]/g, ''), v = Number(t);
    if (!s || !t || !Number.isFinite(v) || v < s.min || v > s.max) return null;
    return s.unit === 'price' ? Math.round(v * 100) / 100 : onStep(v, s.step);
  }
  /** The field closes on a value: a change only when it differs. */
  private settle(v: number | null): void {
    const s = this.inline();
    this.shut();
    if (s && v !== null && v !== Number(this.rc().p[s.key])) this.change.emit({ key: s.key, value: v });
  }
  /** The field closes after its pieces' quick fade-out (120 ms; at once for a reader who asked for less motion). */
  private shut(): void {
    const k = ++this.shutAt;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) { this.open.set(null); return; }
    this.shutting.set(true);
    setTimeout(() => { if (k === this.shutAt) { this.shutting.set(false); this.open.set(null); } }, 120);
  }
  /** an open field that is not on its way out */
  private live(): NumberSpec | null { return this.shutting() ? null : this.inline(); }

  /** A round value: pressed, it is picked before the field can lose its focus (the keyboard's Enter comes as a click). */
  protected pick(v: number, e?: Event): void {
    e?.preventDefault();
    if (this.live()) this.settle(v);
  }
  /** Enter keeps a typed value; one that is not a value stays in the field, selected. */
  protected enter(e: Event): void {
    const f = e.target as HTMLInputElement, v = this.typedValue(f.value);
    if (!this.live()) return;
    if (v === null) f.select();
    else this.settle(v);
  }
  /** Escape leaves the value as it was, and goes no further: on the page it would close the editor. */
  protected escape(e: Event): void {
    e.stopPropagation();
    if (this.live()) this.shut();
  }
  /** Leaving the field (not for one of its round values) keeps what was typed, when it is a value. */
  protected leave(e: FocusEvent): void {
    const box = e.currentTarget as HTMLElement, to = e.relatedTarget as Node | null;
    if (!this.live() || (to && box.contains(to))) return;
    this.settle(this.typedValue(box.querySelector('input')?.value ?? ''));
  }

  /** A fine step: a percentage's own; a price's about a thousandth of it, at a round step (a cent at least). */
  private fine(s: NumberSpec, v: number): number {
    return s.unit === 'price' ? Math.max(0.01, 10 ** (Math.floor(Math.log10(Math.max(v, 0.01))) - 2)) : s.step;
  }
  private nudged(s: NumberSpec, v: number, dir: 1 | -1): number {
    const step = this.fine(s, v);
    return s.unit === 'price' ? Math.round((Math.round(v / step) * step + dir * step) * 100) / 100 : onStep(v + dir * step, s.step);
  }
  protected nudgeable(s: NumberSpec, dir: 1 | -1): boolean {
    const v = this.fieldNumber();
    if (v === null) return false;
    const next = this.nudged(s, v, dir);
    return next >= s.min - 1e-9 && next <= s.max + 1e-9;
  }
  /** − or +: the field's number a fine step on, shown at once; the condition follows, and the field stays open. */
  private nudge(dir: 1 | -1): void {
    const s = this.live(), v = this.fieldNumber();
    if (!s || v === null || !this.nudgeable(s, dir)) return;
    const next = this.nudged(s, v, dir), f = this.field()?.nativeElement;
    this.typing.set(String(next));
    if (f) f.value = String(next);
    if (next !== Number(this.rc().p[s.key])) this.change.emit({ key: s.key, value: next });
  }
  /** pressed with a pointer: at once, the field keeping its focus (no leave) */
  protected nudgeDown(dir: 1 | -1, e: Event): void { e.preventDefault(); this.pressed = true; this.nudge(dir); }
  /** a click: the keyboard's, or the same press as its pointerdown */
  protected nudgeClick(dir: 1 | -1): void { if (this.pressed) { this.pressed = false; return; } this.nudge(dir); }

  protected choose(sector: string): void {
    const s = this.openSpec();
    if (!s) return;
    this.change.emit({ key: s.key, value: sector });
    this.open.set(null);
  }

  /** One stock's search: the company taken is the stock. */
  protected chooseTicker(ticker: string): void {
    const s = this.openSpec();
    if (!s) return;
    this.change.emit({ key: s.key, value: ticker });
    this.open.set(null);
  }
}

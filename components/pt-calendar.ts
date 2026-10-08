/**
 * Which companies report earnings (or go ex-dividend) this month — or in the coming week — and which market-wide dates (Fed, CPI,
 * jobs) fall around them?
 * @version 2.4.0
 * @evidence DataForSEO: "earnings calendar" ~153k searches/month, SERP without AI overview (reports/Funzioni pretickt da tenere e aggiungere.md)
 * @evidence DataForSEO: "dividend calendar" in launch/data/08c-serp-dividend-calendar.json
 * @evidence beta: events-calendar month grid (pretickt-frontend/src/app/home/events-calendar.ts); stockanalysis.com earnings calendar
 */
import { afterRenderEffect, Component, computed, type ElementRef, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtLogo } from '@pretickt/components/ds';
import { amount, date, num, stockHref, tip } from '@pretickt/components/format';
import { CALENDAR_MONTHS, type EventItem } from '@pretickt/components/typologies';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const list = m.get(k); if (list) list.push(v); else m.set(k, [v]); };

export const addDays = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = weekday;

/** The Monday of the week of `d` (a Monday stays itself). */
export const mondayOf = (d: string): string => addDays(d, -((weekday(d) + 6) % 7));
const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
/** Whether `month` lies in the calendar window around the latest session's month (the API refuses outside it). */
export const inWindow = (month: string, asOf: string): boolean => {
  const off = monthIndex(month) - monthIndex(asOf);
  return off >= -CALENDAR_MONTHS.back && off <= CALENDAR_MONTHS.ahead;
};

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return iso(y!, m! - 1 + delta, 1).slice(0, 7);
}

type Company = Exclude<EventItem, { kind: 'macro' }>;
type Macro = Extract<EventItem, { kind: 'macro' }>;
/** Unknown future kinds may lack a ticker: those are skipped rather than breaking the page. */
const isCompany = (e: EventItem): e is Company => e.kind !== 'macro' && typeof (e as { ticker?: unknown }).ticker === 'string';
export interface Cell { date: string; day: number; inMonth: boolean; isAsOf: boolean; items: Company[]; macro: Macro[] }

/** Monday-first weeks for `month`; `asOf` (latest session) is highlighted instead of a clock-based "today". */
export function buildMonth(month: string, items: EventItem[], asOf: string) {
  const [y, m] = month.split('-').map(Number);
  const m0 = m! - 1;
  const byDay = new Map<string, Company[]>();
  const macroByDay = new Map<string, Macro[]>();
  for (const e of items) {
    if (e.kind === 'macro') push(macroByDay, e.date, e);
    else if (isCompany(e)) push(byDay, e.date, e);
  }
  const lead = (new Date(Date.UTC(y!, m0, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y!, m0 + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  const cells: Cell[] = Array.from({ length: total }, (_, i) => {
    const date = iso(y!, m0, 1 - lead + i);
    return { date, day: Number(date.slice(8)), inMonth: date.slice(0, 7) === month, isAsOf: date === asOf, items: byDay.get(date) ?? [], macro: macroByDay.get(date) ?? [] };
  });
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, label: `${MONTHS[m0]} ${y}`, weeks };
}

/** The five sessions (Mon–Fri) of the week starting `start`, with their events. */
export function buildWeek(start: string, items: EventItem[], asOf: string): Cell[] {
  return Array.from({ length: 5 }, (_, i) => {
    const date = addDays(start, i);
    const day = items.filter((e) => e.date === date);
    return { date, day: Number(date.slice(8)), inMonth: true, isAsOf: date === asOf, items: day.filter(isCompany), macro: day.filter((e): e is Macro => e.kind === 'macro') };
  });
}
export { isCompany };

type Kind = 'earnings' | 'dividend';
const CAP = 4;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const time = (e: EventItem) => (e.kind === 'earnings' && e.meta.time ? e.meta.time.toUpperCase() : '');
/** Short per-event suffix: report time for earnings, cash amount for dividends. */
const tag = (e: EventItem) => (e.kind === 'dividend' ? amount(e.meta.amount) : time(e));
const macroTip = (e: Macro) => tip({ [e.meta.label]: e.meta.event, Date: date(e.date), Impact: e.meta.impact });
const chipTip = (e: Company) => tip({
  [e.ticker]: e.name, Date: date(e.date), Time: time(e) || null,
  'EPS est.': e.kind === 'earnings' && e.meta.epsEst != null ? num(e.meta.epsEst) : null,
  ...(e.kind === 'dividend' ? { Dividend: amount(e.meta.amount), 'Pay date': e.meta.payDate ? date(e.meta.payDate) : null } : {}),
});
type DatesScope = { scope: { by: 'dates'; from: string; to: string } };
type MonthScope = { scope: { by: 'universe'; month: string } };

/**
 * `month`: the month grid with every report listed below it. `week`: five sessions (Mon–Fri) starting at `start` — the home page
 * passes the coming week, from the market calendar; without it, the first week of `month`. What it names (the month, the week)
 * changes with its data, never before.
 */
@Component({
  selector: 'pt-calendar',
  imports: [PtLogo],
  template: `
    @if (data() === null) {<p class="pt-na">Data not available</p>}
    @else if (data()) {
      <section class="pt-cal" [class.pt-busy]="loading()">
        <div class="pt-head">
          @if (isWeek()) {
            <h3 class="pt-section-title">Week of {{ date(shownWeek()) }}</h3>
            <div class="pt-cal-nav">
              <button type="button" [disabled]="!canGo().back" (click)="goWeek(-1)">← Previous week</button>
              <button type="button" [disabled]="!canGo().on" (click)="goWeek(1)">Next week →</button>
            </div>
          } @else {
            <h2 class="pt-section-title">{{ cal().label }}</h2>
            <div class="pt-cal-nav">
              <button type="button" [disabled]="!canGo().back" (click)="go(prev())">← {{ prev() }}</button>
              <button type="button" [disabled]="!canGo().on" (click)="go(next())">{{ next() }} →</button>
            </div>
          }
        </div>
        <div [class]="isWeek() ? 'pt-cal-grid pt-cal-week' : 'pt-cal-grid'">
          @if (isWeek()) {@for (c of week(); track c.date; let i = $index) {<div class="pt-cal-dow">{{ DOW[i] }} {{ c.day }}</div>}}
          @else {@for (d of DOW; track d) {<div class="pt-cal-dow">{{ d }}</div>}}
          @for (c of cells(); track c.date) {
            <div [class]="dayClass(c)">
              @if (!isWeek()) {<div>{{ c.day }}</div>}
              @for (e of c.macro; track $index) {<div class="pt-cal-macro" [attr.data-tip]="macroTip(e)">{{ e.meta.label }}</div>}
              @for (e of c.items.slice(0, CAP); track e.kind + e.ticker) {
                <a class="pt-cal-ev" [href]="stockHref(e.ticker)" [attr.data-tip]="chipTip(e)"><span class="pt-cal-who"><pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="14" />{{ e.ticker }}</span><span class="pt-cal-time">{{ tag(e) }}</span></a>
              }
              @if (c.items.length > CAP) {<button type="button" class="pt-cal-more" (click)="more(c.date, $event)">+{{ c.items.length - CAP }} more</button>}
            </div>
          }
        </div>
        @if (openCell(); as oc) {
          <div class="pt-cal-backdrop" (click)="close()"></div>
          <div #pop class="pt-cal-pop" [style.left.px]="popAt().left" [style.top.px]="popAt().top" role="dialog"
            [attr.aria-label]="'Events on ' + date(oc.date)" tabindex="-1" (keydown.escape)="close()">
            <div class="pt-cal-pop-head"><span>{{ DOW[(weekdayOf(oc.date) + 6) % 7] }}</span> <b>{{ oc.day }}</b><button type="button" class="pt-cal-pop-x" aria-label="Close" (click)="close()">×</button></div>
            @for (e of oc.macro; track $index) {<div class="pt-cal-macro" [attr.data-tip]="macroTip(e)">{{ e.meta.label }}</div>}
            @for (e of oc.items; track e.kind + e.ticker) {
              <a class="pt-cal-ev" [href]="stockHref(e.ticker)" [attr.data-tip]="chipTip(e)"><span class="pt-cal-who"><pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="14" />{{ e.ticker }}</span><span class="pt-cal-time">{{ tag(e) }}</span></a>
            }
          </div>
        }
        @if (isWeek()) {
          @if (!hasCompanies()) {<p class="pt-lede">No {{ kind() === 'dividend' ? 'ex-dividend dates' : 'earnings reports' }} scheduled in the week of {{ date(shownWeek()) }} in the tracked universe yet.</p>}
        } @else if (listed().length) {
          <ol class="pt-cal-list">
            @for (c of listed(); track c.date) {
              <li><span class="pt-cal-list-day">{{ date(c.date) }}</span>@for (e of entries(c); track $index; let i = $index) {<ng-container>{{ i ? ', ' : ' ' }}</ng-container>@if (e.kind === 'macro') {<strong>{{ e.meta.label }}</strong> ({{ e.meta.event }})} @else {<a class="pt-co" [href]="stockHref(e.ticker)"><pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="16" />{{ e.name }} ({{ e.ticker }}){{ tag(e) ? ' ' + tag(e) : '' }}</a>}}</li>
            }
          </ol>
        } @else {<p class="pt-lede">No {{ kind() === 'dividend' ? 'ex-dividend dates' : 'earnings reports' }} scheduled for {{ cal().label }} in the tracked universe yet.</p>}
      </section>
    }`,
})
export class PtCalendar {
  private readonly pt = inject(Pt);
  readonly month = input.required<string>();
  readonly kind = input<Kind>('earnings');
  readonly view = input<'month' | 'week'>('month');
  readonly start = input<string>();

  protected readonly isWeek = computed(() => this.view() === 'week');
  private readonly kinds = computed(() => [this.kind(), 'macro'] as ['earnings' | 'dividend', 'macro']);
  /** The month (or week) the reader asked for; what is on screen follows the data (`params()` of the answer shown). */
  private readonly pickedMonth = linkedSignal(() => this.month());
  private readonly pickedWeek = linkedSignal(() => {
    const s = this.start();
    return mondayOf(s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : `${this.month()}-01`);
  });
  private readonly monthEvents = this.pt.events(() => (this.isWeek() ? null : { scope: { by: 'universe', month: this.pickedMonth() }, kinds: this.kinds() }));
  private readonly weekEvents = this.pt.events(() => (this.isWeek() ? { scope: { by: 'dates', from: this.pickedWeek(), to: addDays(this.pickedWeek(), 4) }, kinds: this.kinds() } : null));
  protected readonly data = computed(() => (this.isWeek() ? this.weekEvents.value() : this.monthEvents.value()));
  protected readonly loading = computed(() => (this.isWeek() ? this.weekEvents.loading() : this.monthEvents.loading()));
  protected readonly shownMonth = computed(() => (this.monthEvents.params() as MonthScope | undefined)?.scope.month ?? this.pickedMonth());
  protected readonly shownWeek = computed(() => (this.weekEvents.params() as DatesScope | undefined)?.scope.from ?? this.pickedWeek());

  protected readonly CAP = CAP;
  protected readonly DOW = DOW;
  protected readonly date = date;
  protected readonly stockHref = stockHref;
  protected readonly tag = tag;
  protected readonly macroTip = macroTip;
  protected readonly chipTip = chipTip;
  protected readonly weekdayOf = weekdayOf;

  private readonly weekItems = computed(() => (this.weekEvents.value()?.items ?? []).filter((e) => e.kind === 'macro' || e.kind === this.kind()));
  protected readonly week = computed(() => (this.isWeek() ? buildWeek(this.shownWeek(), this.weekItems(), this.weekEvents.value()?.asOf ?? '') : []));
  protected readonly hasCompanies = computed(() => this.weekItems().some(isCompany));
  protected readonly cal = computed(() => {
    const m = this.shownMonth();
    const items = (this.monthEvents.value()?.items ?? []).filter((e) => e.date.startsWith(m) && (e.kind === 'macro' || (isCompany(e) && e.kind === this.kind())));
    return buildMonth(m, items, this.monthEvents.value()?.asOf ?? '');
  });
  protected readonly cells = computed(() => (this.isWeek() ? this.week() : this.cal().weeks.flat()));
  protected readonly prev = computed(() => shiftMonth(this.shownMonth(), -1));
  protected readonly next = computed(() => shiftMonth(this.shownMonth(), 1));
  /** The latest session, which fixes the window the arrows may reach. */
  private readonly asOf = computed(() => this.data()?.asOf ?? '');
  protected readonly canGo = computed(() => this.isWeek()
    ? { back: inWindow(addDays(this.shownWeek(), -7).slice(0, 7), this.asOf()), on: inWindow(addDays(this.shownWeek(), 11).slice(0, 7), this.asOf()) }
    : { back: inWindow(shiftMonth(this.shownMonth(), -1), this.asOf()), on: inWindow(shiftMonth(this.shownMonth(), 1), this.asOf()) });
  // the full list, from the same day groups as the grid: nothing hides behind the cap
  protected readonly listed = computed(() => this.cal().weeks.flat().filter((c) => c.inMonth && (c.macro.length || c.items.length)));
  protected entries = (c: Cell): EventItem[] => [...c.macro, ...c.items];
  protected dayClass = (c: Cell) => `pt-cal-day${c.inMonth ? '' : ' pt-cal-out'}${c.isAsOf ? ' pt-cal-asof' : ''}`;

  protected go(m: string) { this.close(); this.pickedMonth.set(m); this.monthEvents.retry(); }
  protected goWeek(delta: number) { this.close(); this.pickedWeek.set(addDays(this.shownWeek(), 7 * delta)); this.weekEvents.retry(); }

  // "+N more": the whole day over its cell (as Google Calendar), outside the grid so nothing clips it; ×, Escape or a click outside close it
  private readonly openDay = signal<string | null>(null);
  protected readonly popAt = signal({ left: 0, top: 0 });
  private readonly pop = viewChild<ElementRef<HTMLElement>>('pop');
  private opener: HTMLElement | null = null;
  private cellLeft = 0;
  private boxWidth = 0;
  protected readonly openCell = computed(() => this.cells().find((c) => c.date === this.openDay()) ?? null);

  constructor() {
    // once it is drawn, keep it inside the calendar with its real width (whatever the font size), and give it the focus
    afterRenderEffect(() => {
      const el = this.pop()?.nativeElement;
      if (!el || !this.openDay()) return;
      const left = Math.max(0, Math.min(this.cellLeft, this.boxWidth - el.offsetWidth));
      if (left !== this.popAt().left) this.popAt.update((p) => ({ ...p, left }));
      el.focus();
    });
  }

  protected more(d: string, e: Event) {
    this.opener = e.currentTarget as HTMLElement;
    const cell = this.opener.closest('.pt-cal-day');
    const box = cell?.closest('.pt-cal');
    if (cell && box) {
      const c = cell.getBoundingClientRect(), b = box.getBoundingClientRect();
      this.cellLeft = c.left - b.left;
      this.boxWidth = b.width;
      this.popAt.set({ left: this.cellLeft, top: c.top - b.top });
    }
    this.openDay.set(d);
  }
  /** Closes the day box and gives the focus back to the "+N more" that opened it. */
  protected close() {
    if (!this.openDay()) return;
    this.openDay.set(null);
    this.opener?.focus();
  }
}

/**
 * Which companies report earnings (or go ex-dividend) this month — or in the coming week — which market-wide dates (Fed, CPI,
 * jobs) fall around them, and what to expect from each?
 * The grid gives the days (on a computer; a phone has no room for it). Under it a row per event, the market's dates first, then the
 * companies still to report, the largest first, then those already reported (Romeo, 2026-10-31: "una riga per azienda, prima le più
 * importanti, con logo e insight probabili"). Beyond the date, a row answers what people ask of a calendar: what is expected and how
 * the price reacts — before a report the stock's usual move the session after one (the last 8, at least 4) and its record against the
 * EPS estimate, after it the verdict and the move against that usual size; for a Fed, CPI or jobs date the figure expected and the
 * market's (SPY) usual move on its releases. How big, not which way: past reactions do not say where the next one goes (FORECAST.md).
 * A row opens to its sentence (the company a link that opens its card), the estimates and the news about the event, all in the page's
 * HTML. The outlook fields are events@1.2's, optional: without them a row says the date and the EPS estimate, nothing made up.
 * On a month, every date stays in the list by day under the rows. The grid's grey cells, the days of the months around it that share
 * its weeks, show their events too (Romeo, 2026-11-02: "non vedo i passati di ottobre nelle celle grigie"); rows and list are the month's.
 * With `view: 'day'` and `start`, a day: its week's grid with the day marked, and the day's rows first, every one, then the rest of the
 * week (Romeo, 2026-11-11, on the earnings-today page: "le aziende di oggi per prime, non la settimana per dimensione").
 * The grid marks the reader's day, the session after the latest close: the data is the last close's and the page is read the day after
 * (Romeo, 2026-11-11: "perché evidenzia il 10 novembre se oggi è 11?"); on a day view, the day.
 * @version 3.2.1
 * @evidence DataForSEO: "earnings calendar" ~153k searches/month, SERP without AI overview (reports/Funzioni pretickt da tenere e aggiungere.md)
 * @evidence DataForSEO: "dividend calendar" in launch/data/08c-serp-dividend-calendar.json
 * @evidence DataForSEO round 14 (2026-10-31, launch/data/14-summary.json): beyond the date, "who is expected to beat earnings this week?" (AI 574), "is it better to buy before or after earnings?" (357), "fed rate decision" 40,500, "important earnings this week" 590
 * @evidence beta: events-calendar month grid (pretickt-frontend/src/app/home/events-calendar.ts); stockanalysis.com earnings calendar
 */
import { afterRenderEffect, Component, computed, type ElementRef, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { MORE_STEP, PtLogo, PtMention, PtMore, PtSay } from '@pretickt/components/ds';
import { amount, date, dayMonth, href, level, mention, money, named, num, pct, plainName, say, tip, tone, usd, type Said, type Tone }
  from '@pretickt/components/format';
import { CALENDAR_MONTHS, cmp, type EventItem } from '@pretickt/components/typologies';

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
export interface Cell { date: string; day: number; inMonth: boolean; marked: boolean; items: Company[]; macro: Macro[] }

/** Monday-first weeks for `month`; `mark` is the day to highlight (the reader's day, from the data's date: no clock). */
export function buildMonth(month: string, items: EventItem[], mark: string) {
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
    return { date, day: Number(date.slice(8)), inMonth: date.slice(0, 7) === month, marked: date === mark, items: byDay.get(date) ?? [], macro: macroByDay.get(date) ?? [] };
  });
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, label: `${MONTHS[m0]} ${y}`, weeks };
}

/** The five sessions (Mon–Fri) of the week starting `start`, with their events. */
export function buildWeek(start: string, items: EventItem[], mark: string): Cell[] {
  return Array.from({ length: 5 }, (_, i) => {
    const date = addDays(start, i);
    const day = items.filter((e) => e.date === date);
    return { date, day: Number(date.slice(8)), inMonth: true, marked: date === mark, items: day.filter(isCompany), macro: day.filter((e): e is Macro => e.kind === 'macro') };
  });
}
export { isCompany };

type Kind = 'earnings' | 'dividend';
const CAP = 4;
/** The rows a week shows at first (the home page: a glance); a month shows MORE_STEP. */
const WEEK_ROWS = 10;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const time = (e: EventItem) => (e.kind === 'earnings' && e.meta.time ? e.meta.time.toUpperCase() : '');
/** The provider's own flag: true = the company set the date, false = still an estimate, absent = not known (older data). */
const status = (e: EventItem) => (e.kind !== 'earnings' || e.meta.confirmed == null ? null : e.meta.confirmed ? 'Confirmed by the company' : 'Estimated date');
/** Short per-event suffix: report time for earnings (a leading ~ when the date is still an estimate), cash amount for dividends. */
const tag = (e: EventItem) => (e.kind === 'dividend' ? amount(e.meta.amount) : `${e.kind === 'earnings' && e.meta.confirmed === false ? '~' : ''}${time(e)}`);
const macroTip = (e: Macro) => tip({ [e.meta.label]: e.meta.event, Date: date(e.date), Impact: e.meta.impact });
const chipTip = (e: Company) => tip({
  [e.ticker]: plainName(e.name), Date: date(e.date), Time: e.kind === 'earnings' && e.meta.time ? TIME[e.meta.time] : null, Status: status(e),
  'EPS est.': e.kind === 'earnings' && e.meta.epsEst != null ? num(e.meta.epsEst) : null,
  ...(e.kind === 'dividend' ? { Dividend: amount(e.meta.amount), 'Pay date': e.meta.payDate ? date(e.meta.payDate) : null } : {}),
});
type Earnings = Extract<EventItem, { kind: 'earnings' }>;
type Dividend = Extract<EventItem, { kind: 'dividend' }>;
type Story = NonNullable<Earnings['meta']['news']>[number];

/** The usual move needs this many past ones of the last eight (the nightly feed's rule). */
const REPORTS = 8, MIN_REPORTS = 4, SURPRISE = 0.02;
/** The usual size of the move: the mean absolute move of the last eight, null with fewer than four. */
export function usualMove(moves: readonly number[] | null | undefined): number | null {
  const last = (moves ?? []).slice(-REPORTS);
  return last.length >= MIN_REPORTS ? last.reduce((s, m) => s + Math.abs(m), 0) / last.length : null;
}
/** EPS against the estimate: a beat or a miss beyond 2% of it, in line within (a loss estimate reads on its size). */
export function verdictOf(actual: number | null, est: number | null): 'beat' | 'inline' | 'miss' | null {
  if (actual == null || est == null) return null;
  const s = est === 0 ? actual : (actual - est) / Math.abs(est);
  return s > SURPRISE ? 'beat' : s < -SURPRISE ? 'miss' : 'inline';
}
const verdictPhrase = (actual: number, est: number) => {
  const v = verdictOf(actual, est)!;
  return v === 'inline' ? 'in line' : `a ${v} (${pct(est === 0 ? 0 : (actual - est) / Math.abs(est), 0)})`;
};
/** A ratio to one decimal ("2.4×"); one that would round to "0.0×" reads "under 0.1×". */
const times = (v: number) => (v < 0.05 ? 'under 0.1×' : `${num(v, 1)}×`);
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = (d: string) => `${WEEKDAY[weekday(d)]}, ${dayMonth(d)}`;
const TIME = { bmo: 'before the open', amc: 'after the close' } as const;
/** The next session after `d`: a weekday the market is open (the calendar's own "Closed" dates are its holidays). */
const closedDays = (items: EventItem[]): Set<string> => new Set(items.filter((e): e is Macro => e.kind === 'macro' && e.meta.label === 'Closed').map((e) => e.date));
function nextSession(d: string, closed: ReadonlySet<string>): string {
  let x = addDays(d, 1);
  while (weekday(x) % 6 === 0 || closed.has(x)) x = addDays(x, 1);
  return x;
}
/** The session that trades a report: its own before the open, the next one after the close; unknown without a time. */
const reactsOn = (e: Earnings, closed: ReadonlySet<string>) => (e.meta.time === 'bmo' ? e.date : e.meta.time === 'amc' ? nextSession(e.date, closed) : null);

/**
 * A market date as a row names it beside its label (not "CPI CPI report"), as the list by day names it (the words people search) and as
 * a sentence does; an unknown label keeps the release's own name.
 */
const MACRO_NAMES: Record<string, [row: string, list: string, sentence: string]> = {
  Fed: ['Rate decision', 'Fed rate decision', 'The Fed\'s rate decision'], FOMC: ['Meeting minutes', 'FOMC minutes', 'The FOMC minutes'],
  CPI: ['Consumer prices', 'CPI report', 'The CPI report'], PCE: ['Inflation', 'PCE report', 'The PCE report'],
  Jobs: ['Payrolls', 'Jobs report', 'The jobs report'], GDP: ['Growth', 'GDP report', 'The GDP report'],
};
/** A market date in the list by day: the report's name ("CPI report"), a holiday as the market closed. */
export const listName = (m: Macro) => MACRO_NAMES[m.meta.label]?.[1] ?? (m.meta.label === 'Closed' ? `Market closed: ${m.meta.event}` : `${m.meta.label}: ${firstRelease(m)}`);
const firstRelease = (m: Macro) => m.meta.event.split(' · ')[0]!;
/** A headline figure in its unit, with the decimals it came with ("2.9%", "120K"); the Fed's rate always with two ("3.50%"). */
function figure(v: number, unit: string | null, label: string): string {
  const digits = label === 'Fed' ? 2 : Math.min(2, (String(v).split('.')[1] ?? '').length);
  return `${num(v, digits)}${unit ?? ''}`;
}
/** The Fed's move: what the rate became against the one before ("cut to 3.50%"), or what is expected of it. */
function fedChange(to: number, from: number | null, f: (v: number) => string, expected: boolean): string {
  if (from == null) return `${expected ? 'a rate of ' : 'set at '}${f(to)}`;
  if (to === from) return `held at ${f(to)}`;
  return `${to < from ? (expected ? 'a cut to' : 'cut to') : expected ? 'a hike to' : 'raised to'} ${f(to)}`;
}
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Its last eight moves as small bars around zero, in their tones: how big and which way, at a glance (none with fewer than four).
 * Romeo tried thumbs for beats and misses instead, then: "le barrette restano, erano meglio".
 */
export function miniBars(moves: readonly number[] | null | undefined): { w: number; bars: { x: number; y: number; h: number; tone: Tone }[] } | null {
  const last = (moves ?? []).slice(-REPORTS);
  if (last.length < MIN_REPORTS) return null;
  const max = Math.max(...last.map(Math.abs), 1e-9);
  return { w: last.length * 6 - 2, bars: last.map((v, i) => { const h = Math.max(1.5, (Math.abs(v) / max) * 10); return { x: i * 6, y: v >= 0 ? 11 - h : 11, h, tone: tone(v) }; }) };
}

/** An event's key: its row's, which its chip in the grid opens. */
export const rowKey = (e: EventItem): string => (e.kind === 'macro' ? `macro:${e.meta.label}:${e.date}` : `${e.kind}:${isCompany(e) ? e.ticker : ''}:${e.date}`);

/** A row: everything it prints, as text, and the sentence (in parts: the company a link) its detail opens to. */
export interface Row {
  key: string; out: boolean;
  /** A market date's label (Fed, CPI…); a company's row has its logo instead. */
  label: string | null; title: string; ticker: string | null; logo: string | null; showTicker: boolean; unconfirmed: boolean;
  cue: string; cueTone: Tone | 'est'; when: string; hint: string; bars: ReturnType<typeof miniBars>;
  said: Said; facts: string; news: Story[];
}

function earningsRow(e: Earnings, asOf: string, closed: ReadonlySet<string>): Row {
  const m = e.meta, out = e.date <= asOf, moved = out ? m.move ?? null : null, moves = (m.moves ?? []).slice(-REPORTS);
  const u = usualMove(moves), n = moves.length, t = m.time ? TIME[m.time] : null, on = reactsOn(e, closed), usual = u == null ? null : `±${level(u)}`;
  const record = m.record && m.record.of >= MIN_REPORTS ? m.record : null;
  const who = mention(e.ticker, e.name, e.logo), name = plainName(e.name);
  let when: string, hint: string, said: Said, facts: string;
  if (out) {
    const pending = moved == null && on != null && on > asOf;
    when = `Reported ${dayLabel(e.date)}${t ? ` · ${t}` : ''}${pending ? ` · reacts ${WEEKDAY[weekday(on!)]}` : ''}`;
    const eps = m.epsActual != null && m.epsEst != null ? verdictPhrase(m.epsActual, m.epsEst) : '';
    hint = upper([eps, moved != null && u != null ? `${times(Math.abs(moved) / u)} its usual` : ''].filter(Boolean).join(' · '));
    const fig = eps ? `: EPS ${money(m.epsActual)} vs ${money(m.epsEst)} expected, ${eps}` : '';
    said = moved != null
      ? say`${who} reported ${dayLabel(e.date)}${t ? `, ${t}` : ''}${fig}. The stock moved ${pct(moved)} in the session that traded it${u != null ? `, ${times(Math.abs(moved) / u)} its usual ${usual}` : ''}.`
      : say`${who} reported ${dayLabel(e.date)}${t ? `, ${t}` : ''}${fig}${pending ? `; the stock reacts ${dayLabel(on!)}` : ''}.${usual ? ` Its usual move after a report: ${usual}.` : ''}`;
    facts = m.revActual != null && m.revEst != null ? `Revenue ${usd(m.revActual, { compact: true })} vs ${usd(m.revEst, { compact: true })} expected` : '';
  } else {
    when = m.confirmed === false ? `Around ${dayLabel(e.date)}${t ? ` · ${t}` : ''} · not confirmed`
      : `${dayLabel(e.date)}${t ? ` · ${t}` : ''}${on && on !== e.date ? ` · reacts ${WEEKDAY[weekday(on)]}` : ''}`;
    const ups = moves.filter((v) => v > 0).length;
    hint = u == null ? (m.epsEst != null ? `EPS est. ${money(m.epsEst)}` : '')
      : upper([record ? `beat ${record.beats} of ${record.of}` : '', `rose after ${ups} of ${n}`].filter(Boolean).join(' · '));
    const tail = (usual ? ` In the session after each of its last ${n} reports it moved ${usual} on average.` : '') +
      (record ? ` It beat the EPS estimate in ${record.beats} of its last ${record.of} reports.` : '') +
      (u == null && m.epsEst != null ? ` The EPS estimate is ${money(m.epsEst)}.` : '');
    said = m.confirmed === false
      ? say`${who} is expected to report around ${dayLabel(e.date)} (date not confirmed)${t ? `, ${t}` : ''}.${tail}`
      : say`${who} reports ${dayLabel(e.date)}${m.confirmed ? ' (confirmed)' : ''}${t ? `, ${t}` : ''}${on ? `; the stock reacts ${on === e.date ? 'the same day' : dayLabel(on)}` : ''}.${tail}`;
    facts = [u != null && m.epsEst != null ? `EPS est. ${money(m.epsEst)}` : '', m.revEst != null ? `revenue est. ${usd(m.revEst, { compact: true })}` : '']
      .filter(Boolean).join(' · ');
    if (facts) facts = upper(facts);
  }
  return { key: rowKey(e), out, label: null, title: name, ticker: e.ticker, logo: e.logo, showTicker: named(e.name, e.ticker) !== name,
    unconfirmed: !out && m.confirmed === false, cue: moved != null ? pct(moved) : usual ?? '', cueTone: moved != null ? tone(moved) : 'est',
    when, hint, bars: miniBars(moves), said, facts, news: m.news ?? [] };
}

function macroRow(e: Macro, asOf: string, normal: number | null): Row {
  const m = e.meta, out = e.date <= asOf, u = usualMove(m.moves), n = Math.min(REPORTS, m.moves?.length ?? 0), moved = out ? m.move ?? null : null;
  const h = m.headline ?? null, f = (v: number) => figure(v, h?.unit ?? null, m.label), fed = m.label === 'Fed';
  const [title, , noun] = MACRO_NAMES[m.label] ?? [firstRelease(e), '', firstRelease(e)];
  const vs = (actual: number) => (h?.expected == null ? '' : fed ? (actual === h.expected ? ', as expected' : `, ${f(h.expected)} expected`) : ` vs ${f(h.expected)} expected`);
  let hint = '', said: string;
  if (out) {
    const fig = h?.actual == null ? '' : fed ? fedChange(h.actual, h.previous, f, false) + vs(h.actual) : `${f(h.actual)}${vs(h.actual)}`;
    hint = upper(fig);
    said = `${noun} came out ${dayLabel(e.date)}${fig ? `: ${fig}${!fed && h?.previous != null ? ` (previous ${f(h.previous)})` : ''}` : ''}.` +
      (moved != null ? ` The market (SPY) moved ${pct(moved)} that session${normal ? `, ${times(Math.abs(moved) / normal)} a normal day` : ''}.` : '');
  } else {
    const exp = h?.expected == null ? '' : fed ? `${fedChange(h.expected, h.previous, f, true)}${h.previous != null && h.previous !== h.expected ? ` (from ${f(h.previous)})` : ''}`
      : `${f(h.expected)}${h.previous != null ? ` (previous ${f(h.previous)})` : ''}`;
    hint = !exp ? '' : fed ? `Expected: ${exp}` : `Expected ${f(h!.expected!)}${h!.previous != null ? ` · previous ${f(h!.previous)}` : ''}`;
    said = `${noun} is due ${dayLabel(e.date)}${exp ? `: expected ${exp}` : ''}.` +
      (u != null ? ` On its last ${n} ${fed ? 'decisions' : 'releases'} the market (SPY) moved ±${level(u)} on average${normal ? `, ${times(u / normal)} a normal day` : ''}.` : '');
  }
  return { key: rowKey(e), out, label: m.label, title, ticker: null, logo: null, showTicker: false, unconfirmed: false,
    cue: moved != null ? pct(moved) : u == null ? '' : `±${level(u)}`, cueTone: moved != null ? tone(moved) : 'est',
    when: `${out ? 'Released' : 'Due'} ${dayLabel(e.date)}`, hint, bars: miniBars(m.moves), said: [said], facts: '', news: m.news ?? [] };
}

function dividendRow(e: Dividend, asOf: string): Row {
  const out = e.date <= asOf, who = mention(e.ticker, e.name, e.logo), name = plainName(e.name), pay = e.meta.payDate;
  // the pay date comes after the ex-date: "payable" until it has passed
  const paid = pay ? `${pay <= asOf ? 'paid' : 'payable'} ${dayMonth(pay)}` : null;
  return { key: rowKey(e), out, label: null, title: name, ticker: e.ticker, logo: e.logo, showTicker: named(e.name, e.ticker) !== name,
    unconfirmed: false, cue: amount(e.meta.amount), cueTone: 'est', when: `Ex-dividend ${dayLabel(e.date)}`, hint: paid ? upper(paid) : '', bars: null,
    said: say`${who} ${out ? 'went' : 'goes'} ex-dividend ${dayLabel(e.date)}: ${amount(e.meta.amount)} a share${paid ? `, ${paid}` : ''}.`, facts: '', news: [] };
}

/**
 * The rows in their order: the market's dates first (an earnings calendar only, holidays aside: they move every stock), then the
 * companies by market value; those still ahead before those already out (`asOf`, the latest session, and before it).
 */
export function calendarRows(items: EventItem[], kind: Kind, asOf: string, normal: number | null): Row[] {
  const closed = closedDays(items);
  const mine = items.filter((e) => (e.kind === 'macro' ? kind === 'earnings' && e.meta.label !== 'Closed' : isCompany(e) && e.kind === kind));
  const size = (e: EventItem) => (e.kind === 'macro' ? Infinity : e.mcap ?? 0);
  const order = (a: EventItem, b: EventItem) => size(b) - size(a) || cmp(a.date, b.date) || cmp(isCompany(a) ? a.ticker : '', isCompany(b) ? b.ticker : '');
  const row = (e: EventItem) => (e.kind === 'macro' ? macroRow(e, asOf, normal) : e.kind === 'earnings' ? earningsRow(e, asOf, closed) : dividendRow(e as Dividend, asOf));
  return [...mine.filter((e) => e.date > asOf).sort(order), ...mine.filter((e) => e.date <= asOf).sort(order)].map(row);
}
const LEGEND = '± is the usual move the session after a report (for a Fed, CPI or jobs date, the market’s, SPY): how big, not which way. The bars: the last 8.';

type DatesScope = { scope: { by: 'dates'; from: string; to: string } };
type MonthScope = { scope: { by: 'universe'; month: string } };

/**
 * `month`: the month grid, its rows (twenty at first) and every date listed by day below them. `week`: five sessions (Mon–Fri)
 * starting at `start` and their rows (ten at first) — the home page passes the coming week, from the market calendar; without it,
 * the first week of `month`. What it names (the month, the week) changes with its data, never before.
 */
@Component({
  selector: 'pt-calendar',
  imports: [PtLogo, PtMention, PtMore, PtSay],
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
              @for (e of c.macro; track $index) {
                @let row = rowOf(e);
                @if (row) {<button type="button" class="pt-cal-macro" [attr.data-tip]="macroTip(e)" (click)="openEvent(e, $event)"><span>{{ e.meta.label }}</span><span [class]="chipCue(row)">{{ row.cue }}</span></button>}
                @else {<div class="pt-cal-macro" [attr.data-tip]="macroTip(e)">{{ e.meta.label }}</div>}
              }
              @for (e of c.items.slice(0, CAP); track e.kind + e.ticker) {
                @let row = rowOf(e);
                <button type="button" class="pt-cal-ev" [class.pt-cal-ev-unconf]="row?.unconfirmed" [attr.data-card]="e.ticker" [attr.data-tip]="chipTip(e)" (click)="openEvent(e, $event)">
                  <span class="pt-cal-who"><pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="14" />{{ e.ticker }}@if (row?.unconfirmed) {<span class="pt-sr"> (date not confirmed)</span>}</span>
                  <span [class]="chipCue(row)">{{ row?.cue ?? '' }}</span>
                </button>
              }
              @if (c.items.length > CAP) {<button type="button" class="pt-cal-more" (click)="more(c.date, $event)">+{{ c.items.length - CAP }}<span class="pt-cal-more-word"> more</span></button>}
            </div>
          }
        </div>
        @if (openCell(); as oc) {
          <div class="pt-cal-backdrop" (click)="close()"></div>
          <div #pop [class]="openRow() ? 'pt-cal-pop pt-cal-pop-ev' : 'pt-cal-pop'" [style.left.px]="popAt().left" [style.top.px]="popAt().top" role="dialog"
            [attr.aria-label]="(openRow()?.title ?? 'Events') + ' on ' + date(oc.date)" tabindex="-1" (keydown.escape)="close()">
            <div class="pt-cal-pop-head"><span>{{ DOW[(weekdayOf(oc.date) + 6) % 7] }}</span> <b>{{ oc.day }}</b><button type="button" class="pt-cal-pop-x" aria-label="Close" (click)="close()">×</button></div>
            @if (openRow(); as open) {
              <!-- the event's summary card (its row, its sentence and news), the company's usual card under it (the page fills the slot) -->
              @for (r of [open]; track r.key) {
                <div class="pt-cal-sum">
                <div class="pt-cal-pop-row">
                @if (r.label) {<span class="pt-cal-row-label">{{ r.label }}</span><span class="pt-cal-row-who"><b>{{ r.title }}</b></span>}
                @else {
                  <pt-logo [ticker]="r.ticker!" [src]="r.logo" [size]="32" />
                  <span class="pt-cal-row-who">@if (r.showTicker) {<b>{{ r.title }}</b>{{ ' ' }}<span class="pt-cal-row-t">{{ r.ticker }}</span>} @else {<b>{{ r.title }}</b>}</span>
                }
                <b [class]="'pt-cal-row-cue ' + (r.cueTone === 'est' ? 'pt-cal-row-est' : 'pt-t-' + r.cueTone)">{{ r.cue }}</b>
                <span class="pt-cal-row-when">{{ r.when }}</span>
                @if (r.bars; as mb) {
                  <svg class="pt-cal-row-bars" [attr.viewBox]="'0 0 ' + mb.w + ' 22'" [attr.width]="mb.w" height="22" aria-hidden="true">
                    <line x1="0" [attr.x2]="mb.w" y1="11" y2="11" />
                    @for (b of mb.bars; track $index) {<rect [attr.x]="b.x" [attr.y]="b.y" width="4" [attr.height]="b.h" rx="1" [class]="'pt-t-' + b.tone" />}
                  </svg>
                }
                <span class="pt-cal-row-hint">{{ r.hint }}</span>
                </div>
                <div class="pt-cal-row-more">
                <p class="pt-cal-row-say"><pt-say [parts]="r.said" /></p>
                @if (r.facts) {<p class="pt-meta">{{ r.facts }}</p>}
                @if (r.news.length) {
                  <ul class="pt-news">
                    @for (s of r.news; track s.url) {
                      <li class="pt-news-item"><div>@if (s.tag) {<span class="pt-cal-row-tag">{{ s.tag }}</span>{{ ' ' }}}<a [href]="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a><div class="pt-meta">{{ s.site }} · {{ dayMonth(s.publishedAt) }}</div></div></li>
                    }
                  </ul>
                }
                </div>
                </div>
                @if (r.ticker) {<div class="pt-cal-pop-card" [attr.data-card-slot]="r.ticker"></div>}
              }
            } @else {
              @for (e of oc.macro; track $index) {
                @let row = rowOf(e);
                @if (row) {<button type="button" class="pt-cal-macro" [attr.data-tip]="macroTip(e)" (click)="openEvent(e, $event)"><span>{{ e.meta.label }}</span><span [class]="chipCue(row)">{{ row.cue }}</span></button>}
                @else {<div class="pt-cal-macro" [attr.data-tip]="macroTip(e)">{{ e.meta.label }}</div>}
              }
              @for (e of oc.items; track e.kind + e.ticker) {
                @let row = rowOf(e);
                <button type="button" class="pt-cal-ev" [class.pt-cal-ev-unconf]="row?.unconfirmed" [attr.data-card]="e.ticker" [attr.data-tip]="chipTip(e)" (click)="openEvent(e, $event)">
                  <span class="pt-cal-who"><pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="14" />{{ e.ticker }}@if (row?.unconfirmed) {<span class="pt-sr"> (date not confirmed)</span>}</span>
                  <span [class]="chipCue(row)">{{ row?.cue ?? '' }}</span>
                </button>
              }
            }
          </div>
        }
        @if (rows().length) {
          <div class="pt-cal-rows-head">
            @if (isWeek()) {<h4 class="pt-cal-rows-title">{{ rowsTitle() }}</h4>} @else {<h3 class="pt-cal-rows-title">{{ rowsTitle() }}</h3>}
            @if (hasOutlook()) {<p class="pt-meta">{{ LEGEND }}</p>}
          </div>
          <ol class="pt-cal-rows">
            @for (row of visible(); track row.key; let i = $index) {
              @if (i === dayCount() && i) {<li class="pt-cal-rows-sep">The rest of the week</li>}
              @if (i === firstOut()) {<li class="pt-cal-rows-sep">{{ kind() === 'dividend' ? 'Already ex-dividend' : 'Already reported' }}</li>}
              <li>
                <details class="pt-cal-row" [class.pt-cal-row-unconf]="row.unconfirmed" (toggle)="opened($event)">
                  <summary>
                    @if (row.label) {<span class="pt-cal-row-label">{{ row.label }}</span><span class="pt-cal-row-who"><b>{{ row.title }}</b></span>}
                    @else {
                      <pt-logo [ticker]="row.ticker!" [src]="row.logo" [size]="32" />
                      <span class="pt-cal-row-who">@if (row.showTicker) {<b>{{ row.title }}</b>{{ ' ' }}<span class="pt-cal-row-t" [attr.data-card]="row.ticker">{{ row.ticker }}</span>} @else {<b [attr.data-card]="row.ticker">{{ row.title }}</b>}</span>
                    }
                    <b [class]="'pt-cal-row-cue ' + (row.cueTone === 'est' ? 'pt-cal-row-est' : 'pt-t-' + row.cueTone)">{{ row.cue }}</b>
                    <span class="pt-cal-row-when">{{ row.when }}</span>
                    @if (row.bars; as mb) {
                      <svg class="pt-cal-row-bars" [attr.viewBox]="'0 0 ' + mb.w + ' 22'" [attr.width]="mb.w" height="22" aria-hidden="true">
                        <line x1="0" [attr.x2]="mb.w" y1="11" y2="11" />
                        @for (b of mb.bars; track $index) {<rect [attr.x]="b.x" [attr.y]="b.y" width="4" [attr.height]="b.h" rx="1" [class]="'pt-t-' + b.tone" />}
                      </svg>
                    }
                    <span class="pt-cal-row-hint">{{ row.hint }}</span>
                  </summary>
                  <div class="pt-cal-row-more">
                    <p class="pt-cal-row-say"><pt-say [parts]="row.said" /></p>
                    @if (row.facts) {<p class="pt-meta">{{ row.facts }}</p>}
                    @if (row.news.length) {
                      <ul class="pt-news">
                        @for (s of row.news; track s.url) {
                          <li class="pt-news-item"><div>@if (s.tag) {<span class="pt-cal-row-tag">{{ s.tag }}</span>{{ ' ' }}}<a [href]="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a><div class="pt-meta">{{ s.site }} · {{ dayMonth(s.publishedAt) }}</div></div></li>
                        }
                      </ul>
                    }
                  </div>
                </details>
              </li>
            }
          </ol>
          @if (hasMore()) {<pt-more [step]="moreCount()" (more)="showMore()" />}
        }
        @if (isWeek()) {
          @if (!hasCompanies()) {<p class="pt-lede">No {{ kind() === 'dividend' ? 'ex-dividend dates' : 'earnings reports' }} scheduled in the week of {{ date(shownWeek()) }} in the tracked universe yet.</p>}
        } @else if (listed().length) {
          <h3 class="pt-cal-list-title">Every date in {{ cal().label }}, by day</h3>
          <ol class="pt-cal-list">
            @for (c of listed(); track c.date) {
              <li><span class="pt-cal-list-day">{{ date(c.date) }}</span>@for (e of entries(c); track $index; let i = $index) {<ng-container>{{ i ? ', ' : ' ' }}</ng-container>@if (e.kind === 'macro') {<strong>{{ listName(e) }}</strong>} @else {<a ptMention [ticker]="e.ticker" [name]="e.name" [logo]="e.logo"></a>{{ tag(e) ? ' ' + tag(e) : '' }}}}</li>
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
  readonly view = input<'month' | 'week' | 'day'>('month');
  readonly start = input<string>();

  /** A week's five sessions: the week view, and the day view (its week, the day first in the rows). */
  protected readonly isWeek = computed(() => this.view() !== 'month');
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
  protected readonly tag = tag;
  protected readonly macroTip = macroTip;
  protected readonly chipTip = chipTip;
  protected readonly weekdayOf = weekdayOf;
  protected readonly LEGEND = LEGEND;
  protected readonly listName = listName;
  protected readonly href = href;
  protected readonly dayMonth = dayMonth;

  /**
   * The reader's day: the session after the latest close (`asOf`), as the pages that place the calendar count it (the home's week,
   * /earnings-today/). The holidays are the answer's own "Closed" dates, so a week view does not see a closed Friday in the week before
   * the one on screen: over that long weekend the next week has no cell marked (a month has the Friday in its grid, and marks Monday).
   */
  private readonly today = computed(() => {
    const d = this.data();
    return d?.asOf ? nextSession(d.asOf, closedDays(d.items)) : '';
  });
  private readonly weekItems = computed(() => (this.weekEvents.value()?.items ?? []).filter((e) => e.kind === 'macro' || e.kind === this.kind()));
  protected readonly week = computed(() => (this.isWeek() ? buildWeek(this.shownWeek(), this.weekItems(), this.today()) : []));
  protected readonly hasCompanies = computed(() => this.weekItems().some(isCompany));
  protected readonly cal = computed(() => {
    const m = this.shownMonth();
    // the grid's every day (events@1.3 answers a month with its weeks): the grey cells show the months around it too
    const items = (this.monthEvents.value()?.items ?? []).filter((e) => e.kind === 'macro' || (isCompany(e) && e.kind === this.kind()));
    return buildMonth(m, items, this.today());
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

  /** A row for every event in the grid, grey cells included (their closed days place a report's reacting session across a month end). */
  private readonly gridRows = computed(() => {
    const d = this.data();
    return calendarRows(this.cells().flatMap((c) => [...c.macro, ...c.items]), this.kind(), d?.asOf ?? '', d?.normal ?? null);
  });
  /** The rows of the days shown (the month's, the week's), in their order; a month's twenty at first, a week's ten, then twenty more. */
  protected readonly rows = computed(() => {
    const mine = new Set(this.cells().filter((c) => c.inMonth).flatMap((c) => [...c.macro, ...c.items]).map(rowKey));
    const rows = this.gridRows().filter((r) => mine.has(r.key)), day = this.dayKeys();
    // a day view: the day's rows first, in their order, then the rest of the week in its own
    return day.size ? [...rows.filter((r) => day.has(r.key)), ...rows.filter((r) => !day.has(r.key))] : rows;
  });
  /** A day view's day (`start`), while its week is the one on screen; null on a week, a month, or once the reader moved to another week. */
  private readonly day = computed(() => {
    const s = this.start();
    return this.view() === 'day' && s && /^\d{4}-\d{2}-\d{2}$/.test(s) && mondayOf(s) === this.shownWeek() ? s : null;
  });
  private readonly dayKeys = computed(() => {
    const d = this.day();
    return new Set(d ? this.week().filter((c) => c.date === d).flatMap((c) => [...c.macro, ...c.items]).map(rowKey) : []);
  });
  /** How many rows are the day's (they come first): 0 outside a day view, or on a day with nothing. */
  protected readonly dayCount = computed(() => this.rows().filter((r) => this.dayKeys().has(r.key)).length);
  // a day shows every row of its own, however many
  private readonly shown = linkedSignal({ source: () => this.rows(), computation: (): number => (this.isWeek() ? Math.max(WEEK_ROWS, this.dayCount()) : MORE_STEP) });
  protected readonly visible = computed(() => this.rows().slice(0, this.shown()));
  /** Some row has a usual move (its last moves, four at least): the legend says what ± and the bars are. */
  protected readonly hasOutlook = computed(() => this.rows().some((r) => r.bars !== null));
  // "Already reported" opens the rows already out; under a day's rows, those of the rest of the week
  protected readonly firstOut = computed(() => this.visible().findIndex((r, i) => i >= this.dayCount() && r.out));
  protected readonly hasMore = computed(() => this.rows().length > this.shown());
  protected readonly moreCount = computed(() => Math.min(MORE_STEP, this.rows().length - this.shown()));
  protected showMore() { this.shown.update((n) => n + MORE_STEP); }
  /** Each row by its key: a chip in the grid carries its row's number and opens it — a grey cell's chip too, though the rows are the month's. */
  private readonly rowsByKey = computed(() => new Map(this.gridRows().map((r) => [r.key, r])));
  protected rowOf = (e: EventItem): Row | null => this.rowsByKey().get(rowKey(e)) ?? null;
  protected chipCue = (r: Row | null) => `pt-cal-cue${r && r.cueTone !== 'est' ? ` pt-t-${r.cueTone}` : ''}`;
  protected readonly rowsTitle = computed(() => {
    const d = this.day();
    if (d && this.dayCount()) return `${this.kind() === 'dividend' ? 'Ex-dividend dates' : 'Earnings and economic data'} on ${dayLabel(d)}`;
    const what = this.kind() === 'dividend' ? 'The largest ex-dividend dates' : 'Important earnings and economic data';
    return this.isWeek() ? `${what}, week of ${dayMonth(this.shownWeek())}` : `${what} in ${this.cal().label}`;
  });
  /** Opening a row is an interaction the page counts. */
  protected opened(e: Event) {
    const d = e.target as HTMLDetailsElement;
    if (d.open) d.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'open' } }));
  }
  // the marked cell: the reader's day; on a day view, the day
  protected dayClass = (c: Cell) => `pt-cal-day${c.inMonth ? '' : ' pt-cal-out'}${(this.day() ? c.date === this.day() : c.marked) ? ' pt-cal-asof' : ''}`;

  protected go(m: string) { this.close(); this.pickedMonth.set(m); this.monthEvents.retry(); }
  protected goWeek(delta: number) { this.close(); this.pickedWeek.set(addDays(this.shownWeek(), 7 * delta)); this.weekEvents.retry(); }

  // "+N more": the whole day over its cell (as Google Calendar), outside the grid so nothing clips it; a chip: its event in the same
  // box, as its row opens, with the company's card under it. ×, Escape or a click outside close it
  private readonly openDay = signal<string | null>(null);
  private readonly openKey = signal<string | null>(null);
  protected readonly openRow = computed(() => { const k = this.openKey(); return k ? this.rowsByKey().get(k) ?? null : null; });
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
      this.openKey(); // an event in the box is wider than its day: place it again
      if (!el || !this.openDay()) return;
      const left = Math.max(0, Math.min(this.cellLeft, this.boxWidth - el.offsetWidth));
      if (left !== this.popAt().left) this.popAt.update((p) => ({ ...p, left }));
      el.focus();
    });
  }

  protected more(d: string, e: Event) {
    this.anchor(e.currentTarget as HTMLElement);
    this.openKey.set(null);
    this.openDay.set(d);
  }
  /** A chip opens its event over its cell; inside a day's box, in the same box. Opening it is an interaction the page counts. */
  protected openEvent(e: EventItem, ev: Event) {
    const t = ev.currentTarget as HTMLElement;
    if (!t.closest('.pt-cal-pop')) this.anchor(t);
    this.openDay.set(e.date);
    this.openKey.set(rowKey(e));
    t.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'open' } }));
  }
  /** The box goes over the cell of what opened it, which gets the focus back when it closes. */
  private anchor(t: HTMLElement) {
    this.opener = t;
    const cell = t.closest('.pt-cal-day'), box = cell?.closest('.pt-cal');
    if (!cell || !box) return;
    const c = cell.getBoundingClientRect(), b = box.getBoundingClientRect();
    this.cellLeft = c.left - b.left;
    this.boxWidth = b.width;
    this.popAt.set({ left: this.cellLeft, top: c.top - b.top });
  }
  /** Closes the box and gives the focus back to what opened it (a chip, "+N more"). */
  protected close() {
    if (!this.openDay()) return;
    this.openDay.set(null);
    this.openKey.set(null);
    this.opener?.focus();
  }
}

/**
 * DRAFT · The earnings calendar with each event's possible outcome (made-up data, stories only). Before a report its row carries one
 * number, in one of four variants: the stock's usual move after a report (±%), that move in market value (±$), its record against the
 * EPS estimate (7/8 beat) or the price range the usual move spans ($lo–hi); after it, what happened. Hovering or focusing a row opens
 * a card above it with the detail (the last eight reactions, the bar to clear, the run into the report, which session trades it) and
 * what others expect: the analysts' average target and how many raised or cut it in 30 days, how its peers reacted this season,
 * Polymarket's odds where a market trades $5K or more (not live before Polymarket agrees in writing: its terms bar data use by
 * financial technology companies and market data distributors otherwise). The agenda under the grid opens the same card in place, which is how a phone reads it.
 * BMO/AMC stay out of the row: the card says it in words, with the session that reacts. A macro date (Fed, CPI, jobs…) carries the market's (SPY) usual move on
 * its releases. Past reactions say how big a move has been, not which way the next one goes (FORECAST.md: direction did not hold up).
 * The numbers are the nightly feed's (typical move: the last 8 reports, at least 4); until a typology carries them, the payload is an input.
 * In the words people search (DataForSEO, 2026-10-28: they search the date — "{company} earnings date", "earnings calendar this week",
 * "earnings today" — and the AIs fetch the usual move after a report from small sites with a reactions table): the week is titled
 * "Earnings calendar this week", the agenda's days "Earnings today" and "Earnings tomorrow" with their date (the page is built after
 * the close and read in the next session), and every agenda row is a sentence in the page — the date, confirmed or not, the session
 * that reacts, the usual move — with a link that says where it goes ("Microsoft earnings date"). What others expect is said in
 * sentences too, and the Polymarket line says what its chance is. A date not yet confirmed is dotted in the grid.
 * @version 0.0.3
 */
import { Component, computed, input, signal } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { dayMonth, level, money, num, pct, stockHref, tone, usd, type Tone } from '@pretickt/components/format';
import { addDays, mondayOf, weekdayOf } from '../pt-calendar';

export type OutlookVariant = 'move' | 'dollars' | 'record' | 'range';
export type Verdict = 'beat' | 'inline' | 'miss';
/** A past report: the move of the session that traded it, and its EPS against the estimate. */
export interface Reaction { date: string; move: number; verdict: Verdict | null }
/** Analysts' price targets: the average, how many analysts, how many raised or cut theirs in the last 30 days. */
export interface Analysts { target: number; n: number; raised: number; cut: number }
/** A peer's report this season and the move of the session that traded it. */
export interface PeerMove { ticker: string; date: string; move: number }
/** A prediction market's price for one outcome (Polymarket) and the dollars traded on it. */
export interface Odds { what: string; p: number; volume: number }
export interface CoEvent {
  kind: 'earnings'; date: string; ticker: string; name: string; logo: string | null; time: 'bmo' | 'amc' | null; confirmed: boolean | null;
  /** The last close and market value before the report. */
  price: number | null; mcap: number | null;
  /** The reports before this one, oldest first. */
  reactions: Reaction[];
  epsEst: number | null; epsYearAgo: number | null; revEst: number | null; revYearAgo: number | null;
  /** The stock's and the market's (SPY) return over the 20 sessions before the report. */
  runup: number | null; marketRunup: number | null;
  /** Reported: its figures, and the move once a session has traded them (null on the evening of an after-the-close report). */
  result: { move: number | null; epsActual: number | null; revActual: number | null } | null;
  analysts: Analysts | null; peers: PeerMove[]; odds: Odds | null;
}
export interface MacroEvent {
  kind: 'macro'; date: string; label: string; event: string;
  /** The market's (SPY) move on the past releases of the same kind, oldest first. */
  moves: { date: string; move: number }[];
  expected: string | null; previous: string | null;
  result: { move: number | null; actual: string | null } | null;
  odds: Odds | null;
}
export type OutlookEvent = CoEvent | MacroEvent;
/** `normal`: the market's (SPY) usual daily move, to size a macro date against an ordinary session. */
export interface CalOutlook { asOf: string; from: string; to: string; normal: number | null; items: OutlookEvent[] }

const REPORTS = 8, MIN_REPORTS = 4, SURPRISE = 0.02, CAP = 4;
/** What others expect is shown only with enough of it: analysts, peers that reported, dollars traded on the odds. */
const MIN_ANALYSTS = 3, MIN_PEERS = 2, MIN_VOLUME = 5_000, PEERS_NAMED = 3;

/** The usual size of the move: the mean absolute move of the last eight, null with fewer than four (the nightly feed's rule). */
export function usualMove(moves: readonly number[]): number | null {
  const last = moves.slice(-REPORTS);
  return last.length >= MIN_REPORTS ? last.reduce((s, m) => s + Math.abs(m), 0) / last.length : null;
}
const pastMoves = (e: OutlookEvent) => (e.kind === 'macro' ? e.moves.map((m) => m.move) : e.reactions.map((r) => r.move));
export const usualOf = (e: OutlookEvent) => usualMove(pastMoves(e));
/** The traded outcome, once a session has priced the release. */
const moved = (e: OutlookEvent) => e.result?.move ?? null;

/** EPS against the estimate: a beat or a miss beyond 2% of it, in line within (the feed's band; a loss estimate reads on its size). */
export function verdictOf(actual: number | null, est: number | null): Verdict | null {
  if (actual == null || est == null) return null;
  const s = est === 0 ? actual : (actual - est) / Math.abs(est);
  return s > SURPRISE ? 'beat' : s < -SURPRISE ? 'miss' : 'inline';
}
/** The last eight reports: how many beat the estimate (of those with a verdict), how many the stock rose after. */
export function record(rs: readonly Reaction[]) {
  const last = rs.slice(-REPORTS), known = last.filter((r) => r.verdict != null);
  return { n: last.length, known: known.length, beats: known.filter((r) => r.verdict === 'beat').length, ups: last.filter((r) => r.move > 0).length };
}
/** Where the price lands if it moves its usual size, either way. */
export const priceRange = (price: number | null, usual: number | null): [number, number] | null =>
  price == null || usual == null ? null : [price * (1 - usual), price * (1 + usual)];
const priceDigits = (p: number) => (p >= 100 ? 0 : p >= 10 ? 1 : 2);
export const rangeText = ([lo, hi]: [number, number]) => `$${num(lo, priceDigits(lo))}–${num(hi, priceDigits(lo))}`;
const times = (v: number) => `${num(v, 1)}×`;

/** `est`: an outlook (no direction to colour). */
export interface Cue { text: string; tone: Tone | 'est' }
const VERDICT: Record<Verdict, [string, Tone]> = { beat: ['Beat', 'pos'], inline: ['In line', 'flat'], miss: ['Miss', 'neg'] };
const outcome = (m: number): Cue => ({ text: pct(m), tone: tone(m) });

/** The number in a row: the outlook before the event, the outcome after it ('' when the history is too short to say). */
export function cue(e: OutlookEvent, variant: OutlookVariant): Cue {
  const m = moved(e), u = usualOf(e);
  if (e.kind === 'macro') return m != null ? outcome(m) : { text: u == null ? '' : `±${level(u)}`, tone: 'est' };
  if (variant === 'record') {
    const v = e.result ? verdictOf(e.result.epsActual, e.epsEst) : null;
    if (v) return { text: VERDICT[v][0], tone: VERDICT[v][1] };
    if (m != null) return outcome(m);
    const r = record(e.reactions);
    return { text: r.known >= MIN_REPORTS ? `${r.beats}/${r.known} beat` : '', tone: 'est' };
  }
  if (variant === 'dollars') {
    if (m != null) return e.mcap == null ? outcome(m) : { text: usd(e.mcap * m, { compact: true, signed: true }), tone: tone(m) };
    return { text: u == null || e.mcap == null ? '' : `±${usd(e.mcap * u, { compact: true })}`, tone: 'est' };
  }
  if (m != null) return outcome(m);
  if (variant === 'range') {
    const r = priceRange(e.price, u);
    return { text: r ? rangeText(r) : '', tone: 'est' };
  }
  return { text: u == null ? '' : `±${level(u)}`, tone: 'est' };
}

export interface Bar { x: number; y: number; h: number; tone: Tone; now: boolean; verdict: Verdict | null }
export const BAR_W = 12, BAR_GAP = 5, BARS_H = 40;
/** The past moves as bars around a zero line (this event's last, set apart), with the usual size as a dashed band. */
export function bars(moves: { move: number; verdict?: Verdict | null; now?: boolean }[], usual: number | null) {
  const half = BARS_H / 2, max = Math.max(...moves.map((m) => Math.abs(m.move)), usual ?? 0, 0.001), k = (half - 2) / max;
  const list: Bar[] = moves.map((m, i) => {
    const h = Math.max(1, Math.abs(m.move) * k);
    return { x: i * (BAR_W + BAR_GAP) + (m.now ? 6 : 0), y: m.move >= 0 ? half - h : half, h, tone: tone(m.move), now: !!m.now, verdict: m.verdict ?? null };
  });
  return { bars: list, width: Math.max(1, (list.at(-1)?.x ?? 0) + BAR_W), half, band: usual == null ? null : usual * k };
}

const TIME = { bmo: 'before the open', amc: 'after the close' } as const;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayLabel = (d: string) => `${WEEKDAY[weekdayOf(d)]}, ${dayMonth(d)}`;
/** The next weekday after `d` (no market holidays in the draft). */
const nextWeekday = (d: string) => { let x = addDays(d, 1); while (weekdayOf(x) === 0 || weekdayOf(x) === 6) x = addDays(x, 1); return x; };
/** The session that trades a report: its own before the open, the next weekday's after the close. */
export function reactsOn(e: CoEvent): string | null {
  if (e.time !== 'amc') return e.time === 'bmo' ? e.date : null;
  return nextWeekday(e.date);
}
/**
 * An agenda day's heading, in the words people search: "Earnings today · Wed, Oct 28" for the session the page is read in (the one
 * after `asOf`, the last close the build saw), "Earnings tomorrow · Thu, Oct 29" for the next; the date is always there, so a page
 * read later never lies. A day with only macro dates says "Today" or "Tomorrow".
 */
export function dayHeading(date: string, companies: number, asOf: string): string {
  const today = nextWeekday(asOf), rel = date === today ? 'today' : date === nextWeekday(today) ? 'tomorrow' : null;
  return rel ? `${companies ? `Earnings ${rel}` : rel[0]!.toUpperCase() + rel.slice(1)} · ${dayLabel(date)}` : dayLabel(date);
}
export function when(e: OutlookEvent): string {
  if (e.kind === 'macro') return `${e.result ? 'Released' : 'Due'} ${dayLabel(e.date)}`;
  const t = e.time ? `, ${TIME[e.time]}` : '';
  if (!e.result && e.confirmed === false) return `Expected around ${dayLabel(e.date)}${t} (date not confirmed)`;
  const on = reactsOn(e);
  const reacts = on == null ? '' : ` · the stock ${moved(e) != null ? 'reacted' : 'reacts'} ${on === e.date ? 'the same day' : dayLabel(on)}`;
  return `${e.result ? 'Reported' : 'Reports'} ${dayLabel(e.date)}${!e.result && e.confirmed ? ' (confirmed)' : ''}${t}${reacts}`;
}
const growth = (now: number | null, before: number | null) => (now != null && before != null && before > 0 && now > 0 ? `, ${pct(now / before - 1, 0)} on a year ago` : '');
function verdictPhrase(actual: number, est: number) {
  const v = verdictOf(actual, est)!, s = est === 0 ? 0 : (actual - est) / Math.abs(est);
  return v === 'inline' ? 'in line' : `a ${v} (${pct(s, 0)})`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** "Analysts' average target is $625, 20% above the price (52 analysts); 9 raised it and 1 cut it in the last 30 days." */
function analystsText(a: Analysts | null, price: number | null): string | null {
  if (!a || a.n < MIN_ANALYSTS) return null;
  const r = price ? a.target / price - 1 : null;
  const vs = r === null ? '' : `, ${level(Math.abs(r), 0)} ${r >= 0 ? 'above' : 'below'} the price`;
  const moves = [a.raised ? `${a.raised} raised it` : '', a.cut ? `${a.cut} cut it` : ''].filter(Boolean).join(' and ');
  return `Analysts’ average target is $${num(a.target, priceDigits(a.target))}${vs} (${plural(a.n, 'analyst')}); ` +
    `${moves ? `${moves} in the last 30 days` : 'none changed it in the last 30 days'}.`;
}
/** The peers that reported this season: how many rose, their usual size, the biggest movers named, in a sentence. */
function peersText(ps: readonly PeerMove[]): string | null {
  if (ps.length < MIN_PEERS) return null;
  const avg = ps.reduce((s, p) => s + Math.abs(p.move), 0) / ps.length, ups = ps.filter((p) => p.move > 0).length;
  const named = [...ps].sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, PEERS_NAMED).map((p) => `${p.ticker} ${pct(p.move)}`);
  return `${ups} of ${ps.length} peers rose after reporting this season, moving ±${level(avg)} on average: ${named.join(', ')}.`;
}
/** The prediction market's price, and what it means: people ask what these markets are ("what is kalshi", "is kalshi legit"). */
const oddsText = (o: Odds | null) => (o && o.volume >= MIN_VOLUME
  ? `${level(o.p, 0)} chance of ${o.what}: the price of a share that pays $1 if it happens (${usd(o.volume, { compact: true })} traded).` : null);
/** Others' views before the event (none once it is out): the analysts, the peers, the prediction market. */
function expectations(e: OutlookEvent): [string, string][] {
  if (e.result) return [];
  const rows: [string, string | null][] = e.kind === 'macro' ? [['Polymarket', oddsText(e.odds)]]
    : [['Analysts', analystsText(e.analysts, e.price)], ['Peers', peersText(e.peers)], ['Polymarket', oddsText(e.odds)]];
  return rows.filter((r): r is [string, string] => r[1] != null);
}

/** Everything the card says, as text: the big number and what it is, the lines under it, the facts, what others expect, the bars. */
export interface Card {
  big: string; tone: Tone | 'est'; says: string; lines: string[]; facts: [string, string][]; expect: [string, string][]; bars: ReturnType<typeof bars>;
}
export function card(e: OutlookEvent, normal: number | null): Card {
  const m = moved(e), u = usualOf(e), lines: string[] = [], facts: [string, string][] = [];
  if (e.kind === 'macro') {
    const n = Math.min(e.moves.length, REPORTS);
    const shown = [...e.moves.slice(-REPORTS), ...(m != null ? [{ move: m, now: true }] : [])];
    if (m == null && u != null && normal) lines.push(`${times(u / normal)} a normal day (±${level(normal)})`);
    if (e.result) { if (e.result.actual) facts.push(['Actual', `${e.result.actual}${e.expected ? ` vs ${e.expected} expected` : ''}${e.previous ? ` · previous ${e.previous}` : ''}`]); }
    else if (e.expected) facts.push(['Expected', `${e.expected}${e.previous ? ` · previous ${e.previous}` : ''}`]);
    const head = m != null ? { big: pct(m), tone: tone(m) as Tone | 'est', says: `the market (SPY) that session${normal ? `, ${times(Math.abs(m) / normal)} a normal day` : ''}` }
      : u != null ? { big: `±${level(u)}`, tone: 'est' as const, says: `the market’s (SPY) usual move on its last ${n} releases` }
      : { big: '', tone: 'est' as const, says: 'Not enough past releases on file for a usual move.' };
    return { ...head, lines, facts, expect: expectations(e), bars: bars(shown, u) };
  }
  const rec = record(e.reactions);
  if (e.result && e.result.epsActual != null && e.epsEst != null) {
    lines.push(`EPS ${money(e.result.epsActual)} vs ${money(e.epsEst)} expected: ${verdictPhrase(e.result.epsActual, e.epsEst)}` +
      (e.result.revActual != null && e.revEst != null ? ` · revenue ${usd(e.result.revActual, { compact: true })} vs ${usd(e.revEst, { compact: true })}` : ''));
  }
  if (m == null && u != null) {
    const r = priceRange(e.price, u);
    const parts = [e.mcap != null ? `≈ ±${usd(e.mcap * u, { compact: true })} of market value` : '', r && e.price != null ? `${rangeText(r)} from $${num(e.price, priceDigits(e.price))}` : ''];
    if (parts.some(Boolean)) lines.push(parts.filter(Boolean).join(' · '));
  }
  if (rec.n) lines.push(rec.known ? `Beat the EPS estimate ${rec.beats} of ${rec.known} times · the stock rose after ${rec.ups} of ${rec.n}`
    : `The stock rose after ${rec.ups} of its last ${rec.n} reports`);
  if (!e.result) {
    if (e.epsEst != null) facts.push(['The bar', `EPS est. ${money(e.epsEst)}${growth(e.epsEst, e.epsYearAgo)}` +
      (e.revEst != null ? ` · revenue est. ${usd(e.revEst, { compact: true })}${growth(e.revEst, e.revYearAgo)}` : '')]);
    if (e.runup != null) facts.push(['Into it', `${pct(e.runup)} in the last 20 sessions${e.marketRunup != null ? `; the market ${pct(e.marketRunup)}` : ''}`]);
  }
  const shown = [...e.reactions.slice(-REPORTS), ...(m != null ? [{ move: m, verdict: verdictOf(e.result!.epsActual, e.epsEst), now: true }] : [])];
  const head = m != null ? { big: pct(m), tone: tone(m) as Tone | 'est', says: `the session after the report${u != null ? `, ${times(Math.abs(m) / u)} its usual ±${level(u)}` : ''}` }
    : u != null ? { big: `±${level(u)}`, tone: 'est' as const, says: `its usual move the session after a report (average of the last ${Math.min(rec.n, REPORTS)})` }
    : { big: '', tone: 'est' as const, says: `Not enough reports yet for a usual move (${rec.n} of the ${MIN_REPORTS} it takes).` };
  return { ...head, lines, facts, expect: expectations(e), bars: bars(shown, u) };
}

const named = (e: CoEvent) => (e.name && e.name !== e.ticker ? `${e.name} (${e.ticker})` : e.ticker);
/**
 * An agenda row in a sentence, the text a search engine and an AI read: "Microsoft (MSFT) reports Wed, Oct 28 (confirmed), after the
 * close; the stock reacts Thu, Oct 29. In the session after its last 8 reports it moved ±4.7% on average." After the report, its
 * figures and the move against the usual one; for a macro date, the market's (SPY) usual move on its releases.
 */
export function agendaSentence(e: OutlookEvent, normal: number | null): string {
  const m = moved(e), u = usualOf(e);
  if (e.kind === 'macro') {
    if (e.result) {
      const fig = e.result.actual ? `: ${e.result.actual}${e.expected ? ` vs ${e.expected} expected` : ''}` : '';
      return `${e.event}, released ${dayLabel(e.date)}${fig}${m != null ? `; the market (SPY) moved ${pct(m)} that session` : ''}.`;
    }
    const n = Math.min(e.moves.length, REPORTS);
    return `${e.event} is due ${dayLabel(e.date)}${e.expected ? ` (expected ${e.expected}${e.previous ? `, previous ${e.previous}` : ''})` : ''}.` +
      (u != null ? ` On its last ${n} releases the market (SPY) moved ±${level(u)} on average${normal ? `, ${times(u / normal)} a normal day` : ''}.` : '');
  }
  const t = e.time ? `, ${TIME[e.time]}` : '', on = reactsOn(e), usual = u != null ? `±${level(u)}` : null;
  const reacts = on == null ? '' : `; the stock reacts ${on === e.date ? 'the same day' : dayLabel(on)}`;
  if (e.result) {
    const eps = e.result.epsActual != null && e.epsEst != null
      ? `: EPS ${money(e.result.epsActual)} vs ${money(e.epsEst)} expected, ${verdictPhrase(e.result.epsActual, e.epsEst)}` : '';
    if (m != null) return `${named(e)} reported ${dayLabel(e.date)}${t}${eps}. The stock moved ${pct(m)} in the session that traded it` +
      `${u != null ? `, ${times(Math.abs(m) / u)} its usual ${usual}` : ''}.`;
    return `${named(e)} reported ${dayLabel(e.date)}${t}${eps}${reacts}.${usual ? ` Its usual move after a report: ${usual}.` : ''}`;
  }
  const head = e.confirmed === false ? `${named(e)} is expected to report around ${dayLabel(e.date)} (date not confirmed)${t}`
    : `${named(e)} reports ${dayLabel(e.date)}${e.confirmed ? ' (confirmed)' : ''}${t}${reacts}`;
  return `${head}.${usual ? ` In the session after its last ${Math.min(e.reactions.length, REPORTS)} reports it moved ${usual} on average.` : ''}`;
}

const NOTE = 'Past reactions: how big a move has been, not which way the next one goes. What others expect is their view, not a forecast.';

@Component({
  selector: 'pt-outlook-card',
  imports: [PtLogo],
  template: `
    @let e = event();
    @let c = view();
    <div class="do-card">
      <div class="do-card-head">
        @if (e.kind === 'macro') {<span class="pt-cal-macro">{{ e.label }}</span><b>{{ e.event }}</b>}
        @else {<pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="20" /><b>{{ e.name }}{{ e.name === e.ticker ? '' : ' (' + e.ticker + ')' }}</b>}
      </div>
      <p class="pt-meta">{{ whenText() }}</p>
      <p class="do-big">@if (c.big) {<b [class]="c.tone === 'est' ? 'do-est' : 'pt-t-' + c.tone">{{ c.big }}</b>}<span>{{ c.says }}</span></p>
      @for (l of c.lines; track $index) {<p>{{ l }}</p>}
      @if (c.bars.bars.length) {
        <svg class="do-bars" [attr.viewBox]="'0 0 ' + c.bars.width + ' 50'" [attr.width]="c.bars.width" height="50" role="img" [attr.aria-label]="barsLabel()">
          <line class="do-axis" x1="0" [attr.x2]="c.bars.width" [attr.y1]="c.bars.half" [attr.y2]="c.bars.half" />
          @if (c.bars.band; as b) {
            <line class="do-band" x1="0" [attr.x2]="c.bars.width" [attr.y1]="c.bars.half - b" [attr.y2]="c.bars.half - b" />
            <line class="do-band" x1="0" [attr.x2]="c.bars.width" [attr.y1]="c.bars.half + b" [attr.y2]="c.bars.half + b" />
          }
          @for (b of c.bars.bars; track $index) {
            <rect [class]="'do-bar-' + b.tone + (b.now ? ' do-bar-now' : '')" [attr.x]="b.x" [attr.y]="b.y" width="12" [attr.height]="b.h" rx="1.5" />
            @if (b.verdict) {<circle [class]="'do-dot-' + b.verdict" [attr.cx]="b.x + 6" cy="46" r="2.5" />}
          }
        </svg>
        <p class="pt-meta">{{ e.kind === 'macro' ? BARS_MACRO : BARS_CO }}</p>
      }
      @if (c.facts.length) {<dl class="do-facts">@for (f of c.facts; track f[0]) {<dt>{{ f[0] }}</dt><dd>{{ f[1] }}</dd>}</dl>}
      @if (c.expect.length) {
        <p class="do-sub">What others expect</p>
        <dl class="do-facts">@for (f of c.expect; track f[0]) {<dt>{{ f[0] }}</dt><dd>{{ f[1] }}</dd>}</dl>
      }
      <p class="pt-meta">{{ NOTE }}</p>
    </div>`,
})
export class PtOutlookCard {
  readonly event = input.required<OutlookEvent>();
  readonly normal = input<number | null>(null);
  protected readonly view = computed(() => card(this.event(), this.normal()));
  protected readonly whenText = computed(() => when(this.event()));
  protected readonly barsLabel = computed(() => {
    const e = this.event(), b = this.view().bars.bars;
    return `${e.kind === 'macro' ? 'The market’s move on the last releases' : 'The stock’s move after its last reports'}: ${b.map((x) => (x.tone === 'neg' ? 'down' : 'up')).join(', ')}`;
  });
  protected readonly NOTE = NOTE;
  protected readonly BARS_CO = 'Each bar: the move after a past report, the dashed lines its usual size. Dot: green a beat, red a miss, hollow in line.';
  protected readonly BARS_MACRO = 'Each bar: the market’s move on a past release, the dashed lines its usual size.';
}

interface Cell { date: string; day: number; inMonth: boolean; items: CoEvent[]; macro: MacroEvent[] }
/** The five sessions of the week of `from`, or the Monday-first month grid of `from`'s month; a day's companies the largest first. */
export function outlookCells(d: CalOutlook, view: 'week' | 'month'): Cell[] {
  const on = (date: string) => ({
    items: d.items.filter((e): e is CoEvent => e.kind === 'earnings' && e.date === date).sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0)),
    macro: d.items.filter((e): e is MacroEvent => e.kind === 'macro' && e.date === date),
  });
  const month = d.from.slice(0, 7);
  const cell = (date: string) => ({ date, day: Number(date.slice(8)), inMonth: view === 'week' || date.startsWith(month), ...on(date) });
  if (view === 'week') return Array.from({ length: 5 }, (_, i) => cell(addDays(mondayOf(d.from), i)));
  const first = `${month}-01`, lead = (weekdayOf(first) + 6) % 7;
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => cell(addDays(first, i - lead)));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LEGEND: Record<OutlookVariant, string> = {
  move: 'Before a report: its usual move (±). After: the move it made.',
  dollars: 'Before a report: its usual move in market value (±$). After: the value it gained or lost.',
  record: 'Before a report: how often it beat the EPS estimate in its last 8. After: beat, in line or miss.',
  range: 'Before a report: the price range its usual move spans. After: the move it made.',
};
const FOOT = 'Usual move: the average size of the stock’s move the session after each of its last 8 reports (for a Fed, CPI or jobs date, ' +
  'the market’s, SPY, on its last 8 releases). How big, not which way: past reactions do not say where the next one goes. ' +
  'A dotted ticker: the date is not confirmed yet.';
/** Room the card needs above a row before it opens below it instead. */
const ROOM_ABOVE = 560, CARD_W = 384;

@Component({
  selector: 'pt-cal-outlook',
  imports: [PtLogo, PtOutlookCard],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <section class="pt-cal do-cal">
        <div class="pt-head"><h3 class="pt-section-title">{{ title() }}</h3><span class="pt-meta">{{ LEGEND[variant()] }}</span></div>
        <div [class]="isWeek() ? 'pt-cal-grid pt-cal-week do-grid' : 'pt-cal-grid do-grid'">
          @if (isWeek()) {@for (c of cells(); track c.date) {<div class="pt-cal-dow">{{ dayLabel(c.date) }}</div>}}
          @else {@for (w of DOW; track w) {<div class="pt-cal-dow">{{ w }}</div>}}
          @for (c of cells(); track c.date) {
            <div [class]="dayClass(c)">
              @if (!isWeek()) {<div>{{ c.day }}</div>}
              @for (m of c.macro; track m.label) {
                <button type="button" class="pt-cal-macro do-ev" (pointerenter)="show(m, $event)" (pointerleave)="hide()" (focus)="show(m, $event)" (blur)="hide()">
                  <span>{{ m.label }}</span><span [class]="cueClass(m)">{{ cueOf(m).text }}</span></button>
              }
              @for (e of c.items.slice(0, CAP); track e.ticker) {
                <a class="pt-cal-ev do-ev" [class.do-unconf]="e.confirmed === false" [href]="stockHref(e.ticker)" (pointerenter)="show(e, $event)" (pointerleave)="hide()" (focus)="show(e, $event)" (blur)="hide()">
                  <span class="pt-cal-who"><pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="14" />{{ e.ticker }}@if (e.confirmed === false) {<span class="pt-sr"> (date not confirmed)</span>}</span>
                  <span [class]="cueClass(e)">{{ cueOf(e).text }}</span></a>
              }
              @if (c.items.length > CAP) {<span class="pt-cal-more">+{{ c.items.length - CAP }} more</span>}
            </div>
          }
        </div>
        @if (pop(); as p) {
          <div [class]="p.below ? 'do-pop do-pop-below' : 'do-pop'" [style.left.px]="p.left" [style.top.px]="p.top"><pt-outlook-card [event]="p.e" [normal]="d.normal" /></div>
        }
        <div class="do-agenda">
          @for (c of listed(); track c.date) {
            <h4 class="do-agenda-day">{{ heading(c, d.asOf) }}</h4>
            @for (e of entries(c); track key(e)) {
              <div class="do-item">
                <details class="do-row">
                  <summary>
                    @if (e.kind === 'macro') {<span class="pt-cal-macro">{{ e.label }}</span><span class="do-sum-name">{{ e.event }}</span>}
                    @else {<pt-logo [ticker]="e.ticker" [src]="e.logo" [size]="16" /><span class="do-sum-name">{{ e.name }} <span class="pt-meta">{{ e.name === e.ticker ? '' : e.ticker }}</span></span>}
                    <b [class]="cueClass(e)">{{ cueOf(e).text }}</b>
                  </summary>
                  <pt-outlook-card [event]="e" [normal]="d.normal" />
                </details>
                <p class="do-say">{{ say(e, d.normal) }} @if (e.kind === 'earnings') {<a [href]="stockHref(e.ticker)">{{ e.name }} earnings date →</a>}</p>
              </div>
            }
          }
        </div>
        <p class="pt-meta">{{ FOOT }}</p>
      </section>
    }`,
})
export class PtCalOutlook {
  readonly data = input.required<CalOutlook | null>();
  readonly variant = input<OutlookVariant>('move');
  readonly view = input<'week' | 'month'>('month');

  protected readonly isWeek = computed(() => this.view() === 'week');
  protected readonly cells = computed(() => { const d = this.data(); return d ? outlookCells(d, this.view()) : []; });
  protected readonly listed = computed(() => this.cells().filter((c) => c.inMonth && (c.items.length || c.macro.length)));
  protected readonly title = computed(() => {
    const d = this.data();
    if (!d) return '';
    return this.isWeek() ? `Earnings calendar this week · ${dayMonth(mondayOf(d.from))}–${dayMonth(addDays(mondayOf(d.from), 4))}, ${d.from.slice(0, 4)}`
      : `Earnings calendar — ${MONTHS[Number(d.from.slice(5, 7)) - 1]} ${d.from.slice(0, 4)}`;
  });
  protected readonly pop = signal<{ e: OutlookEvent; left: number; top: number; below: boolean } | null>(null);

  protected readonly CAP = CAP;
  protected readonly DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly LEGEND = LEGEND;
  protected readonly FOOT = FOOT;
  protected readonly dayLabel = dayLabel;
  protected readonly stockHref = stockHref;
  protected readonly say = agendaSentence;
  protected heading = (c: Cell, asOf: string) => dayHeading(c.date, c.items.length, asOf);
  protected cueOf = (e: OutlookEvent) => cue(e, this.variant());
  protected cueClass = (e: OutlookEvent) => { const t = this.cueOf(e).tone; return `do-cue ${t === 'est' ? 'do-est' : `pt-t-${t}`}`; };
  protected entries = (c: Cell): OutlookEvent[] => [...c.macro, ...c.items];
  protected key = (e: OutlookEvent) => (e.kind === 'macro' ? `m:${e.label}` : e.ticker);
  protected dayClass = (c: Cell) => `pt-cal-day${c.inMonth ? '' : ' pt-cal-out'}${c.date === this.data()?.asOf ? ' pt-cal-asof' : ''}`;

  /** The card opens above the row (below it when the window has no room), inside the calendar's width. */
  protected show(e: OutlookEvent, ev: Event) {
    const t = ev.currentTarget as HTMLElement | null, box = t?.closest('.do-cal');
    if (!t || !box) return;
    const r = t.getBoundingClientRect(), b = box.getBoundingClientRect();
    const below = r.top < ROOM_ABOVE;
    this.pop.set({ e, left: Math.max(0, Math.min(r.left - b.left, b.width - CARD_W)), top: below ? r.bottom - b.top + 6 : r.top - b.top - 6, below });
  }
  protected hide() { this.pop.set(null); }
}

/**
 * What changed for this company since the session before — and, when the page carries it, what is close to the last close?
 * @version 1.1.0
 * @evidence Romeo, 2026-11-12: «per ogni azienda, mostriamo quel summary ogni giorno diverso con il confronto col giorno prima, fatto ogni notte alla chiusura»
 * @evidence Romeo, 2026-11-13: «le principali devono sempre avere scheda in company page (almeno con niente di rilevante)»
 * @evidence Romeo, 2026-11-14: «Sempre la più vicina e usa badge e grassetto per aiutare la lettura»
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { date, money, named, pct } from '@pretickt/components/format';
import type { DailyFact, DailyVisual } from '@pretickt/components/typologies';

/** The half's heading (spec 2026-11-14 what-to-watch, Open #3: the name is Romeo's; one constant until he picks it). */
export const WATCH_TITLE = 'What to watch';
/** The note under a card whose "What to watch" half the model worded too. */
export const AI_NOTE_BOTH = 'Wording by an AI model from pretickt\'s data; the levels, dates and dated facts are the platform\'s own. Not investment advice.';
const AI_NOTE = 'Wording by an AI model from pretickt\'s data; the dated facts under it are the platform\'s own. Not investment advice.';

/** A body's `**bold**` phrases as segments (the server keeps only well-formed ones); text with an unpaired mark is one plain segment, marks and all. */
export function segments(text: string): { t: string; b: boolean }[] {
  const parts = text.split('**');
  if (parts.length % 2 === 0) return [{ t: text, b: false }];
  return parts.map((t, i) => ({ t, b: i % 2 === 1 })).filter((s) => s.t !== '');
}
/** The facts that carry a chip, in their cited order (the lead first). */
export const withChips = (facts: readonly DailyFact[]): DailyFact[] => facts.filter((f) => f.chip);

/**
 * One shape of a small picture, in a 100 × 40 viewBox: a line (`path`), a dashed level or guide (`dash`), a solid mark (`rule`), a dot, a bar
 * (`rect`) or a short label (`text`). `c` names its look (`.pt-dv-<c>` in ds.css). All numbers are rounded to 0.1.
 */
export interface Shape { k: 'path' | 'dash' | 'rule' | 'dot' | 'rect' | 'text'; c: string; d?: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number; w?: number; h?: number; t?: string; a?: 'start' | 'middle' | 'end' }
export interface Pic { shapes: Shape[] }

const X0 = 2, X1 = 98, Y0 = 2, Y1 = 38;
const r1 = (v: number) => Math.round(v * 10) / 10;
const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x));
/** A linear scale; a flat domain gets ±1% of its value (or ±1) around it, so a flat line is drawn flat, mid-height, never stretched. */
function scale(values: readonly number[], to: [number, number]): (v: number) => number {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-9) { const e = Math.abs(lo) * 0.01 || 1; lo -= e; hi += e; }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  return (v) => r1(to[0] + ((v - lo) / (hi - lo)) * (to[1] - to[0]));
}
const xs = (n: number) => (i: number) => r1(X0 + (n === 1 ? 0 : (i * (X1 - X0)) / (n - 1)));
/** A line through the values; a null breaks it (a new `M`). */
function path(values: readonly (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = '', pen = false;
  values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${d ? ' ' : ''}${pen ? 'L' : 'M'}${x(i)},${y(v)}`; pen = true; });
  return d;
}
/** Closes with a level dashed across them and the last close as a dot; the scale holds both (a far level is drawn far). */
function ladder(closes: readonly number[], level: number, close: number): Pic | null {
  if (closes.length < 2 || !ok(level, close, ...closes)) return null;
  const y = scale([...closes, level], [Y1, Y0]), x = xs(closes.length), ly = y(level);
  return { shapes: [
    { k: 'dash', c: 'level', x1: X0, y1: ly, x2: X1, y2: ly },
    { k: 'path', c: 'line', d: path(closes, x, y) },
    { k: 'dot', c: 'dot', x: x(closes.length - 1), y: y(close) },
    { k: 'text', c: 'label', x: X0, y: r1(ly > 20 ? ly - 2 : ly + 7), t: money(level), a: 'start' },
  ] };
}

/** A fact's small picture from the platform's numbers; null when they cannot be drawn honestly (too few points, an empty range, nothing to split). */
export function picture(v: DailyVisual): Pic | null {
  switch (v.v) {
    case 'level': return ladder(v.closes, v.level, v.close);
    case 'ma200': return ladder(v.closes, v.ma200, v.close);
    case 'crossed': return ladder(v.closes, v.level, v.close);
    case 'range': {
      if (!ok(v.lo, v.hi, v.close) || v.hi <= v.lo) return null;
      const w = X1 - X0, at = Math.min(1, Math.max(0, (v.close - v.lo) / (v.hi - v.lo)));
      return { shapes: [
        { k: 'rect', c: 'track', x: X0, y: 18, w, h: 4 },
        { k: 'dot', c: 'dot', x: r1(X0 + at * w), y: 20 },
        { k: 'text', c: 'label', x: X0, y: 33, t: money(v.lo), a: 'start' },
        { k: 'text', c: 'label', x: X1, y: 33, t: money(v.hi), a: 'end' },
      ] };
    }
    case 'rsi': {
      const vals = v.values.map((x) => (x != null && Number.isFinite(x) ? x : null)), last = vals.map((x, i) => [x, i] as const).filter(([x]) => x != null).at(-1);
      if (!last) return null;
      const y = (r: number) => r1(Y1 - (r / 100) * (Y1 - Y0)), x = xs(vals.length);
      return { shapes: [
        { k: 'dash', c: 'guide', x1: X0, y1: y(30), x2: X1, y2: y(30) },
        { k: 'dash', c: 'guide', x1: X0, y1: y(70), x2: X1, y2: y(70) },
        { k: 'path', c: 'line', d: path(vals, x, y) },
        { k: 'dot', c: 'dot', x: x(last[1]), y: y(last[0]!) },
      ] };
    }
    case 'ma': {
      const n = Math.min(v.fast.length, v.slow.length);
      const fast = v.fast.slice(-n), slow = v.slow.slice(-n);
      if (n < 2 || !ok(...fast, ...slow)) return null;
      const y = scale([...fast, ...slow], [Y1, Y0]), x = xs(n);
      const shapes: Shape[] = [{ k: 'path', c: 'line', d: path(fast, x, y) }, { k: 'path', c: 'slow', d: path(slow, x, y) }];
      if (v.crossAgo != null && v.crossAgo >= 0 && v.crossAgo < n) { const cx = x(n - 1 - v.crossAgo); shapes.push({ k: 'rule', c: 'mark', x1: cx, y1: Y0, x2: cx, y2: Y1 }); }
      return { shapes };
    }
    case 'date': {
      if (!ok(v.sessions)) return null;
      const t = v.sessions <= 0 ? 'today' : `in ${v.sessions} ${v.sessions === 1 ? 'session' : 'sessions'}`;
      return { shapes: [
        { k: 'rect', c: 'cal', x: X0, y: 10, w: 16, h: 18 },
        { k: 'rect', c: 'cal-top', x: X0, y: 10, w: 16, h: 5 },
        { k: 'text', c: 'label', x: 24, y: 23, t, a: 'start' },
      ] };
    }
    case 'split': {
      const parts = [['market', v.market], ['sector', v.sector], ['own', v.specific]] as const;
      const sum = parts.reduce((a, [, p]) => a + Math.abs(p), 0);
      if (!ok(v.ret, v.market, v.sector, v.specific) || sum < 1e-9) return null;
      let at = X0;
      const shapes: Shape[] = parts.map(([c, p]) => {
        const w = r1(((X1 - X0) * Math.abs(p)) / sum), rect: Shape = { k: 'rect', c: c === 'own' ? (p > 0 ? 'pos' : p < 0 ? 'neg' : 'flat') : c, x: r1(at), y: 16, w, h: 8 };
        at += w; return rect;
      });
      shapes.push({ k: 'text', c: 'label', x: X0, y: 11, t: pct(v.ret), a: 'start' });
      return { shapes };
    }
    case 'target': {
      if (!ok(v.before, v.after)) return null;
      const x = scale([v.before, v.after], [X0 + 10, X1 - 10]), a = x(v.before), b = x(v.after);
      return { shapes: [
        { k: 'rule', c: 'guide', x1: X0, y1: 18, x2: X1, y2: 18 },
        { k: 'dot', c: 'was', x: a, y: 18 },
        { k: 'dot', c: 'dot', x: b, y: 18 },
        { k: 'text', c: 'label', x: a, y: 33, t: money(v.before), a: 'middle' },
        { k: 'text', c: 'label', x: b, y: 10, t: money(v.after), a: 'middle' },
      ] };
    }
    case 'ratings': {
      const tot = (r: typeof v.before) => r.buy + r.hold + r.sell, max = Math.max(tot(v.before), tot(v.after));
      if (!ok(max) || max <= 0) return null;
      const row = (r: typeof v.before, y: number): Shape[] => {
        let at = X0;
        return (['buy', 'hold', 'sell'] as const).map((c) => { const w = r1(((X1 - X0) * r[c]) / max), s: Shape = { k: 'rect', c, x: r1(at), y, w, h: 7 }; at += w; return s; });
      };
      return { shapes: [...row(v.before, 10), ...row(v.after, 23)] };
    }
    case 'event': {
      const cs = v.closes.map((p) => p.c);
      if (cs.length < 2 || !ok(...cs)) return null;
      const y = scale(cs, [Y1, Y0]), x = xs(cs.length), i = v.closes.findIndex((p) => p.t === v.date);
      const shapes: Shape[] = [{ k: 'path', c: 'line', d: path(cs, x, y) }];
      if (i >= 0) shapes.push({ k: 'rule', c: 'mark', x1: x(i), y1: Y0, x2: x(i), y2: Y1 }, { k: 'dot', c: 'dot', x: x(i), y: y(cs[i]!) });
      return { shapes };
    }
  }
}

/** The kinds of fact each picture draws: the picture's tip is the first such fact's sentence (the platform drew the first cited fact it could). */
const DRAWS: Record<DailyVisual['v'], (kind: string) => boolean> = {
  level: (k) => k === 'level-above' || k === 'level-below', ma200: (k) => k === 'ma-200', crossed: (k) => k === 'level-crossed',
  range: (k) => k === 'range-52w', rsi: (k) => k === 'rsi', ma: (k) => k === 'ma-gap', date: (k) => k === 'date',
  split: (k) => k === 'day' || k === 'week', target: (k) => k === 'analysts', ratings: (k) => k === 'consensus',
  event: (k) => !['day', 'week', 'analysts', 'consensus', 'targets', 'next-earnings'].includes(k),
};
export const tipOf = (v: DailyVisual, facts: readonly DailyFact[]): string | undefined => facts.find((f) => DRAWS[v.v](f.kind))?.text;
const drawn = (v: DailyVisual | undefined, facts: readonly DailyFact[]): (Pic & { tip: string | undefined }) | null => {
  const p = v ? picture(v) : null;
  return p && v ? { ...p, tip: tipOf(v, facts) } : null;
};

@Component({
  selector: 'pt-daily',
  template: `
    @let d = daily.value();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else if (d) {
      @let c = d.card;
      @let facts = c ? c.facts : d.facts;
      @let w = d.watch;
      @if (c || facts.length) {
        <section class="pt-daily">
          <p class="pt-meta">{{ named(d.name, d.ticker) }} · @if (c && c.session !== d.asOf) {Latest: }{{ date(c ? c.session : d.asOf) }}</p>
          @if (c) {
            <div class="pt-daily-row">
              <div class="pt-daily-text">
                <p class="pt-daily-message">{{ c.message }}</p>
                <p class="pt-daily-body">@for (s of segments(c.body); track $index) {@if (s.b) {<b>{{ s.t }}</b>} @else {{{ s.t }}}}</p>
              </div>
              @if (cardPic(); as p) {<svg class="pt-daily-visual" viewBox="0 0 100 40" aria-hidden="true" [attr.data-tip]="p.tip">@for (s of p.shapes; track $index) {@switch (s.k) {
                @case ('path') {<path [attr.class]="'pt-dv-' + s.c" [attr.d]="s.d" />}
                @case ('dash') {<line [attr.class]="'pt-dv-' + s.c + ' pt-dv-dash'" [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" />}
                @case ('rule') {<line [attr.class]="'pt-dv-' + s.c" [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" />}
                @case ('dot') {<circle [attr.class]="'pt-dv-' + s.c" [attr.cx]="s.x" [attr.cy]="s.y" r="2" />}
                @case ('rect') {<rect [attr.class]="'pt-dv-' + s.c" [attr.x]="s.x" [attr.y]="s.y" [attr.width]="s.w" [attr.height]="s.h" />}
                @case ('text') {<text [attr.class]="'pt-dv-' + s.c" [attr.x]="s.x" [attr.y]="s.y" [attr.text-anchor]="s.a">{{ s.t }}</text>}
              }}</svg>}
            </div>
          }
          @if (withChips(facts).length) {
            <ul class="pt-badges pt-daily-chips">
              @for (f of withChips(facts); track $index) {<li class="pt-badge pt-badge-mini"><span class="pt-badge-k">{{ f.chip!.label }}</span>@if (f.chip!.value) { · <span class="pt-badge-v">{{ f.chip!.value }}</span>}</li>}
            </ul>
          }
          @if (facts.length) {
            <ul class="pt-daily-facts">
              @for (f of facts; track $index) {
                <li>{{ f.text }}@if (f.was) {<span class="pt-daily-was">Before: {{ f.was }}</span>}</li>
              }
            </ul>
          }
          @if (w) {
            <div class="pt-daily-watch">
              <h3 class="pt-daily-half">{{ title }}</h3>
              @if (w.kind === 'half') {
                <div class="pt-daily-row">
                  <div class="pt-daily-text">
                    <p class="pt-daily-message">{{ w.message }}</p>
                    <p class="pt-daily-body">@for (s of segments(w.body); track $index) {@if (s.b) {<b>{{ s.t }}</b>} @else {{{ s.t }}}}</p>
                  </div>
                  @if (watchPic(); as p) {<svg class="pt-daily-visual" viewBox="0 0 100 40" aria-hidden="true" [attr.data-tip]="p.tip">@for (s of p.shapes; track $index) {@switch (s.k) {
                @case ('path') {<path [attr.class]="'pt-dv-' + s.c" [attr.d]="s.d" />}
                @case ('dash') {<line [attr.class]="'pt-dv-' + s.c + ' pt-dv-dash'" [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" />}
                @case ('rule') {<line [attr.class]="'pt-dv-' + s.c" [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" />}
                @case ('dot') {<circle [attr.class]="'pt-dv-' + s.c" [attr.cx]="s.x" [attr.cy]="s.y" r="2" />}
                @case ('rect') {<rect [attr.class]="'pt-dv-' + s.c" [attr.x]="s.x" [attr.y]="s.y" [attr.width]="s.w" [attr.height]="s.h" />}
                @case ('text') {<text [attr.class]="'pt-dv-' + s.c" [attr.x]="s.x" [attr.y]="s.y" [attr.text-anchor]="s.a">{{ s.t }}</text>}
              }}</svg>}
                </div>
                @if (withChips(w.facts).length) {
                  <ul class="pt-badges pt-daily-chips">
                    @for (f of withChips(w.facts); track $index) {<li class="pt-badge pt-badge-mini"><span class="pt-badge-k">{{ f.chip!.label }}</span>@if (f.chip!.value) { · <span class="pt-badge-v">{{ f.chip!.value }}</span>}</li>}
                  </ul>
                }
                @if (w.facts.length) {
                  <ul class="pt-daily-facts">
                    @for (f of w.facts; track $index) {<li>{{ f.text }}</li>}
                  </ul>
                }
              } @else if (w.kind === 'fact') {
                <div class="pt-daily-row">
                  <p class="pt-daily-line pt-daily-text">{{ w.fact.text }}</p>
                  @if (watchPic(); as p) {<svg class="pt-daily-visual" viewBox="0 0 100 40" aria-hidden="true" [attr.data-tip]="p.tip">@for (s of p.shapes; track $index) {@switch (s.k) {
                @case ('path') {<path [attr.class]="'pt-dv-' + s.c" [attr.d]="s.d" />}
                @case ('dash') {<line [attr.class]="'pt-dv-' + s.c + ' pt-dv-dash'" [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" />}
                @case ('rule') {<line [attr.class]="'pt-dv-' + s.c" [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" />}
                @case ('dot') {<circle [attr.class]="'pt-dv-' + s.c" [attr.cx]="s.x" [attr.cy]="s.y" r="2" />}
                @case ('rect') {<rect [attr.class]="'pt-dv-' + s.c" [attr.x]="s.x" [attr.y]="s.y" [attr.width]="s.w" [attr.height]="s.h" />}
                @case ('text') {<text [attr.class]="'pt-dv-' + s.c" [attr.x]="s.x" [attr.y]="s.y" [attr.text-anchor]="s.a">{{ s.t }}</text>}
              }}</svg>}
                </div>
                @if (w.fact.chip; as k) {
                  <ul class="pt-badges pt-daily-chips"><li class="pt-badge pt-badge-mini"><span class="pt-badge-k">{{ k.label }}</span>@if (k.value) { · <span class="pt-badge-v">{{ k.value }}</span>}</li></ul>
                }
              } @else {
                <p class="pt-meta">{{ w.text }}</p>
              }
            </div>
          }
          @if (w && w.kind === 'half') {<p class="pt-note">{{ noteBoth }}</p>}
          @else if (c) {<p class="pt-note">{{ note }}</p>}
        </section>
      } @else {
        <!-- every night's facts hold something new (the day's move): no card and no fact means the night did not read this company, so the line claims nothing about it -->
        <p class="pt-na">No daily summary for {{ named(d.name, d.ticker) }} on {{ date(d.asOf) }}</p>
      }
    }`,
})
export class PtDaily {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  protected readonly daily = this.pt.daily(() => ({ ticker: this.ticker() }));
  protected readonly date = date;
  protected readonly named = named;
  protected readonly segments = segments;
  protected readonly cardPic = computed(() => { const c = this.daily.value()?.card; return c ? drawn(c.visual, c.facts) : null; });
  protected readonly watchPic = computed(() => {
    const w = this.daily.value()?.watch;
    return w?.kind === 'half' ? drawn(w.visual, w.facts) : w?.kind === 'fact' ? drawn(w.visual, [w.fact]) : null;
  });
  protected readonly withChips = withChips;
  protected readonly title = WATCH_TITLE;
  protected readonly note = AI_NOTE;
  protected readonly noteBoth = AI_NOTE_BOTH;
}

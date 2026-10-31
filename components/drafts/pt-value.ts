/**
 * DRAFT · Is this a company of value? (made-up data, stories only) — for anyone, not only investors: six plain questions side by
 * side (Demand, Advantage, Economics, Execution, Fragility, Price), each with a verdict in words and a few schematic cards, a number
 * and a small picture each. Each card has a title in blue and names the FMP endpoint that will feed it (checked against the API on
 * the Display key, 2026-10-27); a card that reads other companies wears a small "pretickt analysis" badge under its title. A fact
 * with no data has no card: never a placeholder on a public page.
 * In the words people search (DataForSEO, 2026-10-28): the top line asks "Is {company} a good stock to buy?" and answers with facts —
 * how many of the five questions about the business are strong, the P/E against its 3-year median with the date — never with a yes
 * or a no. A card's title is a heading (h3, as the questions under the columns) that starts with the ticker, with the searched term
 * inside it, below ("NVDA price vs profit · P/E ratio"), and every card says its fact in a sentence that names the company (company,
 * number, date): the card carries both ways people search it (DataForSEO, 2026-10-28: the price terms with the ticker half the time,
 * "nvda price target"; the business ones with the name, "nvidia number of employees", 93%). A tooltip is not text to a search engine
 * or an AI. Under the columns, the questions people search that the cards answer ("Who is dumping Nvidia stock?"); the resolver
 * templates them, so the generator can put the same pairs in the page's structured data — one answer per question on a page.
 * The six columns share their rows (a subgrid): a question on one line or two, the verdicts and the first cards start level.
 * Its questions and answers are marked for the page's structured data (`data-faq`, `data-faq-q`, `data-faq-a`): the top question is an
 * h2 with its answer, each searched question has an address of its own (`#value-<its words>`), so pt-people-ask links to it instead
 * of answering it again. The columns carry the words people search beside their own ("Price valuation", "Advantage moat").
 * A ticker of another company on a card is a link to its page: its card opens on hover, as on every ticker of the site.
 * A record over time (earnings against the estimate, sales against the forecast) is a bar per quarter, oldest first, on the line of
 * what was expected: up by what it beat, down by what it missed, the latest in full colour; the quarter under each bar, the fiscal
 * year once under its quarters, the number on hover (Romeo, 2026-10-31: the dots were periods with no time on them).
 * The Piotroski checks show what they look at: a row per group people read (profit & cash, debt & shares, efficiency), a mark
 * per check — a green check when it passes, a red x when it misses — its name on hover; the sentence names what it misses.
 * @version 0.0.11
 */
import { Component, computed, input } from '@angular/core';
import { PtIcon, PtLogo } from '@pretickt/components/ds';
import { date, faqId, num, pct, plainName, stockHref, tip } from '@pretickt/components/format';

export type ValueKey = 'demand' | 'advantage' | 'economics' | 'execution' | 'fragility' | 'price';
export type ValueTone = 'pos' | 'flat' | 'neg' | 'na';
export type ValueViz =
  | { kind: 'bars'; values: number[]; labels?: string[] }          // a trend: years or quarters, the last one in its tone
  | { kind: 'vs'; value: number; peers: number; unit: '%' | '×' }  // the company against its peers' median
  | { kind: 'dots'; hits: number; total: number }                  // so many of so many, with no time and no names
  | { kind: 'checks'; ok: Record<CheckKey, boolean> }              // the nine Piotroski checks, each passed or missed
  | { kind: 'quarters'; quarters: ValueQuarter[]; vs: string }     // a record over time, oldest first, against `vs` (what was expected)
  | { kind: 'gauge'; value: number; min: number; max: number; zones: [number, number] } // a score with a red, amber, green zone
  | { kind: 'range'; low: number; high: number; value: number; mark?: number; labels?: [string, string] } // where it sits in a range
  | { kind: 'split'; parts: { label: string; share: number }[] }   // shares of a whole: segments, pay
  | { kind: 'companies'; rows: ValueCompany[]; bars: boolean };    // other companies: customers, rivals, holders, analysts' banks
/** A quarter of a record, as the company names it (fiscal quarter and year), and by how much it beat what was expected: 0.06 is 6%, a miss below 0. */
export interface ValueQuarter { q: string; fy: string; by: number }
type CheckGroup = 'profit' | 'debt' | 'efficiency';
/** The nine Piotroski checks in their order, each with its group and its plain name (the hover). */
export const CHECKS = {
  roa: ['profit', 'A profit (return on assets above zero)'],
  cfo: ['profit', 'Cash from operations above zero'],
  droa: ['profit', 'Return on assets up on a year before'],
  accruals: ['profit', 'More cash from operations than profit'],
  leverage: ['debt', 'Less long-term debt for its assets than a year before'],
  liquidity: ['debt', 'Current ratio up on a year before'],
  shares: ['debt', 'No new shares issued'],
  margin: ['efficiency', 'Gross margin up on a year before'],
  turnover: ['efficiency', 'More sales for its assets than a year before'],
} as const satisfies Record<string, readonly [CheckGroup, string]>;
export type CheckKey = keyof typeof CHECKS;
/** The three things the checks look at, in words anyone reads. */
const CHECK_GROUPS: Record<CheckGroup, string> = { profit: 'Profit & cash', debt: 'Debt & shares', efficiency: 'Efficiency' };
/** One company on a card that reads others: its logo, its value (the bar), its label; `self` is the company of the page. */
export interface ValueCompany { ticker: string; logo: string | null; value: number | null; label: string; tone?: ValueTone; self?: boolean }
/**
 * A card: a title, a small picture, a big number, a plain line, the fact in a sentence (`say`: the company, the number, the date or
 * period). The title reads after the company's ticker, in lower case but for acronyms ("sales growth", "CEO pay": "NVDA sales
 * growth"). `term` is the words people search for it when they differ from the title. `via` marks pretickt's own analysis — a fact
 * read across other companies (its customers' spending, its competitors' returns, its holders, the banks' analysts) that no single
 * data point gives.
 */
export interface ValueCard {
  tone: ValueTone; title: string; term?: string; big: string; line: string; say: string; why: string; source: string; viz: ValueViz; via?: string;
}
export interface ValueSection { key: ValueKey; tone: ValueTone; verdict: string; cards: ValueCard[] }
/** A question people search and its answer, both templated from the cards' numbers. */
export interface ValueFaq { q: string; a: string }
/**
 * The future `value@1` payload: one company, its six sections, its P/E against its 3-year median (`now` null: a loss over the last
 * 12 months; as pt-quality computes it) and the searched questions the cards answer.
 */
export interface Value {
  asOf: string; ticker: string; name: string; logo: string | null; sections: ValueSection[];
  pe: { now: number | null; median: number | null } | null; faq: ValueFaq[];
}

/** Each column: its word, its plain question, its icon, and the word people search for it when it differs (`term`, beside the word). */
export const QUESTIONS: Record<ValueKey, { name: string; ask: string; icon: string; term?: string }> = {
  demand: { name: 'Demand', ask: 'Do people want more of what it sells?', icon: 'trend-up' },
  advantage: { name: 'Advantage', ask: 'Is it hard to copy?', icon: 'target', term: 'moat' },
  economics: { name: 'Economics', ask: 'Does it make good money?', icon: 'bank' },
  execution: { name: 'Execution', ask: 'Does it deliver what it promises?', icon: 'bolt' },
  fragility: { name: 'Fragility', ask: 'Could something break it?', icon: 'alert', term: 'risks' },
  price: { name: 'Price', ask: 'Is the price reasonable?', icon: 'gauge', term: 'valuation' },
};
const BUSINESS: ValueKey[] = ['demand', 'advantage', 'economics', 'execution', 'fragility'];
/** A P/E within 15% of its 3-year median is about usual (pt-quality's band). */
const PE_BAND = 0.15;
export const NOT_ADVICE = 'pretickt does not say whether to buy or sell.';

/** The price in a sentence: the P/E against its 3-year median, dated; '' without a P/E reading. */
export function priceSentence(v: Value): string {
  const pe = v.pe, on = date(v.asOf);
  if (!pe) return '';
  if (pe.now === null || pe.now <= 0) return `With a loss over the last 12 months, ${v.name} has no P/E ratio (${on}).`;
  if (pe.median === null || pe.median <= 0) return `${v.name}'s P/E ratio is ${num(pe.now, 1)} (${on}).`;
  const r = pe.now / pe.median - 1;
  const [word, rel] = r >= PE_BAND ? ['high', 'above'] : r <= -PE_BAND ? ['low', 'below'] : ['about usual', 'near'];
  return `The price is ${word}: ${num(pe.now, 1)} times its earnings, ${rel} its 3-year median of ${num(pe.median, 1)} (${on}).`;
}

/**
 * The answer to "Is {company} a good stock to buy?" in facts anyone reads: how many of the five questions about the business are
 * strong (`lead`), then the price and that pretickt does not tell anyone to buy or sell (`text`). Never a yes or a no.
 */
export function valueAnswer(v: Value): { lead: string; text: string } {
  const by = (k: ValueKey) => v.sections.find((s) => s.key === k);
  const known = BUSINESS.map(by).filter((s): s is ValueSection => !!s && s.tone !== 'na');
  const strong = known.filter((s) => s.tone === 'pos').length, weak = known.filter((s) => s.tone === 'neg').length;
  const names = (tone: ValueTone) => list(known.filter((s) => s.tone === tone).map((s) => QUESTIONS[s.key].name.toLowerCase()));
  const lead = !known.length ? `The questions about ${v.name}'s business have no data yet.`
    : strong ? `${v.name} is strong on ${strong} of the ${known.length} questions about the business${weak ? `; weak on ${names('neg')}` : ''}.`
    : weak ? `${v.name} is weak on ${names('neg')}${weak < known.length ? `; ${names('flat') || 'the rest'} in between` : ''}.`
    : `${v.name} is in between on every question about the business.`;
  const price = priceSentence(v);
  return { lead, text: price ? `${price} ${NOT_ADVICE}` : NOT_ADVICE };
}

/** "a", "a and b", "a, b and c". */
export const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** A trend's bars in a 120 × 32 box: zero as the baseline, negatives below it. */
export function barGeom(values: number[]) {
  const max = Math.max(...values, 0), min = Math.min(...values, 0), span = max - min || 1, base = 2 + (max / span) * 26;
  const w = Math.min(16, 112 / values.length - 4);
  return { base: Math.round(base * 10) / 10, bars: values.map((v, i) => {
    const h = Math.max(1.5, (Math.abs(v) / span) * 26);
    return { x: Math.round((4 + i * (112 / values.length) + (112 / values.length - w) / 2) * 10) / 10, y: Math.round((v >= 0 ? base - h : base) * 10) / 10,
      w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, neg: v < 0, last: i === values.length - 1 };
  }) };
}
/** The quarters' track in px: 20 high (the first row of `.dv-qs`), the bars inside a 1.5 margin; a 5% beat or miss fills it at least, so small ones stay small. */
export const QS_TRACK = 20;
const PAD = 1.5, ROOM = QS_TRACK - 2 * PAD, MIN_H = 2, FILLS = 0.05;
/**
 * A record's bars on the line of what was expected: beats only, the line at the bottom; misses only, at the top; both, where they
 * meet. Each bar's tone by its sign (in line: a mark on the line), the latest marked, its number for the hover; the fiscal years
 * with how many of the quarters each spans.
 */
export function quarterGeom(quarters: ValueQuarter[], vs: string) {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const up = Math.max(0, ...quarters.map((x) => x.by)), down = Math.max(0, ...quarters.map((x) => -x.by)), span = Math.max(up + down, FILLS);
  const base = r1(down === 0 ? QS_TRACK - PAD : up === 0 ? PAD : PAD + ((up + (span - up - down) / 2) / span) * ROOM);
  const bars = quarters.map((x, i) => {
    const tone = Math.abs(x.by) < 0.0005 ? 'flat' as const : x.by > 0 ? 'pos' as const : 'neg' as const;
    const h = tone === 'flat' ? MIN_H : r1(Math.max(MIN_H, (Math.abs(x.by) / span) * ROOM));
    const top = r1(tone === 'flat' ? base - MIN_H / 2 : tone === 'pos' ? base - h : base);
    return { q: x.q, tone, h, top, last: i === quarters.length - 1, tip: tip({ [`${x.q} ${x.fy}`]: `${pct(x.by)} vs ${vs}` }) };
  });
  const years: { fy: string; span: number }[] = [];
  for (const x of quarters) { const y = years.at(-1); if (y?.fy === x.fy) y.span++; else years.push({ fy: x.fy, span: 1 }); }
  return { base, bars, years, cols: `repeat(${quarters.length}, minmax(0, 1fr))` };
}
/** The checks by group, in order, each passed or missed, with its name for the hover. */
export function checkGroups(ok: Record<CheckKey, boolean>) {
  const keys = Object.keys(CHECKS) as CheckKey[];
  return (Object.keys(CHECK_GROUPS) as CheckGroup[]).map((g) => ({ key: g, label: CHECK_GROUPS[g],
    checks: keys.filter((k) => CHECKS[k][0] === g).map((k) => ({ key: k, ok: ok[k], tip: tip({ [CHECKS[k][1]]: ok[k] ? 'passed' : 'missed' }) })) }));
}
/** A companies card's rows: each bar as a share of the largest value (none without bars or a value), its tone by its sign. */
export function companyRows(rows: ValueCompany[], bars: boolean) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value ?? 0)), 1e-9);
  return rows.map((r) => ({ ...r, self: !!r.self, tone: r.tone ?? (r.value === null ? 'na' : r.value < 0 ? 'neg' : 'pos') as ValueTone,
    width: bars && r.value !== null ? Math.max(3, Math.round((Math.abs(r.value) / max) * 100)) : null }));
}

/** Where `v` falls between `min` and `max`, 0–1, clamped. */
export const at = (v: number, min: number, max: number) => Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
/** A point on the gauge's half circle (centre 60,36, radius 30) for a share 0–1 from the left. */
export const onArc = (t: number, r = 30) => ({ x: Math.round((60 - r * Math.cos(Math.PI * t)) * 10) / 10, y: Math.round((36 - r * Math.sin(Math.PI * t)) * 10) / 10 });
/** The arc's path from share a to share b. */
export const arcPath = (a: number, b: number, r = 30) => { const p = onArc(a, r), q = onArc(b, r); return `M${p.x} ${p.y}A${r} ${r} 0 0 1 ${q.x} ${q.y}`; };

@Component({
  selector: 'pt-value',
  imports: [PtIcon, PtLogo],
  template: `
    @let v = value();
    @if (v === null) {<p class="pt-na">Data not available</p>}
    @else {
      <section class="dv">
        <div class="dv-top">
          <pt-logo [ticker]="v.ticker" [src]="v.logo" [size]="36" />
          <div data-faq>
            <h2 class="dv-q" data-faq-q>Is {{ v.name }} a good stock to buy?</h2>
            <p class="dv-a" data-faq-a><b>{{ answer().lead }}</b> {{ answer().text }}</p>
          </div>
        </div>
        <ol class="dv-strip" aria-label="The six questions at a glance">
          @for (s of v.sections; track s.key) {<li [class]="'dv-chip dv-' + s.tone"><span>{{ QUESTIONS[s.key].name }}</span><b>{{ s.verdict }}</b></li>}
        </ol>
        <div class="dv-cols">
          @for (s of v.sections; track s.key) {
            <div [class]="'dv-col dv-' + s.tone">
              <div class="dv-col-h">
                <span class="dv-name"><svg class="pt-icon" [ptIcon]="QUESTIONS[s.key].icon"></svg>{{ QUESTIONS[s.key].name }}@if (QUESTIONS[s.key].term; as t) {<span class="dv-term">{{ ' ' + t }}</span>}</span>
                <span class="dv-ask">{{ QUESTIONS[s.key].ask }}</span>
                <span [class]="'dv-verdict dv-' + s.tone">{{ s.verdict }}</span>
              </div>
              <div class="dv-stack">
              @for (c of s.cards; track $index) {
                <div [class]="'dv-card dv-' + c.tone" [class.dv-via]="!!c.via" [attr.data-tip]="cardTip(c)">
                  <h3 class="dv-title">{{ v.ticker }} {{ c.title }}@if (c.term) {<span class="dv-term">{{ ' ' + c.term }}</span>}</h3>
                  @if (c.via) {<span class="dv-badge">pretickt analysis</span>}
                  @switch (c.viz.kind) {
                    @case ('bars') {
                      @let g = bars(c);
                      <svg class="dv-viz" viewBox="0 0 120 32" aria-hidden="true">
                        <line class="dv-base" x1="2" x2="118" [attr.y1]="g.base" [attr.y2]="g.base" />
                        @for (b of g.bars; track $index) {<rect [class]="b.last ? 'dv-last-' + c.tone : b.neg ? 'dv-bar-neg' : 'dv-bar'" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="1.5" />}
                      </svg>
                    }
                    @case ('vs') {
                      @let m = vs(c);
                      <svg class="dv-viz" viewBox="0 0 120 32" aria-hidden="true">
                        <rect [class]="'dv-last-' + c.tone" x="0" y="3" [attr.width]="m.it" height="10" rx="2" /><text class="dv-t" [attr.x]="m.it + 3" y="11">it</text>
                        <rect class="dv-bar" x="0" y="19" [attr.width]="m.peers" height="10" rx="2" /><text class="dv-t" [attr.x]="m.peers + 3" y="27">peers</text>
                      </svg>
                    }
                    @case ('dots') {
                      @let d = dots(c);
                      <svg class="dv-viz" viewBox="0 0 120 32" aria-hidden="true">
                        @for (x of d; track $index) {<circle [class]="x.on ? 'dv-dot-' + c.tone : 'dv-dot'" [attr.cx]="x.cx" cy="16" r="4.2" />}
                      </svg>
                    }
                    @case ('checks') {
                      <div class="dv-ck" aria-hidden="true">
                        @for (g of checks(c); track g.key) {<span class="dv-ck-g">{{ g.label }}</span><span class="dv-ck-row">@for (x of g.checks; track x.key) {<svg [ptIcon]="x.ok ? 'check' : 'x'" [class.dv-ck-on]="x.ok" [class.dv-ck-off]="!x.ok" [attr.data-tip]="x.tip"></svg>}</span>}
                      </div>
                    }
                    @case ('quarters') {
                      @let g = quarters(c);
                      <div class="dv-qs" [style.grid-template-columns]="g.cols" aria-hidden="true">
                        <i class="dv-qs-base" [style.top.px]="g.base"></i>
                        @for (b of g.bars; track $index) {<span class="dv-qs-slot" [attr.data-tip]="b.tip"><i [class]="'dv-qs-bar dv-qs-' + b.tone" [class.dv-qs-last]="b.last" [style.top.px]="b.top" [style.height.px]="b.h"></i></span>}
                        @for (b of g.bars; track $index) {<span class="dv-qs-q">{{ b.q }}</span>}
                        @for (y of g.years; track $index) {<span class="dv-qs-y" [style.grid-column]="'span ' + y.span">{{ y.fy }}</span>}
                      </div>
                    }
                    @case ('gauge') {
                      @let q = gauge(c);
                      <svg class="dv-viz dv-viz-tall" viewBox="0 0 120 40" aria-hidden="true">
                        <path class="dv-zone-neg" [attr.d]="q.red" /><path class="dv-zone-flat" [attr.d]="q.amber" /><path class="dv-zone-pos" [attr.d]="q.green" />
                        <line class="dv-needle" x1="60" y1="36" [attr.x2]="q.needle.x" [attr.y2]="q.needle.y" /><circle class="dv-needle-c" cx="60" cy="36" r="3" />
                      </svg>
                    }
                    @case ('range') {
                      @let r = range(c);
                      <svg class="dv-viz" viewBox="0 0 120 32" aria-hidden="true">
                        <line class="dv-track" x1="6" x2="114" y1="12" y2="12" />
                        @if (r.mark !== null) {<line class="dv-mark" [attr.x1]="r.mark" [attr.x2]="r.mark" y1="6" y2="18" />}
                        <circle [class]="'dv-dot-' + c.tone" [attr.cx]="r.value" cy="12" r="5" />
                        <text class="dv-t" x="6" y="29">{{ r.labels[0] }}</text><text class="dv-t" x="114" y="29" text-anchor="end">{{ r.labels[1] }}</text>
                      </svg>
                    }
                    @case ('split') {
                      @let p = split(c);
                      <svg class="dv-viz" viewBox="0 0 120 32" aria-hidden="true">
                        @for (x of p; track $index) {<rect [class]="$first ? 'dv-last-' + c.tone : 'dv-bar dv-bar-' + $index" [attr.x]="x.x" y="4" [attr.width]="x.w" height="12" rx="2" />}
                        @if (p[0]; as f) {<text class="dv-t" x="0" y="28">{{ f.label }}</text>}
                      </svg>
                    }
                    @case ('companies') {
                      <ul class="dv-cos">
                        @for (r of companies(c); track r.ticker) {
                          <li [class.dv-self]="r.self">
                            <pt-logo [ticker]="r.ticker" [src]="r.logo" [size]="16" />
                            <a class="pt-mention dv-co-t" [href]="stockHref(r.ticker)">{{ r.ticker }}</a>
                            @if (r.width !== null) {<span class="dv-co-track"><i [class]="'dv-co-bar dv-last-' + r.tone" [style.width.%]="r.width"></i></span>}
                            <span [class]="'dv-co-v dv-co-' + r.tone">{{ r.label }}</span>
                          </li>
                        }
                      </ul>
                    }
                  }
                  <b class="dv-big">{{ c.big }}</b>
                  <span class="dv-line">{{ c.line }}</span>
                  <p class="dv-say">{{ c.say }}</p>
                </div>
              }
              </div>
            </div>
          }
        </div>
        @if (v.faq.length) {
          <div class="dv-faq">
            @for (f of v.faq; track f.q) {<div class="dv-faq-i" data-faq [id]="'value-' + faqId(f.q)"><h3 class="dv-faq-q" data-faq-q>{{ f.q }}</h3><p class="dv-faq-a" data-faq-a>{{ f.a }}</p></div>}
          </div>
        }
        <p class="pt-note">Made-up numbers, to look at the design; real ones come from FMP and the filings. Each card says what a fact means for its
          question, never what to do with the stock. For information only — not investment advice. As of {{ date(v.asOf) }}.</p>
      </section>
    }`,
})
export class PtValue {
  readonly data = input.required<Value | null>();
  /** The payload with the company's common name ("Nvidia", whatever the provider calls it): every sentence names it so. */
  protected readonly value = computed(() => { const v = this.data(); return v ? { ...v, name: plainName(v.name) } : null; });
  protected readonly answer = computed(() => { const v = this.value(); return v ? valueAnswer(v) : { lead: '', text: '' }; });
  protected readonly faqId = faqId;
  protected readonly stockHref = stockHref;
  protected readonly QUESTIONS = QUESTIONS;
  protected readonly date = date;
  protected readonly cardTip = (c: ValueCard) => tip({ [c.big]: c.line, Why: c.why, 'pretickt analysis': c.via ?? null, Source: c.source });
  protected companies(c: ValueCard) { return c.viz.kind === 'companies' ? companyRows(c.viz.rows, c.viz.bars) : []; }
  protected bars(c: ValueCard) { return c.viz.kind === 'bars' ? barGeom(c.viz.values) : { base: 0, bars: [] }; }
  protected quarters(c: ValueCard) { return c.viz.kind === 'quarters' ? quarterGeom(c.viz.quarters, c.viz.vs) : quarterGeom([], ''); }
  protected checks(c: ValueCard) { return c.viz.kind === 'checks' ? checkGroups(c.viz.ok) : []; }
  protected vs(c: ValueCard) {
    if (c.viz.kind !== 'vs') return { it: 0, peers: 0 };
    const max = Math.max(c.viz.value, c.viz.peers, 1e-9);
    return { it: Math.max(2, (c.viz.value / max) * 90), peers: Math.max(2, (c.viz.peers / max) * 90) };
  }
  protected dots(c: ValueCard) {
    if (c.viz.kind !== 'dots') return [];
    const { hits, total } = c.viz, step = Math.min(13, 112 / Math.max(total, 1));
    return Array.from({ length: total }, (_, i) => ({ cx: Math.round((6 + i * step) * 10) / 10, on: i < hits }));
  }
  protected gauge(c: ValueCard) {
    if (c.viz.kind !== 'gauge') return { red: '', amber: '', green: '', needle: { x: 60, y: 36 } };
    const { value, min, max, zones } = c.viz, a = at(zones[0], min, max), b = at(zones[1], min, max);
    return { red: arcPath(0, a), amber: arcPath(a, b), green: arcPath(b, 1), needle: onArc(at(value, min, max), 24) };
  }
  protected range(c: ValueCard) {
    if (c.viz.kind !== 'range') return { value: 0, mark: null, labels: ['', ''] as [string, string] };
    const { low, high, value, mark, labels } = c.viz, x = (n: number) => Math.round((6 + at(n, low, high) * 108) * 10) / 10;
    return { value: x(value), mark: mark === undefined ? null : x(mark), labels: labels ?? ['low', 'high'] };
  }
  protected split(c: ValueCard) {
    if (c.viz.kind !== 'split') return [];
    let x = 0;
    return c.viz.parts.map((p) => { const w = Math.max(2, p.share * 118); const r = { x: Math.round(x * 10) / 10, w: Math.round(w * 10) / 10, label: p.label }; x += w + 1; return r; });
  }
}

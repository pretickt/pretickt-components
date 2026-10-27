/**
 * DRAFT · Is this a company of value? (made-up data, stories only) — for anyone, not only investors: six plain questions side by
 * side (Demand, Advantage, Economics, Execution, Fragility, Price), each with a verdict in words and a few schematic cards, a number
 * and a small picture each. The answer on top says how many of the five questions about the business are strong, and what the
 * price already counts on. Each card names the FMP endpoint that will feed it (Romeo's coverage analysis, 2026-10-27); the facts
 * FMP does not have (customers, market share, risk factors, short interest) show as "not measured yet".
 * @version 0.0.1
 */
import { Component, computed, input } from '@angular/core';
import { PtIcon, PtLogo } from '@pretickt/components/ds';
import { date, tip } from '@pretickt/components/format';

export type ValueKey = 'demand' | 'advantage' | 'economics' | 'execution' | 'fragility' | 'price';
export type ValueTone = 'pos' | 'flat' | 'neg' | 'na';
export type ValueViz =
  | { kind: 'bars'; values: number[]; labels?: string[] }          // a trend: years or quarters, the last one in its tone
  | { kind: 'vs'; value: number; peers: number; unit: '%' | '×' }  // the company against its peers' median
  | { kind: 'dots'; hits: number; total: number }                  // so many of so many: beats, checks passed
  | { kind: 'gauge'; value: number; min: number; max: number; zones: [number, number] } // a score with a red, amber, green zone
  | { kind: 'range'; low: number; high: number; value: number; mark?: number; labels?: [string, string] } // where it sits in a range
  | { kind: 'split'; parts: { label: string; share: number }[] }   // shares of a whole: segments, pay
  | { kind: 'missing' };                                          // the data has no source yet
export interface ValueCard { tone: ValueTone; big: string; line: string; why: string; source: string; viz: ValueViz }
export interface ValueSection { key: ValueKey; tone: ValueTone; verdict: string; cards: ValueCard[] }
/** The future `value@1` payload: one company, its six sections. */
export interface Value { asOf: string; ticker: string; name: string; logo: string | null; sections: ValueSection[] }

export const QUESTIONS: Record<ValueKey, { name: string; ask: string; icon: string }> = {
  demand: { name: 'Demand', ask: 'Do people want more of what it sells?', icon: 'trend-up' },
  advantage: { name: 'Advantage', ask: 'Is it hard to copy?', icon: 'target' },
  economics: { name: 'Economics', ask: 'Does it make good money?', icon: 'bank' },
  execution: { name: 'Execution', ask: 'Does it deliver what it promises?', icon: 'bolt' },
  fragility: { name: 'Fragility', ask: 'Could something break it?', icon: 'alert' },
  price: { name: 'Price', ask: 'Is the price reasonable?', icon: 'gauge' },
};
const BUSINESS: ValueKey[] = ['demand', 'advantage', 'economics', 'execution', 'fragility'];

/** The answer on top, in words anyone reads: how many of the five questions about the business are strong, then the price. */
export function valueAnswer(v: Value): { lead: string; text: string } {
  const by = (k: ValueKey) => v.sections.find((s) => s.key === k);
  const known = BUSINESS.map(by).filter((s): s is ValueSection => !!s && s.tone !== 'na');
  const strong = known.filter((s) => s.tone === 'pos').length, weak = known.filter((s) => s.tone === 'neg').length;
  const lead = !known.length ? 'Not enough data yet' : strong >= 4 && weak === 0 ? 'Mostly yes' : weak >= 3 ? 'Mostly no' : weak > strong ? 'Not really, for now' : 'In part';
  const names = (tone: ValueTone) => list(known.filter((s) => s.tone === tone).map((s) => QUESTIONS[s.key].name.toLowerCase()));
  const price = by('price');
  const business = !known.length ? 'The questions about the company have no data yet'
    : strong ? `A strong business on ${strong} of the ${known.length} questions about the company${weak ? `; weak on ${names('neg')}` : ''}`
    : weak ? `Weak on ${names('neg')}${weak < known.length ? `; ${names('flat') || 'the rest'} in between` : ''}` : 'Nothing strong, nothing weak: in between on every question';
  return { lead, text: `${business}.${price && price.tone !== 'na' ? ` The price: ${price.verdict}.` : ''}` };
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
    @let v = data();
    @if (v === null) {<p class="pt-na">Data not available</p>}
    @else {
      <section class="dv">
        <div class="dv-top">
          <pt-logo [ticker]="v.ticker" [src]="v.logo" [size]="36" />
          <div>
            <p class="dv-q">Is {{ v.name }} a company of value?</p>
            <p class="dv-a"><b>{{ answer().lead }}.</b> {{ answer().text }}</p>
          </div>
        </div>
        <ol class="dv-strip" aria-label="The six questions at a glance">
          @for (s of v.sections; track s.key) {<li [class]="'dv-chip dv-' + s.tone"><span>{{ QUESTIONS[s.key].name }}</span><b>{{ s.verdict }}</b></li>}
        </ol>
        <div class="dv-cols">
          @for (s of v.sections; track s.key) {
            <div [class]="'dv-col dv-' + s.tone">
              <div class="dv-col-h">
                <span class="dv-name"><svg class="pt-icon" [ptIcon]="QUESTIONS[s.key].icon"></svg>{{ QUESTIONS[s.key].name }}</span>
                <span class="dv-ask">{{ QUESTIONS[s.key].ask }}</span>
                <span [class]="'dv-verdict dv-' + s.tone">{{ s.verdict }}</span>
              </div>
              @for (c of s.cards; track $index) {
                <div [class]="'dv-card dv-' + c.tone" [attr.data-tip]="cardTip(c)">
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
                    @case ('missing') {
                      <svg class="dv-viz" viewBox="0 0 120 32" aria-hidden="true"><rect class="dv-missing" x="1" y="4" width="118" height="24" rx="4" /><text class="dv-t" x="60" y="20" text-anchor="middle">not measured yet</text></svg>
                    }
                  }
                  <b class="dv-big">{{ c.big }}</b>
                  <span class="dv-line">{{ c.line }}</span>
                </div>
              }
            </div>
          }
        </div>
        <p class="pt-note">Made-up numbers, to look at the design; real ones come from FMP and the filings. Each card says what a fact means for its
          question, never what to do with the stock. For information only — not investment advice. As of {{ date(v.asOf) }}.</p>
      </section>
    }`,
})
export class PtValue {
  readonly data = input.required<Value | null>();
  protected readonly answer = computed(() => { const v = this.data(); return v ? valueAnswer(v) : { lead: '', text: '' }; });
  protected readonly QUESTIONS = QUESTIONS;
  protected readonly date = date;
  protected readonly cardTip = (c: ValueCard) => tip({ [c.big]: c.line, Why: c.why, Source: c.source });
  protected bars(c: ValueCard) { return c.viz.kind === 'bars' ? barGeom(c.viz.values) : { base: 0, bars: [] }; }
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

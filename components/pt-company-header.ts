/**
 * How does this company look right now: its price over three months and today (15 minutes late), and how the data divide between the
 * two sides, counted, never weighed and never concluded?
 * @version 1.0.0
 * @evidence Romeo, 2026-11-05: the company page's header, «si capisce subito quali sono a favore di un rialzo e quali a favore di un ribasso», «senza dare mai consigli»
 * @evidence design: pretickt/docs/superpowers/specs/2026-11-05-company-header-bands-design.md
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtLogo } from '@pretickt/components/ds';
import { money, pct, plainName, usd, type Badge } from '@pretickt/components/format';
import { bollinger, macd, rsi, smaLast } from '@pretickt/components/indicators';
import { METRIC_KEYS, type MetricItem } from '@pretickt/components/typologies';

export type Side = 'g' | 'n' | 'r';
/** The badges whose catalogue tone already says a direction. */
const FOLLOWS_TONE = new Set(['pt_upside', 'consensus', 'pe_vs_own', 'pe_vs_sector', 'fcf_yield', 'insider_net', 'news', 'trend', 'ma_detail', 'macd', 'sector_trend']);
const BY_TONE: Partial<Record<MetricItem['tone'], Side>> = { pos: 'g', neg: 'r' };

/**
 * The band a badge goes in, or null when it has no data. A catalogue tone means "good or worth a look", not up or down: RSI and Bollinger read
 * both extremes as red, a near support is red, and the volume is green on a falling day, so those are decided here.
 */
export function lean(m: MetricItem): Side | null {
  if (m.tone === 'na') return null;
  if (m.key === 'rsi14') return m.value == null ? 'n' : m.value <= 30 ? 'g' : m.value >= 70 ? 'r' : 'n';
  if (m.key === 'bollinger') return m.text === 'below lower' ? 'g' : m.text === 'above upper' ? 'r' : 'n';
  // a projected cross ("↑ in ~5d") is a forecast: it counts once it has happened
  if (m.key === 'ma_cross') return /^Golden/.test(m.text ?? '') ? 'g' : /^Death/.test(m.text ?? '') ? 'r' : 'n';
  return FOLLOWS_TONE.has(m.key) ? BY_TONE[m.tone] ?? 'n' : 'n';
}

/** A delayed price further than this from the page's close is on another basis (a split, a re-based day): nothing is recomputed. */
const OTHER_BASIS = 0.5;
const band = (v: number, pos: number, neg: number): MetricItem['tone'] => (v > pos ? 'pos' : v < neg ? 'neg' : 'flat');
const peTone = (v: number): MetricItem['tone'] => (v < -0.1 ? 'pos' : v > 0.1 ? 'neg' : 'flat');
const countTone = (n: number): MetricItem['tone'] => (n >= 3 ? 'pos' : n <= 1 ? 'neg' : 'flat');

/**
 * Every badge at the delayed price `p`: the ratios from the build's values against the last close `c0`, the indicators from the last 300 closes with `p` as
 * today's close (the nightly reads 300 too). `closes` null: those keep their build values. What depends on more than the price stays at the last close.
 */
export function livened(items: MetricItem[], p: number, c0: number, closes: readonly number[] | null): MetricItem[] {
  const r = p / c0;
  if (!Number.isFinite(r) || Math.abs(r - 1) > OTHER_BASIS) return items;
  const cs = closes ? [...closes, p].slice(-300) : null;
  const above = cs && [20, 50, 100, 200].map((w) => { const a = smaLast(cs, w); return [w, a != null && p > a] as const; });
  const n = above?.filter((a) => a[1]).length ?? 0;
  return items.map((m) => {
    if (m.value == null && m.text == null) return m;
    const v = m.value ?? 0;
    switch (m.key) {
      case 'pt_upside': { const x = (1 + v) / r - 1; return { ...m, value: x, tone: band(x, 0.05, 0) }; }
      case 'pe': case 'market_cap': return { ...m, value: v * r };
      case 'pe_vs_own': case 'pe_vs_sector': { const x = (1 + v) * r - 1; return { ...m, value: x, tone: peTone(x) }; }
      case 'fcf_yield': { const x = v / r; return { ...m, value: x, tone: band(x, 0.04, 0) }; }
      case 'off_high': case 'off_ath': return { ...m, value: Math.min(0, (1 + v) * r - 1) };
      case 'range_52w': return { ...m, value: p };
      case 'support': case 'resistance': return { ...m, value: (1 + v) / r - 1 };
    }
    if (!cs) return m;
    switch (m.key) {
      case 'ma_detail': return { ...m, value: n, text: above!.map(([w, up]) => `${w}${up ? '▲' : '▼'}`).join(' '), tone: countTone(n) };
      case 'trend_ma': return { ...m, value: n, text: `${n} of 4 above`, tone: countTone(n) };
      case 'rsi14': { const x = rsi(cs).at(-1); return x == null ? m : { ...m, value: x, text: String(Math.round(x)) }; }
      case 'macd': { const d = macd(cs), a = d.macd.at(-1), b = d.signal.at(-1); if (a == null || b == null) return m; const x = a - b; return { ...m, value: x, tone: x > 0 ? 'pos' : 'neg' }; }
      case 'bollinger': {
        const b = bollinger(cs), lo = b.lower.at(-1), hi = b.upper.at(-1), mid = b.mid.at(-1);
        if (lo == null || hi == null || mid == null || hi === lo) return m;
        const state = p > hi ? 'above upper' : p < lo ? 'below lower' : p >= mid ? 'upper half' : 'lower half';
        return { ...m, value: (p - lo) / (hi - lo), text: state, tone: p > hi || p < lo ? 'neg' : 'flat' };
      }
      default: return m;
    }
  });
}

const LEAN_ORDER = ['pt_upside', 'consensus', 'pe_vs_own', 'pe_vs_sector', 'fcf_yield', 'insider_net', 'news', 'trend', 'ma_detail', 'ma_cross', 'macd', 'rsi14', 'bollinger', 'sector_trend'];
const NEUTRAL_ORDER = ['earnings_in', 'pe', 'rsi14', 'support', 'resistance', 'off_high', 'volume_ratio', 'bollinger', 'news', 'fcf_yield', 'pe_vs_own', 'pe_vs_sector', 'consensus', 'pt_upside',
  'trend', 'sector_trend', 'range_52w', 'atr_pct', 'off_ath', 'insider_net', 'ma_detail', 'ma_cross', 'macd'];
/** Said elsewhere in the box: the market cap in its top row, the count of averages as the MAs badge's value. */
const NOT_BADGES = new Set(['market_cap', 'trend_ma']);
const TONE_OF: Record<Side, MetricItem['tone']> = { g: 'pos', n: 'flat', r: 'neg' };
const inOrder = (order: string[]) => (a: Badge, b: Badge) => {
  const at = (x: Badge) => { const i = order.indexOf(x.key); return i < 0 ? order.length : i; };
  return at(a) - at(b);
};

/** The dollars of the average target, from the build's upside against the close it was measured on: it does not change during the session. */
export function targetOf(items: MetricItem[], c0: number | null): number | null {
  const v = items.find((m) => m.key === 'pt_upside')?.value;
  return v == null || c0 == null ? null : c0 * (1 + v);
}

/** The three bands, in their order, each badge in its band's colour and in the box's words. */
export function bandsOf(items: MetricItem[], o: { target: number | null; low: boolean }): Record<Side, Badge[]> {
  const out: Record<Side, Badge[]> = { g: [], n: [], r: [] };
  const count = items.find((m) => m.key === 'trend_ma')?.text;
  for (const m of items) {
    const s = lean(m);
    if (s === null || NOT_BADGES.has(m.key)) continue;
    let b: Badge = { ...m, tone: TONE_OF[s] };
    if (m.key === 'pt_upside') {
      if (o.low) b = { ...b, label: 'PT' };
      if (o.target != null && m.value != null) b = { ...b, text: `${money(o.target)} ${pct(m.value)}` };
    } else if (m.key === 'consensus' && m.text) b = { ...b, text: `${m.text} · ${m.value}` };
    else if (m.key === 'ma_detail' && count) b = { ...b, text: count.replace(' above', '') };
    else if (m.key === 'range_52w' && m.range) b = { ...b, text: `${usd(m.range.lo, { digits: 0 })}–${usd(m.range.hi, { digits: 0 })}` };
    out[s].push(b);
  }
  out.g.sort(inOrder(LEAN_ORDER));
  out.r.sort(inOrder(LEAN_ORDER));
  out.n.sort(inOrder(NEUTRAL_ORDER));
  return out;
}

/** The heights of green and red, in proportion to their counts; the floor keeps a small band readable. */
export function bandRows(g: number, r: number): string {
  const floor = Math.max(1, (g + r || 1) * 0.22);
  return `${Math.max(g, floor).toFixed(2)}fr auto ${Math.max(r, floor).toFixed(2)}fr`;
}

export interface SessionLine { session: string; prev?: string; time: string; closed: boolean; closes: (number | null)[] }
export type SessionState = 'static' | 'running' | 'closing' | 'settled';
export interface SessionView { hist: { t: string; c: number }[]; slots: (number | null)[]; price: number | null; prev: number | null; state: SessionState }

/** What the chart and the price show, from the page's closes and the session's line (see the design's table). */
export function sessionView(points: { t: string; c: number }[], line: SessionLine | null): SessionView {
  const last = points.at(-1);
  const own: SessionView = { hist: points, slots: [], price: last?.c ?? null, prev: points.at(-2)?.c ?? null, state: 'static' };
  const newest = line?.closes.filter((v) => v != null).at(-1);
  if (!last || !line || newest == null) return last ? own : { ...own, hist: [] };
  if (line.session === last.t) return { hist: points.slice(0, -1), slots: line.closes, price: last.c, prev: points.at(-2)?.c ?? null, state: 'settled' };
  if (line.session > last.t && (line.prev == null || line.prev === last.t)) return { hist: points, slots: line.closes, price: newest, prev: last.c, state: line.closed ? 'closing' : 'running' };
  return own;
}

@Component({
  selector: 'pt-company-header',
  imports: [PtLogo],
  template: `
    @if (ready().settled && !ready().available) {<p class="pt-na">Data not available</p>}
    @else if (ready().settled) {
      <section [class]="'pt-card pt-hdr pt-hdr-' + size()">
        <div class="pt-card-id">
          <pt-logo [ticker]="ticker()" [src]="co.value()?.logo ?? null" [size]="size() === 'full' ? 38 : 28" />
          <div class="pt-card-who">
            <div class="pt-card-name">{{ co.value()?.name ? plainName(co.value()!.name) : ticker() }}</div>
          </div>
        </div>
      </section>
    }`,
})
export class PtCompanyHeader {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  /** full: the company's main page; low: its sub-pages, so the answer below stays high. */
  readonly size = input<'full' | 'low'>('full');

  protected readonly co = this.pt.company(() => ({ ticker: this.ticker() }));
  protected readonly metrics = this.pt.metric(() => ({ ticker: this.ticker(), metrics: [...METRIC_KEYS] }));
  protected readonly series = this.pt.priceSeries(() => ({ tickers: [this.ticker()], range: '3m' }));
  protected readonly ready = computed(() => {
    const vs = [this.co.value(), this.metrics.value(), this.series.value()];
    return { settled: vs.every((v) => v !== undefined), available: vs.some((v) => v != null) };
  });
  protected readonly plainName = plainName;
}

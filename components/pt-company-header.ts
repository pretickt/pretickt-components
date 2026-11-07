/**
 * How does this company look right now: its price over three months and today (15 minutes late), and how the data divide between the
 * two sides, counted, never weighed and never concluded?
 * @version 1.2.0
 * @evidence design of the fund pages, 2026-11-05: a fund's header says how much of it the basket figures cover
 * @evidence design of the sector pages, 2026-11-07: with `sector`, what its companies are worth over the year and today, the basket's badges only, the fund line
 * @evidence Romeo, 2026-11-05: the company page's header, «si capisce subito quali sono a favore di un rialzo e quali a favore di un ribasso», «senza dare mai consigli»
 * @evidence design: pretickt/docs/superpowers/specs/2026-11-05-company-header-bands-design.md
 */
import { afterRenderEffect, Component, computed, type ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Pt, PtLive, type LiveBars } from '@pretickt/components/context';
import { PtBadge, PtLogo } from '@pretickt/components/ds';
import { date, dayMonth, level, money, num, pct, plainName, tone, usd, type Badge } from '@pretickt/components/format';
import { bollinger, macd, rsi, smaLast } from '@pretickt/components/indicators';
import { METRIC_KEYS, sectorFundLine, type MetricItem, type Sector, type SectorBasket } from '@pretickt/components/typologies';

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
    } else if (m.key === 'consensus' && m.text) b = { ...b, text: `${m.text} · ${num(m.value, 0)}` };
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

/**
 * A sector's line of the session, from its companies' bars: at each 5-minute slot, its value at the last close times each company's close against its
 * own last close, weighted. A company with no bar yet counts flat; a slot no company has traded is empty. Null when the bars follow another session than the
 * payload's (its weights and closes are that session's).
 */
export function sectorLine(b: SectorBasket, l: LiveBars): SessionLine | null {
  if (l.prev !== b.asOf) return null;
  const rows = b.holdings.filter((h) => h.ticker && h.close && h.weight > 0);
  const total = rows.reduce((s, h) => s + h.weight, 0), n = Math.max(0, ...rows.map((h) => l.bars[h.ticker!]?.length ?? 0));
  const closes = Array.from({ length: n }, (_, i) => {
    let traded = false;
    const v = rows.reduce((s, h) => { const c = l.bars[h.ticker!]?.[i]; if (c != null) traded = true; return s + h.weight * (c != null ? c / h.close! : 1); }, 0);
    return traded && total ? b.value * v / total : null;
  });
  return { session: l.session, prev: l.prev, time: l.time, closed: l.closed, closes };
}
export type SessionState = 'static' | 'running' | 'closing' | 'settled';
export interface SessionView { hist: { t: string; c: number }[]; slots: (number | null)[]; price: number | null; prev: number | null; state: SessionState }

/** What the chart and the price show, from the page's closes and the session's line (see the design's table). */
export function sessionView(points: { t: string; c: number }[], line: SessionLine | null): SessionView {
  const last = points.at(-1);
  const own: SessionView = { hist: points, slots: [], price: last?.c ?? null, prev: points.at(-2)?.c ?? null, state: 'static' };
  const newest = line?.closes.filter((v) => v != null).at(-1);
  if (!last || !line || newest == null) return last ? own : { ...own, hist: [] };
  if (Math.abs(newest / last.c - 1) > OTHER_BASIS) return own; // a split or re-based day: price, change, chart and badges all keep the page's data
  if (line.session === last.t) return { hist: points.slice(0, -1), slots: line.closes, price: last.c, prev: points.at(-2)?.c ?? null, state: 'settled' };
  if (line.session > last.t && (line.prev == null || line.prev === last.t)) return { hist: points, slots: line.closes, price: newest, prev: last.c, state: line.closed ? 'closing' : 'running' };
  return own;
}

export interface Chart {
  w: number; h: number; zoneX: number; top: number; y1: number; lo: number; hi: number; hist: string; day: string; areaHist: string; areaDay: string;
  dot: { x: number; y: number } | null; ticks: { y: number; label: string }[]; months: { x: number; label: string }[]; showOpen: boolean;
  points: { x: number; y: number; t: string | null; slot: number | null; v: number }[];
}
const SLOTS = 78;
/** The least room between two month labels: "Sep" is about 20 px at the axis's size. */
const MONTH_GAP = 26;
const niceStep = (x: number) => { const p = 10 ** Math.floor(Math.log10(x)), f = x / p; return Math.max(1, (f <= 1.4 ? 1 : f <= 3 ? 2 : f <= 7 ? 5 : 10) * p); };

/** Three months on the first 80% of the plot, the session (9:30 to 16:00) on the rest, one linear scale for both. Null with nothing to draw. */
export function chartOf(hist: { t: string; c: number }[], slots: (number | null)[], prev: number | null, w: number, h: number, low: boolean,
  fmt: (v: number) => string = (v) => `$${v.toFixed(0)}`): Chart | null {
  const day = slots.flatMap((v, i) => (v == null ? [] : [[i, v] as const]));
  const vals = [...hist.map((p) => p.c), ...day.map((d) => d[1])];
  if (vals.length < 2) return null;
  const L = 30, top = low ? 18 : 34, y1 = h - (low ? 15 : 18), zoneX = Math.round(L + (w - L) * 0.8);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const margin = (hi - lo || hi * 0.01) * 0.08;
  const steps = low ? 2 : 3, step = niceStep((hi - lo || hi * 0.01) / steps);
  const ticks: number[] = [];
  for (let v = Math.ceil((lo - margin) / step) * step; v <= hi + margin; v += step) ticks.push(v);
  lo -= margin; hi += margin;
  const sy = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - top);
  const xh = (i: number) => L + ((zoneX - L) * i) / Math.max(1, hist.length - 1);
  const xd = (i: number) => zoneX + 3 + ((w - zoneX - 3) * i) / (SLOTS - 1);
  const f = (n: number) => +n.toFixed(1);
  const pts = (a: (readonly [number, number])[]) => a.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
  const histXY = hist.map((p, i) => [xh(i), sy(p.c)] as const);
  const dayXY = day.map(([i, v]) => [xd(i), sy(v)] as const);
  const fromPrev = day.length && prev != null ? [[zoneX, sy(prev)] as const] : [];
  const end = dayXY.at(-1) ?? histXY.at(-1);
  const months: Chart['months'] = [];
  // a month that would touch the one before is left out (a sector's year on a phone: twelve labels in 300 px)
  hist.forEach((p, i) => {
    if (i && p.t.slice(0, 7) !== hist[i - 1]!.t.slice(0, 7) && xh(i) < zoneX - 22 && (!months.length || xh(i) - months.at(-1)!.x >= MONTH_GAP)) months.push({ x: f(xh(i)), label: date(p.t).slice(0, 3) });
  });
  return {
    w, h, zoneX, top, y1, lo, hi, hist: pts(histXY), day: pts([...fromPrev, ...dayXY]),
    areaHist: histXY.length ? pts([[L, y1], ...histXY, [histXY.at(-1)![0], y1]]) : '',
    areaDay: dayXY.length ? pts([[zoneX, y1], ...fromPrev, ...dayXY, [dayXY.at(-1)![0], y1]]) : '',
    dot: end ? { x: f(end[0]), y: f(end[1]) } : null,
    ticks: ticks.map((v) => ({ y: f(sy(v)), label: fmt(v) })), months, showOpen: w - zoneX >= 62,
    points: [...hist.map((p, i) => ({ x: xh(i), y: sy(p.c), t: p.t, slot: null, v: p.c })), ...day.map(([i, v]) => ({ x: xd(i), y: sy(v), t: null, slot: i, v }))],
  };
}
const flash = (el: HTMLElement | null) => {
  if (!el) return;
  el.classList.remove('pt-hdr-flash');
  void el.offsetWidth; // the animation starts again on a value that changes twice
  el.classList.add('pt-hdr-flash');
};
/** How many badges of a one-line row wrapped out of sight. */
export function overflowCount(ul: HTMLElement): number {
  const kids = [...ul.children] as HTMLElement[];
  const first = kids[0]?.offsetTop ?? 0;
  return kids.filter((k) => k.offsetTop > first).length;
}
const slotTime = (i: number) => { const t = 570 + i * 5, m = t % 60, h = Math.floor(t / 60); return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'} ET`; };

@Component({
  selector: 'pt-company-header',
  imports: [PtBadge, PtLogo],
  template: `
    @if (ready().settled && !ready().available) {<p class="pt-na">Data not available</p>}
    @else if (ready().settled) {
      @let low = size() === 'low';
      @let b = bands();
      <section #root [class]="'pt-card pt-hdr pt-hdr-' + size()">
        <div class="pt-hdr-head">
          <div class="pt-card-id">
            @if (ticker(); as t) {<pt-logo [ticker]="t" [src]="co.value()?.logo ?? null" [size]="low ? 28 : 38" />}
            <div class="pt-card-who">
              @let title = sec()?.name ?? (co.value()?.name ? plainName(co.value()!.name) : ticker() ?? '');
              <div class="pt-card-name">{{ title }}</div>
              <div class="pt-meta">{{ subLine(title) }}</div>
            </div>
          </div>
          <div class="pt-hdr-px">
            <div class="pt-hdr-price">
              @if (price() != null) {<span class="pt-card-close">{{ fmt(price()) }}</span>}
              @if (change() != null) {<span [class]="'pt-hdr-chg pt-t-' + tone(change())">{{ pct(change()) }}</span>}
            </div>
            <span class="pt-meta">{{ when() }}</span>
            @if (targetText(); as t) {<span [class]="'pt-card-pt pt-tone-' + tone(upside())" hidden>{{ t }}</span>}
          </div>
        </div>
        <div class="pt-hdr-body" [class.pt-hdr-solo]="!chart()">
          @if (chart(); as g) {
            <div class="pt-hdr-chart" #chartEl (pointermove)="hoverAt($event, g)" (pointerleave)="hover.set(null)">
              <svg class="pt-hdr-svg" [attr.viewBox]="'0 0 ' + g.w + ' ' + g.h" preserveAspectRatio="xMinYMin meet" role="img" [attr.aria-label]="chartLabel()">
                <rect class="pt-hdr-zone" [attr.x]="g.zoneX" [attr.y]="g.top - 6" [attr.width]="g.w - g.zoneX" [attr.height]="g.y1 - g.top + 6" />
                @for (t of g.ticks; track t.label) {
                  <line class="pt-hdr-grid" x1="30" [attr.x2]="g.w" [attr.y1]="t.y" [attr.y2]="t.y" />
                  <text class="pt-hdr-ax" x="0" [attr.y]="t.y + 3.5">{{ t.label }}</text>
                }
                <line class="pt-hdr-grid" [attr.x1]="g.zoneX" [attr.x2]="g.zoneX" [attr.y1]="g.top - 6" [attr.y2]="g.y1" />
                <line class="pt-hdr-grid" x1="30" [attr.x2]="g.w" [attr.y1]="g.y1" [attr.y2]="g.y1" />
                @for (m of g.months; track m.label) {<text class="pt-hdr-ax" [attr.x]="m.x" [attr.y]="g.h - 5">{{ m.label }}</text>}
                @if (g.showOpen) {<text class="pt-hdr-ax" [attr.x]="g.zoneX + 3" [attr.y]="g.h - 5">9:30</text>}
                <text class="pt-hdr-ax" [attr.x]="g.w" [attr.y]="g.h - 5" text-anchor="end">16:00</text>
                <text class="pt-hdr-cap" x="0" y="12">{{ sector() ? '1 year' : '3 months' }} <tspan class="pt-hdr-capv">{{ pct(months3()) }}</tspan></text>
                @if (low) {
                  <text class="pt-hdr-cap" [attr.x]="g.w" y="12" text-anchor="end"><tspan class="pt-hdr-capv">{{ zoneTitle() }}</tspan> · {{ zoneNote() }}</text>
                } @else {
                  <text class="pt-hdr-capv" [attr.x]="g.w" y="12" text-anchor="end">{{ zoneTitle() }}</text>
                  <text class="pt-hdr-cap pt-hdr-cap-s" [attr.x]="g.w" y="24" text-anchor="end">{{ zoneNote() }}</text>
                }
                @if (g.areaHist) {<polygon class="pt-hdr-area" [attr.points]="g.areaHist" />}
                @if (g.areaDay) {<polygon class="pt-hdr-area" [attr.points]="g.areaDay" />}
                @if (g.hist) {<polyline class="pt-hdr-line" [attr.points]="g.hist" />}
                @if (g.day) {<polyline class="pt-hdr-line pt-hdr-day" [attr.points]="g.day" />}
                @if (g.dot; as d) {<circle class="pt-hdr-dot pt-hdr-end" [attr.cx]="d.x" [attr.cy]="d.y" r="5" />}
                @if (hover(); as h) {
                  <line class="pt-hdr-cross" [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="g.top - 6" [attr.y2]="g.y1" />
                  <circle class="pt-hdr-dot" [attr.cx]="h.x" [attr.cy]="h.y" r="5" />
                }
              </svg>
              @if (hover(); as h) {<div class="pt-hdr-tip" [style.left.px]="h.left">{{ h.label }}</div>}
            </div>
          }
          @if (low) {
            <div class="pt-hdr-rows">
              <div class="pt-hdr-bar" aria-hidden="true"><i class="pt-hdr-bar-g" [style.flex-grow]="b.g.length"></i><i class="pt-hdr-bar-r" [style.flex-grow]="b.r.length"></i></div>
              @for (s of ROWS; track s) {
                <div [class]="'pt-band pt-band-' + s + ' pt-hdr-row'" [class.open]="opened().has(s)" [attr.data-side]="s">
                  <span class="pt-hdr-l">
                    @if (s === 'g') {<span class="pt-band-mk" role="img" aria-label="Bullish readings">▲</span> {{ b.g.length }}}
                    @else if (s === 'r') {<span class="pt-band-mk" role="img" aria-label="Bearish readings">▼</span> {{ b.r.length }}}
                    @else {Neutral}
                  </span>
                  <ul class="pt-badges">@for (m of b[s]; track m.key) {<li [ptBadge]="m" size="mini" [attr.data-key]="m.key"></li>}</ul>
                  @if (b[s].length) {<button type="button" class="pt-abtn pt-abtn-wide pt-hdr-more" [hidden]="more()[s] === 0 && !opened().has(s)" [attr.data-n]="opened().has(s) ? null : more()[s]" [attr.aria-label]="moreLabel(s)" (click)="toggle(s)">{{ opened().has(s) ? '−' : '+' }}</button>}
                </div>
              }
            </div>
          } @else {
            <div class="pt-hdr-bands" [style.grid-template-rows]="rows()">
              <div class="pt-band pt-band-g">
                <div class="pt-band-h"><span class="pt-band-mk">▲</span> Bullish readings <b class="pt-band-c">{{ b.g.length }}</b></div>
                @if (b.g.length) {<ul class="pt-badges">@for (m of b.g; track m.key) {<li [ptBadge]="m" size="mini" [attr.data-key]="m.key"></li>}</ul>}
                @else {<span class="pt-meta">None right now</span>}
              </div>
              <div class="pt-band pt-band-n pt-hdr-row" [class.open]="opened().has('n')" data-side="n">
                <span class="pt-hdr-l">Neutral</span>
                <ul class="pt-badges">@for (m of b.n; track m.key) {<li [ptBadge]="m" size="mini" [attr.data-key]="m.key"></li>}</ul>
                @if (b.n.length) {<button type="button" class="pt-abtn pt-abtn-wide pt-hdr-more" [hidden]="more().n === 0 && !opened().has('n')" [attr.data-n]="opened().has('n') ? null : more().n" [attr.aria-label]="moreLabel('n')" (click)="toggle('n')">{{ opened().has('n') ? 'Show less' : 'Show all' }}</button>}
              </div>
              <div class="pt-band pt-band-r">
                <div class="pt-band-h"><span class="pt-band-mk">▼</span> Bearish readings <b class="pt-band-c">{{ b.r.length }}</b></div>
                @if (b.r.length) {<ul class="pt-badges">@for (m of b.r; track m.key) {<li [ptBadge]="m" size="mini" [attr.data-key]="m.key"></li>}</ul>}
                @else {<span class="pt-meta">None right now</span>}
              </div>
            </div>
          }
        </div>
        @if (sec(); as s) {
          <p class="pt-hdr-note"><a [href]="etf(s.tracker)">{{ s.tracker }}</a>{{ fundRest() }} Updates with the 15-min delayed prices of its companies; analysts and news are from the last close. Not a forecast or investment advice.</p>
        } @else {<p class="pt-hdr-note">{{ note() }}</p>}
      </section>
    }`,
})
export class PtCompanyHeader {
  private readonly pt = inject(Pt);
  private readonly live = inject(PtLive);
  /** A company's or a fund's ticker; or `sector`, for a sector's page (one call: its basket carries the line and the badges). */
  readonly ticker = input<string | null>(null);
  readonly sector = input<Sector | null>(null);
  /** full: the company's main page; low: its sub-pages, so the answer below stays high. */
  readonly size = input<'full' | 'low'>('full');

  private readonly own = () => { const t = this.ticker(); return t && !this.sector() ? t : null; };
  protected readonly co = this.pt.company(() => { const t = this.own(); return t ? { ticker: t } : null; });
  protected readonly metrics = this.pt.metric(() => { const t = this.own(); return t ? { ticker: t, metrics: [...METRIC_KEYS] } : null; });
  protected readonly series = this.pt.priceSeries(() => { const t = this.own(); return t ? { tickers: [t], range: '3m' } : null; });
  private readonly sectorCall = this.pt.sector(() => { const s = this.sector(); return s ? { sector: s } : null; });
  protected readonly sec = computed(() => (this.sector() ? this.sectorCall.value() ?? null : null));
  protected readonly ready = computed(() => {
    const vs = this.sector() ? [this.sectorCall.value()] : this.own() ? [this.co.value(), this.metrics.value(), this.series.value()] : [null];
    return { settled: vs.every((v) => v !== undefined), available: vs.some((v) => v != null) };
  });
  /** A sector's worth in compact dollars ($22.4T), a price in dollars and cents. */
  protected fmt = (v: number | null) => (v == null ? '' : this.sector() ? usd(v, { compact: true }) : money(v));
  protected readonly etf = (t: string) => `/etfs/${t.toLowerCase()}/`;
  /** The fund line after its ticker, which is the link. */
  protected readonly fundRest = computed(() => { const s = this.sec(); return s ? sectorFundLine(s.name, s.tracker).slice(s.tracker.length) : ''; });
  protected readonly plainName = plainName;
  protected readonly money = money;
  protected readonly pct = pct;
  protected readonly tone = tone;
  protected readonly ROWS = ['g', 'n', 'r'] as const;

  private readonly lines = this.live.bars();
  private readonly points = computed(() => (this.sector() ? this.sec()?.series ?? [] : (this.series.value()?.[0]?.points ?? []).map(({ t, c }) => ({ t, c }))));
  private readonly line = computed<SessionLine | null>(() => {
    const l = this.lines(), s = this.sec();
    if (this.sector()) return l && s ? sectorLine(s, l) : null;
    return l && { session: l.session, ...(l.prev ? { prev: l.prev } : {}), time: l.time, closed: l.closed, closes: l.bars[this.ticker() ?? ''] ?? [] };
  });
  private readonly view = computed(() => sessionView(this.points(), this.line()));
  private readonly isLive = computed(() => this.view().state === 'running' || this.view().state === 'closing');
  /** Asked only once there is a price to recompute against: never in the build, so never in the page. */
  private readonly history = this.pt.priceSeries(() => { const t = this.own(); return t && this.isLive() ? { tickers: [t], range: '2y' } : null; });
  private readonly c0 = computed(() => this.points().at(-1)?.c ?? null);
  /** The build's badges: a sector's are in its basket, the basket's own only (no technicals: its line is not a traded price). */
  private readonly built = computed(() => (this.sector() ? this.sec()?.badges ?? [] : this.metrics.value() ?? []));
  private readonly items = computed(() => {
    const ms = this.built(), p = this.view().price, c0 = this.c0();
    if (!this.isLive() || p == null || c0 == null) return ms;
    return livened(ms, p, c0, this.sector() ? null : this.history.value()?.[0]?.points.map((x) => x.c) ?? null);
  });
  private readonly byKey = computed(() => new Map(this.items().map((m) => [m.key, m])));
  protected readonly note = computed(() => {
    const c = this.co.value();
    if (c?.kind === 'etf') return `Basket figures cover ${level(c.coverage ?? 0, 0)} of this fund. Updates with the 15-min delayed price; analysts and news are from the last close. Not a forecast or investment advice.`;
    return this.size() === 'low' ? 'Updates with the 15-min delayed price. Not a forecast or investment advice.' : 'Updates with the 15-min delayed price; analysts, insiders and news are from the last close. Not a forecast or investment advice.';
  });
  private readonly target = computed(() => targetOf(this.built(), this.c0()));
  // a sector's target is its companies' worth in trillions: its badge says the percent only
  protected readonly bands = computed(() => bandsOf(this.items(), { target: this.sector() ? null : this.target(), low: this.size() === 'low' }));
  protected readonly rows = computed(() => bandRows(this.bands().g.length, this.bands().r.length));
  protected readonly price = computed(() => this.view().price ?? this.byKey().get('range_52w')?.value ?? null);
  protected readonly change = computed(() => { const v = this.view(); return v.price != null && v.prev ? v.price / v.prev - 1 : null; });
  protected readonly months3 = computed(() => { const v = this.view(), first = v.hist[0]?.c; return v.price != null && first ? v.price / first - 1 : null; });
  protected readonly upside = computed(() => this.byKey().get('pt_upside')?.value ?? null);
  protected readonly targetText = computed(() => { const t = this.target(), u = this.upside(); return !this.sector() && t != null && u != null ? `PT ${money(t)} ${pct(u)}` : null; });
  /** Under the name, the ticker (not when the name is the ticker in other letters) and the market value; a sector's companies and their worth. */
  protected subLine(title: string): string {
    const s = this.sec();
    if (s) return `${s.companies} ${s.companies === 1 ? 'company' : 'companies'} · ${usd(s.value, { compact: true })}`;
    const cap = this.byKey().get('market_cap')?.value, t = this.ticker() ?? '';
    return [title.toUpperCase() === t.toUpperCase() ? '' : t, cap != null ? usd(cap, { compact: true }) : ''].filter(Boolean).join(' · ');
  }
  protected readonly when = computed(() => {
    const v = this.view(), l = this.line();
    if (v.state === 'running') return `today · ${l!.time}, 15-min delayed`;
    if (v.state === 'closing') return `today · close ${date(l!.session)}, preliminary`;
    const day = v.state === 'settled' ? l!.session : this.points().at(-1)?.t;
    return day ? `${date(day)} · close` : '';
  });
  protected readonly zoneTitle = computed(() => {
    const s = this.view().state;
    if (s === 'running' || s === 'closing') return 'Today';
    const day = s === 'settled' ? this.line()!.session : this.points().at(-1)?.t;
    return day ? dayMonth(day) : '';
  });
  protected readonly zoneNote = computed(() => (this.view().state === 'running' ? '15-min delayed' : this.view().state === 'closing' ? 'preliminary' : 'close'));
  protected readonly chartLabel = computed(() => {
    const then = this.isLive() ? 'today, 15 minutes delayed' : 'the last session', s = this.sec();
    return s ? `What ${s.name}'s companies are worth: today's shares at each day's adjusted close, over a year, then ${then}. Last ${this.fmt(this.price())}.`
      : `${this.ticker()}: three months of closes, then ${then}. Last ${money(this.price())}.`;
  });

  /** The chart's cell, as measured in the browser; the server draws the default and the SVG scales until then. */
  private readonly chartEl = viewChild<ElementRef<HTMLElement>>('chartEl');
  private readonly box = signal<{ w: number; h: number } | null>(null);
  protected readonly chart = computed(() => {
    const v = this.view(), low = this.size() === 'low', b = this.box();
    return chartOf(v.hist, v.slots, v.prev, b?.w ?? 380, b?.h ?? (low ? 104 : 300), low, this.sector() ? (x) => usd(x, { compact: true }) : undefined);
  });
  protected readonly hover = signal<{ x: number; y: number; left: number; label: string } | null>(null);
  protected hoverAt(e: PointerEvent, g: Chart): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.width ? ((e.clientX - rect.left) * g.w) / rect.width : 0;
    let near = g.points[0];
    for (const p of g.points) if (near && Math.abs(p.x - x) < Math.abs(near.x - x)) near = p;
    if (!near) return;
    const label = `${near.t ? dayMonth(near.t) : slotTime(near.slot ?? 0)} · ${this.fmt(near.v)}`;
    this.hover.set({ x: near.x, y: near.y, left: Math.min(g.w - 60, Math.max(60, near.x)), label });
  }

  protected readonly opened = signal<ReadonlySet<Side>>(new Set());
  /** What each row hides, once measured: null on the server. */
  protected readonly more = signal<Record<Side, number | null>>({ g: null, n: null, r: null });
  /** The count is drawn from `data-n` (CSS), so hydrating never changes the server's text. */
  protected moreLabel(s: Side): string | null {
    const n = this.more()[s];
    return this.opened().has(s) ? 'Show less' : n ? `Show all, ${n} more` : null;
  }
  protected toggle(s: Side): void {
    const next = new Set(this.opened());
    if (!next.delete(s)) next.add(s);
    this.opened.set(next);
  }

  private readonly rootEl = viewChild<ElementRef<HTMLElement>>('root');
  private lockedFor: string | null = null;
  private seen: { width: number; chips: Map<string, { x: number; y: number; text: string }>; price: string; dot: { x: number; y: number } | null } | null = null;

  constructor() {
    afterRenderEffect((cleanup) => {
      const el = this.chartEl()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(() => { if (el.clientWidth > 20 && el.clientHeight > 20) this.box.set({ w: el.clientWidth, h: el.clientHeight }); });
      ro.observe(el);
      cleanup(() => ro.disconnect());
    });
    afterRenderEffect(() => {
      const root = this.rootEl()?.nativeElement;
      this.bands(); this.opened(); this.box(); this.chart();
      if (root) untracked(() => this.settle(root));
    });
    afterRenderEffect(() => {
      const root = this.rootEl()?.nativeElement;
      if (!root || !globalThis.document?.fonts) return;
      void document.fonts.ready.then(() => { this.lockedFor = null; this.settle(root); }); // a late font wraps the badges differently
    });
  }

  /** After each render: count what the rows hide, keep the box's height so nothing below moves, and slide what changed. */
  private settle(root: HTMLElement): void {
    const more = { ...this.more() };
    root.querySelectorAll<HTMLElement>('.pt-hdr-row').forEach((row) => {
      const ul = row.querySelector('ul');
      if (ul && !row.classList.contains('open')) more[row.dataset['side'] as Side] = overflowCount(ul);
    });
    if ((['g', 'n', 'r'] as const).some((s) => more[s] !== this.more()[s])) this.more.set(more);

    const body = root.querySelector<HTMLElement>('.pt-hdr-body'), holder = root.querySelector<HTMLElement>('.pt-hdr-bands, .pt-hdr-rows');
    const width = root.clientWidth, key = `${width}|${[...this.opened()].sort().join()}`;
    if (body && this.lockedFor !== key) {
      body.style.height = '';
      const h = body.offsetHeight;
      if (h) body.style.height = `${h}px`;
      this.lockedFor = key;
    } else if (body && holder) {
      const extra = holder.scrollHeight - holder.clientHeight; // more rows of badges than the box holds: it grows, without animation
      if (extra > 1) body.style.height = `${body.offsetHeight + extra}px`;
    }

    const at = root.getBoundingClientRect();
    const chips = new Map<string, { x: number; y: number; text: string }>();
    root.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
      const r = el.getBoundingClientRect();
      chips.set(el.dataset['key']!, { x: r.left - at.left, y: r.top - at.top, text: el.querySelector('.pt-badge-v')?.textContent ?? '' });
    });
    const priceEl = root.querySelector<HTMLElement>('.pt-card-close'), price = priceEl?.textContent ?? '', dot = this.chart()?.dot ?? null;
    const was = this.seen;
    this.seen = { width, chips, price, dot };
    if (!was || was.width !== width || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const SOFT = { duration: 300, easing: 'ease-out' };
    root.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
      const a = was.chips.get(el.dataset['key']!), b = chips.get(el.dataset['key']!);
      if (!a || !b) return;
      if (a.text !== b.text) flash(el.querySelector<HTMLElement>('.pt-badge-v'));
      const dx = a.x - b.x, dy = a.y - b.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) el.animate?.([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], SOFT);
    });
    if (was.price !== price) flash(priceEl);
    const end = root.querySelector<SVGElement>('.pt-hdr-end');
    if (end && was.dot && dot && (was.dot.x !== dot.x || was.dot.y !== dot.y)) end.animate?.([{ transform: `translate(${was.dot.x - dot.x}px, ${was.dot.y - dot.y}px)` }, { transform: 'none' }], SOFT);
  }
}

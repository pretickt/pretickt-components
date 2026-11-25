/**
 * Where does this stock stand on one technical aspect today, and what happened the other times it stood there? One card per aspect (RSI,
 * support, resistance, the 200-day average, the 20/50/100-day averages, the 50/200 cross, Bollinger Bands, MACD, the distance from the
 * 52-week high): the searched question answered with today's numbers, a chart of now, then the stock's own past episodes a month (or three)
 * later beside the market and beside every company. Counts of the past, never a forecast.
 * @version 1.2.0
 * @evidence DataForSEO round 20 (US, 2026-11-17): «nvda rsi» 590, «nvda 200 day moving average» 480, «nvda technical analysis» 480, «nvda support and resistance» 390, «spy support and resistance» 480, «spy 200 day moving average» 590
 * @evidence Romeo, 2026-11-18, on www: NVDA's resistance «sembra un supporto»; all companies' median «la preferisco continua»; Bollinger «un grafico classico a bande»; MACD «deve dire cosa esprime di solito»; the after chart «più carino e che fa comprendere meglio»
 * @evidence Romeo, 2026-11-17: «una card per ogni aspetto tecnico, con insight statistici su cosa è successo in passato», «devono esserci i grafici e la pagina deve essere seo friendly»
 */
import { Component, computed, inject, input, signal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtToggles } from '@pretickt/components/ds';
import { date, money, named, pct, tip } from '@pretickt/components/format';
import type { TechCard, TechCardKey, Technicals, TechState, TechSum } from '@pretickt/components/typologies';

// the right margin holds the labels: 72 of 600 fits «$233.95» and «+12.3%» at a phone's larger font (52 cut them on www, 2026-11-18)
const W = 600, PH = 210, QH = 84, AH = 170, M = { l: 6, r: 72, t: 10, b: 20 };
/** An axis label's price: no cents from $1,000 (the margin's width). */
const tick = (v: number) => money(v, Math.abs(v) >= 1000 ? 0 : 2);
const HS = [21, 63] as const, STEP = 3;
type Num = number | null | undefined;

/** What each state's episode is, as a sentence's middle: "the times <it>". */
const EPISODE: Record<string, string> = {
  'rsi:below30': 'its RSI went below 30', 'rsi:above70': 'its RSI went above 70',
  'support:near': 'it came within 5% above its nearest support', 'resistance:near': 'it came within 5% under its nearest resistance',
  'ma200:below': 'it crossed below its 200-day average', 'ma200:above': 'it crossed above its 200-day average',
  'mas:belowAll': 'it went below its 20, 50 and 100-day averages', 'mas:aboveAll': 'it went above its 20, 50 and 100-day averages',
  'cross:golden': 'its 50-day average crossed above the 200-day (a golden cross)', 'cross:death': 'its 50-day average crossed below the 200-day (a death cross)',
  'bollinger:belowLower': 'it closed below its lower Bollinger Band', 'bollinger:aboveUpper': 'it closed above its upper Bollinger Band',
  'macd:pos': 'its MACD histogram turned positive', 'macd:neg': 'its MACD histogram turned negative',
  'high:off10': 'it first closed 10% or more below its 52-week high', 'high:off20': 'it first closed 20% or more below its 52-week high',
  'high:off30': 'it first closed 30% or more below its 52-week high', 'high:off40': 'it first closed 40% or more below its 52-week high',
};
/** The states a card shows: today's, or the two it sits between. */
const SHOWN: Record<string, string[]> = {
  'rsi:between': ['below30', 'above70'], 'support:far': ['near'], 'support:none': ['near'], 'resistance:far': ['near'], 'resistance:none': ['near'],
  'mas:mixed': ['belowAll', 'aboveAll'], 'bollinger:inside': ['belowLower', 'aboveUpper'], 'high:near': ['off10'],
};
const LABEL: Record<string, string> = { rsi: 'RSI 14', support: 'Support', resistance: 'Resistance', ma200: '200-day average', ma20: '20-day average',
  ma50: '50-day average', ma100: '100-day average', upper: 'Bollinger Bands (±2 standard deviations)', mid: '20-day average', lower: 'Lower band', macd: 'MACD', signal: 'Signal', high52: '52-week high' };
const NEG = new Set(['below30', 'below', 'belowAll', 'death', 'belowLower', 'neg', 'off10', 'off20', 'off30', 'off40']);
const f1 = (v: Num) => (v == null ? '–' : v.toFixed(1));
const share = (a: number, b: number) => `${Math.round((a / (b || 1)) * 100)}%`;
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const dates = (ts: readonly string[]) => (ts.length < 2 ? ts.join('') : `${ts.slice(0, -1).join(', ')} and ${ts.at(-1)}`);
/** A quantile of sorted values (linear between ranks). */
const quant = (v: number[], q: number) => { const r = (v.length - 1) * q, a = Math.floor(r); return v[a]! + (v[Math.min(a + 1, v.length - 1)]! - v[a]!) * (r - a); };
/** Gridlines a chart of fractions reads well with: 1, 2, 5, 10, 20 or 50% apart, three to five of them. */
function pctTicks(lo: number, hi: number): number[] {
  const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5].find((s) => (hi - lo) / s <= 4) ?? 1;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');

/** The "now" chart: price and overlays on one scale, levels across, marks on the price, an RSI or MACD pane under it. */
export function nowChart(d: Technicals, c: TechCard) {
  const r = c.chart.range === 'daily' ? d.daily : d.weekly, from = c.chart.from, t = r.t.slice(from), p = r.c.slice(from), n = t.length;
  if (n < 2) return null;
  const x = (i: number) => M.l + (i / (n - 1)) * (W - M.l - M.r);
  const vals = [...p, ...c.chart.lines.flatMap((l) => l.v.filter((v): v is number => v != null)), ...c.chart.levels.map((l) => l.v), ...c.chart.marks.flatMap((m) => (m.v == null ? [] : [m.v]))];
  const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03, y = (v: number) => M.t + ((hi - v) / (hi - lo || 1)) * (PH - M.t - M.b);
  const line = (v: (number | null)[]) => path(v.flatMap((u, i) => (u == null ? [] : [[x(i), y(u)] as [number, number]])));
  const at = new Map(t.map((s, i) => [s, i]));
  // a level's turns sit on the level line, each with the close it turned at (Romeo: the resistance's chart «sembra un supporto»)
  const level = c.chart.levels[0]?.v;
  const marks = c.chart.marks.flatMap((m) => { const i = at.get(m.t); if (i == null) return [];
    const turn = m.k === 'turnUp' || m.k === 'turnDown';
    return [{ cx: x(i).toFixed(1), cy: y(turn && level != null ? level : (m.v ?? p[i]!)).toFixed(1), cls: turn ? 'pt-tech-turn' : NEG.has(m.k) ? 'pt-tech-mark pt-tech-mark-neg' : 'pt-tech-mark',
      tip: tip({ [date(m.t)]: turn ? `turned ${m.k === 'turnUp' ? 'up' : 'down'} at ${money(m.v ?? p[i]!)}` : money(p[i]!) }) }]; });
  // Bollinger: the classic picture, the two bands as one shaded channel around the 20-day average (Romeo: «un grafico classico a bande»)
  const up = c.chart.lines.find((l) => l.k === 'upper'), dn = c.chart.lines.find((l) => l.k === 'lower');
  const band = up && dn ? (() => { const a = up.v.flatMap((u, i) => (u == null || dn.v[i] == null ? [] : [i]));
    return a.length < 2 ? null : `${path(a.map((i) => [x(i), y(up.v[i]!)]))}${a.reverse().map((i) => `L${x(i).toFixed(1)},${y(dn.v[i]!).toFixed(1)}`).join('')}Z`; })() : null;
  const cls = (k: string, n: number) => (band ? (k === 'mid' ? 'pt-tech-bb-mid' : 'pt-tech-bb') : `pt-tech-l${n}`);
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].map((i) => ({ x: x(i).toFixed(1), label: date(t[i]!).replace(/ \d+,/, ''), anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }));
  const pane = c.chart.pane && (() => {
    const q = c.chart.pane!, all = [...q.lines.flatMap((l) => l.v), ...(q.bars ?? []), ...q.guides].filter((v): v is number => v != null);
    const top = q.k === 'rsi' ? 100 : Math.max(...all.map(Math.abs)) * 1.1 || 1, bot = q.k === 'rsi' ? 0 : -top;
    const qy = (v: number) => 6 + ((top - v) / (top - bot)) * (QH - 12), bw = Math.max(1, (W - M.l - M.r) / n - 1);
    return { lines: q.lines.map((l, k) => ({ k: l.k, cls: `pt-tech-l${k}`, d: path(l.v.flatMap((u, i) => (u == null ? [] : [[x(i), qy(u)] as [number, number]]))) })),
      bars: (q.bars ?? []).flatMap((b, i) => (b == null ? [] : [{ x: (x(i) - bw / 2).toFixed(1), y: Math.min(qy(b), qy(0)).toFixed(1), w: bw.toFixed(1), h: Math.max(0.5, Math.abs(qy(b) - qy(0))).toFixed(1), pos: b > 0 }])),
      guides: q.guides.map((g) => ({ y: qy(g).toFixed(1), label: q.k === 'rsi' ? String(g) : '0' })), last: q.lines[0]?.v.at(-1) };
  })();
  return { price: line(p), band, lines: c.chart.lines.map((l, k) => ({ k: l.k, cls: cls(l.k, k), d: line(l.v) })),
    levels: c.chart.levels.map((l) => ({ k: l.k, y: y(l.v).toFixed(1), label: tick(l.v) })), marks, ticks, pane,
    now: { cx: x(n - 1).toFixed(1), cy: y(p[n - 1]!).toFixed(1) }, hiLabel: tick(hi / 1.03), loLabel: tick(lo / 0.97), yHi: y(hi / 1.03).toFixed(1), yLo: y(lo / 0.97).toFixed(1) };
}

/**
 * The "after" chart: where the stock went after each past time, as one picture (Romeo, 2026-11-18: «più carino e che fa comprendere
 * meglio»): the middle half of the times as a shaded band, the stock's median path bold, every company's median path in blue across the
 * whole horizon (not a tick at the end: «la preferisco continua»), each past time a faint line, and the percent gridlines with 0% = the
 * price on the day.
 */
export function afterChart(st: TechState, h: 0 | 1) {
  const k = HS[h] / STEP + 1, paths = (st.paths ?? []).map((p) => p.slice(0, k));
  if (!paths.length) return null;
  const poolPath = st.allPath?.slice(0, k) ?? null, poolEnd = st.all?.[h].med ?? null;
  // the median and the middle half over every time (the payload's, as the sentence's); from the drawn paths on an older row
  const at = (i: number) => paths.map((p) => p[i]).filter((u): u is number => u != null).sort((a, b) => a - b);
  const med = st.medPath?.slice(0, k) ?? Array.from({ length: k }, (_, i) => { const v = at(i); return v.length ? quant(v, 0.5) : null; });
  // the band needs four times at a step to say "the middle half"; under four it would be two lines
  const iqr = st.half ? Array.from({ length: k }, (_, i) => { const a = st.half![0][i], b = st.half![1][i]; return a != null && b != null ? [a, b] as const : null; })
    : Array.from({ length: k }, (_, i) => { const v = at(i); return v.length >= 4 ? [quant(v, 0.25), quant(v, 0.75)] as const : null; });
  const vals = [0, ...paths.flat(), ...(poolPath ?? []), ...(poolEnd == null ? [] : [poolEnd])].filter((v): v is number => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08 || 0.01;
  const x = (i: number) => M.l + (i / (k - 1)) * (W - M.l - M.r), y = (v: number) => 8 + ((hi + pad - v) / (hi - lo + 2 * pad)) * (AH - 26);
  const line = (v: readonly (number | null)[]) => path(v.flatMap((u, i) => (u == null ? [] : [[x(i), y(u)] as [number, number]])));
  const eps = st.episodes.slice(-paths.length);
  const bandIdx = iqr.flatMap((b, i) => (b ? [i] : []));
  const band = bandIdx.length >= 2 ? `${path(bandIdx.map((i) => [x(i), y(iqr[i]![1])]))}${[...bandIdx].reverse().map((i) => `L${x(i).toFixed(1)},${y(iqr[i]![0]).toFixed(1)}`).join('')}Z` : null;
  // the two end labels, pushed apart when they would overlap
  const medEnd = med.filter((v) => v != null).at(-1) ?? null, allEnd = poolPath?.filter((v) => v != null).at(-1) ?? poolEnd;
  let ym = medEnd == null ? null : y(medEnd), ya = allEnd == null ? null : y(allEnd);
  if (ym != null && ya != null && Math.abs(ym - ya) < 17) { const mid = (ym + ya) / 2, s = ym <= ya ? -1 : 1; ym = mid + s * 8.5; ya = mid - s * 8.5; }
  const marksX: [number, string][] = h ? [[0, 'Then'], [21, '1 month'], [42, '2 months'], [63, '3 months']] : [[0, 'Then'], [5, '1 week'], [10, '2 weeks'], [15, '3 weeks'], [21, '1 month']];
  const ticks = marksX.map(([sx, label], j, all) => ({ x: x(sx / STEP).toFixed(1), label, anchor: j === 0 ? 'start' : j === all.length - 1 ? 'end' : 'middle' }));
  return {
    paths: paths.map((p, j) => { const end = p.filter((v) => v != null).at(-1) ?? 0;
      return { d: line(p), up: end > 0, tip: tip({ [date(eps[j]?.t ?? '')]: pct(end) }) }; }),
    band, med: line(med), x2: (W - M.r).toFixed(1), some: st.total > paths.length ? paths.length : null,
    all: poolPath && poolPath.some((v) => v != null) ? line(poolPath) : null,
    grid: pctTicks(lo, hi).map((v) => ({ y: y(v).toFixed(1), label: v === 0 ? '0%' : pct(v).replace(/\.0%/, '%'), zero: v === 0 })),
    ends: [...(ym != null ? [{ y: ym.toFixed(1), label: pct(medEnd), cls: 'pt-tech-lab' }] : []),
      ...(ya != null ? [{ y: ya.toFixed(1), label: pct(allEnd), cls: 'pt-tech-lab pt-tech-lab-all' }] : [])],
    ticks,
  };
}

@Component({
  selector: 'pt-technicals',
  imports: [PtToggles],
  template: `
    @let d = data.value();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else if (d) {
      @if (cardOf(); as c) {
        <div class="pt-tech" [class.pt-busy]="data.loading()" data-faq>
          <h3 class="pt-tech-q" data-faq-q>{{ question() }}</h3>
          <p class="pt-tech-now" data-faq-a>{{ answer() }}</p>
          @if (chart(); as g) {
            <svg class="pt-chart-svg pt-tech-svg" [attr.viewBox]="'0 0 ' + W + ' ' + (PH + (g.pane ? QH : 0))" role="img" [attr.aria-label]="chartLabel()">
              <line class="pt-grid" x1="0" [attr.x2]="W - M.r" [attr.y1]="g.yHi" [attr.y2]="g.yHi" /><text class="pt-axis" [attr.x]="W - M.r + 4" [attr.y]="g.yHi" dy="3">{{ g.hiLabel }}</text>
              <line class="pt-grid" x1="0" [attr.x2]="W - M.r" [attr.y1]="g.yLo" [attr.y2]="g.yLo" /><text class="pt-axis" [attr.x]="W - M.r + 4" [attr.y]="g.yLo" dy="3">{{ g.loLabel }}</text>
              @for (l of g.levels; track l.k) {<line class="pt-tech-level" x1="0" [attr.x2]="W - M.r" [attr.y1]="l.y" [attr.y2]="l.y" /><text class="pt-tech-lab" [attr.x]="W - M.r + 4" [attr.y]="l.y" dy="3">{{ l.label }}</text>}
              @if (g.band) {<path class="pt-tech-band" [attr.d]="g.band" />}
              @for (l of g.lines; track l.k) {<path [class]="l.cls" [attr.d]="l.d" />}
              <path class="pt-tech-price" [attr.d]="g.price" />
              @for (m of g.marks; track $index) {<circle [class]="m.cls" [attr.cx]="m.cx" [attr.cy]="m.cy" r="3.5" [attr.data-tip]="m.tip" />}
              <circle class="pt-stats-now" [attr.cx]="g.now.cx" [attr.cy]="g.now.cy" r="4" />
              @for (k of g.ticks; track k.x) {<text class="pt-axis" [attr.x]="k.x" [attr.y]="PH - 4" [attr.text-anchor]="k.anchor">{{ k.label }}</text>}
              @if (g.pane; as q) {
                <g [attr.transform]="'translate(0,' + PH + ')'">
                  @for (u of q.guides; track u.y) {<line class="pt-tech-guide" x1="0" [attr.x2]="W - M.r" [attr.y1]="u.y" [attr.y2]="u.y" /><text class="pt-axis" [attr.x]="W - M.r + 4" [attr.y]="u.y" dy="3">{{ u.label }}</text>}
                  @for (b of q.bars; track $index) {<rect [class]="b.pos ? 'pt-tech-bar' : 'pt-tech-bar pt-tech-bar-neg'" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" />}
                  @for (l of q.lines; track l.k) {<path [class]="l.cls" [attr.d]="l.d" />}
                </g>
              }
            </svg>
            <p class="pt-legend"><span class="pt-key pt-tech-key-price">{{ d.ticker }}</span>
              @for (l of keys(); track l.k) {<span [class]="'pt-key pt-tech-key-' + l.n">{{ l.label }}</span>}
              @if (turns()) {<span class="pt-key pt-tech-key-turn">The closes the price turned at</span>}
              @else if (c.chart.marks.length) {<span class="pt-key pt-tech-key-mark">The times counted below</span>}</p>
          }
          <div class="pt-head pt-tech-head"><h4>What happened after</h4>
            <div ptToggles [value]="h()" [options]="HORIZONS" aria-label="Horizon" (choose)="h.set($event)"></div></div>
          @for (s of shown(); track s.key) {
            <div class="pt-tech-state">
              <p>{{ stockLine(s) }}@if (heldLine(s); as l) { {{ l }}}</p>
              @if (s.all; as a) {<p class="pt-meta">{{ allLine(a, s) }}</p>}
              @if (after(s); as g) {
                <svg class="pt-chart-svg pt-tech-svg" [attr.viewBox]="'0 0 ' + W + ' ' + AH" role="img" [attr.aria-label]="'Each time ' + episode(s) + ', ' + d.ticker + ' over the next ' + (h() ? 'three months' : 'month')">
                  @for (u of g.grid; track u.y) {<line [class]="u.zero ? 'pt-tech-zero' : 'pt-tech-guide'" x1="0" [attr.x2]="g.x2" [attr.y1]="u.y" [attr.y2]="u.y" /><text class="pt-axis" [attr.x]="M.l" [attr.y]="u.y" dy="-3">{{ u.label }}</text>}
                  @if (g.band) {<path class="pt-tech-iqr" [attr.d]="g.band" />}
                  @for (p of g.paths; track $index) {<path [class]="p.up ? 'pt-tech-path' : 'pt-tech-path pt-tech-path-neg'" [attr.d]="p.d" [attr.data-tip]="p.tip" />}
                  @if (g.all) {<path class="pt-tech-all" [attr.d]="g.all" />}
                  <path class="pt-tech-med" [attr.d]="g.med" />
                  @for (e of g.ends; track e.cls) {<text [class]="e.cls" [attr.x]="W - M.r + 6" [attr.y]="e.y" dy="3">{{ e.label }}</text>}
                  @for (k of g.ticks; track k.x) {<text class="pt-axis" [attr.x]="k.x" [attr.y]="AH - 4" [attr.text-anchor]="k.anchor">{{ k.label }}</text>}
                </svg>
                <p class="pt-legend"><span class="pt-key pt-tech-key-med">{{ d.ticker }}'s median</span>
                  @if (g.all) {<span class="pt-key pt-tech-key-pool">All companies' median</span>}
                  @if (g.band) {<span class="pt-key pt-tech-key-iqr">Middle half of {{ d.ticker }}'s times</span>}
                  <span class="pt-key pt-tech-key-path">@if (g.some) {The last {{ g.some }} times, one line each} @else {One past time each}</span></p>
              }
            </div>
          }
          <p class="pt-meta">From daily closing prices adjusted for splits and dividends, {{ window() }}. A new time counts after at least 10 sessions out of the state. What happened in the past, not a forecast.</p>
        </div>
      } @else {<p class="pt-na">There is not enough price history for this indicator yet.</p>}
    }`,
})
export class PtTechnicals {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly card = input<TechCardKey>('rsi');

  protected readonly data = this.pt.technicals(() => ({ ticker: this.ticker() }));
  protected readonly h = signal<0 | 1>(0);
  protected readonly HORIZONS = [[0, '1 month'], [1, '3 months']] as const;
  protected readonly W = W; protected readonly PH = PH; protected readonly QH = QH; protected readonly AH = AH; protected readonly M = M;

  protected readonly cardOf = computed(() => this.data.value()?.cards.find((c) => c.key === this.card()) ?? null);
  protected readonly chart = computed(() => { const d = this.data.value(), c = this.cardOf(); return d && c ? nowChart(d, c) : null; });
  protected readonly turns = computed(() => this.cardOf()?.chart.marks.some((m) => m.k === 'turnUp' || m.k === 'turnDown') ?? false);
  protected readonly shown = computed(() => { const c = this.cardOf(); if (!c) return [];
    const keys = SHOWN[`${c.key}:${c.state}`] ?? [c.state]; return c.states.filter((s) => keys.includes(s.key)); });
  protected readonly keys = computed(() => { const c = this.cardOf(); if (!c) return [];
    const label = (k: string) => LABEL[k] ?? k;
    const bb = c.key === 'bollinger';
    return [...c.chart.lines.filter((l) => !bb || l.k !== 'lower').map((l, i) => ({ k: l.k, label: label(l.k), n: bb ? (l.k === 'mid' ? 'bbmid' : 'bb') : `l${i}` })), ...c.chart.levels.map((l) => ({ k: l.k, label: label(l.k), n: 'level' })),
      ...(c.chart.pane?.lines ?? []).map((l, i) => ({ k: `pane-${l.k}`, label: label(l.k), n: `l${i}` }))]; });

  private who() { const d = this.data.value()!; return named(d.name, d.ticker); }
  private when() { return date(this.data.value()!.asOf); }
  protected window() { const d = this.data.value()!; return d.fullWindow ? 'in the last five years' : `since ${date(d.since)}`; }
  protected episode(s: TechState) { return EPISODE[`${this.card()}:${s.key}`] ?? s.key; }
  protected after(s: TechState) { return afterChart(s, this.h()); }

  protected question(): string {
    const c = this.cardOf()!, t = this.data.value()!.ticker;
    switch (c.key) {
      case 'rsi': return c.state === 'below30' ? `Is ${t} oversold?` : c.state === 'above70' ? `Is ${t} overbought?` : `What is ${t}'s RSI?`;
      case 'support': return `What is ${t}'s support level?`;
      case 'resistance': return `What is ${t}'s resistance level?`;
      case 'ma200': return `Is ${t} above its 200-day moving average?`;
      case 'mas': return `Is ${t} above its 50-day moving average?`;
      case 'cross': return c.state === 'golden' ? `Has ${t} had a golden cross?` : `Has ${t} had a death cross?`;
      case 'bollinger': return `Is ${t} outside its Bollinger Bands?`;
      case 'macd': return `Is ${t}'s MACD positive?`;
      case 'high': return `How far is ${t} from its 52-week high?`;
    }
  }

  protected answer(): string {
    const d = this.data.value()!, c = this.cardOf()!, n = c.now, who = this.who(), on = this.when(), close = `${who} closed at ${money(d.close)} on ${on}`;
    const side = (v: Num) => (v == null ? '' : `${pct(Math.abs(v)).replace('+', '')} ${v < 0 ? 'below' : 'above'}`);
    switch (c.key) {
      case 'rsi': return `${who}'s 14-day RSI was ${f1(n['rsi'])} on ${on}: ${c.state === 'below30' ? 'below 30, the zone usually called oversold' : c.state === 'above70' ? 'above 70, the zone usually called overbought' : 'between 30 and 70, neither oversold nor overbought'}.${n['was'] != null ? ` It was ${f1(n['was'])} five sessions earlier.` : ''}`;
      case 'support': case 'resistance': {
        if (n['level'] == null) return `${close}, ${c.key === 'support' ? 'under' : 'over'} every level its price turned at in the last two years: no ${c.key} ${c.key === 'support' ? 'below' : 'above'} the price.`;
        // what the level is made of, said when it is the other side's (Romeo: NVDA's resistance «sembra un supporto» — it was one)
        // the turns by direction when the payload has them (pt-technicals 1.2.0): «up» only when every turn was up, else the split in brackets;
        // an older payload says «turned» (its `made` was only the majority, and the count held both kinds)
        const up = n['up'], down = n['down'], split = up != null && down != null;
        const turned = split && down === 0 ? 'turned up' : split && up === 0 ? 'turned down' : 'turned';
        const times = `${n['touches']} times in the last two years${split && up! > 0 && down! > 0 ? ` (${up} up, ${down} down)` : ''}`;
        const flip = n['flipped'] === 1 ? (c.key === 'resistance'
          ? ` It used to be a support: the price ${turned} there ${times}, then fell through it, and a broken support is usually watched as a resistance.`
          : ` It used to be a resistance: the price ${turned} there ${times}, then rose through it, and a broken resistance is usually watched as a support.`) : '';
        return `${who}'s nearest ${c.key} is ${money(n['level'])}, ${side(n['dist'])} its close of ${money(d.close)} on ${on}${flip ? '.' + flip : `; the price ${turned} there ${times}.`}`;
      }
      case 'ma200': return `${close}, ${side(n['dist'])} its 200-day moving average of ${money(n['ma'])}.`;
      case 'mas': return `${close}, ${side(n['d20'])} its 20-day, ${side(n['d50'])} its 50-day and ${side(n['d100'])} its 100-day moving average (${money(n['ma20'])}, ${money(n['ma50'])} and ${money(n['ma100'])}).`;
      case 'cross': {
        const g = c.state === 'golden', name = g ? 'golden' : 'death', ago = n['ago'];
        const since = ago == null ? ` It has been ${g ? 'above' : 'below'} it over the whole period shown.` : ago === 0 ? ` The ${name} cross came on ${on}.`
          : ` The last ${name} cross was ${ago} ${ago === 1 ? 'session' : 'sessions'} before ${on}.`;
        return `${who}'s 50-day moving average (${money(n['ma50'])}) is ${g ? 'above' : 'below'} its 200-day (${money(n['ma200'])}) on ${on}.${since}`;
      }
      case 'bollinger': return `${close}, ${c.state === 'belowLower' ? 'below its lower Bollinger Band' : c.state === 'aboveUpper' ? 'above its upper Bollinger Band' : 'inside its Bollinger Bands'} (${money(n['lower'])} to ${money(n['upper'])}: the 20-day average ± 2 standard deviations).`;
      // what it usually says, as the RSI's «usually called oversold» (Romeo: MACD «deve dire cosa esprime di solito»)
      case 'macd': return `${who}'s MACD histogram is ${c.state === 'pos' ? 'positive' : 'negative'} on ${on} (${n['hist']?.toFixed(2)}): the MACD line is ${c.state === 'pos' ? 'above' : 'below'} its signal line${n['ago'] != null ? `, for ${n['ago']} ${n['ago'] === 1 ? 'session' : 'sessions'}` : ''}. ${c.state === 'pos'
        ? 'A MACD above its signal line is usually read as momentum turning up; below it, as momentum turning down.'
        : 'A MACD below its signal line is usually read as momentum turning down; above it, as momentum turning up.'}`;
      case 'high': return `${close}, ${side(n['dist'])} its 52-week high of ${money(n['high'])}.`;
    }
  }

  protected stockLine(s: TechState): string {
    const d = this.data.value()!, h = this.h(), m: TechSum = s.stock[h], later = h ? 'three months later' : 'a month later', what = this.episode(s);
    const recent = s.total - m.n, tail = recent > 0 ? ` (${recent} more ${recent === 1 ? 'time is' : 'times are'} too recent to count)` : '';
    if (!s.total) return `None ${this.window()}: ${d.ticker} never had a time when ${what}.`;
    // the dates of every time, the too recent among them said once (review: «only 1 time … (1 more time is too recent)» on CAT)
    const young = recent > 0 ? ` ${recent === s.total ? (s.total === 1 ? 'It is' : 'They are') : `${recent} of them ${recent === 1 ? 'is' : 'are'}`} too recent to count.` : '';
    if (m.n < 3) return `${d.ticker} has done it only ${s.total} ${s.total === 1 ? 'time' : 'times'} ${this.window()}, when ${what}: ${dates(s.episodes.map((e) => date(e.t)))}.${young}`;
    const mkt = m.mkt != null ? `; the market ${pct(m.mkt)} over the same days, ${pct(m.net)} net` : '';
    return `The ${m.n} times ${what} ${this.window()}, ${d.ticker} was higher ${later} ${m.up} of ${m.n} times (median ${pct(m.med)}${mkt}).${tail}`;
  }

  protected heldLine(s: TechState): string | null {
    if (s.held == null || !s.total || s.stock[0].n < 3) return null;
    // counted on the month after each time, at either horizon (review: «held X of those times» after the 3-month count)
    const of = `${s.held} of ${s.stock[0].n} times`;
    return this.card() === 'support' ? `The support held ${of} (no close more than 3% under it within a month).`
      : `The resistance held ${of} (no close more than 3% over it within a month).`;
  }

  /** Every company's same count; no "net" on the market's own page (SPY against itself). */
  protected allLine(a: [TechSum, TechSum], s: TechState): string {
    const m = a[this.h()], market = this.data.value()?.ticker !== 'SPY'; // SPY is the market: never «net» of itself (review)
    if (!m.n) return '';
    return `All companies on pretickt, same rule: higher ${this.h() ? 'three months' : 'a month'} later ${share(m.up, m.n)} of ${thousands(m.n)} times, median ${pct(m.med)}${m.net != null && market ? ` (${pct(m.net)} net of the market)` : ''}.`;
  }

  protected chartLabel(): string {
    const d = this.data.value()!, c = this.cardOf()!, r = c.chart.range === 'daily' ? d.daily : d.weekly;
    return `${d.ticker} from ${date(r.t[c.chart.from] ?? r.t[0]!)} to ${date(d.asOf)}${this.keys().length ? `, with ${this.keys().map((k) => k.label).join(', ')}` : ''}`;
  }
}

/**
 * Where does this stock stand on one technical aspect today, and what happened the other times it stood there? One card per aspect (RSI,
 * support, resistance, the 200-day average, the 20/50/100-day averages, the 50/200 cross, Bollinger Bands, MACD, the distance from the
 * 52-week high): the searched question answered with today's numbers, a chart of now, then the stock's own past episodes a month (or three)
 * later beside the market and beside every company. Counts of the past, never a forecast.
 * @version 1.0.0
 * @evidence DataForSEO round 20 (US, 2026-11-17): «nvda rsi» 590, «nvda 200 day moving average» 480, «nvda technical analysis» 480, «nvda support and resistance» 390, «spy support and resistance» 480, «spy 200 day moving average» 590
 * @evidence Romeo, 2026-11-17: «una card per ogni aspetto tecnico, con insight statistici su cosa è successo in passato», «devono esserci i grafici e la pagina deve essere seo friendly»
 */
import { Component, computed, inject, input, signal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtToggles } from '@pretickt/components/ds';
import { date, money, named, pct, tip } from '@pretickt/components/format';
import type { TechCard, TechCardKey, Technicals, TechState, TechSum } from '@pretickt/components/typologies';

const W = 600, PH = 210, QH = 84, AH = 150, M = { l: 6, r: 52, t: 10, b: 20 };
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
  ma50: '50-day average', ma100: '100-day average', upper: 'Upper band', mid: '20-day average', lower: 'Lower band', macd: 'MACD', signal: 'Signal', high52: '52-week high' };
const NEG = new Set(['below30', 'below', 'belowAll', 'death', 'belowLower', 'neg', 'off10', 'off20', 'off30', 'off40']);
const f1 = (v: Num) => (v == null ? '–' : v.toFixed(1));
const share = (a: number, b: number) => `${Math.round((a / (b || 1)) * 100)}%`;
const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const dates = (ts: readonly string[]) => (ts.length < 2 ? ts.join('') : `${ts.slice(0, -1).join(', ')} and ${ts.at(-1)}`);
const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');

/** The "now" chart: price and overlays on one scale, levels across, marks on the price, an RSI or MACD pane under it. */
export function nowChart(d: Technicals, c: TechCard) {
  const r = c.chart.range === 'daily' ? d.daily : d.weekly, from = c.chart.from, t = r.t.slice(from), p = r.c.slice(from), n = t.length;
  if (n < 2) return null;
  const x = (i: number) => M.l + (i / (n - 1)) * (W - M.l - M.r);
  const vals = [...p, ...c.chart.lines.flatMap((l) => l.v.filter((v): v is number => v != null)), ...c.chart.levels.map((l) => l.v)];
  const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03, y = (v: number) => M.t + ((hi - v) / (hi - lo || 1)) * (PH - M.t - M.b);
  const line = (v: (number | null)[]) => path(v.flatMap((u, i) => (u == null ? [] : [[x(i), y(u)] as [number, number]])));
  const at = new Map(t.map((s, i) => [s, i]));
  const marks = c.chart.marks.flatMap((m) => { const i = at.get(m.t); return i == null ? [] : [{ cx: x(i).toFixed(1), cy: y(p[i]!).toFixed(1), neg: NEG.has(m.k), tip: tip({ [date(m.t)]: money(p[i]!) }) }]; });
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].map((i) => ({ x: x(i).toFixed(1), label: date(t[i]!).replace(/ \d+,/, ''), anchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }));
  const pane = c.chart.pane && (() => {
    const q = c.chart.pane!, all = [...q.lines.flatMap((l) => l.v), ...(q.bars ?? []), ...q.guides].filter((v): v is number => v != null);
    const top = q.k === 'rsi' ? 100 : Math.max(...all.map(Math.abs)) * 1.1 || 1, bot = q.k === 'rsi' ? 0 : -top;
    const qy = (v: number) => 6 + ((top - v) / (top - bot)) * (QH - 12), bw = Math.max(1, (W - M.l - M.r) / n - 1);
    return { lines: q.lines.map((l, k) => ({ k: l.k, cls: `pt-tech-l${k}`, d: path(l.v.flatMap((u, i) => (u == null ? [] : [[x(i), qy(u)] as [number, number]]))) })),
      bars: (q.bars ?? []).flatMap((b, i) => (b == null ? [] : [{ x: (x(i) - bw / 2).toFixed(1), y: Math.min(qy(b), qy(0)).toFixed(1), w: bw.toFixed(1), h: Math.max(0.5, Math.abs(qy(b) - qy(0))).toFixed(1), pos: b > 0 }])),
      guides: q.guides.map((g) => ({ y: qy(g).toFixed(1), label: q.k === 'rsi' ? String(g) : '0' })), last: q.lines[0]?.v.at(-1) };
  })();
  return { price: line(p), lines: c.chart.lines.map((l, k) => ({ k: l.k, cls: `pt-tech-l${k}`, d: line(l.v) })),
    levels: c.chart.levels.map((l) => ({ k: l.k, y: y(l.v).toFixed(1), label: money(l.v) })), marks, ticks, pane,
    now: { cx: x(n - 1).toFixed(1), cy: y(p[n - 1]!).toFixed(1) }, hiLabel: money(hi / 1.03), loLabel: money(lo / 0.97), yHi: y(hi / 1.03).toFixed(1), yLo: y(lo / 0.97).toFixed(1) };
}

/** The "after" chart: each past time's path over the horizon, the stock's median path, the pooled median as a tick at the right edge. */
export function afterChart(st: TechState, h: 0 | 1) {
  const k = HS[h] / STEP + 1, paths = (st.paths ?? []).map((p) => p.slice(0, k));
  if (!paths.length) return null;
  const pool = st.all?.[h].med ?? null, vals = [0, ...paths.flat().filter((v): v is number => v != null), ...(pool == null ? [] : [pool])];
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08 || 0.01;
  const x = (i: number) => M.l + (i / (k - 1)) * (W - M.l - M.r), y = (v: number) => 8 + ((hi + pad - v) / (hi - lo + 2 * pad)) * (AH - 26);
  const med = Array.from({ length: k }, (_, i) => { const v = paths.map((p) => p[i]).filter((u): u is number => u != null).sort((a, b) => a - b);
    return v.length ? (v.length % 2 ? v[v.length >> 1]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2) : null; });
  const eps = st.episodes.slice(-paths.length);
  return {
    paths: paths.map((p, j) => { const end = p.filter((v) => v != null).at(-1) ?? 0;
      return { d: path(p.flatMap((v, i) => (v == null ? [] : [[x(i), y(v)] as [number, number]]))), up: end > 0, tip: tip({ [date(eps[j]?.t ?? '')]: pct(end) }) }; }),
    med: path(med.flatMap((v, i) => (v == null ? [] : [[x(i), y(v)] as [number, number]]))),
    zero: y(0).toFixed(1), pool: pool == null ? null : { y: y(pool).toFixed(1), label: pct(pool) }, x2: (W - M.r).toFixed(1),
    ticks: [{ x: x(0).toFixed(1), label: 'Then', anchor: 'start' }, { x: x(k - 1).toFixed(1), label: h ? '3 months' : '1 month', anchor: 'end' }],
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
              @for (l of g.lines; track l.k) {<path [class]="l.cls" [attr.d]="l.d" />}
              <path class="pt-tech-price" [attr.d]="g.price" />
              @for (m of g.marks; track $index) {<circle [class]="m.neg ? 'pt-tech-mark pt-tech-mark-neg' : 'pt-tech-mark'" [attr.cx]="m.cx" [attr.cy]="m.cy" r="3.5" [attr.data-tip]="m.tip" />}
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
              @if (c.chart.marks.length) {<span class="pt-key pt-tech-key-mark">The times counted below</span>}</p>
          }
          <div class="pt-head pt-tech-head"><h4>What happened after</h4>
            <div ptToggles [value]="h()" [options]="HORIZONS" aria-label="Horizon" (choose)="h.set($event)"></div></div>
          @for (s of shown(); track s.key) {
            <div class="pt-tech-state">
              <p>{{ stockLine(s) }}@if (heldLine(s); as l) { {{ l }}}</p>
              @if (s.all; as a) {<p class="pt-meta">{{ allLine(a, s) }}</p>}
              @if (after(s); as g) {
                <svg class="pt-chart-svg pt-tech-svg" [attr.viewBox]="'0 0 ' + W + ' ' + AH" role="img" [attr.aria-label]="'Each time ' + episode(s) + ', ' + d.ticker + ' over the next ' + (h() ? 'three months' : 'month')">
                  <line class="pt-tech-zero" x1="0" [attr.x2]="g.x2" [attr.y1]="g.zero" [attr.y2]="g.zero" />
                  @for (p of g.paths; track $index) {<path [class]="p.up ? 'pt-tech-path' : 'pt-tech-path pt-tech-path-neg'" [attr.d]="p.d" /><path class="pt-stats-hitline" [attr.d]="p.d" [attr.data-tip]="p.tip" />}
                  <path class="pt-tech-med" [attr.d]="g.med" />
                  @if (g.pool; as o) {<line class="pt-tech-pool" [attr.x1]="g.x2" [attr.x2]="W - M.r + 10" [attr.y1]="o.y" [attr.y2]="o.y" /><text class="pt-tech-lab" [attr.x]="W - M.r + 12" [attr.y]="o.y" dy="3">{{ o.label }}</text>}
                  @for (k of g.ticks; track k.x) {<text class="pt-axis" [attr.x]="k.x" [attr.y]="AH - 4" [attr.text-anchor]="k.anchor">{{ k.label }}</text>}
                </svg>
                <p class="pt-legend"><span class="pt-key pt-tech-key-path">One past time each</span><span class="pt-key pt-tech-key-med">{{ d.ticker }}'s median</span>
                  @if (g.pool) {<span class="pt-key pt-tech-key-pool">All companies' median</span>}</p>
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
  protected readonly shown = computed(() => { const c = this.cardOf(); if (!c) return [];
    const keys = SHOWN[`${c.key}:${c.state}`] ?? [c.state]; return c.states.filter((s) => keys.includes(s.key)); });
  protected readonly keys = computed(() => { const c = this.cardOf(); if (!c) return [];
    const label = (k: string) => LABEL[k] ?? k;
    return [...c.chart.lines.map((l, i) => ({ k: l.k, label: label(l.k), n: `l${i}` })), ...c.chart.levels.map((l) => ({ k: l.k, label: label(l.k), n: 'level' })),
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
        return `${who}'s nearest ${c.key} is ${money(n['level'])}, ${side(n['dist'])} its close of ${money(d.close)} on ${on}; the price turned there ${n['touches']} times in the last two years.`;
      }
      case 'ma200': return `${close}, ${side(n['dist'])} its 200-day moving average of ${money(n['ma'])}.`;
      case 'mas': return `${close}, ${side(n['d20'])} its 20-day, ${side(n['d50'])} its 50-day and ${side(n['d100'])} its 100-day moving average (${money(n['ma20'])}, ${money(n['ma50'])} and ${money(n['ma100'])}).`;
      case 'cross': {
        const g = c.state === 'golden', since = n['ago'] != null ? ` The last ${g ? 'golden' : 'death'} cross was ${n['ago']} sessions before ${on}.` : ` It has been ${g ? 'above' : 'below'} it ${this.window()}.`;
        return `${who}'s 50-day moving average (${money(n['ma50'])}) is ${g ? 'above' : 'below'} its 200-day (${money(n['ma200'])}) on ${on}.${since}`;
      }
      case 'bollinger': return `${close}, ${c.state === 'belowLower' ? 'below its lower Bollinger Band' : c.state === 'aboveUpper' ? 'above its upper Bollinger Band' : 'inside its Bollinger Bands'} (${money(n['lower'])} to ${money(n['upper'])}: the 20-day average ± 2 standard deviations).`;
      case 'macd': return `${who}'s MACD histogram is ${c.state === 'pos' ? 'positive' : 'negative'} on ${on} (${n['hist']?.toFixed(2)}): the MACD line is ${c.state === 'pos' ? 'above' : 'below'} its signal line${n['ago'] != null ? `, for ${n['ago']} sessions` : ''}.`;
      case 'high': return `${close}, ${side(n['dist'])} its 52-week high of ${money(n['high'])}.`;
    }
  }

  protected stockLine(s: TechState): string {
    const d = this.data.value()!, h = this.h(), m: TechSum = s.stock[h], later = h ? 'three months later' : 'a month later', what = this.episode(s);
    const recent = s.total - m.n, tail = recent > 0 ? ` (${recent} more ${recent === 1 ? 'time is' : 'times are'} too recent to count)` : '';
    if (!s.total) return `${d.ticker}: ${what[0]!.toUpperCase()}${what.slice(1)} — not once ${this.window()}.`;
    if (m.n < 3) return `${d.ticker} has done it only ${s.total} ${s.total === 1 ? 'time' : 'times'} ${this.window()}, when ${what}: ${dates(s.episodes.map((e) => date(e.t)))}.${tail}`;
    const mkt = m.mkt != null ? `; the market ${pct(m.mkt)} over the same days, ${pct(m.net)} net` : '';
    return `The ${m.n} times ${what} ${this.window()}, ${d.ticker} was higher ${later} ${m.up} of ${m.n} times (median ${pct(m.med)}${mkt}).${tail}`;
  }

  protected heldLine(s: TechState): string | null {
    if (s.held == null || !s.total || s.stock[0].n < 3) return null;
    return this.card() === 'support' ? `The support held ${s.held} of those times (no close more than 3% under it within a month).`
      : `The resistance held ${s.held} of those times (no close more than 3% over it within a month).`;
  }

  /** Every company's same count; no "net" on the market's own page (SPY against itself). */
  protected allLine(a: [TechSum, TechSum], s: TechState): string {
    const m = a[this.h()], market = s.stock[this.h()].mkt != null || s.stock[this.h()].n === 0;
    if (!m.n) return '';
    return `All companies on pretickt, same rule: higher ${this.h() ? 'three months' : 'a month'} later ${share(m.up, m.n)} of ${thousands(m.n)} times, median ${pct(m.med)}${m.net != null && market ? ` (${pct(m.net)} net of the market)` : ''}.`;
  }

  protected chartLabel(): string {
    const d = this.data.value()!, c = this.cardOf()!, r = c.chart.range === 'daily' ? d.daily : d.weekly;
    return `${d.ticker} from ${date(r.t[c.chart.from] ?? r.t[0]!)} to ${date(d.asOf)}${this.keys().length ? `, with ${this.keys().map((k) => k.label).join(', ')}` : ''}`;
  }
}

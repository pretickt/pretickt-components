/**
 * What has this stock done? Its last five years in four rows, the same for every stock: how much it moves, its years against the S&P 500,
 * its falls and rises beyond its own threshold side by side, how often it went up. Facts and counts, each with its window; never a forecast.
 * @version 1.0.0
 * @evidence DataForSEO round 18 (US, 2026-11-14): "nvidia stock price history" 2,900 a month, "will nvidia stock go up" 1,900, "nvidia stock performance" 1,900, "<company> all time high" (Apple 850), "<company> beta" (Nvidia 720)
 * @evidence Romeo, 2026-11-14: «più che precisione, parlerei di statistiche»; «affianca stats rally oltre a drawdown»
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { date, money, pct, plainName, tip } from '@pretickt/components/format';
import type { Stats, StatsSwing } from '@pretickt/components/typologies';

const YW = 600, YH = 150, SW = 600, SH = 230, SM = { l: 4, r: 46, t: 20, b: 22 };

/** "Nov 2021" from an ISO date. */
export const monthYear = (iso: string) => date(iso).replace(/ \d+,/, '');
const many = (n: number, one: string, more = `${one}s`) => `${n} ${n === 1 ? one : more}`;
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
/** How long a move took, in words: weeks under two months, else months. */
export const span = (sessions: number) => (sessions < 42 ? `about ${many(Math.max(1, Math.round(sessions / 5)), 'week')}` : `about ${many(Math.round(sessions / 21), 'month')}`);
const share = (x: number) => `${Math.round(x * 100)}%`;
const fewer = (x: number) => (x < 1 ? 'fewer than 1' : String(Math.round(x)));

/** The year bars: one per calendar year, SPY's change as a tick across it. */
export function yearBars(s: Pick<Stats, 'years' | 'spy'>) {
  const spy = new Map((s.spy?.years ?? []).map((y) => [y.year, y.change]));
  const vals = s.years.flatMap((y) => [y.change, spy.get(y.year) ?? 0]);
  const hi = Math.max(0, ...vals) * 1.08 || 0.01, lo = Math.min(0, ...vals) * 1.08;
  const y = (v: number) => 8 + ((hi - v) / (hi - lo || 1)) * (YH - 16);
  const cw = YW / Math.max(1, s.years.length), bw = Math.min(56, cw * 0.5);
  return { zero: y(0).toFixed(1), bars: s.years.map((yr, i) => {
    const cx = cw * (i + 0.5), top = Math.min(y(yr.change), y(0)), sp = spy.get(yr.year);
    return { ...yr, spy: sp ?? null, x: (cx - bw / 2).toFixed(1), y: top.toFixed(1), w: bw.toFixed(1), h: Math.max(1, Math.abs(y(yr.change) - y(0))).toFixed(1),
      tx1: (cx - bw / 2 - 5).toFixed(1), tx2: (cx + bw / 2 + 5).toFixed(1), ty: sp == null ? null : y(sp).toFixed(1), hx: (cx - cw / 2).toFixed(1), hw: cw.toFixed(1) };
  }) };
}

/** The five years on a log scale: the whole path in plain ink, each swing over it in its tone, the turns marked and labelled. */
export function swingChart(s: Pick<Stats, 'path' | 'swings' | 'deepestFall' | 'largestRise'>) {
  const pts = s.path;
  if (pts.length < 2) return null;
  const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`), t0 = t(pts[0]!.t), t1 = t(pts.at(-1)!.t);
  const x = (iso: string) => SM.l + ((t(iso) - t0) / (t1 - t0 || 1)) * (SW - SM.l - SM.r);
  const cs = pts.map((p) => p.c), lo = Math.log(Math.min(...cs) * 0.92), hi = Math.log(Math.max(...cs) * 1.08);
  const y = (v: number) => SM.t + ((hi - Math.log(v)) / (hi - lo || 1)) * (SH - SM.t - SM.b);
  const line = (from: string, to: string) => pts.filter((p) => p.t >= from && p.t <= to).map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.c).toFixed(1)}`).join('');
  const falls = s.swings.filter((w) => w.kind === 'fall'), rises = s.swings.filter((w) => w.kind === 'rise');
  const deepest = falls.reduce<StatsSwing | null>((a, b) => (!a || b.size < a.size ? b : a), null);
  const largest = rises.reduce<StatsSwing | null>((a, b) => (!a || b.size > a.size ? b : a), null);
  const main = new Set([deepest, largest, s.swings.at(-1), s.swings.at(-2)].filter(Boolean));
  // three price levels at round values across the range
  const levels = [0.15, 0.5, 0.85].map((f) => { const v = Math.exp(lo + (hi - lo) * f), p = 10 ** Math.floor(Math.log10(v)); return Math.round(v / p) * p; })
    .filter((v, i, a) => a.indexOf(v) === i);
  const years: { label: string; x: string }[] = [];
  for (let yr = Number(pts[0]!.t.slice(0, 4)) + 1; yr <= Number(pts.at(-1)!.t.slice(0, 4)); yr++) years.push({ label: String(yr), x: x(`${yr}-01-01`).toFixed(1) });
  return {
    all: line(pts[0]!.t, pts.at(-1)!.t),
    swings: s.swings.map((w) => {
      const up = w.kind === 'rise', lx = Math.max(SM.l + 18, Math.min(SW - SM.r - 18, x(w.to)));
      return { ...w, d: line(w.from, w.to), cx: x(w.to).toFixed(1), cy: y(w.toClose).toFixed(1), lx: lx.toFixed(1), ly: (up ? y(w.toClose) - 8 : y(w.toClose) + 15).toFixed(1),
        main: main.has(w), tip: tip({ [up ? 'A rise' : 'A fall']: pct(w.size), From: `${money(w.fromClose)} (${monthYear(w.from)})`, To: `${money(w.toClose)} (${monthYear(w.to)})${w.open ? ', so far' : ''}`,
          Took: span(w.sessions), ...(up ? {} : { Back: w.back ? monthYear(w.back) : 'not yet' }) }) };
    }),
    levels: levels.map((v) => ({ y: y(v).toFixed(1), label: money(v, v < 10 ? 2 : 0) })), years,
    now: { cx: x(pts.at(-1)!.t).toFixed(1), cy: y(pts.at(-1)!.c).toFixed(1) }, gx2: (SW - SM.r).toFixed(1), lx: (SW - SM.r + 6).toFixed(1),
  };
}

@Component({
  selector: 'pt-stats',
  template: `
    @let s = stats.value();
    @if (s === null) {<p class="pt-na">Statistics not available</p>}
    @else if (s) {
      <section class="pt-stats">
        <div class="pt-stats-row">
          <h3>How much does {{ name() }} stock move?</h3>
          <div class="pt-stats-tiles">
            <div class="pt-stats-tile"><span class="pt-stats-k">±{{ pct(s.typicalDay).replace('+', '') }}</span><span>on a typical day</span>
              @if (s.spy) {<span class="pt-meta">S&amp;P 500 ±{{ pct(s.spy.typicalDay).replace('+', '') }}</span>}</div>
            <div class="pt-stats-tile"><span class="pt-stats-k">{{ round(s.bigDaysPerYear) }}</span><span>days a year it moved more than 5%</span>
              @if (s.spy) {<span class="pt-meta">S&amp;P 500 {{ fewer(s.spy.bigDaysPerYear) }}</span>}</div>
            <div class="pt-stats-tile">
              @if (s.beta !== null) {<span class="pt-stats-k">{{ s.beta.toFixed(1) }}×</span><span>the market's daily moves (beta)</span>
                <span class="pt-meta">When the S&amp;P 500 moved 1%, {{ name() }} moved {{ s.beta.toFixed(1) }}%, over two years</span>}
              @else {<span class="pt-stats-k">—</span><span>the market's daily moves (beta)</span><span class="pt-meta">Not computed: under two years of prices beside the S&amp;P 500</span>}
            </div>
            <div class="pt-stats-tile"><span class="pt-stats-k">±{{ pct(s.month80, 0).replace('+', '') }}</span><span>in a typical month</span>
              <span class="pt-meta">8 months in 10 moved less than this, {{ window() }}</span></div>
          </div>
        </div>

        <div class="pt-stats-row">
          <h3>{{ name() }} stock performance by year</h3>
          <svg class="pt-chart-svg" [attr.viewBox]="'0 0 ' + YW + ' ' + YH" role="img" [attr.aria-label]="name() + ' and the S&P 500, price change by calendar year'">
            <line class="pt-grid" x1="0" [attr.x2]="YW" [attr.y1]="years().zero" [attr.y2]="years().zero" />
            @for (b of years().bars; track b.year) {
              <rect class="pt-stats-ybar" [class.pt-stats-ybar-part]="b.soFar" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="3" />
              @if (b.ty !== null) {<line class="pt-stats-ytick" [attr.x1]="b.tx1" [attr.x2]="b.tx2" [attr.y1]="b.ty" [attr.y2]="b.ty" />}
              <rect class="pt-stats-hit" [attr.x]="b.hx" y="0" [attr.width]="b.hw" [attr.height]="YH"
                [attr.data-tip]="yearTip(b)" />
            }
          </svg>
          <div class="pt-stats-years" [style.grid-template-columns]="'repeat(' + s.years.length + ', minmax(0, 1fr))'">
            @for (y of s.years; track y.year) {
              <div><span class="pt-meta">{{ y.year }}{{ y.soFar ? ' so far' : '' }}</span><b [class]="tone(y.change)">{{ pct(y.change) }}</b>
                @if (spyYear(y.year); as v) {<span class="pt-meta">S&amp;P {{ v }}</span>}</div>
            }
          </div>
          <p class="pt-legend"><span class="pt-key pt-key-rev">{{ name() }}</span>@if (s.spy) {<span class="pt-key pt-stats-key-tick">S&amp;P 500</span>}</p>
          <p class="pt-meta">{{ Window() }}: {{ name() }} {{ pct(s.total) }}@if (s.spy) {, S&amp;P 500 {{ pct(s.spy.total) }}}. {{ s.years.at(-1)?.soFar ? s.years.at(-1)!.year + ' is to ' + date(s.asOf) + '.' : '' }}</p>
        </div>

        <div class="pt-stats-row">
          <h3>Falls and rises of {{ th() }} or more</h3>
          <p>{{ countLine() }} Today {{ name() }} is {{ fromHigh() }} its 5-year high close of {{ money(s.high.close) }} ({{ date(s.high.date) }}) and
            {{ fromLow() }} its 52-week low close of {{ money(s.low52.close) }} ({{ date(s.low52.date) }}).</p>
          @if (chart(); as c) {
            <svg class="pt-chart-svg" [attr.viewBox]="'0 0 ' + SW + ' ' + SH" role="img" [attr.aria-label]="name() + ' over ' + window() + ', with each fall and rise of ' + th() + ' or more'">
              @for (l of c.levels; track l.label) {<line class="pt-grid" x1="0" [attr.x2]="c.gx2" [attr.y1]="l.y" [attr.y2]="l.y" /><text class="pt-axis" [attr.x]="c.lx" [attr.y]="l.y" dy="3">{{ l.label }}</text>}
              @for (y of c.years; track y.label) {<text class="pt-axis" [attr.x]="y.x" [attr.y]="SH - 6" text-anchor="middle">{{ y.label }}</text>}
              <path class="pt-stats-path" [attr.d]="c.all" />
              @for (w of c.swings; track w.from) {
                <path [class]="w.kind === 'fall' ? 'pt-stats-fall' : 'pt-stats-rise'" [attr.d]="w.d" />
                <path class="pt-stats-hitline" [attr.d]="w.d" [attr.data-tip]="w.tip" />
                <circle class="pt-stats-pivot" [attr.cx]="w.cx" [attr.cy]="w.cy" r="3" />
                <text class="pt-stats-lab" [class.pt-stats-lab-minor]="!w.main" [attr.x]="w.lx" [attr.y]="w.ly" text-anchor="middle">{{ pct(w.size, 0) }}</text>
              }
              <circle class="pt-stats-now" [attr.cx]="c.now.cx" [attr.cy]="c.now.cy" r="4" />
            </svg>
          }
          <p class="pt-legend"><span class="pt-key pt-stats-key-fall">A fall of {{ th() }} or more</span><span class="pt-key pt-stats-key-rise">A rise of {{ th() }} or more</span></p>
          <div class="pt-stats-twin">
            @for (side of twins(); track side.kind) {
              <div [class]="'pt-stats-' + side.kind + 's'">
                <h4>{{ side.title }}</h4>
                @if (side.n) {
                  <dl>
                    <dt>How many</dt><dd>{{ side.n }}</dd>
                    <dt>Typical</dt><dd>{{ side.typical }}<small>in {{ side.took }}</small></dd>
                    <dt>{{ side.extremeLabel }}</dt><dd>{{ side.extreme }}<small>{{ side.extremeWhen }}</small></dd>
                    <dt>Latest</dt><dd>{{ side.latest }}<small>{{ side.latestWhen }}</small></dd>
                  </dl>
                } @else {<p class="pt-meta">No {{ side.kind }} of {{ th() }} or more {{ window() }}.</p>}
              </div>
            }
          </div>
          <p class="pt-meta">@if (s.spy) {For scale, the S&amp;P 500's deepest fall in the same years: {{ pct(s.spy.deepestFall.size) }}. }A fall or a rise counts once the price turns back by {{ th() }}: 1.5 times {{ name() }}'s typical month, rounded to 5%.</p>
        </div>

        <div class="pt-stats-row">
          <h3>Will {{ name() }} stock go up?</h3>
          <p>{{ Window() }} {{ name() }} closed a month higher {{ upMonths() }} times out of {{ s.months.length }}. That is the past: pretickt does not forecast its direction.</p>
          <div class="pt-stats-urow"><b>{{ name() }}</b>
            <div class="pt-stats-units" role="img" [attr.aria-label]="name() + ': ' + upMonths() + ' of ' + s.months.length + ' months up'">
              @for (m of s.months; track m.month) {<i [class.pt-stats-up]="m.change > 0" [attr.data-tip]="monthTip(m)"></i>}
            </div><span class="pt-stats-v">{{ upMonths() }}/{{ s.months.length }}</span></div>
          @if (s.spy) {
            <div class="pt-stats-urow pt-stats-urow-ref"><span>S&amp;P 500</span>
              <div class="pt-stats-units" role="img" [attr.aria-label]="'S&P 500: ' + spyUp() + ' of ' + s.spy.months.length + ' months up'">
                @for (m of s.spy.months; track m.month) {<i [class.pt-stats-up]="m.change > 0" [attr.data-tip]="monthTip(m)"></i>}
              </div><span class="pt-stats-v">{{ spyUp() }}/{{ s.spy.months.length }}</span></div>
          }
          <div class="pt-stats-tiles">
            <div class="pt-stats-tile"><span class="pt-stats-k">{{ share(s.stretches.n ? s.stretches.up / s.stretches.n : 0) }}</span><span>of one-year stretches ended higher</span>
              @if (s.spy) {<span class="pt-meta">S&amp;P 500 {{ share(s.spy.stretches.n ? s.spy.stretches.up / s.spy.stretches.n : 0) }}</span>}</div>
            <div class="pt-stats-tile"><span class="pt-stats-k">{{ share(s.upDays) }}</span><span>of days closed higher</span>
              @if (s.spy) {<span class="pt-meta">S&amp;P 500 {{ share(s.spy.upDays) }}</span>}</div>
            @if (s.bestMonth && s.worstMonth) {
              <div class="pt-stats-tile"><span class="pt-stats-k">{{ pct(s.bestMonth.change, 0) }} / {{ pct(s.worstMonth.change, 0) }}</span><span>best and worst month</span>
                <span class="pt-meta">{{ monthYear(s.bestMonth.month + '-01') }} · {{ monthYear(s.worstMonth.month + '-01') }}</span></div>
            }
          </div>
        </div>
      </section>
    }`,
})
export class PtStats {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  protected readonly stats = this.pt.stats(() => ({ ticker: this.ticker() }));
  protected readonly name = computed(() => plainName(this.stats.value()?.name ?? this.ticker()));
  /** The window in words: "in the last five years", or "since Jun 1, 2023" for a shorter history. */
  protected readonly window = computed(() => { const s = this.stats.value(); return !s || s.fullWindow ? 'in the last five years' : `since ${date(s.since)}`; });
  protected readonly Window = computed(() => { const w = this.window(); return w[0]!.toUpperCase() + w.slice(1); });
  protected readonly th = computed(() => `${Math.round((this.stats.value()?.threshold ?? 0) * 100)}%`);
  protected readonly years = computed(() => yearBars(this.stats.value() ?? { years: [], spy: null }));
  protected readonly chart = computed(() => { const s = this.stats.value(); return s ? swingChart(s) : null; });
  protected readonly upMonths = computed(() => (this.stats.value()?.months ?? []).filter((m) => m.change > 0).length);
  protected readonly spyUp = computed(() => (this.stats.value()?.spy?.months ?? []).filter((m) => m.change > 0).length);
  protected readonly countLine = computed(() => {
    const s = this.stats.value();
    if (!s) return '';
    const f = s.swings.filter((w) => w.kind === 'fall').length, r = s.swings.filter((w) => w.kind === 'rise').length, th = this.th();
    if (!f && !r) return `No fall or rise of ${th} or more ${this.window()}.`;
    return `${many(f, 'fall')} of ${th} or more ${this.window()}, and ${many(r, 'rise')} of ${th} or more.`;
  });
  protected readonly fromHigh = computed(() => {
    const s = this.stats.value(), last = s?.path.at(-1)?.c;
    if (!s || last === undefined) return '';
    const d = last / s.high.close - 1;
    return Math.abs(d) < 0.0005 ? 'at' : `${pct(-d).replace('+', '')} below`;
  });
  protected readonly fromLow = computed(() => {
    const s = this.stats.value(), last = s?.path.at(-1)?.c;
    if (!s || last === undefined) return '';
    const d = last / s.low52.close - 1;
    return Math.abs(d) < 0.0005 ? 'at' : `${pct(d).replace('+', '')} above`;
  });
  protected readonly twins = computed(() => {
    const s = this.stats.value();
    if (!s) return [];
    const th = this.th(), when = (from: string, to: string) => `${monthYear(from)} → ${monthYear(to)}`;
    return (['fall', 'rise'] as const).map((kind) => {
      const ws = s.swings.filter((w) => w.kind === kind), last = ws.at(-1), x = kind === 'fall' ? s.deepestFall : s.largestRise;
      return { kind, title: `${kind === 'fall' ? 'Falls' : 'Rises'} of ${th} or more`, n: ws.length,
        typical: pct(median(ws.map((w) => w.size))), took: span(median(ws.map((w) => w.sessions))),
        extremeLabel: kind === 'fall' ? 'Deepest from a high' : 'Largest from a low', extreme: pct(x.size),
        extremeWhen: kind === 'fall' ? `${when(x.from, x.to)}, ${x.back ? `back by ${monthYear(x.back)}` : 'not back yet'}` : when(x.from, x.to),
        latest: last ? pct(last.size) : '', latestWhen: last ? `${when(last.from, last.to)}${last.open ? ', so far' : ''}${kind === 'fall' ? (last.back ? `, back by ${monthYear(last.back)}` : ', not back yet') : ''}` : '' };
    });
  });
  protected spyYear(year: number): string | null {
    const v = this.stats.value()?.spy?.years.find((y) => y.year === year)?.change;
    return v === undefined ? null : pct(v);
  }
  protected yearTip(b: { year: number; soFar: boolean; change: number; spy: number | null }) {
    return tip({ [`${b.year}${b.soFar ? ', so far' : ''}`]: '', [this.name()]: pct(b.change), 'S&P 500': b.spy === null ? '—' : pct(b.spy) });
  }
  protected monthTip(m: { month: string; change: number }) { return tip({ [monthYear(`${m.month}-01`)]: pct(m.change) }); }
  protected tone(v: number) { return v > 0 ? 'pt-t-pos' : v < 0 ? 'pt-t-neg' : 'pt-t-flat'; }
  protected readonly round = Math.round;
  protected readonly fewer = fewer;
  protected readonly share = share;
  protected readonly pct = pct;
  protected readonly money = money;
  protected readonly date = date;
  protected readonly monthYear = monthYear;
  protected readonly YW = YW;
  protected readonly YH = YH;
  protected readonly SW = SW;
  protected readonly SH = SH;
}

/**
 * Where do analysts think this stock is going, and how spread out are they?
 * @version 2.3.0
 * @evidence DataForSEO: "{ticker} price target" ~103k searches/month, "{ticker} stock forecast" ~151k (launch/data, public-site spec §4)
 * @evidence beta: pt-chart (pretickt-frontend/src/app/companies/pt-chart.ts) — geometry, clustering, hover animations and zoom/pan ported 1:1
 * @evidence Romeo, 2026-10-18: "nel price target il low high upside … farlo con una visuale verticale col prezzo attuale e percentuale, ma visuale … a good design"
 */
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { applyXViewport, applyYViewport, closeAt, FULL_VIEWPORT, isoDay, linePath, monthTicks, padTime, PtChart, PtTimeAxis, PtYAxis, type Viewport } from '@pretickt/components/ds';
import { date, money, pct, svgId, tip } from '@pretickt/components/format';
import { cmp, type Analysts, type PriceBar } from '@pretickt/components/typologies';

type Target = Analysts['targets'][number];

// Geometry, ported from beta pt-chart.geometry.ts (targets already arrive on our adjusted basis). x unit: days (isoDay). ─────
const W = 800, H = 340, ML = 6, MR = 46, MT = 12, MB = 22;
const START_DAYS = 15;   // start points within a fortnight merge
const END_PCT = 0.2;     // targets within 20% (value) …
const END_DAYS = 45;     // … and ~45 days apart merge
const MAX_MEMBER_ROWS = 6;
const LABEL_W = 30;      // room a "+139%" label needs right of its dot

export interface PtSegment { up: boolean; line: string; x1: number; x2: number; endIdx: number }
export interface PtCluster {
  x: number; y: number; r: number; up: boolean; pctLabel: string; members: Target[]; meanTarget: number;
  /** no room right of the dot */ labelLeft: boolean;
}
export interface PtTargetChart {
  w: number; h: number; pricePath: string; todayX: number;
  yTicks: { y: number; v: number }[]; xTicks: { x: number; label: string }[];
  segments: PtSegment[]; startDots: { x: number; y: number; r: number }[]; clusters: PtCluster[];
}

const f = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** The day a target expires: twelve months after it was published (Feb 29 rolls to Mar 1, like the beta chart). */
const plus12m = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Math.floor(Date.UTC(y! + 1, m! - 1, d!) / 86_400_000); };

/** Greedy clustering in input order: an item joins the first group it is `near`, or starts a new one. */
function clusterGreedy<T>(items: T[], near: (item: T, group: T[]) => boolean): { groups: T[][]; of: number[] } {
  const groups: T[][] = [], of: number[] = [];
  for (const it of items) {
    let g = groups.findIndex((grp) => near(it, grp));
    if (g < 0) g = groups.push([]) - 1;
    groups[g]!.push(it);
    of.push(g);
  }
  return { groups, of };
}

/**
 * The real price line; per target a segment from its (fortnight-grouped) start on the price line to its target at the
 * +12-month horizon. Nearby targets (within 20% and ~45 days) merge into one dot sized by count and labelled with its %
 * versus the current price. "Today" is `asOf`: a component never reads the clock.
 */
export function buildPtChart(points: PriceBar[], targets: Target[], asOf: string, current: number, viewport: Viewport = FULL_VIEWPORT): PtTargetChart | null {
  if (!points.length || !targets.length || !(current > 0)) return null;
  const items = targets
    .filter((t) => t.target > 0)
    .map((t) => { const startY = closeAt(points, t.date); return { t, start: isoDay(t.date), startY, end: plus12m(t.date), targetY: t.target, up: t.target > startY }; })
    .sort((a, b) => a.start - b.start);
  if (!items.length) return null;
  type Item = (typeof items)[number];

  const starts = clusterGreedy(items, (it, g) => Math.abs(it.start - mean(g.map((x) => x.start))) <= START_DAYS);
  const ends = clusterGreedy(items, (it, g) => {
    const cy = mean(g.map((x) => x.targetY));
    return Math.abs(it.targetY - cy) / Math.max(cy, 1) <= END_PCT && Math.abs(it.end - mean(g.map((x) => x.end))) <= END_DAYS;
  });
  const at = (g: Item[], side: 'start' | 'end') => side === 'start'
    ? { day: mean(g.map((x) => x.start)), y: mean(g.map((x) => x.startY)) }
    : { day: mean(g.map((x) => x.end)), y: mean(g.map((x) => x.targetY)) };
  const upOf = (g: Item[]) => g.filter((x) => x.up).length > g.length / 2;

  let yLo = Math.min(...points.map((p) => p.c), ...items.map((t) => t.targetY));
  let yHi = Math.max(...points.map((p) => p.c), ...items.map((t) => t.targetY));
  const pad = (yHi - yLo) * 0.05 || 1;
  // The user's lens on top of the natural ranges (beta: same viewport object as the event map).
  ({ lo: yLo, hi: yHi } = applyYViewport(yLo - pad, yHi + pad, viewport));
  const today = isoDay(asOf);
  // the time pad after the furthest 12-month target: its dot and its % label stand clear of the price axis
  const span = padTime(Math.min(isoDay(points[0]!.t), ...items.map((t) => t.start)), Math.max(isoDay(points.at(-1)!.t), today, ...items.map((t) => t.end)));
  const { min: xMin, max: xMax } = applyXViewport(span.min, span.max, viewport);
  const sx = (day: number) => ML + ((day - xMin) / (xMax - xMin || 1)) * (W - ML - MR);
  const sy = (v: number) => H - MB - ((v - yLo) / (yHi - yLo || 1)) * (H - MT - MB);

  const clusters: PtCluster[] = ends.groups.map((g) => {
    const e = at(g, 'end');
    const pct = (e.y / current - 1) * 100;
    const x = f(sx(e.day)), r = f(2.4 + Math.min(Math.sqrt(g.length) * 1.5, 8));
    return { x, y: f(sy(e.y)), r, up: upOf(g), labelLeft: x + r + LABEL_W > W - MR, meanTarget: e.y,
      pctLabel: `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`,
      members: g.map((x) => x.t).sort((a, b) => cmp(b.date, a.date) || cmp(a.firm, b.firm)) };
  });
  const segments = new Map<string, PtSegment>();
  items.forEach((_, i) => {
    const si = starts.of[i]!, ei = ends.of[i]!;
    if (segments.has(`${si}:${ei}`)) return;
    const s = at(starts.groups[si]!, 'start'), e = at(ends.groups[ei]!, 'end');
    const x1 = f(sx(s.day)), x2 = f(sx(e.day));
    segments.set(`${si}:${ei}`, { up: clusters[ei]!.up, line: linePath([[x1, sy(s.y)], [x2, sy(e.y)]]), x1, x2, endIdx: ei });
  });

  return {
    w: W, h: H, todayX: f(sx(today)),
    pricePath: linePath(points.map((p) => [sx(isoDay(p.t)), sy(p.c)])),
    yTicks: [0, 1, 2, 3, 4].map((i) => { const v = yLo + ((yHi - yLo) * i) / 4; return { y: f(sy(v)), v }; }),
    xTicks: monthTicks(xMin, xMax).map((t) => ({ x: f(sx(t.day)), label: t.label })),
    segments: [...segments.values()],
    startDots: starts.groups.map((g) => { const s = at(g, 'start'); return { x: f(sx(s.day)), y: f(sy(s.y)), r: f(1.8 + Math.min(Math.sqrt(g.length) * 0.8, 3.5)) }; }),
    clusters,
  };
}

const tone = (up: boolean) => (up ? 'pt-pos' : 'pt-neg');

// The ladder: the summary upright, in % of its box. Top and bottom margins, the rail (30–33%), where the labels start, the dots' columns.
const PAD = 8, RAIL_L = 30, RAIL_R = 33, LABEL_X = 37, DOT_H = 2.6;
/** Labels' vertical centres stay this far apart (% of the box): close values (an average beside the median) never overlap. */
export const LADDER_GAP = 9;
const DOT_COLS = [27, 23.5, 20, 16.5, 13, 9.5, 6, 2.5];
const FLAT_PCT = 0.0005;
type Tone = 'pos' | 'neg' | 'flat';
export interface LadderMark {
  key: 'high' | 'median' | 'mean' | 'now' | 'low'; name: string; value: number; price: string; pct: string | null; tone: Tone | 'now';
  /** Its true place (% from the top) and its label's, kept apart; the lead joins the rail (or, for today, the box's left) to the label. */
  y: number; labelY: number; lead: string;
}
export interface Ladder {
  marks: LadderMark[];
  /** The rail from the highest target to the lowest: upside above today's price, downside below (one tone without a price). */
  zones: { top: number; height: number; tone: Tone }[];
  dots: { x: number; y: number; tone: Tone; tip: string }[];
}
const NAMES = { high: 'High', median: 'Median', mean: 'Average', now: 'Now', low: 'Low' } as const;
const ORDER = ['high', 'median', 'mean', 'now', 'low'] as const;

/** Centres at least `gap` apart, inside [lo, hi], each as close to its wish as the others allow (down, then up from the bottom). */
function spread(wish: number[], gap: number, lo: number, hi: number): number[] {
  const out = [...wish];
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i]!, out[i - 1]! + gap);
  if (out.length && out.at(-1)! > hi) { out[out.length - 1] = hi; for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i]!, out[i + 1]! - gap); }
  if (out.length && out[0]! < lo) { out[0] = lo; for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i]!, out[i - 1]! + gap); }
  return out;
}

/**
 * The summary upright: a rail from the lowest to the highest target — green above today's price, red below —, each firm's target a dot
 * beside it (in columns, so none hides another), today's price a line across, and on the right low, average, median, high and today,
 * each with its distance from today's price (the average's is the upside). One scale holds the targets and today's price.
 */
export function buildLadder(s: { low: number; mean: number; median: number; high: number }, price: number | null, targets: readonly Target[]): Ladder | null {
  const vals = [s.low, s.high, ...(price != null && price > 0 ? [price] : [])];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!(hi > lo)) { lo = lo * 0.95; hi = hi * 1.05; }
  if (!(hi > lo)) return null;
  const y = (v: number) => f(PAD + ((hi - v) / (hi - lo)) * (100 - 2 * PAD));
  const now = price != null && price > 0 ? price : null;
  const toneOf = (v: number): Tone => (now == null ? 'flat' : v / now - 1 > FLAT_PCT ? 'pos' : v / now - 1 < -FLAT_PCT ? 'neg' : 'flat');
  const raw = ORDER.filter((k) => k !== 'now' || now != null).map((key) => {
    const value = key === 'now' ? now! : s[key];
    return { key, value, name: NAMES[key], price: money(value), pct: key === 'now' || now == null ? null : pct(value / now - 1), tone: key === 'now' ? 'now' as const : toneOf(value), y: y(value) };
  }).sort((a, b) => a.y - b.y || ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  const labels = spread(raw.map((m) => m.y), LADDER_GAP, 5, 95).map(f);
  const marks = raw.map((m, i): LadderMark => ({ ...m, labelY: labels[i]!,
    lead: `M${m.key === 'now' ? 2 : RAIL_R} ${m.y} L${LABEL_X - 2} ${m.y} L${LABEL_X} ${labels[i]}` }));
  const top = y(s.high), bottom = y(s.low), at = now == null ? null : y(now);
  const zones = at == null ? [{ top, height: f(bottom - top), tone: 'flat' as Tone }]
    : at <= top ? [{ top, height: f(bottom - top), tone: 'neg' as Tone }]
    : at >= bottom ? [{ top, height: f(bottom - top), tone: 'pos' as Tone }]
    : [{ top, height: f(at - top), tone: 'pos' as Tone }, { top: at, height: f(bottom - at), tone: 'neg' as Tone }];
  // one dot a firm: its latest target (the one the summary counts; the list holds the year's history), highest first, each in the
  // column nearest the rail that no dot of a close value holds
  const latest = new Map<string, Target>();
  for (const t of targets) { const cur = latest.get(t.firm); if (t.target > 0 && (!cur || t.date >= cur.date)) latest.set(t.firm, t); }
  const placed: { x: number; y: number }[] = [];
  const dots = [...latest.values()].sort((a, b) => b.target - a.target || cmp(a.firm, b.firm)).map((t) => {
    const ty = y(t.target);
    const x = DOT_COLS.find((c) => !placed.some((p) => p.x === c && Math.abs(p.y - ty) < DOT_H)) ?? DOT_COLS.at(-1)!;
    placed.push({ x, y: ty });
    return { x, y: ty, tone: toneOf(t.target), tip: tip({ [t.firm]: `${money(t.target, 0)} · ${t.date}` }) };
  });
  return { marks, zones, dots };
}

@Component({
  selector: 'pt-price-target',
  imports: [PtChart, PtYAxis, PtTimeAxis],
  template: `
    @let a = analysts.value();
    @if (a === null) {<p class="pt-na">Data not available</p>}
    @else if (a && (!a.summary || !a.targets.length)) {<p class="pt-na">No analyst targets in the last 12 months</p>}
    @else if (a && a.summary && series.value() !== undefined) {
      <figure class="pt-chart pt-pt">
        @if (ladder(); as L) {
          <div class="pt-tg">
            <svg class="pt-tg-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              @for (m of L.marks; track m.key) {<path [attr.class]="'pt-tg-lead pt-tg-lead-' + m.tone" [attr.d]="m.lead" />}
            </svg>
            <div class="pt-tg-rail" aria-hidden="true">
              @for (z of L.zones; track z.tone) {<span [class]="'pt-tg-zone pt-tg-zone-' + z.tone" [style.top.%]="z.top" [style.height.%]="z.height"></span>}
            </div>
            @for (d of L.dots; track $index) {<i [class]="'pt-tg-dot pt-tg-dot-' + d.tone" [style.left.%]="d.x" [style.top.%]="d.y" [attr.data-tip]="d.tip"></i>}
            @for (m of L.marks; track m.key) {
              <div [class]="'pt-tg-mark pt-tg-' + m.key + ' pt-tg-' + m.tone" [style.top.%]="m.labelY">
                <span class="pt-tg-name">{{ m.name }}</span><span class="pt-tg-price">{{ m.price }}</span>@if (m.pct) {<span class="pt-tg-pct">{{ m.pct }}</span>}
              </div>
            }
          </div>
        }
        <p class="pt-lede">{{ a.summary.n }} firm{{ a.summary.n === 1 ? '' : 's' }} with a target in the last 12 months · last close {{ money(a.price) }} · as of {{ date(a.asOf) }}</p>
        @if (c(); as c) {
          <div ptChart [w]="c.w" [h]="c.h" [plotW]="c.w - MR" [plotH]="c.h - MB" [id]="id()" [label]="'Analyst price targets over time'" [(view)]="view">
            <svg:g ptDefs>
              @for (sg of c.segments; track $index) {
                <linearGradient [attr.id]="id() + 'g' + $index" gradientUnits="userSpaceOnUse" [attr.x1]="sg.x1" y1="0" [attr.x2]="sg.x2" y2="0">
                  <stop offset="0" class="pt-grad-from" /><stop offset="1" [attr.class]="sg.up ? 'pt-grad-up' : 'pt-grad-down'" />
                </linearGradient>
              }
            </svg:g>
            <svg:g ptAxes>
              <svg:g ptYAxis [w]="c.w" [plotW]="c.w - MR" [ticks]="c.yTicks"></svg:g>
              <svg:g ptTimeAxis [h]="c.h" [plotW]="c.w - MR" [ticks]="c.xTicks"></svg:g>
            </svg:g>
            <svg:g ptPlot>
              <line class="pt-today" [attr.x1]="c.todayX" y1="0" [attr.x2]="c.todayX" [attr.y2]="c.h" />
              <path class="pt-price" [attr.d]="c.pricePath" />
              <!-- one group per target dot: its segments, the dot, its % label and its orbit ring, so CSS hover lights them together -->
              @for (g of groups(); track g.i) {
                <g class="pt-cl">
                  @for (s of g.segs; track s.k) {
                    <g class="pt-sg"><path class="pt-seg" [attr.stroke]="'url(#' + id() + 'g' + s.k + ')'" [attr.d]="s.sg.line" /><path class="pt-seg-hit" [attr.d]="s.sg.line" /></g>
                  }
                  <circle [attr.class]="'pt-dot ' + tone(g.cl.up)" [attr.data-i]="g.i" [attr.tabindex]="0" [attr.cx]="g.cl.x" [attr.cy]="g.cl.y" [attr.r]="g.cl.r" [attr.aria-label]="g.label"
                    (pointerover)="open.set(g.i)" (pointerout)="open.set(null)" (focusin)="open.set(g.i)" (focusout)="open.set(null)" />
                  <text [attr.class]="'pt-pct ' + tone(g.cl.up)" [attr.x]="g.pctX" [attr.y]="f(g.cl.y + 3)" [attr.text-anchor]="g.cl.labelLeft ? 'end' : null">{{ g.cl.pctLabel }}</text>
                  <circle [attr.class]="'pt-orbit ' + tone(g.cl.up)" [attr.cx]="g.cl.x" [attr.cy]="g.cl.y" [attr.r]="f(g.cl.r + 4)" [style.transform-origin]="g.cl.x + 'px ' + g.cl.y + 'px'" />
                </g>
              }
              @for (d of c.startDots; track $index) {<circle class="pt-start" [attr.cx]="d.x" [attr.cy]="d.y" [attr.r]="d.r" />}
            </svg:g>
            <ng-container ngProjectAs="[ptAfter]">
              @for (g of groups(); track g.i) {
                <div [class]="g.panel.above ? 'pt-members pt-members-above' : 'pt-members'" [attr.data-i]="g.i" [hidden]="open() !== g.i" [style.left]="g.panel.left" [style.top]="g.panel.top">
                  @for (r of g.rows; track r.m.firm + r.m.date + r.m.target) {
                    <div class="pt-mem" [style.animation-delay]="r.delay">
                      <span class="pt-mem-analyst">{{ r.m.firm }}</span><span [class]="'pt-mem-target ' + tone(g.cl.up)">{{ money(r.m.target, 0) }}</span>
                      <span class="pt-mem-date">{{ r.m.date }}</span>@if (r.acc) {<span [class]="'pt-mem-acc ' + r.acc.cls">{{ r.acc.text }}</span>}
                    </div>
                  }
                  @if (g.more > 0) {<div class="pt-mem pt-mem-more" [style.animation-delay]="moreDelay">+{{ g.more }} more</div>}
                </div>
              }
            </ng-container>
          </div>
          <div class="pt-legend">
            <span class="pt-lg-price">— actual price</span><span class="pt-lg-up">● bullish target</span><span class="pt-lg-down">● bearish target</span>
            <span class="pt-lg-hint">hover a dot to see the analysts behind it · wheel or drag to move through time · drag the price axis on the right to stretch it · double-click resets</span>
          </div>
        }
        @if (consensus(); as k) {
          <div class="pt-consensus" aria-hidden="true">@for (b of k.bars; track b.cls) {<span [class]="b.cls" [style.width]="b.width"></span>}</div>
          <p class="pt-lede">{{ k.text }}</p>
        }
      </figure>
    }`,
})
export class PtPriceTarget {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();

  protected readonly analysts = this.pt.analysts(() => ({ ticker: this.ticker(), window: '1y' }));
  protected readonly series = this.pt.priceSeries(() => ({ tickers: [this.ticker()], range: '1y', interval: '1d', rebase: false }));
  protected readonly view = linkedSignal<unknown, Viewport>({ source: () => this.series.params(), computation: () => FULL_VIEWPORT });
  /** The dot whose analysts are shown (hover or keyboard focus). */
  protected readonly open = signal<number | null>(null);
  protected readonly MR = MR;
  protected readonly MB = MB;
  protected readonly tone = tone;
  protected readonly money = money;
  protected readonly date = date;
  protected readonly f = f;
  protected readonly moreDelay = `${(MAX_MEMBER_ROWS * 0.13).toFixed(2)}s`;
  protected readonly id = computed(() => svgId(`pt${this.ticker()}`));

  private readonly pts = computed(() => this.series.value()?.[0]?.points ?? []);
  protected readonly c = computed(() => {
    const a = this.analysts.value(), s = this.series.value();
    return a && s ? buildPtChart(this.pts(), a.targets, a.asOf, a.price ?? this.pts().at(-1)?.c ?? 0, this.view()) : null;
  });
  /** The summary upright against today's price (the last close; the series' when the answer has none). */
  protected readonly ladder = computed(() => {
    const a = this.analysts.value();
    return a?.summary ? buildLadder(a.summary, a.price ?? this.pts().at(-1)?.c ?? null, a.targets) : null;
  });
  protected readonly consensus = computed(() => {
    const k = this.analysts.value()?.consensus;
    if (!k) return null;
    const parts = [['sb', 'Strong buy', k.strongBuy], ['b', 'Buy', k.buy], ['h', 'Hold', k.hold], ['s', 'Sell', k.sell], ['ss', 'Strong sell', k.strongSell]] as const;
    const total = parts.reduce((n, [, , v]) => n + v, 0);
    if (!total) return null;
    return { bars: parts.filter(([, , v]) => v > 0).map(([key, , v]) => ({ cls: `pt-consensus-${key}`, width: `${((v / total) * 100).toFixed(1)}%` })),
      text: parts.map(([, label, v]) => `${label} ${v}`).join(' · ') };
  });
  private readonly accuracy = computed(() => new Map((this.analysts.value()?.accuracy ?? []).filter((x) => x.total > 0).map((x) => [x.firm, x])));
  protected readonly groups = computed(() => {
    const ch = this.c();
    if (!ch) return [];
    const acc = this.accuracy();
    return ch.clusters.map((cl, i) => {
      const one = cl.members[0]!;
      // % coordinates in the responsive wrapper; x clamped so the panel stays inside, flipped above the dot in the bottom third.
      const above = cl.y > ch.h * 0.62;
      const left = Math.min(85, Math.max(15, (cl.x / ch.w) * 100));
      const top = above ? ((cl.y - cl.r - 5) / ch.h) * 100 : ((cl.y + cl.r + 5) / ch.h) * 100;
      return {
        cl, i,
        segs: ch.segments.map((sg, k) => ({ sg, k })).filter(({ sg }) => sg.endIdx === i),
        label: cl.members.length > 1 ? `${cl.members.length} targets, about ${money(cl.meanTarget, 0)}` : `${one.firm}, ${money(one.target, 0)}, ${one.date}`,
        pctX: f(cl.labelLeft ? cl.x - cl.r - 3 : cl.x + cl.r + 3),
        panel: { above, left: `${f(left)}%`, top: `${f(top)}%` },
        rows: cl.members.slice(0, MAX_MEMBER_ROWS).map((m, k) => {
          const hit = acc.get(m.firm);
          return { m, delay: `${(k * 0.13).toFixed(2)}s`,
            acc: hit ? { cls: hit.hits / hit.total >= 0.5 ? 'pt-acc-good' : 'pt-acc-bad', text: `${Math.round((hit.hits / hit.total) * 100)}% · ${hit.total}` } : null };
        }),
        more: cl.members.length - MAX_MEMBER_ROWS,
      };
    });
  });
}

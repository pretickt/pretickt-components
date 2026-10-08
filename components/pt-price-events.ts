/**
 * What happened to this stock's price, and which earnings, dividends, splits and analyst moves happened along the way?
 * @version 2.1.0
 * @evidence beta: the price chart with event markers on the company page
 * @evidence DataForSEO: "<ticker> earnings date", "<ticker> dividend" families (launch/data)
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { applyXViewport, applyYViewport, closeAt, FULL_VIEWPORT, isoDay, linePath, monthTicks, PtChart, PtTimeAxis, PtToggles, PtYAxis, type Viewport } from '@pretickt/components/ds';
import { amount, date, money, num, pct, tip } from '@pretickt/components/format';
import { RANGES, type EventItem, type PriceBar, type RangeValue } from '@pretickt/components/typologies';

// Price labels sit in the right-hand strip you can grab to stretch the scale (beta / TradingView layout).
export const W = 720, H = 260, L = 6, R = 46, T = 12, B = 24;
export const PLOT_W = W - R, PLOT_H = H - B;

/** One marker per day and kind: busy days (a dozen analyst notes after earnings) collapse into one dot. */
export interface Marker { kind: string; date: string; items: EventItem[]; cx: number; cy: number; future: boolean }

/** A rating reiteration is not an event; it would bury the chart in dots. */
export const isEvent = (e: EventItem) => !(e.kind === 'analyst' && e.meta.action === 'maintain');

/** Pure chart geometry: calendar-day x scale (so future events have room), close-price y scale, seen through `viewport`. */
export function layout(points: PriceBar[], items: EventItem[], viewport: Viewport = FULL_VIEWPORT) {
  if (!points.length) return null;
  const first = points[0]!.t, last = points.at(-1)!.t;
  const shown = items.filter((e) => e.date >= first && isEvent(e));
  const end = shown.reduce((m, e) => (e.date > m ? e.date : m), last);
  const { min: d0, max: d1 } = applyXViewport(isoDay(first), Math.max(isoDay(first) + 1, isoDay(end)), viewport);
  const x = (day: number) => L + ((day - d0) / (d1 - d0 || 1)) * (PLOT_W - L);
  let lo = Infinity, hi = -Infinity;
  for (const p of points) { lo = Math.min(lo, p.c); hi = Math.max(hi, p.c); }
  const pad = (hi - lo) * 0.08 || hi * 0.05 || 1;
  ({ lo, hi } = applyYViewport(lo - pad, hi + pad, viewport));
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const groups = new Map<string, EventItem[]>();
  for (const e of shown) { const k = `${e.date}|${e.kind}`; const g = groups.get(k); if (g) g.push(e); else groups.set(k, [e]); }
  const used = new Map<string, number>();
  const markers: Marker[] = [...groups.values()].map((list) => {
    const { date: d, kind } = list[0]!;
    const n = used.get(d) ?? 0;
    used.set(d, n + 1);
    return { kind, date: d, items: list, cx: x(isoDay(d)), cy: y(closeAt(points, d)) - 12 - n * 12, future: d > last };
  });
  return {
    path: linePath(points.map((p) => [x(isoDay(p.t)), y(p.c)])),
    markers,
    yTicks: [0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * (i + 0.5)) / 4; return { v, y: Math.round(y(v) * 10) / 10 }; }),
    xTicks: monthTicks(d0, d1).map((t) => ({ label: t.label, x: Math.round(x(t.day) * 10) / 10 })),
  };
}

/** One row per event kind: marker glyph, plural for grouped tooltips, legend entry. Unknown kinds render as a plain dot. */
const KINDS: Record<string, { glyph: string; plural: string; legend: string }> = {
  earnings: { glyph: 'E', plural: 'earnings reports', legend: 'earnings' },
  dividend: { glyph: 'D', plural: 'dividends', legend: 'dividend' },
  split: { glyph: 'S', plural: 'splits', legend: 'split' },
  analyst: { glyph: 'A', plural: 'analyst actions', legend: 'analyst rating change' },
};
const LEGEND = Object.values(KINDS).map((k) => `${k.glyph} ${k.legend}`).join(' · ');

function tipFor(e: EventItem): string {
  switch (e.kind) {
    case 'earnings': {
      const m = e.meta;
      const surprise = m.epsActual != null && m.epsEst ? (m.epsActual - m.epsEst) / Math.abs(m.epsEst) : null;
      return tip({ Earnings: date(e.date), Time: m.time ? m.time.toUpperCase() : null, 'EPS est.': m.epsEst == null ? null : num(m.epsEst),
        'EPS actual': m.epsActual == null ? null : num(m.epsActual), Surprise: surprise == null ? null : pct(surprise) });
    }
    case 'dividend':
      return tip({ Dividend: amount(e.meta.amount), 'Ex-date': date(e.date), 'Pay date': e.meta.payDate ? date(e.meta.payDate) : null });
    case 'split':
      return tip({ Split: `${e.meta.numerator}-for-${e.meta.denominator}`, Date: date(e.date) });
    case 'analyst':
      return tip({ [e.meta.firm || 'Analyst']: `${e.meta.action}${e.meta.from || e.meta.to ? ` ${e.meta.from ?? '?'} → ${e.meta.to ?? '?'}` : ''}`, Date: date(e.date) });
    default:
      return tip({ Event: String((e as { kind: string }).kind), Date: date((e as { date: string }).date) });
  }
}
/** Tooltip for a marker: the event itself, or a count with the first few entries. */
function tipForGroup(m: Marker): string {
  if (m.items.length === 1) return tipFor(m.items[0]!);
  const o: Record<string, string> = { [`${m.items.length} ${KINDS[m.kind]?.plural ?? 'events'}`]: date(m.date) };
  for (const e of m.items.slice(0, 5)) {
    const label = e.kind === 'analyst' ? e.meta.firm : e.kind;
    const value = e.kind === 'analyst' ? `${e.meta.action}${e.meta.to ? ` → ${e.meta.to}` : ''}` : date(e.date);
    let k = label;
    for (let i = 2; k in o; i++) k = `${label} (${i})`;
    o[k] = value;
  }
  if (m.items.length > 5) o['More'] = `+${m.items.length - 5}`;
  return tip(o);
}

@Component({
  selector: 'pt-price-events',
  imports: [PtChart, PtToggles, PtYAxis, PtTimeAxis],
  template: `
    @let s = series.value();
    @if (s !== undefined && !g()) {<p class="pt-na">Data not available</p>}
    @else if (g(); as g) {
      <figure class="pt-chart" [class.pt-busy]="series.loading() || events.loading()">
        <div ptToggles [value]="picked()" [options]="RANGE_TOGGLES" aria-label="Range" (choose)="pick($event)"></div>
        <div ptChart [w]="W" [h]="H" [plotW]="PLOT_W" [plotH]="PLOT_H" [id]="'pe' + ticker()" [label]="ticker() + ' price, ' + shown()" [(view)]="view">
          <svg:g ptAxes>
            <svg:g ptYAxis [w]="W" [plotW]="PLOT_W" [ticks]="g.yTicks"></svg:g>
            <svg:g ptTimeAxis [h]="H" [plotW]="PLOT_W" [ticks]="g.xTicks"></svg:g>
          </svg:g>
          <svg:g ptPlot>
            <path class="pt-line" [attr.d]="g.path" />
            @for (m of g.markers; track m.date + '|' + m.kind) {
              <g [attr.class]="markerClass(m)" tabindex="0" [attr.data-tip]="tipForGroup(m)">
                <circle [attr.cx]="m.cx.toFixed(1)" [attr.cy]="m.cy.toFixed(1)" r="6" />
                <text [attr.x]="m.cx.toFixed(1)" [attr.y]="(m.cy + 3).toFixed(1)" text-anchor="middle">{{ KINDS[m.kind]?.glyph ?? '•' }}</text>
              </g>
            }
          </svg:g>
        </div>
        <p class="pt-lede">{{ caption() }}</p>
      </figure>
    }`,
})
export class PtPriceEvents {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly range = input<RangeValue>('1y');

  /** The reader's choice (the toggle); the captions follow the data on screen (`series.params()`). */
  protected readonly picked = linkedSignal(() => this.range());
  protected readonly series = this.pt.priceSeries(() => ({ tickers: [this.ticker()], range: this.picked(), interval: '1d', rebase: false }));
  protected readonly events = this.pt.events(() => ({ scope: { by: 'ticker', ticker: this.ticker(), range: this.picked(), ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] }));
  protected readonly shown = computed(() => (this.series.params() as { range?: RangeValue } | undefined)?.range ?? this.picked());
  /** New data on screen: back to the full view. */
  protected readonly view = linkedSignal<unknown, Viewport>({ source: () => this.series.params(), computation: () => FULL_VIEWPORT });

  protected readonly W = W; protected readonly H = H; protected readonly PLOT_W = PLOT_W; protected readonly PLOT_H = PLOT_H;
  protected readonly KINDS = KINDS;
  protected readonly RANGE_TOGGLES = RANGES.map((r) => [r, r.toUpperCase()] as const);
  protected readonly tipForGroup = tipForGroup;
  protected markerClass = (m: Marker) => `pt-mk pt-mk-${KINDS[m.kind] ? m.kind : 'other'}${m.future ? ' pt-mk-future' : ''}`;

  protected pick(r: RangeValue) { this.picked.set(r); this.series.retry(); this.events.retry(); }

  private readonly points = computed(() => this.series.value()?.[0]?.points ?? []);
  protected readonly g = computed(() => layout(this.points(), this.events.value()?.items ?? [], this.view()));
  protected readonly caption = computed(() => {
    const p = this.points();
    if (!p.length) return '';
    return `Last close ${money(p.at(-1)!.c)} · ${pct(p.at(-1)!.c / p[0]!.c - 1)} over ${this.shown()} · ${LEGEND}${this.events.value() ? '' : ' · Events not available'}`;
  });
}

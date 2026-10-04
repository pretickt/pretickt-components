import * as z from 'zod/mini';
import {
  applyXViewport, applyYViewport, closeAt, defineComponent, FULL_VIEWPORT, isoDay, linePath, monthTicks, ViewportParam, type DataFor, type Helpers, type Viewport,
} from '../src/sdk';
import { Range, Ticker, type EventItem, type Events, type PriceBar, type PriceSeries } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-price-events',
  version: '1.2.0',
  need: {
    question: 'What happened to this stock, and when — earnings, dividends, splits, analyst moves on the price line?',
    evidence: [
      'Romeo: "grafico di prezzo base su cui si può aggiungere un pallino con un\'icona" (2026-10-03)',
      'TradingView marks earnings/dividends/splits on its symbol chart; beta event map and SL/TP charts use the same markers',
    ],
  },
  params: z.object({ ticker: Ticker, range: z._default(Range, '1y'), view: z.optional(ViewportParam) }),
  user: [],
  uses: [],
  needs: (p) => ({
    series: { t: 'price-series@1', params: { tickers: [p.ticker], range: p.range, interval: '1d', rebase: false } },
    events: { t: 'events@1', params: { scope: { by: 'ticker', ticker: p.ticker, range: p.range, ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] } },
  }),
});

export const samples = [{ ticker: 'NVDA', range: '1y' }, { ticker: 'BRK.B', range: '1m' }, { ticker: 'AAPL', range: '5y' }];

const RANGES = Range.options.map((r) => [r, r.toUpperCase()] as const);
// Price labels sit in the right-hand strip you can grab to stretch the scale (beta / TradingView layout).
const W = 720, H = 260, L = 6, R = 46, T = 12, B = 24;
const PLOT_W = W - R, PLOT_H = H - B;
/** One row per event kind: marker glyph, plural for grouped tooltips, legend entry. Unknown kinds render as a plain dot. */
const KINDS: Record<string, { glyph: string; plural: string; legend: string }> = {
  earnings: { glyph: 'E', plural: 'earnings reports', legend: 'earnings' },
  dividend: { glyph: 'D', plural: 'dividends', legend: 'dividend' },
  split: { glyph: 'S', plural: 'splits', legend: 'split' },
  analyst: { glyph: 'A', plural: 'analyst actions', legend: 'analyst rating change' },
};

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
    const { date, kind } = list[0]!;
    const n = used.get(date) ?? 0;
    used.set(date, n + 1);
    return { kind, date, items: list, cx: x(isoDay(date)), cy: y(closeAt(points, date)) - 12 - n * 12, future: date > last };
  });
  return {
    path: linePath(points.map((p) => [x(isoDay(p.t)), y(p.c)])),
    markers,
    yTicks: [0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * (i + 0.5)) / 4; return { v, y: Math.round(y(v) * 10) / 10 }; }),
    xTicks: monthTicks(d0, d1).map((t) => ({ label: t.label, x: Math.round(x(t.day) * 10) / 10 })),
  };
}

function tipFor(e: EventItem, h: Helpers): string {
  switch (e.kind) {
    case 'earnings': {
      const m = e.meta;
      const surprise = m.epsActual != null && m.epsEst ? (m.epsActual - m.epsEst) / Math.abs(m.epsEst) : null;
      return h.tip({ Earnings: h.date(e.date), Time: m.time ? m.time.toUpperCase() : null, 'EPS est.': m.epsEst == null ? null : h.num(m.epsEst),
        'EPS actual': m.epsActual == null ? null : h.num(m.epsActual), Surprise: surprise == null ? null : h.pct(surprise) });
    }
    case 'dividend':
      return h.tip({ Dividend: h.amount(e.meta.amount), 'Ex-date': h.date(e.date), 'Pay date': e.meta.payDate ? h.date(e.meta.payDate) : null });
    case 'split':
      return h.tip({ Split: `${e.meta.numerator}-for-${e.meta.denominator}`, Date: h.date(e.date) });
    case 'analyst':
      return h.tip({ [e.meta.firm || 'Analyst']: `${e.meta.action}${e.meta.from || e.meta.to ? ` ${e.meta.from ?? '?'} → ${e.meta.to ?? '?'}` : ''}`, Date: h.date(e.date) });
    default:
      return h.tip({ Event: String((e as { kind: string }).kind), Date: h.date((e as { date: string }).date) });
  }
}

/** Tooltip for a marker: the event itself, or a count with the first few entries. */
function tipForGroup(m: Marker, h: Helpers): string {
  if (m.items.length === 1) return tipFor(m.items[0]!, h);
  const o: Record<string, string> = { [`${m.items.length} ${KINDS[m.kind]?.plural ?? 'events'}`]: h.date(m.date) };
  for (const e of m.items.slice(0, 5)) {
    const label = e.kind === 'analyst' ? e.meta.firm : e.kind;
    const value = e.kind === 'analyst' ? `${e.meta.action}${e.meta.to ? ` → ${e.meta.to}` : ''}` : h.date(e.date);
    let k = label;
    for (let i = 2; k in o; i++) k = `${label} (${i})`;
    o[k] = value;
  }
  if (m.items.length > 5) o.More = `+${m.items.length - 5}`;
  return h.tip(o);
}

type Data = DataFor<{ series: PriceSeries; events: Events }>;

const LEGEND = Object.values(KINDS).map((k) => `${k.glyph} ${k.legend}`).join(' · ');

export function renderStatic(data: Data, params: z.output<typeof manifest.params>, h: Helpers): string {
  const points = data.series?.[0]?.points ?? [];
  const g = layout(points, data.events?.items ?? [], params.view);
  if (!g) return h.na();
  const firstC = points[0]!.c, lastC = points.at(-1)!.c;
  const fr = { w: W, h: H, plotW: PLOT_W, plotH: PLOT_H, id: `pe${params.ticker}`, label: `${params.ticker} price, ${params.range}`, view: params.view };
  const marks = g.markers.map((m) => {
    const k = KINDS[m.kind];
    return `<g class="pt-mk pt-mk-${k ? m.kind : 'other'}${m.future ? ' pt-mk-future' : ''}" tabindex="0" ${tipForGroup(m, h)}>` +
      `<circle cx="${m.cx.toFixed(1)}" cy="${m.cy.toFixed(1)}" r="6"/><text x="${m.cx.toFixed(1)}" y="${(m.cy + 3).toFixed(1)}" text-anchor="middle">${k?.glyph ?? '•'}</text></g>`;
  }).join('');
  const caption = `<p class="pt-lede">Last close ${h.money(lastC)} · ${h.pct(lastC / firstC - 1)} over ${h.esc(params.range)} · ${LEGEND}` +
    `${data.events ? '' : ' · Events not available'}</p>`;
  return `<figure class="pt-chart">${h.toggles('range', RANGES, params.range, 'Range')}` +
    h.chartFrame(fr, { axes: h.yAxis(fr, g.yTicks) + h.timeAxis(fr, g.xTicks), plot: `<path class="pt-line" d="${g.path}"/>${marks}` }) +
    `${caption}</figure>`;
}

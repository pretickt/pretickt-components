import * as z from 'zod/mini';
import { applyXViewport, applyYViewport, defineComponent, FULL_VIEWPORT, ViewportParam, type DataFor, type Helpers, type Viewport } from '../src/sdk';
import { Range, Ticker, type EventItem, type Events, type PriceSeries } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-price-events',
  version: '1.1.0',
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

const RANGES = ['1m', '3m', '6m', '1y', '2y', '5y'] as const;
// Price labels sit in the right-hand strip you can grab to stretch the scale (beta / TradingView layout).
const W = 720, H = 260, L = 6, R = 46, T = 12, B = 24;
const PLOT_W = W - R, PLOT_H = H - B;
const GLYPH: Record<string, string> = { earnings: 'E', dividend: 'D', split: 'S', analyst: 'A' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

type Bar = PriceSeries[number]['points'][number];
/** One marker per day and kind: busy days (a dozen analyst notes after earnings) collapse into one dot. */
export interface Marker { kind: string; date: string; items: EventItem[]; cx: number; cy: number; future: boolean }

/** A rating reiteration is not an event; it would bury the chart in dots. */
const isEvent = (e: EventItem) => !(e.kind === 'analyst' && e.meta.action === 'maintain');

/** Pure chart geometry: calendar-day x scale (so future events have room), close-price y scale, seen through `viewport`. */
export function layout(points: Bar[], items: EventItem[], viewport: Viewport = FULL_VIEWPORT) {
  if (!points.length) return null;
  const first = points[0]!.t;
  const last = points.at(-1)!.t;
  const shown = items.filter((e) => e.date >= first && isEvent(e));
  const end = shown.reduce((m, e) => (e.date > m ? e.date : m), last);
  const { min: d0, max: d1 } = applyXViewport(day(first), Math.max(day(first) + 1, day(end)), viewport);
  const x = (iso: string) => L + ((day(iso) - d0) / (d1 - d0 || 1)) * (PLOT_W - L);
  let lo = Infinity, hi = -Infinity;
  for (const p of points) { lo = Math.min(lo, p.c); hi = Math.max(hi, p.c); }
  const pad = (hi - lo) * 0.08 || hi * 0.05 || 1;
  ({ lo, hi } = applyYViewport(lo - pad, hi + pad, viewport));
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.c).toFixed(1)}`).join('');
  const closeAt = (iso: string) => {
    let c = points[0]!.c;
    for (const p of points) { if (p.t > iso) break; c = p.c; }
    return c;
  };
  const groups = new Map<string, EventItem[]>();
  for (const e of shown) groups.set(`${e.date}|${e.kind}`, [...(groups.get(`${e.date}|${e.kind}`) ?? []), e]);
  const used = new Map<string, number>();
  const markers: Marker[] = [...groups.values()].map((list) => {
    const { date, kind } = list[0]!;
    const n = used.get(date) ?? 0;
    used.set(date, n + 1);
    return { kind, date, items: list, cx: x(date), cy: y(closeAt(date)) - 12 - n * 12, future: date > last };
  });
  const yTicks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * (i + 0.5)) / 4);
  // month ticks over the visible window only
  const visible = points.filter((p) => day(p.t) >= d0 && day(p.t) <= d1);
  const months: string[] = [];
  for (const p of visible.length ? visible : points) { const m = p.t.slice(0, 7); if (months.at(-1) !== m) months.push(m); }
  const step = Math.ceil(months.length / 6);
  const from = (visible[0] ?? points[0]!).t;
  const xTicks = months.filter((_, i) => i % step === 0).map((m) => ({ iso: `${m}-01` < from ? from : `${m}-01`, label: m }));
  return { path, markers, yTicks: yTicks.map((v) => ({ v, y: y(v) })), xTicks: xTicks.map((t) => ({ ...t, x: x(t.iso) })), first, last };
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
      return h.tip({ Dividend: h.money(e.meta.amount, 4).replace(/0+$/, '').replace(/\.$/, ''), 'Ex-date': h.date(e.date), 'Pay date': e.meta.payDate ? h.date(e.meta.payDate) : null });
    case 'split':
      return h.tip({ Split: `${e.meta.numerator}-for-${e.meta.denominator}`, Date: h.date(e.date) });
    case 'analyst':
      return h.tip({ [e.meta.firm || 'Analyst']: `${e.meta.action}${e.meta.from || e.meta.to ? ` ${e.meta.from ?? '?'} → ${e.meta.to ?? '?'}` : ''}`, Date: h.date(e.date) });
    default:
      return h.tip({ Event: String((e as { kind: string }).kind), Date: h.date((e as { date: string }).date) });
  }
}

const PLURAL: Record<string, string> = { earnings: 'earnings reports', dividend: 'dividends', split: 'splits', analyst: 'analyst actions' };

/** Tooltip for a marker: the event itself, or a count with the first few entries. */
function tipForGroup(m: Marker, h: Helpers): string {
  if (m.items.length === 1) return tipFor(m.items[0]!, h);
  const o: Record<string, string> = { [`${m.items.length} ${PLURAL[m.kind] ?? 'events'}`]: h.date(m.date) };
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

export function renderStatic(data: Data, params: { ticker: string; range: string; view?: Viewport }, h: Helpers): string {
  const points = data.series?.[0]?.points ?? [];
  const g = layout(points, data.events?.items ?? [], params.view);
  if (!g) return h.na();
  const firstC = points[0]!.c, lastC = points.at(-1)!.c;
  const toggles = `<div class="pt-toggles" role="group" aria-label="Range">${RANGES.map((r) =>
    `<button type="button" data-set='{"range":"${r}"}' aria-pressed="${r === params.range}">${r.toUpperCase()}</button>`).join('')}</div>`;
  const grid = g.yTicks.map((t) => `<line class="pt-grid" x1="0" x2="${PLOT_W}" y1="${t.y.toFixed(1)}" y2="${t.y.toFixed(1)}"/>` +
    `<text class="pt-axis" x="${W - 4}" y="${(t.y + 3).toFixed(1)}" text-anchor="end">${h.esc(h.num(t.v, t.v >= 100 ? 0 : 2))}</text>`).join('');
  const clip = `pe${params.ticker.replace(/[^A-Za-z0-9]/g, '-')}`;
  const xAxis = g.xTicks.map((t) => `<text class="pt-axis" x="${t.x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${monthLabel(t.label)}</text>`).join('');
  const marks = g.markers.map((m) => {
    const kind = GLYPH[m.kind] ? m.kind : 'other';
    return `<g class="pt-mk pt-mk-${kind}${m.future ? ' pt-mk-future' : ''}" tabindex="0" ${tipForGroup(m, h)}>` +
      `<circle cx="${m.cx.toFixed(1)}" cy="${m.cy.toFixed(1)}" r="6"/>` +
      `<text x="${m.cx.toFixed(1)}" y="${(m.cy + 3).toFixed(1)}" text-anchor="middle" fill="white" font-size="8">${GLYPH[m.kind] ?? '•'}</text></g>`;
  }).join('');
  const caption = `<p class="pt-lede">Last close ${h.money(lastC)} · ${h.pct(lastC / firstC - 1)} over ${h.esc(params.range)} · ` +
    `E earnings · D dividend · S split · A analyst rating change${data.events ? '' : ' · Events not available'}</p>`;
  return `<figure class="pt-chart">${toggles}<div class="pt-wrap"><svg class="pt-chart-svg" viewBox="0 0 ${W} ${H}" role="img" ` +
    `aria-label="${h.esc(params.ticker)} price, ${h.esc(params.range)}" ${h.zoomable(W, H, PLOT_W, PLOT_H)}>` +
    `<defs><clipPath id="${clip}"><rect x="0" y="0" width="${PLOT_W}" height="${PLOT_H}"/></clipPath></defs>${h.zoomStrips(W, H, PLOT_W, PLOT_H)}` +
    `${grid}<g clip-path="url(#${clip})"><path class="pt-line" d="${g.path}"/>${marks}</g>${xAxis}</svg>${h.viewControls(params.view)}</div>${caption}</figure>`;
}

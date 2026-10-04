import { ICONS } from './icons';
import { isAtLatest, isFullViewport, isYFitted, type Viewport } from './viewport';

export type Tone = 'pos' | 'neg' | 'flat' | 'na';

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ENT[c]!);
}

export function num(v: number | null | undefined, digits = 2): string {
  if (!finite(v)) return '—';
  const s = Math.abs(v).toFixed(digits);
  const [i, d] = s.split('.');
  const neg = v < 0 && Number(s) !== 0;
  return (neg ? '-' : '') + group(i!) + (d ? `.${d}` : '');
}

/** `v` is a fraction: 0.123 → "+12.3%". */
export function pct(v: number | null | undefined, digits = 1): string {
  if (!finite(v)) return '—';
  const s = num(v * 100, digits);
  return (v > 0 && Number(s.replace(/,/g, '')) !== 0 ? '+' : '') + s + '%';
}

export function money(v: number | null | undefined, digits = 2): string {
  if (!finite(v)) return '—';
  const s = num(Math.abs(v), digits);
  return (v < 0 && Number(s.replace(/,/g, '')) !== 0 ? '-' : '') + '$' + s; // no "-$0.00"
}

const UNITS: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'], [1, '']];
export function compact(v: number | null | undefined): string {
  if (!finite(v)) return '—';
  const a = Math.abs(v);
  let i = UNITS.findIndex(([d]) => a >= d);
  if (i < 0) i = UNITS.length - 1;
  const digitsAt = (j: number) => (UNITS[j]![1] === '' || a / UNITS[j]![0] >= 100 ? 0 : 2);
  // rounding can carry into the next unit: 999,999 is "1M", not "1,000K"
  if (i > 0 && Number((a / UNITS[i]![0]).toFixed(digitsAt(i))) >= 1000) i--;
  const [div, suf] = UNITS[i]!;
  const digits = digitsAt(i);
  const s = num(v / div, digits);
  return (digits ? s.replace(/\.?0+$/, '') : s) + suf;
}

export function date(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return esc(iso); // never "Jan NaN, 2026"; whatever it is, it reaches HTML escaped
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

export function toneOf(v: number | null | undefined, flatBand = 0): Tone {
  if (!finite(v)) return 'na';
  if (Math.abs(v) <= flatBand) return 'flat';
  return v > 0 ? 'pos' : 'neg';
}

/** A safe href: absolute http(s) or a site path ("/…", not "//host"); any other scheme (javascript:, data:, …) becomes "#". */
export function href(url: string | null | undefined): string {
  const u = String(url ?? '').trim();
  return /^(https?:\/\/|\/(?!\/))[^\s"'<>]*$/i.test(u) ? esc(u) : '#';
}

export function na(label = 'Data not available'): string {
  return `<p class="pt-na">${esc(label)}</p>`;
}

/** `data-tip` attribute carrying a JSON object; the base element turns it into a tooltip. */
export function tip(o: Record<string, string | number | null>): string {
  return `data-tip="${esc(JSON.stringify(o))}"`;
}

export function icon(name: string | null | undefined): string {
  return (name && Object.hasOwn(ICONS, name) && ICONS[name]) || ''; // not 'constructor' & co. from the prototype
}

/** A badge: the shape of a metric@1 item. Any component can build one from any data and draw it with `badge`. */
export interface Badge {
  key: string;
  label: string;
  value: number | null;
  /** Categorical value shown instead of the number. */
  text: string | null;
  /** x = multiple, % = fraction shown as percent, $ = price, $c = compact dollars, d = days, '' = plain number. */
  unit: 'x' | '%' | '$' | '$c' | 'd' | '';
  delta: number | null;
  tone: Tone;
  range: { lo: number; hi: number; marks: { label: string; value: number }[] } | null;
  icon: string | null;
  hint: string;
  asOf: string;
  /** Rendered as coloured dots instead of the value (e.g. one per news story, by sentiment). */
  dots?: ('pos' | 'neg')[] | null;
}

export function badgeValue(b: Pick<Badge, 'text' | 'value' | 'unit'>): string {
  if (b.text) return b.text;
  if (b.value == null || !Number.isFinite(b.value)) return '—';
  switch (b.unit) {
    case 'x': return `${num(b.value, 1)}x`;
    case '%': return pct(b.value);
    case '$': return money(b.value);
    case '$c': return (b.value < 0 ? '-$' : '$') + compact(Math.abs(b.value));
    case 'd': return `${num(b.value, 0)}d`;
    default: return num(b.value);
  }
}

function rangeBar(b: Badge): string {
  if (!b.range || b.value == null || b.range.hi <= b.range.lo) return '';
  const pos = Math.min(100, Math.max(0, ((b.value - b.range.lo) / (b.range.hi - b.range.lo)) * 100));
  return `<span class="pt-range" aria-hidden="true"><span class="pt-range-dot" style="left:${pos.toFixed(1)}%"></span></span>`;
}

/** One badge as an `<li>` for a `<ul class="pt-badges">`. Every string from data is escaped. */
export function badge(b: Badge): string {
  const t: Record<string, string> = { [b.label]: b.hint, 'As of': date(b.asOf) };
  if (b.range) { t.Low = money(b.range.lo); t.High = money(b.range.hi); }
  const body = b.dots && b.dots.length
    ? `<span class="pt-dots" aria-label="${esc(`${b.dots.length} items`)}">${b.dots.map((d) => `<span class="pt-dot-${d === 'pos' ? 'pos' : 'neg'}"></span>`).join('')}</span>`
    : `<span class="pt-badge-v">${esc(badgeValue(b))}</span>`;
  return `<li class="pt-badge pt-tone-${esc(b.tone)}" tabindex="0" ${tip(t)}>${icon(b.icon)}<span class="pt-badge-k">${esc(b.label)}</span>${body}${rangeBar(b)}</li>`;
}

/**
 * Zoom & pan (ported from beta's ZoomPan + ChartControls). Put `zoomable(...)` on the chart's <svg>, draw
 * `zoomStrips(...)` inside it and `viewControls(params.view)` after it; read `params.view` (declare
 * `view: z.optional(ViewportParam)`) in the geometry with applyXViewport/applyYViewport. The base element does the rest:
 * wheel/drag on the plot = time, on the right strip = price scale, on the bottom strip = time around the grab point,
 * double-click = reset.
 */
export function zoomable(w: number, h: number, plotW: number, plotH: number): string {
  return `data-zoom="${esc(JSON.stringify({ px: plotW / w, ty: plotH / h }))}"`;
}

/** The two axis strips you can grab, with their ⇕ / ⇔ hints (lit while hovered: .pt-over-axis / .pt-over-taxis). */
export function zoomStrips(w: number, h: number, plotW: number, plotH: number): string {
  return `<rect class="pt-taxis" x="0" y="${plotH}" width="${plotW}" height="${h - plotH}"/>` +
    `<line class="pt-taxis-edge" x1="0" x2="${plotW}" y1="${plotH}" y2="${plotH}"/>` +
    `<text class="pt-taxis-hint" x="14" y="${h - 6}">⇔</text>` +
    `<rect class="pt-axis-strip" x="${plotW}" y="0" width="${w - plotW}" height="${h}"/>` +
    `<line class="pt-axis-edge" x1="${plotW}" x2="${plotW}" y1="0" y2="${h}"/>` +
    `<text class="pt-axis-hint" x="${(plotW + w) / 2}" y="${h - 6}" text-anchor="middle">⇕</text>`;
}

/** fit / today » / reset view — each only when it has something to undo (nothing at the full view). */
export function viewControls(view: Viewport | null | undefined): string {
  if (!view || isFullViewport(view)) return '';
  const b = (k: string, label: string, title: string, wide = false) =>
    `<button type="button" class="pt-abtn${wide ? ' pt-abtn-wide' : ''}" data-view="${k}" title="${title}">${label}</button>`;
  return `<div class="pt-vctl">` +
    (isYFitted(view) ? '' : b('fit', 'fit', 'Fit the price scale to what is in view — the time window stays where it is')) +
    (isAtLatest(view) ? '' : b('latest', 'today »', 'Back to the latest data, keeping the current zoom')) +
    b('reset', 'reset view', 'Back to the full view (or double-click the chart)', true) + `</div>`;
}

export const helpers = { esc, num, pct, money, compact, date, toneOf, href, na, tip, icon, badge, badgeValue, zoomable, zoomStrips, viewControls };
export type Helpers = typeof helpers;

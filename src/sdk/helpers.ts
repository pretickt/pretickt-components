import { ICONS } from './icons';

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
  return (v < 0 ? '-' : '') + '$' + num(Math.abs(v), digits);
}

export function compact(v: number | null | undefined): string {
  if (!finite(v)) return '—';
  const a = Math.abs(v);
  const [div, suf] = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];
  const n = v / div;
  const digits = suf === '' ? 0 : Math.abs(n) >= 100 ? 0 : 2;
  const s = num(n, digits);
  return (digits ? s.replace(/\.?0+$/, '') : s) + suf;
}

export function date(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

export function toneOf(v: number | null | undefined, flatBand = 0): Tone {
  if (!finite(v)) return 'na';
  if (Math.abs(v) <= flatBand) return 'flat';
  return v > 0 ? 'pos' : 'neg';
}

export function na(label = 'Data not available'): string {
  return `<p class="pt-na">${esc(label)}</p>`;
}

/** `data-tip` attribute carrying a JSON object; the base element turns it into a tooltip. */
export function tip(o: Record<string, string | number | null>): string {
  return `data-tip="${esc(JSON.stringify(o))}"`;
}

export function icon(name: string | null | undefined): string {
  return (name && ICONS[name]) || '';
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

export const helpers = { esc, num, pct, money, compact, date, toneOf, na, tip, icon, badge, badgeValue };
export type Helpers = typeof helpers;

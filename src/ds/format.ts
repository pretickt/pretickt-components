/**
 * How numbers, dates and links look on pretickt — part of the design system, the same in every component. Deterministic (no Intl,
 * no clock): the build and the browser produce the same text, so hydration never mismatches. Nothing here escapes: Vue escapes
 * what a template prints (text and attributes).
 */
import type { MetricItem, TONES } from '../typologies';

export type Tone = (typeof TONES)[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** A formatted magnitude that rounds to zero carries no sign: never "-$0.00" or "+0.0%". */
const isZero = (formatted: string) => Number(formatted.replace(/,/g, '')) === 0;

export function num(v: number | null | undefined, digits = 2): string {
  if (!finite(v)) return '—';
  const s = Math.abs(v).toFixed(digits);
  const [i, d] = s.split('.');
  const neg = v < 0 && !isZero(s);
  return (neg ? '-' : '') + group(i!) + (d ? `.${d}` : '');
}

/** `v` is a fraction: 0.123 → "+12.3%". */
export function pct(v: number | null | undefined, digits = 1): string {
  if (!finite(v)) return '—';
  const s = num(v * 100, digits);
  return (v > 0 && !isZero(s) ? '+' : '') + s + '%';
}

/** `v` is a fraction shown as a level, without a plus sign: 0.123 → "12.3%" (margins, yields, shares). */
export function level(v: number | null | undefined, digits = 1): string {
  return finite(v) ? `${num(v * 100, digits)}%` : '—';
}

/** Dollars: `compact` → "$1.05B", `signed` → "+$200M"; never "-$0". */
export function usd(v: number | null | undefined, o: { compact?: boolean; signed?: boolean; digits?: number } = {}): string {
  if (!finite(v)) return '—';
  const s = o.compact ? compact(Math.abs(v)) : num(Math.abs(v), o.digits ?? 2);
  const sign = isZero(s.replace(/[A-Z]$/, '')) ? '' : v < 0 ? '-' : o.signed && v > 0 ? '+' : '';
  return `${sign}$${s}`;
}

export function money(v: number | null | undefined, digits = 2): string {
  return usd(v, { digits });
}

/** A cash amount with 2 to 4 decimals, as declared (dividends): 0.2625 → "$0.2625", 0.5 → "$0.50". */
export function amount(v: number | null | undefined): string {
  return usd(v, { digits: 4 }).replace(/(\.\d\d\d*?)0+$/, '$1');
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

/** "2026-03" (or a full date) → "Mar 26": the label of a month on a time axis. */
export function month(ym: string): string {
  return /^\d{4}-\d{2}/.test(ym) ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}` : String(ym);
}

export function date(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return String(iso ?? ''); // never "Jan NaN, 2026"
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

export function tone(v: number | null | undefined, flatBand = 0): Tone {
  if (!finite(v)) return 'na';
  if (Math.abs(v) <= flatBand) return 'flat';
  return v > 0 ? 'pos' : 'neg';
}

/** A safe href: absolute http(s) or a site path ("/…", not "//host"); any other scheme (javascript:, data:, …) becomes "#". */
export function href(url: string | null | undefined): string {
  const u = String(url ?? '').trim();
  return /^(https?:\/\/|\/(?!\/))[^\s"'<>]*$/i.test(u) ? u : '#';
}

/** The site path of a company's page. */
export function stockHref(ticker: string): string {
  return href(`/stocks/${String(ticker).toLowerCase()}/`);
}

/** The JSON a `data-tip` attribute carries; the island runtime shows it as a tooltip (label → value rows). */
export function tip(o: Record<string, string | number | null>): string {
  return JSON.stringify(o);
}

/** A badge is a metric@1 item (fields documented on `MetricItem`): build one from any data and draw it with PtBadge. */
export type Badge = MetricItem;

/** The text of a badge's value, by unit. */
export function badgeValue(b: Pick<Badge, 'text' | 'value' | 'unit'>): string {
  if (b.text) return b.text;
  if (b.value == null || !Number.isFinite(b.value)) return '—';
  switch (b.unit) {
    case 'x': return `${num(b.value, 1)}x`;
    case '%': return pct(b.value);
    case '$': return money(b.value);
    case '$c': return usd(b.value, { compact: true });
    case 'd': return `${num(b.value, 0)}d`;
    default: return num(b.value);
  }
}

/** An id usable in SVG (`url(#…)`): letters, digits and dashes only. */
export const svgId = (s: string): string => s.replace(/[^A-Za-z0-9-]/g, '-');

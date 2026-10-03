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

export const helpers = { esc, num, pct, money, compact, date, toneOf, na, tip, icon };
export type Helpers = typeof helpers;

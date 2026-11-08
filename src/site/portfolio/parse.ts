/**
 * A pasted portfolio read line by line (design 2026-11-07 Part B, amended 2026-11-08): one holding per line — a symbol, at most one amount (shares
 * `AAPL 10`, a percentage `AAPL 25%`, a dollar value `AAPL $5,000`, or none: equal weight) and on a portfolio an optional purchase date (ISO or a
 * broker's US date) — or a broker's CSV export, read by its header. One kind of amount per portfolio; a watchlist keeps the symbols only.
 */
export type Unit = 'shares' | 'pct' | 'usd' | 'equal';
export interface PasteRow { line: number; t: string; n: number | null; d: string | null }
export interface Parsed { rows: PasteRow[]; unit: Unit; refused: string | null; notOnSite: string[]; dropped: boolean }

type Kind = 'shares' | 'pct' | 'usd' | 'none';
interface Read { line: number; t: string; n: number | null; d: string | null; kind: Kind }

const SYMBOL = /^[A-Za-z][A-Za-z0-9./-]{0,9}$/;
/** First words of the lines a broker adds around the positions. */
const IGNORE = new Set(['cash', 'total', 'pending', 'account', 'symbol', 'ticker', 'positions']);
const AMOUNT = /^\$?\d[\d,]*(\.\d+)?%?$/;
const WHAT: Record<Kind, string> = { pct: 'a percentage', usd: 'a dollar value', none: 'no amount', shares: 'shares' };

const number = (s: string): number | null => { const v = Number(s.replace(/[$,%\s]/g, '')); return Number.isFinite(v) && v > 0 ? v : null; };
const kindOf = (s: string): Kind => (s.endsWith('%') ? 'pct' : s.startsWith('$') ? 'usd' : 'shares');
function isoDate(s: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s), us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const [y, m, d] = iso ? [iso[1]!, iso[2]!, iso[3]!] : us ? [us[3]!, us[1]!.padStart(2, '0'), us[2]!.padStart(2, '0')] : [];
  if (!y) return null;
  const t = `${y}-${m}-${d}`, at = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === t ? t : null;
}
/** A CSV line's cells, quoted cells with their commas kept. */
function cells(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const list = (n: number[]) => (n.length === 1 ? String(n[0]) : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
const lines = (n: number[], first: boolean) => `${first ? 'L' : 'l'}ine${n.length > 1 ? 's' : ''} ${list(n)}`;

/** The holdings a broker's export lists, by its header's columns. Null: no header with a symbol column. */
function fromCsv(all: string[], known: (s: string) => string | null, notOnSite: Set<string>): Read[] | null {
  for (let h = 0; h < all.length; h++) {
    const sep = all[h]!.includes('\t') ? '\t' : all[h]!.includes(';') && !all[h]!.includes(',') ? ';' : ',';
    const head = cells(all[h]!, sep).map((c) => c.toLowerCase());
    const col = (re: RegExp) => head.findIndex((c) => re.test(c));
    const sym = col(/^(symbol|ticker)$/);
    if (sym < 0) continue;
    const qty = col(/^(quantity|shares|qty)$/), val = col(/^(market value|current value|value|amount)$/), wgt = col(/^(weight|percent|%|% of account|percent of account)$/);
    const date = col(/^(date|acquired|date acquired|purchase date|trade date|open date)$/);
    const out: Read[] = [];
    all.slice(h + 1).forEach((raw, k) => {
      const c = cells(raw, sep), s = (c[sym] ?? '').trim();
      if (!SYMBOL.test(s) || IGNORE.has(s.toLowerCase())) return;
      const t = known(s);
      if (!t) { notOnSite.add(s.toUpperCase()); return; }
      const pick = ([[qty, 'shares'], [val, 'usd'], [wgt, 'pct']] as const).find(([i]) => i >= 0 && number(c[i] ?? '') != null);
      out.push({ line: h + 2 + k, t, n: pick ? number(c[pick[0]]!) : null, d: date >= 0 ? isoDate(c[date] ?? '') : null, kind: pick ? pick[1] : 'none' });
    });
    return out;
  }
  return null;
}

/** One holding a line, as typed. */
function fromLines(all: string[], known: (s: string) => string | null, notOnSite: Set<string>): Read[] {
  const out: Read[] = [];
  all.forEach((raw, k) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    // a comma after a word separates; one between digits groups thousands ($12,500)
    const norm = line.replace(/[\t;]/g, ' ').replace(/([A-Za-z])\s*,/g, '$1 ').replace(/,(?!\d{3}(?:\D|$))/g, ' ').replace(/\s+%/g, '%').replace(/\$\s+/g, '$');
    const [first, ...rest] = norm.split(/\s+/);
    if (!first || !SYMBOL.test(first) || IGNORE.has(first.toLowerCase())) return;
    const t = known(first);
    if (!t) { notOnSite.add(first.toUpperCase()); return; }
    const amount = rest.find((x) => AMOUNT.test(x) && number(x) != null);
    const d = rest.map(isoDate).find((x) => x != null) ?? null;
    out.push({ line: k + 1, t, n: amount ? number(amount) : null, d, kind: amount ? kindOf(amount) : 'none' });
  });
  return out;
}

export function parsePaste(text: string, known: (symbol: string) => string | null, today: string, kind: 'portfolio' | 'watchlist'): Parsed {
  const all = text.split(/\r?\n/), notOnSite = new Set<string>();
  const read = fromCsv(all, known, notOnSite) ?? fromLines(all, known, notOnSite);
  const names = [...notOnSite];
  if (kind === 'watchlist')
    return { rows: read.map(({ line, t }) => ({ line, t, n: null, d: null })), unit: 'equal', refused: null, notOnSite: names, dropped: read.some((r) => r.n != null || r.d != null) };
  const rows = read.map(({ line, t, n, d }) => ({ line, t, n, d }));
  const late = read.filter((r) => r.d != null && r.d > today);
  if (late.length) {
    const refused = late.length === 1 ? `Line ${late[0]!.line}: the date ${late[0]!.d} is after today.` : `${lines(late.map((r) => r.line), true)}: their dates are after today.`;
    return { rows, unit: 'equal', refused, notOnSite: names, dropped: false };
  }
  const groups = new Map<Kind, number[]>();
  for (const r of read) groups.set(r.kind, [...(groups.get(r.kind) ?? []), r.line]);
  if (groups.size > 1) {
    // the lines that differ first: the smaller group, on a tie the later lines
    const parts = [...groups].sort(([, a], [, b]) => a.length - b.length || b[0]! - a[0]!)
      .map(([k, n], i) => (i === 0 ? `${lines(n, true)} give${n.length > 1 ? '' : 's'} ${WHAT[k]}` : `${lines(n, false)} ${WHAT[k]}`));
    return { rows, unit: 'equal', refused: `${parts.join(', ')}: one kind of amount per portfolio.`, notOnSite: names, dropped: false };
  }
  const only = [...groups.keys()][0] ?? 'none';
  return { rows, unit: only === 'none' ? 'equal' : only, refused: null, notOnSite: names, dropped: false };
}

/** A portfolio as text, one line a holding: what "Copy as text" gives and a paste reads back. */
export function serialize(rows: readonly { t: string; n: number | null; d: string | null }[], unit: Unit): string {
  const amount = (n: number | null) => (n == null || unit === 'equal' ? '' : unit === 'pct' ? ` ${n}%` : unit === 'usd' ? ` $${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ` ${n}`);
  return rows.map((r) => `${r.t}${amount(r.n)}${r.d ? ` ${r.d}` : ''}`).join('\n');
}

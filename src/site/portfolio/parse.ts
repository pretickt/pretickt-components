import { plainName, withoutSuffixes } from '@pretickt/components/format';
import type { FactsFile } from '@pretickt/components/typologies';

/**
 * A pasted portfolio read whatever its format (design 2026-11-07 Part B; Romeo, 2026-11-08: «l'algoritmo per estrarre le aziende incollate deve
 * essere generico per tanti possibili formati»). No rule per broker: the text is read for what it holds. A table with a header (a broker's CSV, a
 * spreadsheet's or a web page's table: commas, tabs, semicolons, pipes) is read by its columns, found by what they hold. Anything else is read line by
 * line: symbols however written ($AAPL, NASDAQ:AAPL, BRK/B), company names (Apple, Coca-Cola), amounts in shares, dollars or percent before or
 * after them, dates in the usual forms; when a line has several numbers, the company's close tells its price from its shares; an app's cards copied
 * over several lines join their symbol. In the browser only: a reader's holdings never leave it. One kind of amount per portfolio; a watchlist keeps
 * the symbols; a symbol we do not cover is kept as a line and named; what could not be read is listed.
 */
export type Unit = 'shares' | 'pct' | 'usd' | 'equal';
export interface PasteRow { line: number; t: string; n: number | null; d: string | null }
/** `note`: how it was read when the reader should know (a file with no amount column); `ignored`: the lines that gave no holding. */
/** `mixed`: the lines gave different kinds of amount (the preview asks which they are). */
export interface Parsed { rows: PasteRow[]; unit: Unit; refused: string | null; mixed: boolean; notOnSite: string[]; dropped: boolean; note: string | null; ignored: { line: number; text: string }[] }

/** What the reading asks of the site's companies and funds. */
export interface Lookup {
  /** A symbol as typed ($AAPL, NASDAQ:MSFT, NVDA.US, brk/b) as the site writes it, or null. */
  symbol(raw: string): string | null;
  /** The longest company or fund name starting at `words[i]` (lower case, no punctuation): its symbol and how many words it took. */
  name(words: readonly string[], i: number): { t: string; n: number } | null;
  /** Tonight's close, to tell a price from an amount. */
  close(t: string): number | null;
}

const clean = (s: string) => s.toLowerCase().replace(/[.,()"'’]/g, ' ').split(/\s+/).filter(Boolean);
/** The words a company's name may carry after it, read as part of the name. */
const NAME_TAIL = new Set(['inc', 'corp', 'corporation', 'co', 'company', 'ltd', 'plc', 'holdings']);

export function lookupOf(facts: FactsFile): Lookup {
  const index = new Map<string, { words: string[]; t: string }[]>();
  const add = (name: string, t: string) => {
    for (const v of new Set([name, name.replace(/-/g, ' ')])) {
      const words = clean(v).filter((w, i) => !(i === 0 && w === 'the'));
      if (!words.length) continue;
      const list = index.get(words[0]!) ?? [];
      if (!list.some((x) => x.words.join(' ') === words.join(' '))) list.push({ words, t });
      index.set(words[0]!, list);
    }
  };
  for (const c of Object.values(facts.companies).sort((a, b) => (a.ticker < b.ticker ? -1 : 1))) { add(plainName(c.name), c.ticker); add(withoutSuffixes(c.name), c.ticker); }
  for (const [t, f] of Object.entries(facts.funds)) add(f.name, t);
  for (const list of index.values()) list.sort((a, b) => b.words.length - a.words.length);
  return {
    symbol(raw) {
      const t = raw.trim().replace(/^\$/, '').replace(/^[A-Za-z]{2,8}:(?=[A-Za-z])/, '').replace(/[.:](US)$/i, '').replace(/[/-]/g, '.').toUpperCase();
      return facts.companies[t] || facts.funds[t] ? t : null;
    },
    name(words, i) {
      const at = words[i] === 'the' ? i + 1 : i;
      for (const c of index.get(words[at] ?? '') ?? []) {
        if (!c.words.every((w, k) => words[at + k] === w)) continue;
        let n = at - i + c.words.length;
        // "Apple Inc", "NVIDIA Corp", "Berkshire Hathaway Inc Cl B"
        while (NAME_TAIL.has(words[i + n] ?? '')) n++;
        if (/^(cl|class)$/.test(words[i + n] ?? '') && /^[a-z]$/.test(words[i + n + 1] ?? '')) n += 2;
        return { t: c.t, n };
      }
      return null;
    },
    close: (t) => facts.companies[t]?.close ?? facts.funds[t]?.close ?? null,
  };
}

type Kind = 'shares' | 'pct' | 'usd' | 'none';
interface Amount { kind: 'shares' | 'usd' | 'pct' | 'bare'; v: number }
interface Holding { line: number; t: string; known: boolean; amounts: Amount[]; d: string | null }

const WHAT: Readonly<{ [k in Kind]: string }> = { pct: 'a percentage', usd: 'a dollar value', none: 'no amount', shares: 'shares' };
const NO_AMOUNT = 'This file has no column of shares, values or percentages: each line weighs the same.';
/** A broker's words around the positions: never a symbol. */
const NOT_SYMBOL = new Set(['cash', 'total', 'pending', 'account', 'symbol', 'ticker', 'positions', 'usd', 'etf', 'inc', 'corp', 'llc', 'ltd', 'plc', 'class', 'qty',
  'acct', 'shares', 'value', 'price', 'n/a', 'na', 'none']);
/** Common English words that are also symbols: read as one only where a symbol stands (a line's start, a $, an exchange, an amount right after). */
const WORDS = new Set(['a', 'i', 'all', 'now', 'key', 'on', 'it', 'are', 'any', 'one', 'can', 'for', 'has', 'new', 'out', 'see', 'two', 'be', 'do', 'go', 'so', 'no', 'or',
  'at', 'big', 'low', 'well', 'work', 'you', 'by', 'an', 'he', 'me', 'we', 'us', 'love', 'good', 'live', 'life', 'cash', 'fast', 'safe', 'save', 'home']);
const SHARE_WORDS = new Set(['shares', 'share', 'sh', 'shs', 'units', 'unit', 'qty', 'x']);
const USD_WORDS = new Set(['usd', 'dollars', 'dollar']);
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

const number = (s: string): number | null => { const v = Number(s.replace(/[$,%\s"]/g, '')); return Number.isFinite(v) && v > 0 && !/^\s*[-−(]/.test(s) ? v : null; };
function isoOf(y: number, m: number, d: number): string | null {
  const t = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, at = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === t ? t : null;
}
/** Every date in a text, with where it stands: ISO or with slashes (2025-03-14, 2025/03/14), US (3/14/2025), with the month's name (Mar 14, 2025; 14 March 2025). */
function datesIn(text: string): { at: number; len: number; iso: string | null }[] {
  const out: { at: number; len: number; iso: string | null }[] = [];
  const take = (re: RegExp, f: (m: RegExpExecArray) => string | null) => {
    for (const m of text.matchAll(re)) if (!out.some((o) => m.index! < o.at + o.len && o.at < m.index! + m[0].length)) out.push({ at: m.index!, len: m[0].length, iso: f(m) });
  };
  take(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g, (m) => isoOf(+m[1]!, +m[2]!, +m[3]!));
  take(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m) => isoOf(+m[3]!, +m[1]!, +m[2]!));
  take(new RegExp(`\\b${MONTH}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi'), (m) => isoOf(+m[3]!, MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) + 1, +m[2]!));
  take(new RegExp(`\\b(\\d{1,2})\\s+${MONTH},?\\s+(\\d{4})\\b`, 'gi'), (m) => isoOf(+m[3]!, MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1, +m[1]!));
  return out.sort((a, b) => a.at - b.at);
}

/** A table's cells: quoted cells keep their separators; a markdown table's outer pipes go. */
function cells(line: string, sep: string): string[] {
  const src = sep === '|' ? line.trim().replace(/^\|/, '').replace(/\|$/, '') : line;
  const out: string[] = [];
  let cur = '', quoted = false;
  for (const ch of src) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const HEAD = {
  sym: /^(symbol|ticker|sym|instrument|code)\b/,
  name: /^(name|description|investment name|security|company|holding|stock)\b/,
  qty: /\b(qty|quantity|shares|units|share count)\b|^position$/,
  val: /mkt val|market value|current value|total value|position value|^value\b|^amount\b|^balance\b/,
  pct: /% of acc|percent of acc|% of port|percent of port|^weight|^percent|^%|allocation/,
  date: /acquired|purchase date|trade date|open date|opened|bought|buy date|^date\b/,
};
const symbolLike = (s: string) => /^\$?[A-Za-z][A-Za-z0-9./-]{0,9}$/.test(s) && !NOT_SYMBOL.has(s.toLowerCase());

/** A table with a header row: its holdings by column. Null: no header that names a symbol column, or a name column with amounts. */
function fromTable(lines: string[], look: Lookup, notOnSite: Set<string>): { holdings: Holding[]; ignored: number[]; note: string | null } | null {
  for (let h = 0; h < Math.min(lines.length, 12); h++) {
    for (const sep of ['\t', '|', ';', ',']) {
      if (!lines[h]!.includes(sep)) continue;
      const head = cells(lines[h]!, sep).map((c) => c.toLowerCase());
      if (head.length < 2) continue;
      const col = (re: RegExp) => head.findIndex((c) => re.test(c));
      const sym = col(HEAD.sym), nm = col(HEAD.name);
      if (sym < 0 && nm < 0) continue;
      const qty = col(HEAD.qty), val = col(HEAD.val), pct = col(HEAD.pct), date = col(HEAD.date);
      if (sym < 0 && qty < 0 && val < 0 && pct < 0) continue; // a name column alone is no header
      const holdings: Holding[] = [], ignored: number[] = [];
      lines.slice(h + 1).forEach((raw, k) => {
        const line = h + 2 + k;
        if (!raw.trim() || /^[\s|:-]+$/.test(raw)) return;
        const c = cells(raw, sep);
        let t: string | null = null, known = true;
        const s = (c[sym] ?? '').trim();
        if (sym >= 0 && s) t = look.symbol(s);
        if (!t && nm >= 0) { const w = clean(c[nm] ?? ''), m = look.name(w, 0); if (m && m.n >= w.length) t = m.t; }
        if (!t && sym >= 0 && symbolLike(s)) { t = s.replace(/^\$/, '').toUpperCase(); known = false; notOnSite.add(t); }
        if (!t) { ignored.push(line); return; }
        const pick = ([[qty, 'shares'], [val, 'usd'], [pct, 'pct']] as const).find(([i]) => i >= 0 && number(c[i] ?? '') != null);
        const d = date >= 0 ? datesIn(c[date] ?? '')[0]?.iso ?? null : null;
        holdings.push({ line, t, known, amounts: pick ? [{ kind: pick[1], v: number(c[pick[0]]!)! }] : [], d });
      });
      // a header whose lines do not follow it ("Symbol,Shares" then "AAPL 10"): no holding from the table, so the lines are read one by one
      if (!holdings.length) return null;
      return { holdings, ignored, note: qty < 0 && val < 0 && pct < 0 ? NO_AMOUNT : null };
    }
  }
  return null;
}

type Token = { kind: 'entity'; t: string; known: boolean } | { kind: 'amount'; a: Amount } | { kind: 'unit'; u: 'shares' | 'usd' } | { kind: 'date'; iso: string | null }
  | { kind: 'sep' } | { kind: 'word' };

/** One line's tokens: what stands where. */
function tokens(text: string, look: Lookup): Token[] {
  const dates = datesIn(text);
  let s = '', from = 0;
  dates.forEach((d, k) => { s += `${text.slice(from, d.at)} §D${k} `; from = d.at + d.len; });
  s += text.slice(from);
  // a comma between digits groups thousands ($12,500); any other comma, and "and" or "&", separates
  s = s.replace(/[\t;|]/g, ' ').replace(/,(?!\d{3}(?:\D|$))/g, ' , ').replace(/(\d)\s+%/g, '$1%').replace(/\$\s+(?=\d)/g, '$').replace(/(^|\s)(and|&)(?=\s|$)/gi, '$1 , ');
  const raw = s.split(/\s+/).filter(Boolean);
  const words = raw.map((w) => clean(w)[0] ?? '');
  const out: Token[] = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i]!, lw = w.toLowerCase();
    if (w === ',') { out.push({ kind: 'sep' }); continue; }
    const dm = /^§D(\d+)$/.exec(w);
    if (dm) { out.push({ kind: 'date', iso: dates[+dm[1]!]!.iso }); continue; }
    const times = /^x(\d[\d,]*(?:\.\d+)?)$/i.exec(w);
    if (times) { const v = number(times[1]!); if (v != null) out.push({ kind: 'amount', a: { kind: 'shares', v } }); continue; }
    const num = /^(\$)?([+\-−])?(\d[\d,]*(?:\.\d+)?)(%|\$)?(x)?$/i.exec(w);
    if (num) {
      if (num[2]) continue; // a signed figure is a change, never an amount
      const v = number(num[3]!);
      if (v != null) out.push({ kind: 'amount', a: { kind: num[4] === '%' ? 'pct' : num[1] || num[4] === '$' ? 'usd' : num[5] ? 'shares' : 'bare', v } });
      continue;
    }
    if (SHARE_WORDS.has(lw)) { out.push({ kind: 'unit', u: 'shares' }); continue; }
    if (USD_WORDS.has(lw)) { out.push({ kind: 'unit', u: 'usd' }); continue; }
    // a symbol: in capitals, with a $ or an exchange, or where a line starts; a common word only where a symbol clearly stands
    const bare = w.replace(/[,;:.]+$/, '').replace(/^\(|\)$/g, '');
    const t = look.symbol(bare);
    const strong = /^\$|^[A-Za-z]{2,8}:/.test(bare), first = out.length === 0, caps = /^[$A-Z0-9:./-]+$/.test(bare) && /[A-Z]/.test(bare);
    const nextAmount = /^\$?\d/.test(raw[i + 1] ?? '');
    if (t && (strong || first || (caps && (!WORDS.has(bare.toLowerCase()) || nextAmount)))) { out.push({ kind: 'entity', t, known: true }); continue; }
    // a share class after a space: "BRK B", "BF B"
    const cls = /^[A-Z]{1,5}$/.test(bare) && /^[A-Z]$/.test(raw[i + 1] ?? '') ? look.symbol(`${bare}.${raw[i + 1]}`) : null;
    if (cls) { out.push({ kind: 'entity', t: cls, known: true }); i++; continue; }
    const m = /^[a-z0-9&]/.test(words[i] ?? '') ? look.name(words, i) : null;
    if (m) { out.push({ kind: 'entity', t: m.t, known: true }); i += m.n - 1; continue; }
    if ((strong || first) && /^\$?[A-Z][A-Z0-9]{1,5}(\.[A-Z])?$/.test(bare) && !NOT_SYMBOL.has(lw) && !WORDS.has(lw)) {
      out.push({ kind: 'entity', t: bare.replace(/^\$/, ''), known: false });
      continue;
    }
    out.push({ kind: 'word' });
  }
  return out;
}

/** A line read as holdings: groups between separators, each with its company and its figures; a group of figures alone joins the one before. */
function fromLine(text: string, line: number, look: Lookup): { holdings: Holding[]; orphan: Amount[] | null; date: string | null } {
  const groups: Token[][] = [[]];
  for (const t of tokens(text, look)) if (t.kind === 'sep') groups.push([]); else groups.at(-1)!.push(t);
  const holdings: Holding[] = [];
  let orphan: Amount[] | null = null, lone: string | null = null;
  for (const g of groups.filter((x) => x.length)) {
    // a unit word gives the figure next to it its kind: "10 shares", "x 8", "4,920 USD"
    const amounts: (Amount | null)[] = g.map((t) => (t.kind === 'amount' ? { ...t.a } : null));
    g.forEach((t, k) => {
      if (t.kind !== 'unit') return;
      const near = [k - 1, k + 1].find((j) => amounts[j]?.kind === 'bare');
      if (near != null) amounts[near]!.kind = t.u;
    });
    const figures = amounts.filter((x): x is Amount => x != null);
    const ents = g.flatMap((t, k) => (t.kind === 'entity' ? [{ k, t: t.t, known: t.known }] : []));
    const d = g.find((t): t is Extract<Token, { kind: 'date' }> => t.kind === 'date')?.iso ?? null;
    if (!ents.length) {
      // figures with no company: they belong to the one before (a list "VOO, $12,500"), else to the line before (an app's card)
      if (figures.length || d) {
        if (holdings.length) { holdings.at(-1)!.amounts.push(...figures); holdings.at(-1)!.d ??= d; } else { orphan = [...(orphan ?? []), ...figures]; lone ??= d; }
      }
      continue;
    }
    // one company twice in a row ("MSFT Microsoft Corp") is one
    const distinct = ents.filter((e, k) => k === 0 || e.t !== ents[k - 1]!.t);
    if (distinct.length === 1) { holdings.push({ line, t: distinct[0]!.t, known: distinct[0]!.known, amounts: figures, d }); continue; }
    // several companies: figures before the first belong to it ("10 AAPL 5 MSFT"); else each company takes the figures after it ("AAPL 10 MSFT 5")
    const before = g[0]!.kind === 'amount' || g[0]!.kind === 'unit';
    distinct.forEach((e, n) => {
      const [a, b] = before ? [(distinct[n - 1]?.k ?? -1) + 1, e.k] : [e.k + 1, distinct[n + 1]?.k ?? g.length];
      holdings.push({ line, t: e.t, known: e.known, amounts: amounts.slice(a, b).filter((x): x is Amount => x != null), d: n === 0 ? d : null });
    });
  }
  return { holdings, orphan, date: lone };
}

/** A holding's amount: shares stated, or found by the close (a price, its shares and their value); else dollars, else a percentage. */
function amountOf(r: Holding, look: Lookup): { kind: Kind; n: number | null } {
  const shares = r.amounts.find((a) => a.kind === 'shares');
  if (shares) return { kind: 'shares', n: shares.v };
  const c = r.known ? look.close(r.t) : null;
  const priceLike = (v: number) => c != null && Math.abs(v / c - 1) <= 0.35;
  const bare = r.amounts.filter((a) => a.kind === 'bare').map((a) => a.v), usd = r.amounts.filter((a) => a.kind === 'usd').map((a) => a.v);
  if (bare.length) {
    if (c != null && bare.length + usd.length > 1) {
      // shares × the close ≈ another figure on the line: those are the shares, the other their value; neither is a price (a change times the
      // price is near the price: "215.20 1.05 … 10 2,152.00" holds 10 shares, not 1.05), and the best fit wins
      const left = bare.filter((x) => !priceLike(x)), values = [...bare, ...usd].filter((v) => !priceLike(v));
      const fits = left.flatMap((q) => values.filter((v) => v !== q).map((v) => ({ q, miss: Math.abs(v / (q * c) - 1) }))).filter((f) => f.miss <= 0.35);
      if (fits.length) return { kind: 'shares', n: fits.sort((a, b) => a.miss - b.miss)[0]!.q };
      // no fit (a price far from tonight's close: an old export): shares are whole numbers far more often than prices
      if (left.length) return { kind: 'shares', n: left.find((x) => Number.isInteger(x)) ?? left[0]! };
    }
    return { kind: 'shares', n: bare.find((x) => Number.isInteger(x)) ?? bare[0]! };
  }
  if (usd.length) { const v = usd.filter((x) => !priceLike(x)); return { kind: 'usd', n: (v.length ? v : usd).at(-1)! }; }
  const pct = r.amounts.find((a) => a.kind === 'pct');
  return pct ? { kind: 'pct', n: pct.v } : { kind: 'none', n: null };
}

const list = (n: number[]) => (n.length === 1 ? String(n[0]) : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
const linesOf = (n: number[], first: boolean) => `${first ? 'L' : 'l'}ine${n.length > 1 ? 's' : ''} ${list(n)}`;
/** The words of a line once its figures, units and months are gone: a line with none is a line of figures. */
const wordsLeft = (t: string) => t.replace(/\b(shares?|sh|shs|units?|usd|dollars?)\b/gi, '').replace(new RegExp(MONTH, 'gi'), '').match(/[a-z]{2,}/gi) ?? [];

export function parsePaste(text: string, look: Lookup, today: string, kind: 'portfolio' | 'watchlist'): Parsed {
  const source = text.split(/\r?\n/);
  const all = source.map((l) => l.replace(/^\s*(?:[-*•·▪◦]+|\d{1,3}[.)])\s+/, ''));
  const notOnSite = new Set<string>();
  const table = fromTable(all, look, notOnSite);
  let holdings: Holding[], ignoredLines: number[], note: string | null = null;
  if (table) ({ holdings, ignored: ignoredLines, note } = table);
  else {
    holdings = []; ignoredLines = [];
    all.forEach((raw, k) => {
      const t = raw.trim();
      if (!t || t.startsWith('#') || /^[\s|:-]+$/.test(t)) return;
      const r = fromLine(t, k + 1, look);
      const prev = holdings.at(-1);
      // the company of the line before, again with nothing yet ("AAPL" then "Apple Inc"): the same holding
      if (r.holdings.length === 1 && prev && prev.t === r.holdings[0]!.t && prev.line === k && !prev.amounts.length && !r.holdings[0]!.amounts.length) { prev.line = k + 1; return; }
      if (r.holdings.length) { holdings.push(...r.holdings); return; }
      // a line of figures only joins the holding above it (an app's card); a line with other words is not read
      if (r.orphan && prev && !wordsLeft(t).length) { prev.amounts.push(...r.orphan); prev.d ??= r.date; prev.line = k + 1; return; }
      ignoredLines.push(k + 1);
    });
    for (const h of holdings) if (!h.known) notOnSite.add(h.t);
  }
  const names = [...notOnSite];
  const ignored = ignoredLines.map((line) => ({ line, text: source[line - 1]!.trim() })).filter((x) => x.text);
  const read = holdings.map((h) => ({ h, ...amountOf(h, look) }));
  if (kind === 'watchlist')
    return { rows: read.map(({ h }) => ({ line: h.line, t: h.t, n: null, d: null })), unit: 'equal', refused: null, mixed: false, notOnSite: names, dropped: read.some((x) => x.n != null || x.h.d != null), note: null, ignored };
  const rows = read.map(({ h, n }) => ({ line: h.line, t: h.t, n, d: h.d }));
  const groups = new Map<Kind, number[]>();
  for (const x of read) groups.set(x.kind, [...(groups.get(x.kind) ?? []), x.h.line]);
  const mixed = groups.size > 1, only = [...groups.keys()][0] ?? 'none', unit: Unit = mixed || only === 'none' ? 'equal' : only;
  if (mixed) {
    // the lines that differ first: the smaller group, on a tie the later lines
    const parts = [...groups].sort(([, a], [, b]) => a.length - b.length || b[0]! - a[0]!)
      .map(([k, n], i) => (i === 0 ? `${linesOf(n, true)} give${n.length > 1 ? '' : 's'} ${WHAT[k]}` : `${linesOf(n, false)} ${WHAT[k]}`));
    return { rows, unit, refused: `${parts.join(', ')}: one kind of amount per portfolio.`, mixed, notOnSite: names, dropped: false, note, ignored };
  }
  const late = rows.filter((r) => r.d != null && r.d > today);
  const refused = !late.length ? null : late.length === 1 ? `Line ${late[0]!.line}: the date ${late[0]!.d} is after today.` : `${linesOf(late.map((r) => r.line), true)}: their dates are after today.`;
  return { rows, unit, refused, mixed, notOnSite: names, dropped: false, note, ignored };
}

/** A portfolio as text, one line a holding: what "Copy as text" gives and a paste reads back. */
export function serialize(rows: readonly { t: string; n: number | null; d: string | null }[], unit: Unit): string {
  const amount = (n: number | null) => (n == null || unit === 'equal' ? '' : unit === 'pct' ? ` ${n}%` : unit === 'usd' ? ` $${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ` ${n}`);
  return rows.map((r) => `${r.t}${amount(r.n)}${r.d ? ` ${r.d}` : ''}`).join('\n');
}

import type { AlertRow } from './rows';

type Named = Pick<AlertRow, 'ticker' | 'name'>;
/** words a company's name carries that nobody writes when naming it */
const STOP = new Set(['inc', 'incorporated', 'corp', 'corporation', 'company', 'co', 'holdings', 'holding', 'group', 'plc', 'ltd',
  'limited', 'nv', 'sa', 'ag', 'the']);
/** a symbol as people write it: upper case, maybe $ before it, BRK.B as BRK-B or BRK/B too */
const SYMBOL = /(^|[^A-Za-z0-9$.&])(\$?)([A-Z][A-Z0-9]{0,5}(?:[.\-/][A-Z])?)(?![A-Za-z0-9&])/g;   // no lookbehind: older Safari
/** the text in lower case with anything but letters, digits and & as a space: positions stay those of the text */
const plain = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9&]/g, ' ')} `;

/** A company's name as it is written in a sentence: "The Coca-Cola Company" → ['coca', 'cola'], "Alphabet Inc. Class A" → ['alphabet']. */
function nameWords(name: string): string[] {
  const w = name.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean), out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'class') { i++; continue; }
    if (!STOP.has(w[i]!)) out.push(w[i]!);
  }
  return out;
}

/**
 * The companies a pasted text names (My portfolio, Romeo 2026-11-02), each once, in the order they come: symbols as a broker export
 * or a post writes them (a one-letter symbol only with its $: "A" and "I" are words), and names — the whole name without Inc. or
 * Class, or its first word when no other company starts with it. A name shared by two share classes is the first listed's.
 */
export function companiesIn(text: string, rows: readonly Named[]): string[] {
  const known = new Set(rows.map((r) => r.ticker)), found = new Map<string, number>();
  const see = (ticker: string, at: number) => { if (!found.has(ticker) || found.get(ticker)! > at) found.set(ticker, at); };
  for (const m of text.matchAll(SYMBOL)) {
    const t = m[3]!.replace(/[-/]/, '.');
    if (known.has(t) && (t.length > 1 || m[2] === '$')) see(t, m.index! + m[1]!.length);
  }
  const words = rows.map((r) => nameWords(r.name));
  const firsts = new Map<string, number>();
  for (const w of words) if (w[0]) firsts.set(w[0], (firsts.get(w[0]) ?? 0) + 1);
  const phrases = new Map<string, string>();                 // a phrase → the first company it names
  rows.forEach((r, i) => {
    const w = words[i]!;
    if (!w.length) return;
    const all = w.join(' ');
    if (all.length >= 3 && !phrases.has(all)) phrases.set(all, r.ticker);
    if (w.length > 1 && w[0]!.length >= 4 && firsts.get(w[0]!) === 1 && !phrases.has(w[0]!)) phrases.set(w[0]!, r.ticker);
  });
  const hay = plain(text);
  for (const [phrase, ticker] of phrases) {
    const at = hay.indexOf(` ${phrase} `);
    if (at >= 0) see(ticker, at);                           // ` text` starts one place on: the order still holds
  }
  return [...found].sort((a, b) => a[1] - b[1]).map(([t]) => t);
}

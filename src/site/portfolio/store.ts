import type { Unit } from './parse';

/**
 * The reader's portfolios and watchlists, kept only in this browser (design 2026-11-07 Part B): one versioned value under `pt-portfolios`. A
 * storage that refuses (a private window, a full quota) leaves the page working for the visit; a value this build cannot read is kept aside once,
 * never silently lost.
 */
export interface StoredRow { t: string; n: number | null; d: string | null }
export interface StoredPortfolio { id: string; name: string; kind: 'portfolio' | 'watchlist'; unit: Unit; rows: StoredRow[] }
export interface Stored { v: 1; active: string | null; list: StoredPortfolio[] }

export const PORTFOLIO_KEY = 'pt-portfolios';
export const MAX_PORTFOLIOS = 10;
export const MAX_ROWS = 200;
const EMPTY = (): Stored => ({ v: 1, active: null, list: [] });
const PROBE = `${PORTFOLIO_KEY}-probe`;

const readable = (v: unknown): v is Stored =>
  typeof v === 'object' && v !== null && (v as Stored).v === 1 && Array.isArray((v as Stored).list)
  && (v as Stored).list.every((p) => typeof p?.id === 'string' && typeof p.name === 'string' && (p.kind === 'portfolio' || p.kind === 'watchlist') && Array.isArray(p.rows));

export function loadPortfolios(storage: () => Storage): { stored: Stored; saving: boolean } {
  let s: Storage;
  try { s = storage(); s.setItem(PROBE, '1'); s.removeItem(PROBE); } catch { return { stored: EMPTY(), saving: false }; }
  const raw = s.getItem(PORTFOLIO_KEY);
  if (raw == null) return { stored: EMPTY(), saving: true };
  let v: unknown = null;
  try { v = JSON.parse(raw); } catch { /* kept aside below */ }
  if (readable(v)) return { stored: v, saving: true };
  try { if (s.getItem(`${PORTFOLIO_KEY}-unread`) == null) s.setItem(`${PORTFOLIO_KEY}-unread`, raw); } catch { /* nothing more to do */ }
  return { stored: EMPTY(), saving: true };
}

export function savePortfolios(storage: () => Storage, stored: Stored): boolean {
  try { storage().setItem(PORTFOLIO_KEY, JSON.stringify(stored)); return true; } catch { return false; }
}

/** The list with `p` added or replaced (by id) and chosen; the limits as a sentence instead. */
export function withPortfolio(stored: Stored, p: StoredPortfolio): Stored | string {
  const known = stored.list.some((x) => x.id === p.id);
  if (!known && stored.list.length >= MAX_PORTFOLIOS) return `You can keep ${MAX_PORTFOLIOS} portfolios.`;
  if (p.rows.length > MAX_ROWS) return `A portfolio holds up to ${MAX_ROWS} lines.`;
  return { v: 1, active: p.id, list: known ? stored.list.map((x) => (x.id === p.id ? p : x)) : [...stored.list, p] };
}

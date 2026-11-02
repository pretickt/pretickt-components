import type { AlertRow } from './rows';

type Findable = Pick<AlertRow, 'ticker' | 'name' | 'marketCap'>;

/**
 * The companies a search names (the alert editor's: a portfolio's, One stock's): the symbol itself first, then the symbols
 * starting with it, then the names holding it, each the largest first; none already taken; six at most.
 */
export function searchCompanies<T extends Findable>(rows: readonly T[], query: string, exclude: readonly string[] = [], max = 6): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const taken = new Set(exclude), sym = (r: T) => r.ticker.toLowerCase();
  const rank = (r: T) => (sym(r) === q ? 0 : sym(r).startsWith(q) ? 1 : 2);
  return rows.filter((r) => !taken.has(r.ticker) && (sym(r).startsWith(q) || r.name.toLowerCase().includes(q)))
    .sort((a, b) => rank(a) - rank(b) || (b.marketCap ?? -1) - (a.marketCap ?? -1) || (a.ticker < b.ticker ? -1 : 1))
    .slice(0, max);
}

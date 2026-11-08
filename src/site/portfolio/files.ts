import { InjectionToken } from '@angular/core';
import type { ClosesFile, FactsFile } from '@pretickt/components/typologies';

/**
 * Where the portfolio page reads its data: the nightly's files under /data/, the same for every reader (design 2026-11-07 Part B). A request names a
 * file — the facts, the year, a calendar year — never a symbol: a reader's holdings never leave the browser.
 */
export interface PortfolioFiles { facts(): Promise<FactsFile | null>; closes(key: string): Promise<ClosesFile | null> }
export const PT_PORTFOLIO_FILES = new InjectionToken<PortfolioFiles>('pt-portfolio-files');
/** The browser's storage, asked when needed (its accessor throws in some private windows). */
export const PT_PORTFOLIO_STORAGE = new InjectionToken<() => Storage>('pt-portfolio-storage');

export function fetchFiles(buildId: string, f: typeof fetch = fetch): PortfolioFiles {
  const get = async <T>(path: string): Promise<T | null> => {
    try { const r = await f(`/data/${path}?v=${encodeURIComponent(buildId)}`); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
  };
  return {
    facts: () => get<FactsFile>('facts-v1.json'),
    closes: (key) => (/^(1y|\d{4})$/.test(key) ? get<ClosesFile>(`closes-${key}-v1.json`) : Promise.resolve(null)),
  };
}

import { InjectionToken } from '@angular/core';
import type { ClosesFile, FactsFile, FactsSprite } from '@pretickt/components/typologies';

/**
 * Where the portfolio page reads its data: the nightly's files under /data/, the same for every reader (design 2026-11-07 Part B), and the one sheet
 * of every logo. A request names a file — the facts, the year, a calendar year, the sheet — never a symbol: a reader's saved holdings never leave the
 * browser (the only request that carries what the reader typed is the paste they ask the site's AI to read, ai.ts).
 * `logos`: the lines' logos cut out of the sheet, as data URLs (a ticker the sheet lacks, or a sheet that does not come, is no logo: its initials).
 */
export interface PortfolioFiles {
  facts(): Promise<FactsFile | null>;
  closes(key: string): Promise<ClosesFile | null>;
  logos(sheet: FactsSprite, tickers: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
export const PT_PORTFOLIO_FILES = new InjectionToken<PortfolioFiles>('pt-portfolio-files');
/** The browser's storage, asked when needed (its accessor throws in some private windows). */
export const PT_PORTFOLIO_STORAGE = new InjectionToken<() => Storage>('pt-portfolio-storage');

/** The sheet's only name: one file for every reader, never a company's (the facts' typology says the same). */
const SHEET = /^\/logos\/sprite\.[0-9a-f]{8}\.webp$/;
const loadImage = (src: string) => new Promise<CanvasImageSource | null>((ok) => {
  if (typeof Image === 'undefined') { ok(null); return; }
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => ok(null);
  i.src = src;
});

export function fetchFiles(buildId: string, f: typeof fetch = fetch, image: (src: string) => Promise<CanvasImageSource | null> = loadImage): PortfolioFiles {
  const get = async <T>(path: string): Promise<T | null> => {
    try { const r = await f(`/data/${path}?v=${encodeURIComponent(buildId)}`); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
  };
  const sheets = new Map<string, Promise<CanvasImageSource | null>>();
  return {
    facts: () => get<FactsFile>('facts-v1.json'),
    closes: (key) => (/^(1y|\d{4})$/.test(key) ? get<ClosesFile>(`closes-${key}-v1.json`) : Promise.resolve(null)),
    async logos(s, tickers) {
      const out = new Map<string, string>();
      if (!SHEET.test(s.file)) return out;
      if (!sheets.has(s.file)) sheets.set(s.file, image(s.file));
      const img = await sheets.get(s.file)!;
      const c = img && typeof document !== 'undefined' ? document.createElement('canvas') : null, g = c?.getContext('2d');
      if (!img || !c || !g) return out;
      c.width = c.height = s.px;
      for (const t of tickers) {
        const n = s.tickers.indexOf(t);
        if (n < 0) continue;
        g.clearRect(0, 0, s.px, s.px);
        g.drawImage(img, (n % s.cols) * s.px, Math.floor(n / s.cols) * s.px, s.px, s.px, 0, 0, s.px, s.px);
        // a white or pale logo is marked in its data URL, where the stylesheet finds it as it finds a `.white.` or `.light.` file
        const kind = s.white?.includes(t) ? 'white' : s.light?.includes(t) ? 'light' : null;
        out.set(t, kind ? c.toDataURL().replace('data:image/png;base64,', `data:image/png;${kind}=1;base64,`) : c.toDataURL());
      }
      return out;
    },
  };
}

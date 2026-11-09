import { inject, Injectable, signal } from '@angular/core';
import type { FactsSprite } from '@pretickt/components/typologies';
import { PT_PORTFOLIO_FILES } from './files';

/**
 * The logos the portfolio page has cut out of the one sheet every reader loads (a company's own logo file would name it), shared by the page's parts:
 * the holdings' table and the preview of a paste (Romeo, 2026-11-09: «quando trovi le aziende, metti il logo pure»). Each ticker is cut once; a ticker
 * the sheet lacks, or a sheet that does not come, is no logo (its initials). Provided by the page.
 */
@Injectable()
export class PortfolioLogos {
  private readonly files = inject(PT_PORTFOLIO_FILES);
  private readonly cut = new Set<string>();
  readonly map = signal<ReadonlyMap<string, string>>(new Map());

  want(sheet: FactsSprite | undefined, tickers: Iterable<string>) {
    const want = sheet ? [...new Set(tickers)].filter((t) => !this.cut.has(t) && sheet.tickers.includes(t)) : [];
    if (!sheet || !want.length) return;
    for (const t of want) this.cut.add(t);
    void this.files.logos(sheet, want).then((m) => { if (m.size) this.map.set(new Map([...this.map(), ...m])); });
  }
}

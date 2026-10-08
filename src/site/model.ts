import { InjectionToken, makeStateKey } from '@angular/core';

/** One component on a page: its tag and props; `off` = shown as "not available" without the component (a placement the build refused). */
export interface PagePlacement { c: string; props: Record<string, unknown>; off?: boolean }
/** A section: its title (none on the company card's), the link to its full page, its placements. */
export interface PageSection { id: string; title?: string; more?: { href: string; label: string }; items: PagePlacement[] }
/** What the generator gives a page app: its sections, the build, the API origin ('' = same origin) and, on a company's pages, that company. */
export interface PageModel { buildId: string; api: string; subject?: string; sections: PageSection[] }

export interface RenderOptions {
  /** The page document with a `<pt-page></pt-page>` root (the generator's layout). */
  document: string;
  /** Answers one call (the database); a rejection or null means "not available". */
  resolve: (t: string, params: unknown) => Promise<unknown>;
  /** Answers shared between the renders of a build step (the seven pages of a company). */
  cache?: Map<string, Promise<unknown>>;
  timeoutMs?: number;
}
export interface RenderResult {
  html: string;
  /** Every call the page made, by need key (the browser replays them). */
  calls: Record<string, unknown>;
  /** Need keys answered null (data not available). */
  failed: string[];
  /** Per placement (`section/item`): markup the page must not ship (checkMarkup). */
  markup: Record<string, string[]>;
  /** Placements that rendered nothing. */
  empty: string[];
  /** Placements (`tag@version`) with a call that took longer than the timeout (answered null). */
  timeouts: string[];
}

/** What `dist/site/server/main.server.mjs` gives the generator and the admin (after its polyfills are loaded). */
export interface ServerApi {
  renderPage(model: PageModel, o: RenderOptions): Promise<RenderResult>;
  warmUp(resolve: RenderOptions['resolve']): Promise<void>;
  checkComponent(tag: string, samples: Record<string, unknown>[]): Promise<string[]>;
}

export const PT_PAGE = new InjectionToken<PageModel>('PT_PAGE');
/** The page model and the build's recorded calls travel to the browser in the page state (TransferState). */
export const PAGE_KEY = makeStateKey<PageModel>('pt-page');
export const CALLS_KEY = makeStateKey<Record<string, unknown>>('pt-calls');

import { InjectionToken, makeStateKey } from '@angular/core';

/** One component on a page: its tag and props; `off` = shown as "not available" without the component (a placement the build refused). */
export interface PagePlacement { c: string; props: Record<string, unknown>; off?: boolean }
/** A section: its title (none on the company card's), the link to its full page, its placements. */
export interface PageSection { id: string; title?: string; more?: { href: string; label: string }; items: PagePlacement[] }
/** What the generator gives a page app: its sections, the build, the API origin ('' = same origin) and, on a company's pages, that company. */
export interface PageModel { buildId: string; api: string; subject?: string; sections: PageSection[] }

export const PT_PAGE = new InjectionToken<PageModel>('PT_PAGE');
/** The page model and the build's recorded calls travel to the browser in the page state (TransferState). */
export const PAGE_KEY = makeStateKey<PageModel>('pt-page');
export const CALLS_KEY = makeStateKey<Record<string, unknown>>('pt-calls');

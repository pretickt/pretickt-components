import { stableStringify } from './key';
import type { Need } from './types';

/** What the generator embeds in each page's <head> (script#pt-data) and the host reads back. */
export interface PageData { buildId: string; api: string; data: Record<string, unknown>; components: Record<string, string> }
/** One mount, in a component's data-pt attribute: component id, params, and the page-data key of each need. */
export interface Mount { c: string; p: unknown; k: Record<string, string> }

const PATH = /^\/v1\/t\/([a-z][a-z-]*@\d+)$/;

/** The API URL of one need (relative to the API origin). Params are canonical, so equal needs share a cache entry. */
export const needPath = (n: Need, build: string): string =>
  `/v1/t/${encodeURIComponent(n.t)}?p=${encodeURIComponent(stableStringify(n.params))}&b=${encodeURIComponent(build)}`;

/** The typology id an API path names (`/v1/t/<id>`), or null. */
export function typologyInPath(pathname: string): string | null {
  let path: string;
  try { path = decodeURIComponent(pathname); } catch { return null; }
  return PATH.exec(path)?.[1] ?? null;
}

/**
 * The data API contract shared by the components (pt context), the generator and the Worker: a need is a typology id and its
 * params; its key (`t|canonical JSON`) names it in page data and in caches; its path is the `/v1/t` URL.
 */
export type TypologyId = `${string}@${number}`;
export interface Need { t: TypologyId; params: unknown }

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export const needKey = (n: Need): string => `${n.t}|${stableStringify(n.params)}`;

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

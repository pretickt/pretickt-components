/** What the generator writes into a page and the island runtime reads back. */

/** `<head>` JSON (script#pt-data): the build, the API origin ('' = same origin), every recorded call by need key, and the client module of each component. */
export interface PageData { buildId: string; api: string; calls: Record<string, unknown>; components: Record<string, string> }

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENT[c]!);

/**
 * One island: the wrapper names the component (`tag@version`) and carries its props; the Vue app hydrates the inner container,
 * which holds exactly the server HTML (the tooltip lives outside it, in the wrapper).
 */
export const islandMarkup = (id: string, props: unknown, html: string): string =>
  `<div class="pt-island" data-island="${esc(id)}" data-props="${esc(JSON.stringify(props ?? {}))}"><div class="pt-island-app">${html}</div></div>`;

/** The page data, read from `<head>` only: component markup lives in `<body>`, so nothing a component renders can stand in for it. */
export function readPage(doc: Document): PageData | null {
  const el = doc.head?.querySelector('script#pt-data[type="application/json"]');
  if (!el?.textContent) return null;
  try { return JSON.parse(el.textContent) as PageData; } catch { return null; }
}

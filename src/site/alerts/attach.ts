import type { AlertSource } from '../../alerts/sources';
import type { AlertFrom } from '../../alerts/token';

/**
 * A pressed bell (`.pt-alert-bell`, under a placement of a page with alerts): the badge it carries and where it was pressed — the
 * component, the section, the page. The page's one-line listener loads the editor's chunk on the first press and hands it the bell,
 * so none of this weighs on the main bundle. Null for a bell whose data is not a badge.
 */
export function bellOf(bell: Element, doc: Document): { src: AlertSource; from: AlertFrom } | null {
  let src: AlertSource;
  try { src = JSON.parse(bell.getAttribute('data-alert') ?? ''); } catch { return null; }
  if (!src || typeof src !== 'object' || typeof src.c !== 'string') return null;
  const tag = bell.closest('.pt-island')?.getAttribute('data-island')?.split('@')[0] ?? '';
  return { src, from: { tag, section: bell.closest('section')?.id || null, path: doc.defaultView?.location.pathname ?? '/' } };
}

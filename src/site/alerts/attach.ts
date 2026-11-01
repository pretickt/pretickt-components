import type { AlertSource } from '../../alerts/sources';
import type { AlertFrom } from '../../context/alerts';

/**
 * The page's bells (`.pt-alert-bell`, under each placement of a page with alerts): one listener for the document; a press opens the
 * editor with the badge of the bell's section — `open` gets the badge and where it was pressed (the component, the section, the page).
 * Nothing else of the alerts is loaded until then: the editor is a chunk of its own.
 */
export function attachAlerts(doc: Document, open: (src: AlertSource, from: AlertFrom) => void): () => void {
  const onClick = (e: Event) => {
    const bell = (e.target as Element | null)?.closest?.<HTMLElement>('[data-alert]');
    if (!bell) return;
    let src: AlertSource;
    try { src = JSON.parse(bell.getAttribute('data-alert') ?? ''); } catch { return; }
    if (!src || typeof src !== 'object' || typeof src.c !== 'string') return;
    e.preventDefault();
    const tag = bell.closest('.pt-island')?.getAttribute('data-island')?.split('@')[0] ?? '';
    open(src, { tag, section: bell.closest('section')?.id || null, path: doc.defaultView?.location.pathname ?? '/' });
  };
  doc.addEventListener('click', onClick);
  return () => doc.removeEventListener('click', onClick);
}

/**
 * Leaving the click's note: a click (Cmd-click, middle-click) on a company link asks the link's origin what the reader saw there
 * (`pt-ctx-ask`, synchronous) and keeps the answer for the page the link leads to. Links that are not "I picked this company" leave
 * none: the header, the company tabs, the crumbs, the page's own company. Navigation is never held up.
 */
import { askAt, rememberedAt } from '../../context/click';
import { companyPageOf, writeNote, type NoteStore } from './note';

export { askAt, rememberPanel } from '../../context/click';

const NOT_A_PICK = '.pt-header, .pt-subnav, .pt-crumbs';

export function attachLeave(doc: Document, subject: string | undefined, store: NoteStore | null): void {
  const own = subject?.toUpperCase();
  const leave = (e: MouseEvent) => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    const a = (e.target as Element | null)?.closest?.('a[href]');
    if (!a || a.closest(NOT_A_PICK)) return;
    const page = companyPageOf(a.getAttribute('href') ?? '');
    if (!page || page.ticker === own) return;
    const panel = rememberedAt(a);
    const data = panel ? panel.data : askAt(a);
    if (!data) return;
    const path = doc.location?.pathname ?? globalThis.location?.pathname ?? '/';
    writeNote(store, { ...data, v: 1, to: page.ticker, land: page.path, at: Date.now(), from: { path, title: doc.title.split(' | ')[0] ?? '' } });
  };
  doc.addEventListener('click', leave, true);
  doc.addEventListener('auxclick', leave, true);
}

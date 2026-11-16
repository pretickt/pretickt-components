/**
 * Leaving the click's note: a click (Cmd-click, middle-click) on a company link asks the link's origin what the reader saw there
 * (`pt-ctx-ask`, synchronous) and keeps the answer for the page the link leads to. Links that are not "I picked this company" leave
 * none: the header, the company tabs, the crumbs, the page's own company. Navigation is never held up.
 */
import { CTX_ASK, type ClickData, type CtxAsk } from '../../context/click';
import { companyPageOf, writeNote, type NoteStore } from './note';

const NOT_A_PICK = '.pt-header, .pt-subnav, .pt-crumbs';
const panels = new WeakMap<Element, ClickData | null>();

/** Asks the origin of a link (synchronous): its answer, or null. */
export function askAt(link: Element): ClickData | null {
  const e = new CustomEvent<CtxAsk>(CTX_ASK, { bubbles: true, detail: { data: null } });
  link.dispatchEvent(e);
  return e.detail.data;
}

/** The hover card opened over a link keeps that link's answer: a click inside the card leaves it. */
export function rememberPanel(panel: Element, data: ClickData | null): void {
  panels.set(panel, data);
}

const panelOf = (el: Element): { data: ClickData | null } | null => {
  for (let at: Element | null = el; at; at = at.parentElement) if (panels.has(at)) return { data: panels.get(at) ?? null };
  return null;
};

export function attachLeave(doc: Document, subject: string | undefined, store: NoteStore | null): void {
  const own = subject?.toUpperCase();
  const leave = (e: MouseEvent) => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    const a = (e.target as Element | null)?.closest?.('a[href]');
    if (!a || a.closest(NOT_A_PICK)) return;
    const page = companyPageOf(a.getAttribute('href') ?? '');
    if (!page || page.ticker === own) return;
    const panel = panelOf(a);
    const data = panel ? panel.data : askAt(a);
    if (!data) return;
    const path = doc.location?.pathname ?? globalThis.location?.pathname ?? '/';
    writeNote(store, { ...data, v: 1, to: page.ticker, land: page.path, at: Date.now(), from: { path, title: doc.title.split(' | ')[0] ?? '' } });
  };
  doc.addEventListener('click', leave, true);
  doc.addEventListener('auxclick', leave, true);
}

import { createApp, h, Suspense, type App, type Component } from 'vue';
import { createPt, PT } from '../context/pt';
import type { PageData } from './page';
import { attachTips } from './tips';

const GAP = 8;
/** The hookup of a document: attaching again replaces it (listeners, open panel). */
const ATTACHED = new WeakMap<Document, AbortController>();

/** The company a link points to — its page `/stocks/<t>/` and nothing else — as a ticker, or null. */
export function companyOf(el: Element | null): string | null {
  const m = /^\/stocks\/([a-z0-9.]{1,12})\/$/.exec(el?.getAttribute('href') ?? '');
  return m ? m[1]!.toUpperCase() : null;
}

export interface CardOptions {
  importer: (url: string) => Promise<{ default: Component }>;
  /** Answers the card's calls (the page's API resolver), with the page's cache and recorded calls. */
  resolve: (t: string, params: unknown) => Promise<unknown>;
  cache: Map<string, Promise<unknown>>;
  replay: Record<string, unknown>;
  /** A device with a mouse (`(hover: hover) and (pointer: fine)`); touch screens follow the link instead. */
  hover: boolean;
  openMs?: number;
  closeMs?: number;
  /** After a card fails to load (typically the API's rate limit), cards pause this long and links show their text tooltips. */
  pauseMs?: number;
}

/** What the tooltips need to know: whether a company link opens its card right now. */
export interface Cards { active(): boolean }

/** Whether a page's company links get a card instead of a text tooltip. */
export const cardsOn = (page: PageData, hover: boolean): boolean => hover && !!page.card;

/**
 * Where the panel goes: under the link when it fits, above it when that fits, else pinned to the top of the window with a height
 * that scrolls — the whole card (after "Show all" too) stays reachable.
 */
export function panelPosition(r: { left: number; top: number; bottom: number }, w: number, h: number, vw: number, vh: number) {
  const x = Math.max(GAP, Math.min(r.left, vw - w - GAP));
  if (r.bottom + GAP + h <= vh - GAP) return { x, y: r.bottom + GAP, maxHeight: null };
  if (r.top - GAP - h >= GAP) return { x, y: r.top - GAP - h, maxHeight: null };
  return { x, y: GAP, maxHeight: vh - 2 * GAP };
}

function place(panel: HTMLElement, link: Element, win: Window) {
  panel.style.maxHeight = '';
  const p = panelPosition(link.getBoundingClientRect(), panel.offsetWidth || 340, panel.scrollHeight || panel.offsetHeight || 0, win.innerWidth, win.innerHeight);
  panel.style.left = `${Math.round(p.x)}px`;
  panel.style.top = `${Math.round(p.y)}px`;
  if (p.maxHeight !== null) panel.style.maxHeight = `${Math.round(p.maxHeight)}px`;
}

const rowsOf = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try { const o = JSON.parse(raw) as unknown; return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null; } catch { return null; }
};

/**
 * Hovering a company link (any `/stocks/<t>/` link but the page's own company) opens the company card, compact, in a floating panel
 * outside the islands: after a moment (a passing pointer opens nothing), with the link's tooltip rows as its footer. The panel stays
 * while the pointer is on the link or on it, closes a moment after leaving or on Escape; one at a time. Its calls go through the
 * page's API resolver and cache; a card whose data cannot load is not shown.
 */
export function attachCards(doc: Document, page: PageData, o: CardOptions): Cards {
  ATTACHED.get(doc)?.abort();
  ATTACHED.delete(doc);
  if (!cardsOn(page, o.hover) || !doc.defaultView) return { active: () => false };
  const ctl = new AbortController();
  ATTACHED.set(doc, ctl);
  const on = { signal: ctl.signal };
  const win = doc.defaultView;
  const card = page.card!;
  const subject = page.subject?.toUpperCase();
  let link: Element | null = null, panel: HTMLElement | null = null, app: App | null = null;
  let openTimer = 0, closeTimer = 0, pausedUntil = 0;
  const paused = () => win.performance.now() < pausedUntil;

  const linkOf = (t: EventTarget | null): Element | null => {
    const a = (t as Element | null)?.closest?.('a[href]') ?? null;
    const ticker = companyOf(a);
    return ticker && ticker !== subject ? a : null;
  };
  /** Removes the open panel; a card about to open (the next link) is left alone. */
  const teardown = () => {
    win.clearTimeout(closeTimer);
    try { app?.unmount(); } catch { /* already gone */ }
    panel?.remove();
    app = null; panel = null; link = null;
  };
  /** Escape, a new card, a new hookup: nothing stays open or about to open. */
  const close = () => { win.clearTimeout(openTimer); teardown(); };
  const closeSoon = () => { win.clearTimeout(closeTimer); closeTimer = win.setTimeout(teardown, o.closeMs ?? 250); };

  async function open(a: Element) {
    close();
    link = a;
    const ticker = companyOf(a)!;
    const p = doc.createElement('div');
    p.className = 'pt-hovercard';
    p.setAttribute('data-island', card.id); // names the card in the beacon
    const loading = doc.createElement('div');
    loading.className = 'pt-hovercard-loading';
    loading.textContent = `${ticker} …`;
    p.append(loading);
    p.addEventListener('pointerenter', () => win.clearTimeout(closeTimer));
    p.addEventListener('pointerleave', closeSoon);
    doc.body.append(p);
    place(p, a, win);
    panel = p;
    const root = doc.createElement('div');
    try {
      const { default: Card } = await o.importer(card.url);
      if (panel !== p) return; // closed, or another card opened meanwhile
      await new Promise<void>((done, fail) => {
        const mine = createApp({ render: () => h(Suspense, { onResolve: done }, { default: () => h(Card, { ticker, size: 'compact', extra: rowsOf(a.getAttribute('data-tip')) }) }) });
        mine.provide(PT, createPt({ resolve: o.resolve, replay: o.replay, cache: o.cache, status: (s) => { if (s === 'failed') fail(new Error('card data')); } }));
        mine.config.errorHandler = (e) => fail(e);
        app = mine;
        mine.mount(root);
      });
      if (panel !== p) return;
      p.replaceChildren(root);
      attachTips(p, (action) => p.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action } })));
      place(p, a, win);
      p.addEventListener('click', () => win.setTimeout(() => { if (panel === p) place(p, a, win); }, 0)); // "Show all" changes its height
      p.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'hover' } }));
    } catch {
      pausedUntil = win.performance.now() + (o.pauseMs ?? 60_000); // most likely the rate limit: stop asking for a while
      if (panel === p) close();
    }
  }

  ctl.signal.addEventListener('abort', () => close());
  doc.addEventListener('pointerover', (e) => {
    const a = linkOf(e.target);
    if (!a || paused()) return;
    if (a === link) { win.clearTimeout(closeTimer); return; }
    win.clearTimeout(openTimer);
    openTimer = win.setTimeout(() => void open(a), o.openMs ?? 250);
  }, on);
  doc.addEventListener('pointerout', (e) => {
    const a = linkOf(e.target);
    if (!a || a.contains((e as PointerEvent).relatedTarget as Node | null)) return; // still inside the link
    win.clearTimeout(openTimer); // left before it opened
    if (a === link) closeSoon();
  }, on);
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, on);
  return { active: () => !ctl.signal.aborted && !paused() };
}

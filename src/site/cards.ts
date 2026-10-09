import { type ApplicationRef, type ComponentRef, createComponent, createEnvironmentInjector, effect, type EnvironmentInjector, type Type } from '@angular/core';
import { Pt } from '@pretickt/components/context';

const GAP = 8;

/** The company a link points to — its page `/stocks/<t>/` and nothing else — as a ticker, or null. */
export function companyOf(el: Element | null): string | null {
  const m = /^\/stocks\/([a-z0-9.]{1,12})\/$/.exec(el?.getAttribute('href') ?? '');
  return m ? m[1]!.toUpperCase() : null;
}

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

/** What a hover card needs from the card component: its inputs and when its data is in. */
export interface CardComponent { ready: () => { settled: boolean; available: boolean } }
export interface CardOptions {
  /** The card component, loaded on first use (`tag@version` names it in the beacon). */
  load: () => Promise<Type<CardComponent>>;
  id: string;
  /** A device with a mouse (`(hover: hover) and (pointer: fine)`); touch screens follow the link instead. */
  hover: boolean;
  /** The company of a company page: its own links open no card. */
  subject?: string;
  openMs?: number;
  closeMs?: number;
  /** After a card fails to load (typically the API's rate limit), cards pause this long and links show their text tooltips. */
  pauseMs?: number;
}
export interface Cards { active(): boolean }

/**
 * Hovering a company link (any `/stocks/<t>/` link but the page's own company) opens the company card, compact, in a floating panel
 * outside the page markup: after a moment (a passing pointer opens nothing), with the link's tooltip rows as its footer. The panel
 * stays while the pointer is on the link or on it, closes a moment after leaving or on Escape; one at a time. The card is mounted in
 * the page's own app (its calls share the page's answers); a card whose data cannot load is not shown and cards pause.
 */
export function attachCards(doc: Document, appRef: ApplicationRef, o: CardOptions): Cards {
  const win = doc.defaultView;
  if (!o.hover || !win) return { active: () => false };
  const subject = o.subject?.toUpperCase();
  let link: Element | null = null, panel: HTMLElement | null = null, ref: ComponentRef<CardComponent> | null = null, env: EnvironmentInjector | null = null;
  let openTimer = 0, closeTimer = 0, pausedUntil = 0;
  const paused = () => win.performance.now() < pausedUntil;

  const linkOf = (t: EventTarget | null): Element | null => {
    const a = (t as Element | null)?.closest?.('a[href]') ?? null;
    if (a?.closest('.pt-header')) return null; // the header's search results: a card would cover the list
    const ticker = companyOf(a);
    return ticker && ticker !== subject ? a : null;
  };
  /** Removes the open panel; a card about to open (the next link) is left alone. */
  const teardown = () => {
    win.clearTimeout(closeTimer);
    if (ref) { appRef.detachView(ref.hostView); ref.destroy(); }
    env?.destroy();
    panel?.remove();
    ref = null; env = null; panel = null; link = null;
  };
  /** Escape, a new card: nothing stays open or about to open. */
  const close = () => { win.clearTimeout(openTimer); teardown(); };
  const closeSoon = () => { win.clearTimeout(closeTimer); closeTimer = win.setTimeout(teardown, o.closeMs ?? 250); };

  async function open(a: Element) {
    close();
    link = a;
    const ticker = companyOf(a)!;
    const p = doc.createElement('div');
    p.className = 'pt-hovercard';
    p.setAttribute('data-island', o.id); // names the card in the beacon
    const loading = doc.createElement('div');
    loading.className = 'pt-hovercard-loading';
    loading.textContent = `${ticker} …`;
    p.append(loading);
    p.addEventListener('pointerenter', () => win!.clearTimeout(closeTimer));
    p.addEventListener('pointerleave', closeSoon);
    doc.body.append(p);
    place(p, a, win!);
    panel = p;
    try {
      const Card = await o.load();
      if (panel !== p) return; // closed, or another card opened meanwhile
      const host = doc.createElement('div');
      const mine = createEnvironmentInjector([Pt], appRef.injector);
      env = mine;
      const card = createComponent(Card, { environmentInjector: mine, hostElement: host });
      card.setInput('ticker', ticker);
      card.setInput('size', 'compact');
      card.setInput('extra', rowsOf(a.getAttribute('data-tip')));
      appRef.attachView(card.hostView);
      ref = card;
      card.changeDetectorRef.detectChanges(); // its calls start
      const pt = mine.get(Pt);
      const shown = await new Promise<boolean>((done) => {
        const watch = effect(() => {
          const r = card.instance.ready();
          if (pt.failed()) { watch.destroy(); done(false); } else if (r.settled) { watch.destroy(); done(r.available); }
        }, { injector: mine });
      });
      if (panel !== p) return;
      if (!shown) throw new Error('card data');
      p.replaceChildren(host);
      card.changeDetectorRef.detectChanges();
      place(p, a, win!);
      p.addEventListener('click', () => win!.setTimeout(() => { if (panel === p) place(p, a, win!); }, 0)); // "Show all" changes its height
      p.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'hover' } }));
    } catch {
      pausedUntil = win!.performance.now() + (o.pauseMs ?? 60_000); // most likely the rate limit: stop asking for a while
      if (panel === p) close();
    }
  }

  doc.addEventListener('pointerover', (e) => {
    const a = linkOf(e.target);
    if (!a || paused()) return;
    if (a === link) { win.clearTimeout(closeTimer); return; }
    win.clearTimeout(openTimer);
    openTimer = win.setTimeout(() => void open(a), o.openMs ?? 250);
  });
  doc.addEventListener('pointerout', (e) => {
    const a = linkOf(e.target);
    if (!a || a.contains((e as PointerEvent).relatedTarget as Node | null)) return; // still inside the link
    win.clearTimeout(openTimer); // left before it opened
    if (a === link) closeSoon();
  });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { active: () => !paused() };
}

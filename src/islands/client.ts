import type { Component } from 'vue';
import { needPath } from '../api';
import { createPt } from '../context/pt';
import { sendBeacon, startBeacon, type Send } from './beacon';
import { readPage } from './page';
import { islandApp } from './server';
import { attachCards, cardsOn, companyOf } from './cards';
import { attachTips } from './tips';

export interface HydrateOptions {
  importer?: (url: string) => Promise<{ default: Component }>;
  fetchImpl?: (url: string) => Promise<Response>;
  send?: Send;
  /** Company cards on hover: the device test (default: matchMedia) and the delays, for tests. */
  cards?: { hover?: boolean; openMs?: number; closeMs?: number };
}

/** What starts a new interaction in an island. */
const INTERACTIONS = ['pointerdown', 'keydown', 'click', 'input', 'change'] as const;

/**
 * The page runtime: hydrate every island with its component, replaying the calls the build recorded (no network on first paint);
 * later calls go to `/v1/t`. One `pt` per island (latest wins stays per island, between its interactions), one cache per page. A
 * request that fails leaves the island as it was, with a notice. One island that fails to load or hydrate never stops the others.
 */
export async function hydrateIslands(doc: Document = document, o: HydrateOptions = {}) {
  const page = readPage(doc);
  if (!page) return;
  const importer = o.importer ?? ((u: string) => import(/* @vite-ignore */ u) as Promise<{ default: Component }>);
  const fetchImpl = o.fetchImpl ?? ((u: string) => fetch(u));
  startBeacon(doc, page.api, o.send ?? sendBeacon);
  const cache = new Map<string, Promise<unknown>>();
  const resolve = async (t: string, params: unknown) => {
    const r = await fetchImpl(`${page.api}${needPath({ t: t as `${string}@${number}`, params }, page.buildId)}`);
    if (!r.ok) throw new Error(`api ${r.status}`);
    return r.json(); // the API validated it (and the browser does not ship the schemas)
  };
  const hover = o.cards?.hover ?? !!doc.defaultView?.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  attachCards(doc, page, { importer, resolve, cache, replay: page.calls, hover, openMs: o.cards?.openMs, closeMs: o.cards?.closeMs });
  // where cards open, a company link shows its card instead of its text tooltip
  const skip = cardsOn(page, hover) ? (t: Element) => companyOf(t.closest('a[href]')) !== null : undefined;
  await Promise.all([...doc.querySelectorAll<HTMLElement>('[data-island]')].map(async (island) => {
    if (island.parentElement?.closest('[data-island]')) return; // an island inside a component's markup is not an island
    const id = island.getAttribute('data-island')!;
    const url = page.components[id];
    const root = island.querySelector<HTMLElement>(':scope > .pt-island-app');
    if (!url || !root) return;
    try {
      const props = JSON.parse(island.getAttribute('data-props') ?? '{}') as Record<string, unknown>;
      const { default: component } = await importer(url);
      attachTips(island, (action) => island.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action } })), skip);
      // Hydration finishes when the component's top-level awaits resolve (replayed data); until then it is the static HTML.
      // A component that throws is unmounted and its server HTML put back: a page never loses content to a client error.
      const serverHtml = root.innerHTML;
      // "latest wins" compares interactions: every press inside the island starts a new one
      let interaction = 0;
      for (const ev of INTERACTIONS) island.addEventListener(ev, () => { interaction++; }, { capture: true });
      await new Promise<void>((done) => {
        // a request that fails keeps the island as it is and shows the notice (ds.css) until the next answer; one that fails
        // before the island has hydrated leaves it static (its server HTML) instead of holding the page runtime
        const status = (s: 'ok' | 'failed') => { island.classList.toggle('pt-island-error', s === 'failed'); if (s === 'failed') done(); };
        const app = islandApp(component, props, createPt({ resolve, replay: page.calls, cache, epoch: () => interaction, status }), done);
        app.config.errorHandler = (err) => {
          console.error(`island ${id}:`, err);
          try { app.unmount(); } catch { /* already gone */ }
          root.innerHTML = serverHtml;
          done();
        };
        app.mount(root);
      });
    } catch (e) {
      console.error(`island ${id}:`, e); // the server HTML stays as it is
    }
  }));
}

// for runtimes that mount a component without a page around it (the admin's draft preview)
export { islandApp } from './server';
export { attachTips } from './tips';

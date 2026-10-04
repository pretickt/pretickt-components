import { LitElement, html, svg } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { elementName } from '../sdk/define';
import { classFor } from '../sdk/element';
import { needKey, stableStringify } from '../sdk/key';
import type { ComponentModule, HostApi, Need } from '../sdk/types';
import { getTypology } from '../typologies';

export interface PageData { buildId: string; api: string; data: Record<string, unknown>; components: Record<string, string> }
interface Mount { c: string; p: unknown; k: Record<string, string> }

const lit = { LitElement, html, svg, unsafeHTML };

export function createHost(page: PageData, fetchImpl: typeof fetch = (...a) => fetch(...a)): HostApi {
  const cache = new Map<string, Promise<unknown>>(Object.entries(page.data).map(([k, v]) => [k, Promise.resolve(v)]));
  return {
    resolve(need: Need) {
      const t = getTypology(need.t);
      if (!t) return Promise.reject(new Error(`unknown typology ${need.t}`));
      if (!t.params.safeParse(need.params).success) return Promise.reject(new Error(`invalid params for ${need.t}`));
      const key = needKey(need);
      const hit = cache.get(key);
      if (hit) return hit;
      const url = `${page.api}/v1/t/${encodeURIComponent(need.t)}?p=${encodeURIComponent(stableStringify(need.params))}&b=${encodeURIComponent(page.buildId)}`;
      const p = fetchImpl(url).then(async (r) => {
        if (!r.ok) throw new Error(`api ${r.status}`);
        return t.payload.parse(await r.json());
      });
      cache.set(key, p);
      p.catch(() => cache.delete(key));
      return p;
    },
  };
}

export type Send = (url: string, body: string) => void;
const sendBeacon: Send = (url, body) => { try { navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' })); } catch { /* analytics never breaks a page */ } };

/** First-party analytics: one page view, then each component+action once per page view. No cookies, no identifiers. */
function startBeacon(doc: Document, api: string, send: Send) {
  const p = doc.location?.pathname ?? '/';
  let r = '';
  try { const ref = new URL(doc.referrer); r = ref.host === doc.location.host ? '' : ref.host; } catch { /* no referrer */ }
  send(`${api}/v1/e`, JSON.stringify({ t: 'pv', p, r }));
  const seen = new Set<string>();
  doc.addEventListener('pt-interact', (e) => {
    const d = (e as CustomEvent<{ component?: string; action?: string }>).detail ?? {};
    const k = `${d.component}|${d.action}`;
    if (!d.component || !d.action || seen.has(k)) return;
    seen.add(k);
    send(`${api}/v1/e`, JSON.stringify({ t: 'ix', p, c: d.component, a: d.action }));
  });
}

export async function boot(doc: Document = document, importer: (url: string) => Promise<unknown> = (u) => import(/* @vite-ignore */ u), send: Send = sendBeacon) {
  // Page data lives in <head>: component markup is in <body>, so nothing a component renders can stand in for it.
  const dataEl = doc.head?.querySelector('script#pt-data[type="application/json"]');
  if (!dataEl?.textContent) return;
  const page = JSON.parse(dataEl.textContent) as PageData;
  startBeacon(doc, page.api, send);
  const host = createHost(page);
  const byComponent = new Map<string, HTMLElement[]>();
  for (const el of doc.querySelectorAll<HTMLElement>('[data-pt]')) {
    if (el.parentElement?.closest('[data-pt]')) continue; // a mount inside a component's markup is not a component
    let m: Mount;
    try { m = JSON.parse(el.dataset.pt!) as Mount; } catch { continue; } // one broken mount must not stop the page
    byComponent.set(m.c, [...(byComponent.get(m.c) ?? []), el]);
    // Set before the element is defined: Lit restores pre-upgrade properties on its first update.
    Object.assign(el, { params: m.p, data: Object.fromEntries(Object.entries(m.k).map(([name, key]) => [name, page.data[key] ?? null])) });
  }
  await Promise.all([...byComponent.keys()].map(async (c) => {
    const url = page.components[c];
    if (!url) return;
    const mod = (await importer(url)) as ComponentModule;
    const name = elementName(mod.manifest);
    if (!customElements.get(name)) customElements.define(name, classFor(lit, mod, host));
  }));
}

if (typeof document !== 'undefined' && !(globalThis as { __PT_NO_BOOT__?: boolean }).__PT_NO_BOOT__) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot());
  else void boot();
}

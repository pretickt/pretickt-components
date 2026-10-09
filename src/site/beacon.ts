export type Send = (url: string, body: string) => void;

/** keepalive survives the page unloading like sendBeacon, but `credentials: 'omit'` keeps any cookie off analytics events. */
export const sendBeacon: Send = (url, body) => {
  try { void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'application/json' } }).catch(() => undefined); }
  catch { /* analytics never breaks a page */ }
};

/**
 * First-party analytics: one page view, then each component + action once per page view. Components (and the design-system
 * primitives) dispatch `pt-interact` with `{ action }`; the component is the island it happened in (or a `data-beacon` part of the
 * page shell). No cookies, no identifiers.
 */
export function startBeacon(doc: Document, api: string, send: Send) {
  const p = doc.location?.pathname ?? '/';
  let r = '';
  try { const ref = new URL(doc.referrer); r = ref.host === doc.location.host ? '' : ref.host; } catch { /* no referrer */ }
  send(`${api}/v1/e`, JSON.stringify({ t: 'pv', p, r }));
  const seen = new Set<string>();
  doc.addEventListener('pt-interact', (e) => {
    const action = (e as CustomEvent<{ action?: string }>).detail?.action;
    // a placement (data-island), or a part of the page shell that counts itself (data-beacon: the header's search)
    const at = (e.target as Element | null)?.closest?.('[data-island], [data-beacon]');
    const component = at?.getAttribute('data-island') ?? at?.getAttribute('data-beacon');
    const k = `${component}|${action}`;
    if (!component || !action || seen.has(k)) return;
    seen.add(k);
    send(`${api}/v1/e`, JSON.stringify({ t: 'ix', p, c: component, a: action }));
  });
}

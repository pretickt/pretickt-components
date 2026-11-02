import type { CheckState, HumanCheck } from '../../alerts/token';

/** Cloudflare's script, from its own address only (a copy breaks with their updates), drawing a widget when asked. */
export const TURNSTILE_JS = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
interface Turnstile {
  render(el: HTMLElement, params: Record<string, unknown>): string | null | undefined;
  reset(id: string): void;
  remove(id: string): void;
}

const loading = new WeakMap<Document, Promise<Turnstile>>();
/** The script, once a page: one that cannot load (blocked, offline) rejects, and the next widget tries again. */
function load(doc: Document): Promise<Turnstile> {
  const win = doc.defaultView as (Window & { turnstile?: Turnstile }) | null;
  if (win?.turnstile) return Promise.resolve(win.turnstile);
  let p = loading.get(doc);
  if (!p) {
    p = new Promise<Turnstile>((ok, no) => {
      const s = doc.createElement('script');
      s.src = TURNSTILE_JS;
      s.async = true;
      s.onload = () => (win?.turnstile ? ok(win.turnstile) : no(new Error('turnstile')));
      s.onerror = () => no(new Error('turnstile'));
      doc.head.append(s);
    });
    loading.set(doc, p);
    p.catch(() => loading.delete(doc));
  }
  return p;
}

/**
 * The editor's human check on www (spec §4, Romeo 2026-11-02): Cloudflare Turnstile for the alerts' action, invisible unless
 * Cloudflare asks for a tap, in English as the site. Each fresh token goes to `on`; one that expires, or a check that cannot run,
 * sends none (Turnstile retries by itself, and refreshes an expired token).
 */
export function turnstileCheck(sitekey: string): HumanCheck {
  return {
    mount(el, on) {
      let api: Turnstile | null = null, id: string | null = null, gone = false;
      const none = (failed: boolean): CheckState => ({ token: null, failed });
      load(el.ownerDocument).then((t) => {
        if (gone) return;
        api = t;
        id = t.render(el, {
          sitekey, action: 'alert', appearance: 'interaction-only', size: 'flexible', language: 'en', 'response-field': false,
          callback: (token: string) => on({ token }),
          'expired-callback': () => on(none(false)),
          'timeout-callback': () => on(none(false)),
          'error-callback': () => on(none(true)),
        }) ?? null;
      }, () => { if (!gone) on(none(true)); });
      return {
        reset: () => { if (api && id) { on(none(false)); api.reset(id); } },
        remove: () => { gone = true; if (api && id) api.remove(id); },
      };
    },
  };
}

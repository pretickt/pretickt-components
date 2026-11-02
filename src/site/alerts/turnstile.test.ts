import { describe, expect, it } from 'vitest';
import type { CheckState } from '../../alerts/token';
import { TURNSTILE_JS, turnstileCheck } from './turnstile';

type Params = Record<string, unknown> & { callback(t: string): void; 'expired-callback'(): void; 'timeout-callback'(): void; 'error-callback'(c: string): void };
/** Cloudflare's `window.turnstile`, recording what the check asks of it. */
function fakeTurnstile() {
  const rendered: { el: unknown; params: Params }[] = [], reset: string[] = [], removed: string[] = [];
  const api = {
    render: (el: unknown, params: Params) => { rendered.push({ el, params }); return `w${rendered.length}`; },
    reset: (id: string) => { reset.push(id); },
    remove: (id: string) => { removed.push(id); },
  };
  return { api, rendered, reset, removed };
}
/** A page: its window (with or without Turnstile) and the scripts appended to its head. */
function page(turnstile?: unknown) {
  const scripts: { src: string; async: boolean; onload?: () => void; onerror?: () => void }[] = [];
  const win: Record<string, unknown> = turnstile ? { turnstile } : {};
  const doc = { defaultView: win, createElement: () => ({ src: '', async: false }), head: { append: (s: never) => { scripts.push(s); } } };
  const el = () => ({ ownerDocument: doc }) as unknown as HTMLElement;
  return { win, scripts, el };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("the editor's human check on www (Cloudflare Turnstile)", () => {
  it("draws Cloudflare's widget for the alerts' action, invisible unless Cloudflare asks for a tap, and hands over each token", async () => {
    const t = fakeTurnstile(), p = page(t.api), got: CheckState[] = [];
    const el = p.el();
    turnstileCheck('site-key').mount(el, (s) => got.push(s));
    await tick();
    expect(t.rendered).toHaveLength(1);
    expect(t.rendered[0]!.el).toBe(el);
    expect(t.rendered[0]!.params).toMatchObject({ sitekey: 'site-key', action: 'alert', appearance: 'interaction-only', size: 'flexible',
      language: 'en', 'response-field': false });
    const cb = t.rendered[0]!.params;
    cb.callback('tok-1');
    cb['expired-callback']();
    cb.callback('tok-2');
    cb['timeout-callback']();
    cb['error-callback']('600010');
    expect(got).toEqual([{ token: 'tok-1' }, { token: null, failed: false }, { token: 'tok-2' }, { token: null, failed: false }, { token: null, failed: true }]);
    expect(p.scripts).toHaveLength(0);                     // Turnstile already on the page: no second script
  });

  it("loads Cloudflare's script once a page, from its own address; one that cannot load fails the check, and is tried again", async () => {
    const p = page(), a: CheckState[] = [], b: CheckState[] = [];
    turnstileCheck('k').mount(p.el(), (s) => a.push(s));
    turnstileCheck('k').mount(p.el(), (s) => b.push(s));
    expect(p.scripts).toHaveLength(1);
    expect(p.scripts[0]).toMatchObject({ src: TURNSTILE_JS, async: true });
    expect(TURNSTILE_JS).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    p.scripts[0]!.onerror!();
    await tick();
    expect(a).toEqual([{ token: null, failed: true }]);
    expect(b).toEqual([{ token: null, failed: true }]);
    // the next widget tries again; this time the script arrives
    const t = fakeTurnstile(), c: CheckState[] = [];
    turnstileCheck('k').mount(p.el(), (s) => c.push(s));
    expect(p.scripts).toHaveLength(2);
    p.win['turnstile'] = t.api;
    p.scripts[1]!.onload!();
    await tick();
    expect(t.rendered).toHaveLength(1);
    expect(c).toEqual([]);
  });

  it('reset asks for a fresh token (the last one is spent); remove takes the widget away, also when the script comes after', async () => {
    const t = fakeTurnstile(), p = page(t.api), got: CheckState[] = [];
    const w = turnstileCheck('k').mount(p.el(), (s) => got.push(s));
    await tick();
    t.rendered[0]!.params.callback('tok');
    w.reset();
    expect(t.reset).toEqual(['w1']);
    expect(got).toEqual([{ token: 'tok' }, { token: null, failed: false }]);
    w.remove();
    expect(t.removed).toEqual(['w1']);

    const late = page(), t2 = fakeTurnstile();
    const w2 = turnstileCheck('k').mount(late.el(), () => {});
    w2.remove();
    late.win['turnstile'] = t2.api;
    late.scripts[0]!.onload!();
    await tick();
    expect(t2.rendered).toHaveLength(0);
  });
});

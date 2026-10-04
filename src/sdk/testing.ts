/** Test helpers for the SDK and the components (not a public entry point, not importable by components). */
import { LitElement, html, svg } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import * as z from 'zod/mini';
import { Ticker } from '../typologies';
import { defineComponent } from './define';
import type { LitKit } from './element';
import type { Need } from './types';

export const lit: LitKit = { LitElement, html, svg, unsafeHTML };

/** A one-need manifest (`m`: metric@1 of the ticker) for tests that need any valid component. */
export const probeManifest = (tag = 'pt-probe') => defineComponent({
  tag, version: '1.0.0', need: { question: 'q', evidence: [] },
  params: z.object({ ticker: Ticker }), user: [], uses: [],
  needs: (p) => ({ m: { t: 'metric@1', params: { ticker: p.ticker, metrics: ['pe'] } } }),
});

/** A host whose requests settle on demand: `release(match, value)` / `fail(match)` the pending ones whose params contain `match`. */
export function controlledHost() {
  const pending = new Map<string, { p: Promise<unknown>; r: (v: unknown) => void; f: (e: Error) => void }>();
  return {
    host: { resolve: (n: Need) => {
      const k = JSON.stringify(n.params);
      if (!pending.has(k)) { let r!: (v: unknown) => void, f!: (e: Error) => void; const p = new Promise((res, rej) => { r = res; f = rej; }); pending.set(k, { p, r, f }); }
      return pending.get(k)!.p; // like the real host: one promise per key
    } },
    release: (match: string, value: unknown) => { for (const [k, x] of pending) if (k.includes(match)) x.r(value); },
    fail: (match: string) => { for (const [k, x] of pending) if (k.includes(match)) x.f(new Error('down')); },
  };
}

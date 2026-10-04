// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { LitElement, html, svg } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { defineComponent, helpers as h, type ComponentModule, type Need } from './index';
import { classFor } from './element';

/** A component whose single need depends on `t`, so each patch fetches; it prints what it shows. */
const mod: ComponentModule = {
  manifest: defineComponent({
    tag: 'pt-race-probe', version: '1.0.0', need: { question: 'probe', evidence: ['test'] },
    params: z.object({ t: z.string(), range: z._default(z.string(), '1y') }), user: [], uses: [],
    needs: (p) => ({ m: { t: 'metric@1', params: { ticker: p.t, metrics: ['pe'] } }, s: { t: 'price-series@1', params: { tickers: ['X'], range: p.range } } }),
  }),
  renderStatic: (d: Record<string, unknown>, p: { t: string; range: string }) =>
    `<p class="shows">${h.esc(p.t)}|${h.esc(p.range)}|${h.esc(String(d.m))}|${h.esc(String(d.s))}</p><span class="tipped" ${h.tip({ A: 'b' })}>x</span>`,
};
const lit = { LitElement, html, svg, unsafeHTML };

/** Resolves on demand: `release(match)` settles the requests whose params contain `match`. Like the real host, one promise per key. */
function controlledHost() {
  const pending = new Map<string, { p: Promise<unknown>; r: (v: unknown) => void }>();
  return {
    host: { resolve: (n: Need) => {
      const k = JSON.stringify(n.params);
      if (!pending.has(k)) { let r!: (v: unknown) => void; const p = new Promise((res) => { r = res; }); pending.set(k, { p, r }); }
      return pending.get(k)!.p;
    } },
    release: (match: string, value: unknown) => { for (const [k, x] of pending) if (k.includes(match)) x.r(value); },
  };
}
let seq = 0;
async function mount(host: { resolve: (n: Need) => Promise<unknown> }) {
  const name = `pt-race-probe-v1-t${seq++}`;
  customElements.define(name, classFor(lit, mod, host));
  const el = document.createElement(name) as HTMLElement & { params: unknown; data: unknown; updateComplete: Promise<boolean>; setParams(p: object): Promise<void> };
  el.params = { t: 'MSFT', range: '1y' };
  el.data = { m: 'm-MSFT', s: 's-1y' };
  document.body.append(el);
  await el.updateComplete;
  return el;
}
const shows = (el: HTMLElement) => el.querySelector('.shows')!.textContent;
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('base element', () => {
  it('the newest params win even when an older request finishes last', async () => {
    const { host, release } = controlledHost();
    const el = await mount(host);
    const a = el.setParams({ t: 'AAPL' });
    const b = el.setParams({ t: 'AMD' });
    release('AMD', 'm-AMD');
    await b; await el.updateComplete;
    release('AAPL', 'm-AAPL');
    await a; await el.updateComplete;
    expect(shows(el)).toBe('AMD|1y|m-AMD|s-1y');
  });
  it('two patches on different needs build on each other: data and params never disagree', async () => {
    const { host, release } = controlledHost();
    const el = await mount(host);
    const a = el.setParams({ range: '5y' });
    const b = el.setParams({ t: 'AMD' });
    release('5y', 's-5y'); release('AMD', 'm-AMD');
    await Promise.all([a, b]); await el.updateComplete;
    expect(shows(el)).toBe('AMD|5y|m-AMD|s-5y');
    expect(el.hasAttribute('busy')).toBe(false);
  });
  it('tooltips keep working after a re-render', async () => {
    const { host, release } = controlledHost();
    const el = await mount(host);
    const p = el.setParams({ t: 'AMD' });
    release('AMD', 'm-AMD');
    await p; await el.updateComplete; await tick();
    el.querySelector('.tipped')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    const tip = el.querySelector('.pt-tip') as HTMLElement | null;
    expect(tip).not.toBeNull();
    expect(tip!.hidden).toBe(false);
    expect(tip!.textContent).toContain('A b');
  });
});

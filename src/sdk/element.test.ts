// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { LitElement, html, svg } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import * as z from 'zod/mini';
import { defineComponent } from './define';
import { classFor } from './element';
import { checkParity } from './parity';
import type { ComponentModule, Kit } from './types';
import { Ticker } from '../typologies';

const lit = { LitElement, html, svg, unsafeHTML };
const manifest = defineComponent({
  tag: 'pt-probe', version: '1.0.0', need: { question: 'q', evidence: [] },
  params: z.object({ ticker: Ticker }), user: [], uses: [],
  needs: (p) => ({ m: { t: 'metric@1', params: { ticker: p.ticker, metrics: ['pe'] } } }),
});
const mod: ComponentModule = {
  manifest,
  renderStatic: (d, p, h) =>
    `<p ${h.tip({ Ticker: (p as { ticker: string }).ticker })}>${h.esc((p as { ticker: string }).ticker)}:${d.m ? 'ok' : 'na'}</p>` +
    `<button data-set='{"ticker":"MSFT"}'>MSFT</button>`,
};

let n = 0;
async function mount(host = { resolve: vi.fn(async () => [{ key: 'pe' }]) }) {
  const name = `pt-probe-t${n++}`;
  customElements.define(name, classFor(lit, mod, host));
  const wrap = document.createElement('div');
  wrap.innerHTML = `<${name}><p>NVDA:ok</p><button>MSFT</button></${name}>`;
  document.body.append(wrap);
  const el = wrap.firstElementChild as HTMLElement & { params: unknown; data: Record<string, unknown>; updateComplete: Promise<boolean> };
  el.params = { ticker: 'NVDA' };
  el.data = { m: [{ key: 'pe' }] };
  await el.updateComplete;
  return { el, host };
}

describe('makeBase', () => {
  it('an element factory extends PtElement without casts and sees its API', async () => {
    const seen: unknown[] = [];
    const custom: ComponentModule = { ...mod, element: ({ PtElement }: Kit<HTMLElement>) => class extends PtElement {
      firstUpdated() { super.firstUpdated(); seen.push(this.params, typeof this.setParams, this.busy, this.tagName); }
    } };
    customElements.define('pt-probe-kit', classFor(lit, custom, { resolve: async () => null }));
    const el = document.createElement('pt-probe-kit') as HTMLElement & { params: unknown; updateComplete: Promise<boolean> };
    el.params = { ticker: 'NVDA' };
    document.body.append(el);
    await el.updateComplete;
    expect(seen).toEqual([{ ticker: 'NVDA' }, 'function', false, 'PT-PROBE-KIT']);
  });
  it('renders in light DOM and replaces the static markup instead of duplicating it', async () => {
    const { el } = await mount();
    expect(el.shadowRoot).toBeNull();
    expect(el.querySelectorAll('p')).toHaveLength(1);
    expect(el.textContent).toContain('NVDA:ok');
  });
  it('re-resolves only the changed need on [data-set] and updates params with data', async () => {
    const { el, host } = await mount();
    el.querySelector('button')!.click();
    await vi.waitFor(() => expect(el.textContent).toContain('MSFT:ok'));
    expect(host.resolve).toHaveBeenCalledTimes(1);
    expect(host.resolve).toHaveBeenCalledWith({ t: 'metric@1', params: { ticker: 'MSFT', metrics: ['pe'] } });
  });
  it('sets the error attribute and keeps old data when the host fails', async () => {
    const { el } = await mount({ resolve: vi.fn(async () => { throw new Error('down'); }) });
    el.querySelector('button')!.click();
    await vi.waitFor(() => expect(el.hasAttribute('error')).toBe(true));
    expect(el.textContent).toContain('NVDA:ok');
  });
  it('shows a text-only tooltip for [data-tip]', async () => {
    const { el } = await mount();
    el.querySelector('p')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    const tip = el.querySelector('.pt-tip') as HTMLElement;
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain('Ticker NVDA');
  });
  it('checkParity passes for the default element', async () => {
    expect(await checkParity(lit, mod, [{ ticker: 'NVDA' }])).toEqual([]);
  });
  it('checkParity catches an element whose render diverges', async () => {
    const bad: ComponentModule = { ...mod, element: (kit: Kit<HTMLElement>) => class extends kit.PtElement { render() { return kit.html`<p>different</p>`; } } };
    expect((await checkParity(lit, bad, [{ ticker: 'NVDA' }])).join('\n')).toMatch(/parity/);
  });
  it('checkParity reads the module samples by default and fails a module that declares none', async () => {
    expect(await checkParity(lit, { ...mod, samples: [{ ticker: 'NVDA' }] })).toEqual([]);
    expect(await checkParity(lit, mod)).toEqual(['pt-probe: declares no samples, so nothing can be checked']);
  });
});

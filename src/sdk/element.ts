import type { LitElement as LitElementType, PropertyValues } from 'lit';
import { helpers } from './helpers';
import { needKey } from './key';
import type { ComponentModule, HostApi, Kit, Need } from './types';

export interface LitKit {
  LitElement: typeof LitElementType;
  html: Kit['html'];
  svg: Kit['svg'];
  unsafeHTML: Kit['unsafeHTML'];
}

export function makeBase(lit: LitKit, mod: ComponentModule, host: HostApi) {
  const { LitElement, unsafeHTML } = lit;

  return class PtElement extends LitElement {
    static properties = {
      data: { attribute: false },
      params: { attribute: false },
      user: { attribute: false },
      error: { type: Boolean, reflect: true },
      busy: { type: Boolean, reflect: true },
    };
    data: Record<string, unknown> = {};
    params: unknown = {};
    user: Record<string, unknown> = {};
    error = false;
    busy = false;

    /** Light DOM: the design system's global CSS applies. */
    createRenderRoot() { return this; }

    /** The static markup from the build is replaced on the first render, never duplicated. */
    protected update(changed: PropertyValues) {
      if (!this.hasUpdated) this.replaceChildren();
      super.update(changed);
    }

    render() { return unsafeHTML(mod.renderStatic(this.data, this.params, helpers)); }

    protected firstUpdated() {
      this.enableTips();
      this.addEventListener('click', (e) => {
        const t = (e.target as Element).closest?.('[data-set]');
        if (!t || !this.contains(t)) return;
        e.preventDefault();
        let patch: Record<string, unknown>;
        try { patch = JSON.parse(t.getAttribute('data-set')!); } catch { return; }
        void this.setParams(patch);
      });
    }

    /** Apply a params patch: resolve only the needs whose key changed, then swap data and params together. */
    async setParams(patch: Record<string, unknown>) {
      const parsed = mod.manifest.params.safeParse({ ...(this.params as object), ...patch });
      if (!parsed.success) return;
      const before = mod.manifest.needs(this.params as never);
      const after = mod.manifest.needs(parsed.data as never);
      const changed = Object.entries(after).filter(([k, n]) => !before[k] || needKey(before[k]!) !== needKey(n));
      this.busy = true;
      try {
        const got = await Promise.all(changed.map(async ([k, n]: [string, Need]) => [k, await host.resolve(n)] as const));
        this.data = { ...this.data, ...Object.fromEntries(got) };
        this.params = parsed.data;
        this.error = false;
      } catch {
        this.error = true;
      } finally {
        this.busy = false;
      }
    }

    private enableTips() {
      const tip = document.createElement('div');
      tip.className = 'pt-tip';
      tip.hidden = true;
      tip.setAttribute('role', 'tooltip');
      this.append(tip);
      const show = (e: Event) => {
        const t = (e.target as Element).closest?.('[data-tip]');
        if (!t || !this.contains(t)) return;
        let o: Record<string, unknown>;
        try { o = JSON.parse(t.getAttribute('data-tip')!); } catch { return; }
        tip.replaceChildren(...Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => {
          const row = document.createElement('div');
          const b = document.createElement('b');
          b.textContent = k;
          row.append(b, document.createTextNode(` ${String(v)}`));
          return row;
        }));
        const a = t.getBoundingClientRect();
        const h = this.getBoundingClientRect();
        tip.style.left = `${a.left - h.left + a.width / 2}px`;
        tip.style.top = `${a.top - h.top}px`;
        tip.hidden = false;
      };
      const hide = (e: Event) => { if ((e.target as Element).closest?.('[data-tip]')) tip.hidden = true; };
      this.addEventListener('pointerover', show);
      this.addEventListener('focusin', show);
      this.addEventListener('pointerout', hide);
      this.addEventListener('focusout', hide);
    }
  };
}

export function classFor(lit: LitKit, mod: ComponentModule, host: HostApi): CustomElementConstructor {
  const PtElement = makeBase(lit, mod, host);
  return mod.element ? mod.element({ PtElement, html: lit.html, svg: lit.svg, unsafeHTML: lit.unsafeHTML }) : PtElement;
}

import type { LitElement as LitElementType, PropertyValues } from 'lit';
import { helpers } from './helpers';
import { needKey } from './key';
import type { ComponentModule, HostApi, Kit, Need } from './types';
import { attachTips } from './tips';
import { FULL_VIEWPORT, isFullViewport, type Viewport } from './viewport';
import { attachZoom } from './zoom-controller';

export type LitKit = Omit<Kit, 'PtElement'> & { LitElement: typeof LitElementType };

export function makeBase(lit: LitKit, mod: ComponentModule, host: HostApi) {
  const { LitElement, unsafeHTML } = lit;

  return class PtElement extends LitElement {
    static properties = {
      data: { attribute: false },
      params: { attribute: false },
      error: { type: Boolean, reflect: true },
      busy: { type: Boolean, reflect: true },
    };
    /* `declare` + constructor defaults, not field initialisers: whoever bundles this TypeScript may compile with
       useDefineForClassFields, and a native field would shadow Lit's reactive accessor (assignments would never re-render). */
    declare data: Record<string, unknown>;
    declare params: unknown;
    declare error: boolean;
    declare busy: boolean;

    constructor() {
      super();
      this.data = {};
      this.params = {};
      this.error = false;
      this.busy = false;
    }

    /** Light DOM: the design system's global CSS applies. */
    createRenderRoot() { return this; }

    /** The static markup from the build is replaced on the first render, never duplicated. */
    protected update(changed: PropertyValues) {
      if (!this.hasUpdated) this.replaceChildren();
      super.update(changed);
    }

    render() { return unsafeHTML(mod.renderStatic(this.data, this.params, helpers)); }

    /** Tell the page what the reader did with this component; the host turns it into an analytics beacon (no cookies, no ids). */
    protected interact(action: string) {
      this.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, composed: true, detail: { component: `${mod.manifest.tag}@${mod.manifest.version}`, action } }));
    }

    private zoom: ReturnType<typeof attachZoom> | null = null;

    protected firstUpdated() {
      attachTips(this, (a) => this.interact(a));
      this.zoom = attachZoom(this, {
        view: () => (this.params as { view?: Viewport }).view ?? FULL_VIEWPORT,
        setView: (v) => {
          const { view: _old, ...rest } = this.params as Record<string, unknown>;
          this.params = isFullViewport(v) ? rest : { ...rest, view: v };
        },
        interact: (a) => this.interact(a),
      });
      // one delegate for the two kinds of no-code controls: data-view (zoom buttons) and data-set (params patches)
      this.addEventListener('click', (e) => {
        const t = (e.target as Element).closest?.('[data-view],[data-set]');
        if (!t || !this.contains(t)) return;
        if (t.hasAttribute('data-view')) { this.zoom?.control(t.getAttribute('data-view')); return; }
        e.preventDefault();
        let patch: Record<string, unknown>;
        try { patch = JSON.parse(t.getAttribute('data-set')!); } catch { return; }
        this.interact('set');
        void this.setParams(patch);
      });
    }

    /** Each view change replaces the svg: re-apply the axis hover state to the new one. */
    protected updated(changed: PropertyValues) {
      super.updated(changed);
      this.zoom?.sync();
    }

    /** Params of the newest pending patch: the next patch builds on them, so quick successive clicks compose. */
    private requested: Record<string, unknown> | null = null;
    private seq = 0;

    /**
     * Apply a params patch: resolve the needs whose key differs from what is shown, then swap data and params together. Only the
     * newest patch commits — an older request that finishes last is dropped — so data and params never disagree.
     */
    async setParams(patch: Record<string, unknown>) {
      // new data means a new chart: the zoom/pan view starts over
      const { view: _view, ...current } = (this.requested ?? this.params) as Record<string, unknown>;
      const parsed = mod.manifest.params.safeParse({ ...current, ...patch });
      if (!parsed.success) return;
      const seq = ++this.seq;
      this.requested = parsed.data as Record<string, unknown>;
      const before = mod.manifest.needs(this.params as never);
      const after = mod.manifest.needs(parsed.data as never);
      const changed = Object.entries(after).filter(([k, n]) => !before[k] || needKey(before[k]!) !== needKey(n));
      this.busy = true;
      try {
        const got = await Promise.all(changed.map(async ([k, n]: [string, Need]) => [k, await host.resolve(n)] as const));
        if (seq !== this.seq) return;
        this.data = { ...this.data, ...Object.fromEntries(got) };
        this.params = parsed.data;
        this.error = false;
      } catch {
        if (seq === this.seq) this.error = true;
      } finally {
        if (seq === this.seq) { this.busy = false; this.requested = null; }
      }
    }
  };
}

export function classFor(lit: LitKit, mod: ComponentModule, host: HostApi): CustomElementConstructor {
  const PtElement = makeBase(lit, mod, host);
  // the one cast: Lit's protected lifecycle methods are public in PtElementApi, which is what subclasses see
  const kit: Kit = { PtElement: PtElement as unknown as Kit['PtElement'], html: lit.html, svg: lit.svg, unsafeHTML: lit.unsafeHTML };
  return (mod.element ? mod.element(kit) : PtElement) as CustomElementConstructor;
}

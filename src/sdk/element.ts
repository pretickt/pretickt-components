import type { LitElement as LitElementType, PropertyValues } from 'lit';
import { helpers } from './helpers';
import { needKey } from './key';
import type { ComponentModule, HostApi, Kit, Need } from './types';
import {
  fitYViewport, FULL_VIEWPORT, isFullViewport, latestViewport, panViewport, scaleYViewport, shiftYViewport, zoomViewport, type Viewport,
} from './viewport';

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
      this.enableZoom();
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
      // new data means a new chart: the zoom/pan view starts over
      const { view: _view, ...current } = this.params as Record<string, unknown>;
      const parsed = mod.manifest.params.safeParse({ ...current, ...patch });
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

    /** Hover state of the axis strips survives re-renders (each view change replaces the svg). */
    private overAxis = false;
    private overTimeAxis = false;

    protected updated(changed: PropertyValues) {
      super.updated(changed);
      const svg = this.querySelector('svg[data-zoom]');
      svg?.classList.toggle('pt-over-axis', this.overAxis);
      svg?.classList.toggle('pt-over-taxis', this.overTimeAxis);
    }

    /**
     * TradingView-style zoom & pan for any component whose svg carries `data-zoom` (beta's ZoomPan directive):
     * the view lives in `params.view`, so renderStatic stays the only renderer and no data is fetched.
     * Listeners sit on the host, not the svg: every view change re-renders (replaces) the svg mid-gesture.
     */
    private enableZoom() {
      const svgOf = () => this.querySelector<SVGSVGElement>('svg[data-zoom]');
      const view = (): Viewport => ((this.params as { view?: Viewport }).view ?? FULL_VIEWPORT);
      const setView = (v: Viewport) => {
        const { view: _old, ...rest } = this.params as Record<string, unknown>;
        this.params = isFullViewport(v) ? rest : { ...rest, view: v };
      };
      const geo = (e: { clientX: number; clientY: number }) => {
        const svg = svgOf();
        if (!svg) return null;
        let zones = { px: 0.93, ty: 0.9 };
        try { zones = { ...zones, ...JSON.parse(svg.getAttribute('data-zoom') ?? '{}') }; } catch { /* defaults */ }
        const r = svg.getBoundingClientRect();
        const fx = r.width > 0 ? (e.clientX - r.left) / r.width : 0.5;
        const fy = r.height > 0 ? (e.clientY - r.top) / r.height : 0.5;
        const onAxis = fx >= zones.px;
        return { r, fx, onAxis, onTimeAxis: !onAxis && fy >= zones.ty };
      };
      const inSvg = (e: Event) => !!(e.target as Element).closest?.('svg[data-zoom]');
      let drag: { axis: boolean; taxis: boolean; anchor: number; x: number; y: number; moved: boolean } | null = null;

      this.addEventListener('wheel', (e) => {
        if (!inSvg(e)) return;
        const g = geo(e);
        if (!g) return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.25 : 0.8;
        setView(g.onAxis ? scaleYViewport(view(), factor) : zoomViewport(view(), g.fx, factor));
      }, { passive: false });

      this.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !inSvg(e)) return;
        const g = geo(e);
        if (!g) return;
        drag = { axis: g.onAxis, taxis: g.onTimeAxis, anchor: g.fx, x: e.clientX, y: e.clientY, moved: false };
        try { this.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      });

      this.addEventListener('pointermove', (e) => {
        const g = geo(e);
        if (!g) return;
        if (!drag) {
          const over = inSvg(e) && g.onAxis, overT = inSvg(e) && g.onTimeAxis;
          if (over !== this.overAxis || overT !== this.overTimeAxis) {
            this.overAxis = over;
            this.overTimeAxis = overT;
            const svg = svgOf();
            svg?.classList.toggle('pt-over-axis', over);
            svg?.classList.toggle('pt-over-taxis', overT);
          }
          const svg = svgOf();
          if (svg) svg.style.cursor = over ? 'ns-resize' : overT ? 'ew-resize' : 'crosshair';
          return;
        }
        const { r } = g;
        if (r.width === 0 || r.height === 0) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (drag.axis) {   // down stretches the price scale, up compresses it
          if (Math.abs(dy) < 1) return;
          drag.moved = true; drag.y = e.clientY;
          setView(scaleYViewport(view(), 1 + dy / r.height));
          return;
        }
        if (drag.taxis) {  // squeeze or stretch time around the grabbed point
          if (Math.abs(dx) < 1) return;
          drag.moved = true; drag.x = e.clientX;
          setView(zoomViewport(view(), drag.anchor, Math.max(0.5, Math.min(2, 1 - (2 * dx) / r.width))));
          return;
        }
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        drag.moved = true; drag.x = e.clientX; drag.y = e.clientY;
        let v = panViewport(view(), -dx / r.width);
        if ((view().yScale ?? 1) !== 1 && Math.abs(dy) >= 1) v = shiftYViewport(v, dy / r.height);
        setView(v);
      });

      const end = (e: Event) => {
        if (drag?.moved) e.stopPropagation(); // a real drag is not a click
        drag = null;
      };
      this.addEventListener('pointerup', end);
      this.addEventListener('pointercancel', end);
      this.addEventListener('pointerleave', () => {
        this.overAxis = this.overTimeAxis = false;
        svgOf()?.classList.remove('pt-over-axis', 'pt-over-taxis');
      });
      this.addEventListener('dblclick', (e) => { if (inSvg(e)) setView(FULL_VIEWPORT); });
      this.addEventListener('click', (e) => {
        const b = (e.target as Element).closest?.('[data-view]');
        if (!b || !this.contains(b)) return;
        const k = b.getAttribute('data-view');
        setView(k === 'fit' ? fitYViewport(view()) : k === 'latest' ? latestViewport(view()) : FULL_VIEWPORT);
      });
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
  return (mod.element ? mod.element({ PtElement, html: lit.html, svg: lit.svg, unsafeHTML: lit.unsafeHTML }) : PtElement) as CustomElementConstructor;
}

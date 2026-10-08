import { afterEveryRender, afterNextRender, Component, computed, ElementRef, inject, input, model } from '@angular/core';
import { svgId } from './format';
import { FULL_VIEWPORT, isAtLatest, isFullViewport, isYFitted, type Viewport } from './viewport';
import { attachZoom } from './zoom';

/**
 * A zoomable chart frame (beta's ZoomPan + ChartControls): the svg with its clip, the grab strips on the price (right) and time
 * (bottom) axes, your axes above the strips, the plot clipped, `front` unclipped, and the fit / today » / reset controls when there
 * is something to undo. Wheel/drag on the plot = time, on the right strip = price scale, on the bottom strip = time around the grab
 * point, double-click = reset. The view is two-way (`[(view)]`): read it in your geometry with applyXViewport / applyYViewport.
 * Project svg parts with `<svg:g ptAxes>`, `<svg:g ptPlot>`, `<svg:g ptFront>`, `<svg:g ptDefs>`, and html after the svg with `ptAfter`.
 */
@Component({
  selector: 'div[ptChart]',
  host: { class: 'pt-wrap' },
  template: `
    <svg class="pt-chart-svg" [attr.viewBox]="'0 0 ' + w() + ' ' + h()" role="img" [attr.aria-label]="label()" [attr.data-zoom]="zones()">
      <defs>
        <clipPath [attr.id]="clip()"><rect x="0" y="0" [attr.width]="plotW()" [attr.height]="plotH()" /></clipPath>
        <ng-content select="[ptDefs]" />
      </defs>
      <rect class="pt-taxis" x="0" [attr.y]="plotH()" [attr.width]="plotW()" [attr.height]="h() - plotH()" />
      <line class="pt-taxis-edge" x1="0" [attr.x2]="plotW()" [attr.y1]="plotH()" [attr.y2]="plotH()" />
      <text class="pt-taxis-hint" x="14" [attr.y]="h() - 6">⇔</text>
      <rect class="pt-axis-strip" [attr.x]="plotW()" y="0" [attr.width]="w() - plotW()" [attr.height]="h()" />
      <line class="pt-axis-edge" [attr.x1]="plotW()" [attr.x2]="plotW()" y1="0" [attr.y2]="h()" />
      <text class="pt-axis-hint" [attr.x]="(plotW() + w()) / 2" [attr.y]="h() - 6" text-anchor="middle">⇕</text>
      <ng-content select="[ptAxes]" />
      <g [attr.clip-path]="'url(#' + clip() + ')'"><ng-content select="[ptPlot]" /></g>
      <ng-content select="[ptFront]" />
    </svg>
    @if (controls().length) {
      <div class="pt-vctl">
        @for (c of controls(); track c.k) {
          <button type="button" class="pt-abtn" [class.pt-abtn-wide]="c.wide" [attr.data-view]="c.k" [attr.title]="c.title" (click)="control(c.k)">{{ c.label }}</button>
        }
      </div>
    }
    <ng-content select="[ptAfter]" />`,
})
export class PtChart {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly w = input.required<number>();
  readonly h = input.required<number>();
  readonly plotW = input.required<number>();
  readonly plotH = input.required<number>();
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly view = model<Viewport>(FULL_VIEWPORT);

  protected readonly clip = computed(() => `${svgId(this.id())}clip`);
  protected readonly zones = computed(() => JSON.stringify({ px: this.plotW() / this.w(), ty: this.plotH() / this.h() }));
  protected readonly controls = computed(() => {
    const v = this.view();
    if (isFullViewport(v)) return [];
    return [
      ...(isYFitted(v) ? [] : [{ k: 'fit', label: 'fit', title: 'Fit the price scale to what is in view — the time window stays where it is', wide: false }]),
      ...(isAtLatest(v) ? [] : [{ k: 'latest', label: 'today »', title: 'Back to the latest data, keeping the current zoom', wide: false }]),
      { k: 'reset', label: 'reset view', title: 'Back to the full view (or double-click the chart)', wide: true },
    ];
  });
  private zoom: ReturnType<typeof attachZoom> | undefined;

  constructor() {
    const host = this.el.nativeElement;
    const interact = (action: string) => host.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action } }));
    afterNextRender(() => { this.zoom = attachZoom(host, { view: () => this.view(), setView: (v) => this.view.set(v), interact }); });
    afterEveryRender(() => this.zoom?.sync()); // hover classes on the svg survive a re-render
  }

  protected control(k: string) { this.zoom?.control(k); }
}

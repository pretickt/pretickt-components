import { Component, input } from '@angular/core';

/** Time axis of a chart (`<svg:g ptAxes><svg:g ptTimeAxis …>`): one label per tick along the bottom strip, edge labels kept inside. */
@Component({
  selector: 'g[ptTimeAxis]',
  template: `@for (t of ticks(); track t.x) {
    <svg:text class="pt-axis" [attr.x]="t.x" [attr.y]="h() - 6" [attr.text-anchor]="t.x < 20 ? 'start' : t.x > plotW() - 20 ? 'end' : 'middle'">{{ t.label }}</svg:text>
  }`,
})
export class PtTimeAxis {
  readonly h = input.required<number>();
  readonly plotW = input.required<number>();
  readonly ticks = input.required<readonly { x: number; label: string }[]>();
}

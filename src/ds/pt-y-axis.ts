import { Component, input } from '@angular/core';
import { usd } from './format';

/** Price axis of a chart (`<svg:g ptAxes><svg:g ptYAxis …>`): a grid line per tick across the plot and the price label in the right-hand strip. */
@Component({
  selector: 'g[ptYAxis]',
  template: `@for (t of ticks(); track t.y) {
    <svg:line class="pt-grid" x1="0" [attr.x2]="plotW()" [attr.y1]="t.y" [attr.y2]="t.y" />
    <svg:text class="pt-axis" [attr.x]="w() - 4" [attr.y]="t.y + 3" text-anchor="end">{{ price(t.v) }}</svg:text>
  }`,
})
export class PtYAxis {
  readonly w = input.required<number>();
  readonly plotW = input.required<number>();
  readonly ticks = input.required<readonly { y: number; v: number }[]>();
  protected price = (v: number) => usd(v, { digits: Math.abs(v) >= 100 ? 0 : 2 });
}

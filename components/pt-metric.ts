/**
 * How does this stock look at a glance on the numbers investors check first?
 * @version 2.1.0
 * @evidence beta: the badge strip of the company page (25-metric catalogue)
 * @evidence video badges (pretickt-shorts DailyBrief)
 */
import { Component, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtBadge } from '@pretickt/components/ds';
import type { MetricKey } from '@pretickt/components/typologies';

@Component({
  selector: 'pt-metric',
  imports: [PtBadge],
  template: `
    @let items = metric.value();
    @if (items === null || items?.length === 0) {<p class="pt-na">Data not available</p>}
    @else if (items) {<ul class="pt-badges">@for (m of items; track m.key) {<li [ptBadge]="m"></li>}</ul>}`,
})
export class PtMetric {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly metrics = input.required<MetricKey[]>();
  protected readonly metric = this.pt.metric(() => ({ ticker: this.ticker(), metrics: this.metrics() }));
}

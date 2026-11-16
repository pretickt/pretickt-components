import { Component, computed, input } from '@angular/core';
import type { HoldingCtx, PortfolioCtx } from '@pretickt/components/context';
import { dayMonth, href, level, pct } from '../../ds/format';
import { backTo } from './lists';

/** Points as the basket prints them: "-0.44" (hundredths of a percent of the whole). */
const points = (p: number) => `${p < 0 ? '-' : '+'}${Math.abs(p * 100).toFixed(2)}`;

/** A fund's or a sector's company (pt-basket): its weight, its move and points of the whole that day, back to the fund or sector. */
@Component({
  selector: 'pt-ctx-holding',
  template: `
    <p class="pt-ctx-lead">{{ line() }}</p>
    <div class="pt-ctx-more"><p class="pt-ctx-go"><a [href]="back()">Back to {{ d().basket.name }} →</a></p></div>`,
})
export class PtCtxHolding {
  readonly d = input.required<HoldingCtx>();
  readonly from = input.required<string>();
  protected readonly back = computed(() => backTo(this.d().basket.href, this.from()));
  protected readonly line = computed(() => {
    const h = this.d(), head = `${level(h.weight)} of ${h.basket.name}`;
    if (h.ret == null) return head;
    return `${head} · moved ${pct(h.ret)} today${h.points == null ? '' : `, ${points(h.points)} points of the ${h.whole}`}`;
  });
}

/** Your portfolio (pt-basket's portfolio, the page's lists): your line's weight, move and points, the earnings date or the headline. */
@Component({
  selector: 'pt-ctx-portfolio',
  template: `
    @let p = d();
    <p class="pt-ctx-lead">{{ line() }}@if (p.headline; as h) { · <a [href]="href(h.url)" target="_blank" rel="nofollow noopener noreferrer">{{ h.title }}</a>}</p>
    <div class="pt-ctx-more"><p class="pt-ctx-go"><a href="/portfolio/">Back to your portfolio →</a></p></div>`,
})
export class PtCtxPortfolio {
  readonly d = input.required<PortfolioCtx>();
  protected readonly href = href;
  protected readonly line = computed(() => {
    const p = this.d();
    const move = p.ret == null ? '' : `${pct(p.ret)} today${p.points == null ? '' : `, ${points(p.points)} points`}`;
    const parts = [p.weight == null ? '' : level(p.weight), move, p.earnings ? `Reports ${dayMonth(p.earnings)}` : ''].filter(Boolean);
    return parts.length ? `In your portfolio: ${parts.join(' · ')}` : 'In your portfolio';
  });
}

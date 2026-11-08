import { Component, computed, input } from '@angular/core';
import { date, money, pct } from '@pretickt/components/format';
import type { YearLine } from './compute';

/** The portfolio's year as one line (Part B): what today's holdings were worth each day, or their weighted return; its first and last day, said in a sentence. */
@Component({
  selector: 'pt-portfolio-line',
  template: `
    @let l = line();
    <p class="pt-meta">{{ said() }}</p>
    <svg class="pt-pf-line" viewBox="0 0 600 160" preserveAspectRatio="none" role="img" [attr.aria-label]="said()"><path class="pt-pf-path" [attr.d]="path()" /></svg>
    <div class="pt-pf-axis"><span>{{ date(l.points[0]!.t) }}</span><span>{{ date(l.points.at(-1)!.t) }}</span></div>`,
})
export class PtPortfolioLine {
  readonly line = input.required<YearLine>();
  protected readonly date = date;
  protected readonly path = computed(() => {
    const p = this.line().points, v = p.map((x) => x.v), lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
    return p.map((x, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, p.length - 1)) * 600).toFixed(1)},${(150 - ((x.v - lo) / span) * 140).toFixed(1)}`).join('');
  });
  protected readonly said = computed(() => {
    const l = this.line(), a = l.points[0]!, b = l.points.at(-1)!;
    return l.unit === 'value'
      ? `Today's holdings were worth ${money(a.v)} on ${date(a.t)} and ${money(b.v)} at the last close (${pct(b.v / a.v - 1)}), at each day's close.`
      : `${pct(b.v)} since ${date(a.t)}, at today's weights.`;
  });
}

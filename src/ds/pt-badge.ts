import { Component, computed, input } from '@angular/core';
import { badgeValue, date, money, tip, type Badge } from './format';
import { iconPath, PtIcon } from './pt-icon';

/** One catalogue badge (a metric@1 item, or any Badge you build) as the `<li>` of a `<ul class="pt-badges">`; size="mini" for dense rows. */
@Component({
  selector: 'li[ptBadge]',
  imports: [PtIcon],
  host: { '[class]': 'cls()', tabindex: '0', '[attr.data-tip]': 'tooltip()' },
  template: `
    @if (icon()) {<svg [ptIcon]="badge().icon"></svg>}
    <span class="pt-badge-k">{{ badge().label }}</span>
    @if (badge().dots?.length) {
      <span class="pt-dots" [attr.aria-label]="badge().dots!.length + ' items'">@for (d of badge().dots; track $index) {<span [class]="d === 'pos' ? 'pt-dot-pos' : 'pt-dot-neg'"></span>}</span>
    } @else {<span class="pt-badge-v">{{ value() }}</span>}
    @if (rangeLeft(); as left) {<span class="pt-range" aria-hidden="true"><span class="pt-range-dot" [style.left]="left"></span></span>}`,
})
export class PtBadge {
  readonly badge = input.required<Badge>({ alias: 'ptBadge' });
  readonly size = input<'mini' | undefined>(undefined);
  protected readonly cls = computed(() => `pt-badge${this.size() === 'mini' ? ' pt-badge-mini' : ''} pt-tone-${this.badge().tone}`);
  protected readonly icon = computed(() => iconPath(this.badge().icon));
  protected readonly value = computed(() => badgeValue(this.badge()));
  protected readonly tooltip = computed(() => {
    const b = this.badge();
    const t: Record<string, string> = { [b.label]: b.hint, 'As of': date(b.asOf) };
    if (b.range) { t['Low'] = money(b.range.lo); t['High'] = money(b.range.hi); }
    return tip(t);
  });
  protected readonly rangeLeft = computed(() => {
    const b = this.badge();
    if (!b.range || b.value == null || b.range.hi <= b.range.lo) return null;
    return `${Math.min(100, Math.max(0, ((b.value - b.range.lo) / (b.range.hi - b.range.lo)) * 100)).toFixed(1)}%`;
  });
}

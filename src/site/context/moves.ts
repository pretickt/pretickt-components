import { Component, computed, input } from '@angular/core';
import type { MapCtx, MoverCtx, TalkCtx } from '@pretickt/components/context';
import { dayMonth, pct, stockHref, usd } from '../../ds/format';

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n: number): string {
  const t = n % 100, u = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`;
}
const whyMoving = (to: string) => `${stockHref(to)}why-moving/`;

/** Ongoing moves (pt-movers): the move since it started, the three windows, today's line, the industry moving too. */
@Component({
  selector: 'pt-ctx-mover',
  template: `
    @let m = d();
    <p class="pt-ctx-lead">In a {{ m.kind }}: {{ pct(m.move) }} since {{ dayMonth(m.since) }} ({{ m.days }} days)</p>
    <div class="pt-ctx-more">
      <p class="pt-meta">{{ windows() }}</p>
      @if (m.today; as t) {<p>Today {{ pct(t.r) }} ({{ t.label }})</p>}
      @if (m.industry; as i) {<p>Its industry is moving too: median {{ pct(i.median) }}@if (i.peers.length) { ({{ peers() }})}</p>}
      <p class="pt-ctx-go"><a [href]="why()">Why it moved →</a></p>
    </div>`,
})
export class PtCtxMover {
  readonly d = input.required<MoverCtx>();
  readonly to = input.required<string>();
  protected readonly pct = pct;
  protected readonly dayMonth = dayMonth;
  protected readonly why = computed(() => whyMoving(this.to()));
  protected readonly windows = computed(() => {
    const m = this.d();
    return [['This week', m.week], ['30 days', m.month], ['90 days', m.quarter]].flatMap(([k, v]) => (v == null ? [] : [`${k} ${pct(v as number)}`])).join(' · ');
  });
  protected readonly peers = computed(() => (this.d().industry?.peers ?? []).map((p) => `${p.ticker} ${pct(p.move)}`).join(', '));
}

/** The heat map (pt-logo-map, price): the day's move, its place in its sector on the map the reader saw, the market value. */
@Component({
  selector: 'pt-ctx-map',
  template: `
    <p class="pt-ctx-lead">{{ line() }}</p>
    <div class="pt-ctx-more"><p class="pt-ctx-go"><a [href]="why()">Why it moved →</a></p></div>`,
})
export class PtCtxMap {
  readonly d = input.required<MapCtx>();
  readonly to = input.required<string>();
  protected readonly why = computed(() => whyMoving(this.to()));
  protected readonly line = computed(() => {
    const m = this.d();
    return [m.move == null ? '' : `${pct(m.move)} today`,
      m.of > 1 ? `${ordinal(m.rank)} of ${m.of} in ${m.sector}${m.sectorMove == null ? '' : ` (the sector ${pct(m.sectorMove)})`}` : `in ${m.sector}`,
      m.cap ? `${usd(m.cap, { compact: true })} market value` : ''].filter(Boolean).join(' · ');
  });
}

/** The news or social map (pt-logo-map, attention): how much it was talked about that day, as the tile's tooltip said it. */
@Component({
  selector: 'pt-ctx-talk',
  template: `
    <p class="pt-ctx-lead">{{ d().lens === 'social' ? 'Posts on Reddit and X' : d().label }} that day: {{ d().count }}</p>
    <div class="pt-ctx-more"><p class="pt-ctx-go"><a [href]="news()">Latest news →</a></p></div>`,
})
export class PtCtxTalk {
  readonly d = input.required<TalkCtx>();
  readonly to = input.required<string>();
  protected readonly news = computed(() => `${stockHref(this.to())}news/`);
}

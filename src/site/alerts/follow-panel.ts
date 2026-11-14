import { afterNextRender, Component, computed, inject, input } from '@angular/core';
import { PtFollow } from '@pretickt/components/follow';
import { dayMonth } from '@pretickt/components/format';
import type { FollowAlert } from '@pretickt/components/typologies';
import { picGeometry } from '../../alerts/pic';

const PIC_W = 96, PIC_H = 28;

/** A company's alerts, one row each: badge in its tone, line, day, a small picture (the panel and /alerts/). */
@Component({
  selector: 'pt-follow-rows',
  template: `
    @if (rows().length) {
      <ul class="pt-follow-list">
        @for (r of rows(); track $index) {
          <li class="pt-follow-row">
            <span [class]="'pt-follow-chip pt-follow-' + r.a.tone">{{ r.a.label }}@if (r.a.value) {<b>{{ ' ' + r.a.value }}</b>}</span>
            <span class="pt-follow-line">{{ r.a.line }} <span class="pt-meta">{{ day(r.a.session) }}</span></span>
            @if (r.g; as g) {
              <svg class="pt-follow-pic" [attr.viewBox]="'0 0 ' + PIC_W + ' ' + PIC_H" aria-hidden="true">
                @if (g.band; as b) {<rect class="pt-follow-band" x="0" [attr.y]="b.y1" [attr.width]="PIC_W" [attr.height]="b.y2 - b.y1" />}
                @for (y of g.levels; track $index) {<line class="pt-follow-lv" x1="0" [attr.x2]="PIC_W" [attr.y1]="y" [attr.y2]="y" />}
                @if (g.line2; as l2) {<path class="pt-follow-l2" [attr.d]="l2" />}
                <path class="pt-follow-l1" [attr.d]="g.line" />
                @if (g.dot; as d) {<circle class="pt-follow-dot" [attr.cx]="d.x" [attr.cy]="d.y" r="2" />}
              </svg>
            }
          </li>
        }
      </ul>
    } @else {<p class="pt-follow-empty">No alerts in the last 5 sessions.</p>}`,
})
export class PtFollowRows {
  readonly alerts = input<readonly FollowAlert[]>([]);
  protected readonly PIC_W = PIC_W;
  protected readonly PIC_H = PIC_H;
  protected readonly rows = computed(() => this.alerts().map((a) => ({ a, g: a.pic ? picGeometry(a.pic, PIC_W, PIC_H) : null })));
  protected readonly day = dayMonth;
}

/**
 * A company's bell, opened (Romeo, 2026-11-14: «badge per gli allarmi recenti come in un'app mobile … quando attivi la campanella, ti arrivano
 * allarmi»): its alerts of the last 5 sessions — badge, line, day, a small picture — and the switch that follows it in this browser. Opening it
 * marks them seen, so the bell's number goes. The page opens it from its alerts chunk (./follow-start.ts), never from the main bundle.
 */
@Component({
  selector: 'pt-follow-panel',
  imports: [PtFollowRows],
  template: `
    <div class="pt-follow-head">
      <p class="pt-follow-title"><b>Alerts for {{ name() }}</b> <span class="pt-meta">· last 5 sessions</span></p>
      <button type="button" class="pt-abtn pt-follow-switch" [attr.aria-pressed]="followed()" (click)="follow.toggle(ticker())">{{ followed() ? 'Following' : 'Follow' }}</button>
    </div>
    <pt-follow-rows [alerts]="alerts()" />
    <p class="pt-follow-foot pt-meta">Followed companies stay in this browser. <a href="/alerts/">All your alerts</a></p>`,
})
export class PtFollowPanel {
  protected readonly follow = inject(PtFollow);
  readonly ticker = input.required<string>();
  readonly name = input.required<string>();
  readonly alerts = input<readonly FollowAlert[]>([]);
  protected readonly followed = this.follow.following(() => this.ticker());

  constructor() {
    // seen once the reader has the panel in front of them (after PtFollow has read the store)
    afterNextRender(() => { const newest = this.alerts()[0]; if (newest) this.follow.markSeen(this.ticker(), newest.session); });
  }
}

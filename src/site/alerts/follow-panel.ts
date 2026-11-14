import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { PtFollow } from '@pretickt/components/follow';
import { dayMonth } from '@pretickt/components/format';
import type { FollowAlert } from '@pretickt/components/typologies';
import { picGeometry } from '../../alerts/pic';
import { PT_FOLLOW_EMAIL } from './follow-backend';

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const SAID = { invalid: 'Check the address.', captcha: 'The check did not pass. Try again.', limit: 'Too many tries. Try again later.', network: 'No connection. Try again.' } as const;

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
      <p class="pt-follow-title"><b>Alerts for {{ name() }}</b><span class="pt-meta">{{ ' · last 5 sessions' }}</span></p>
      <button type="button" class="pt-abtn pt-follow-switch" [attr.aria-pressed]="followed()" (click)="follow.toggle(ticker())">{{ followed() ? 'Following' : 'Follow' }}</button>
    </div>
    <pt-follow-rows [alerts]="alerts()" />
    @if (email) {
      <div class="pt-follow-mail">
        @if (follow.link(); as l) {<p class="pt-meta">Emails to {{ l.email }} · {{ l.cadence === 'week' ? 'weekly' : 'daily' }} · <a href="/alerts/">Manage</a></p>}
        @else if (sent()) {<p>Check your inbox: the link in our email turns the alerts on.</p>}
        @else {
          <label class="pt-follow-mail-q" for="pt-follow-email">Get the alerts of the companies you follow by email</label>
          <div class="pt-follow-mail-row">
            <input id="pt-follow-email" type="email" autocomplete="email" placeholder="you@example.com" [value]="address()" (input)="typed($event)" (focus)="check()" />
            <button type="button" class="pt-abtn" [disabled]="busy()" (click)="send()">Send</button>
          </div>
          <div #human></div>
          @if (said(); as s) {<p class="pt-follow-mail-said">{{ s }}</p>}
        }
      </div>
    }
    <p class="pt-follow-foot pt-meta">Followed companies stay in this browser. <a href="/alerts/">All your alerts</a></p>`,
})
export class PtFollowPanel {
  protected readonly follow = inject(PtFollow);
  readonly ticker = input.required<string>();
  readonly name = input.required<string>();
  readonly alerts = input<readonly FollowAlert[]>([]);
  protected readonly followed = this.follow.following(() => this.ticker());
  /** The email alerts' side (none where they are off): the address, the human check's token, what came back. */
  protected readonly email = inject(PT_FOLLOW_EMAIL, { optional: true });
  protected readonly address = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly said = signal<string | null>(null);
  private readonly human = viewChild<ElementRef<HTMLElement>>('human');
  private token: string | null = null;
  private mounted: { reset(): void; remove(): void } | null = null;
  private readonly gone = inject(DestroyRef).onDestroy(() => this.mounted?.remove());

  protected typed(e: Event): void { this.address.set((e.target as HTMLInputElement).value.trim()); this.said.set(null); }

  /** The human check loads when the reader first touches the address (as the editor's). */
  protected check(): void {
    const el = this.human()?.nativeElement;
    if (!this.email?.check || this.mounted || !el) return;
    this.mounted = this.email.check.mount(el, (st) => { this.token = st.token; });
  }

  /** The address with every company this browser follows (this one included): the email's link confirms them. */
  protected async send(): Promise<void> {
    const e = this.email, a = this.address();
    if (!e || this.busy()) return;
    if (!EMAIL.test(a)) { this.said.set(SAID.invalid); return; }
    if (e.check && !this.token) { this.check(); this.said.set('One moment: checking you are not a robot…'); return; }
    if (!this.followed()) this.follow.toggle(this.ticker());
    this.busy.set(true);
    const r = await e.backend.signup(a, [...new Set([...this.follow.follows(), this.ticker()])], this.token);
    this.busy.set(false);
    if (r === 'ok') this.sent.set(true);
    else { this.said.set(SAID[r]); this.token = null; this.mounted?.reset(); }
  }

  constructor() {
    // seen once the reader has the panel in front of them (after PtFollow has read the store)
    afterNextRender(() => { const newest = this.alerts()[0]; if (newest) this.follow.markSeen(this.ticker(), newest.session); });
  }
}

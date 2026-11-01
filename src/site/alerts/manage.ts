import { afterNextRender, Component, inject, signal } from '@angular/core';
import { CONDITIONS, sentence } from '../../alerts/catalog';
import { PtAlerts } from '../../alerts/service';
import type { ManagedRule, ManageOp, ManageState } from '../../alerts/token';

/**
 * Your email alerts, from an email's link (Romeo, 2026-11-01: «email senza account»): confirm one, see them all, pause, resume,
 * delete or edit them, the weekly email on or off, unsubscribe from everything. A part of the page app, not a placeable component:
 * the page app mounts it on the alerts' page (`/alerts/`, noindex) from a chunk of its own, so it costs the main bundle nothing.
 */
@Component({
  selector: 'pt-alert-manage',
  template: `
    @let s = state();
    @if (!asked()) {<p class="pt-na">Open the link in one of our emails to confirm or manage your alerts.</p>}
    @else if (s === undefined) {<p class="pt-note pt-busy">Loading your alerts…</p>}
    @else if (s === null) {<p class="pt-na">This link has expired: open the newest email we sent you.</p>}
    @else {
      <section class="pt-alm">
        @if (s.confirmed; as c) {
          <p class="pt-alm-ok">Your alert “{{ nameOf(s, c.id) }}” is on.</p>
          @if (c.now.length) {
            <p class="pt-note">Right now: {{ c.now.join(', ') }} {{ c.now.length === 1 ? 'meets' : 'meet' }} all of these — you will get an email
              when another stock starts meeting them.</p>
          }
        }
        @if (done(); as d) {<p class="pt-alm-ok">{{ d }}</p>}
        @if (s.status === 'unsubscribed') {<p class="pt-note">You are unsubscribed: we will not email you again.</p>}
        @else {
          <p class="pt-meta">Alerts for {{ s.email }}</p>
          <ul class="pt-alm-list">
            @for (r of s.rules; track r.id) {
              <li class="pt-alm-rule" [class.pt-alm-paused]="r.status === 'paused'">
                <p class="pt-alm-name">{{ r.name }}@if (r.status === 'paused') {<span class="pt-alm-tag">Paused</span>}</p>
                <p class="pt-alm-say">{{ say(r) }}</p>
                <div class="pt-alm-acts">
                  @if (r.status === 'active') {<button type="button" (click)="act({ op: 'pause', id: r.id })">Pause</button>}
                  @else {<button type="button" (click)="act({ op: 'resume', id: r.id })">Resume</button>}
                  <button type="button" (click)="edit(r)">Edit</button>
                  <button type="button" (click)="act({ op: 'delete', id: r.id })">Delete</button>
                </div>
              </li>
            } @empty {<li class="pt-note">No alerts yet: press the bell under any chart to create one.</li>}
          </ul>
          <p class="pt-alm-weekly">pretickt's weekly email: <b>{{ s.weekly ? 'on' : 'off' }}</b>
            <button type="button" (click)="act({ op: 'weekly', on: !s.weekly })">{{ s.weekly ? 'Turn off' : 'Turn on' }}</button></p>
          <button type="button" class="pt-alm-unsub" (click)="act({ op: 'unsubscribe' })">Unsubscribe from everything</button>
        }
      </section>
    }`,
})
export class PtAlertManage {
  private readonly alerts = inject(PtAlerts);
  /** the link was read (a browser with the page's backend and a token): until then the server's note */
  protected readonly asked = signal(false);
  /** undefined while asking, null for a link that no longer works */
  protected readonly state = signal<ManageState | null | undefined>(undefined);
  protected readonly done = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      const l = this.alerts.landing();
      if (!this.alerts.enabled || !l.token) return;
      this.asked.set(true);
      const op: ManageOp = l.action === 'confirm' ? { op: 'confirm' } : l.action === 'weekly' ? { op: 'weekly', on: true } : { op: 'list' };
      void this.alerts.manage(l.token, op).then((s) => {
        this.state.set(s);
        if (s && l.action === 'weekly') this.done.set("You will get pretickt's weekly email.");
      });
    });
  }

  protected nameOf(s: ManageState, id: string): string { return s.rules.find((r) => r.id === id)?.name ?? 'your alert'; }
  /** the rule as words: "Falls more than 5% in one session · Is a mega cap, over $200B" */
  protected say(r: ManagedRule): string {
    return r.rule.all.filter((rc) => CONDITIONS[rc.c]).map((rc) => sentence(rc.c, rc.p)).join(' · ');
  }

  protected act(op: ManageOp): void {
    const t = this.alerts.landing().token;
    if (!t) return;
    this.done.set(null);
    void this.alerts.manage(t, op).then((s) => {
      this.state.set(s);
      if (s && op.op === 'delete') this.done.set('Alert deleted.');
      if (s && op.op === 'unsubscribe') this.done.set('Done: no more emails.');
    });
  }

  protected edit(r: ManagedRule): void {
    const t = this.alerts.landing().token;
    if (t) this.alerts.edit(r, t);
  }
}

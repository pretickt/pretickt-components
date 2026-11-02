import { afterNextRender, ApplicationRef, Component, createComponent, effect, EnvironmentInjector, inject, Injector, signal } from '@angular/core';
import { CONDITIONS, sentence } from '../../alerts/catalog';
import { PtAlerts } from '../../alerts/service';
import type { ManagedRule, ManageOp, ManageState } from '../../alerts/token';
import { mountEditor } from './editor';

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
    @else if (s === undefined) {
      @if (failed()) {<p class="pt-alm-err" role="alert">Could not reach pretickt. <button type="button" (click)="retry()">Retry</button></p>}
      @else {<p class="pt-note pt-busy">Loading your alerts…</p>}
    }
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
        @if (failed()) {<p class="pt-alm-err" role="alert">Could not reach pretickt: nothing changed. <button type="button" (click)="retry()">Retry</button></p>}
        @if (asking() === 'confirm' && waiting(s)) {
          <p class="pt-alm-ask">Confirm the alerts waiting below: we email you only once you do.
            <button type="button" class="pt-alm-go" [disabled]="busy()" (click)="confirm()">Confirm</button></p>
        } @else if (asking() === 'weekly' && !s.weekly && s.status !== 'unsubscribed') {
          <p class="pt-alm-ask">Want pretickt's weekly email too?
            <button type="button" class="pt-alm-go" [disabled]="busy()" (click)="weeklyOn()">Yes, send it</button></p>
        }
        @if (s.status === 'unsubscribed') {<p class="pt-note">You are unsubscribed: we will not email you again.</p>}
        @else {
          <p class="pt-meta">Alerts for {{ s.email }}</p>
          <ul class="pt-alm-list">
            @for (r of s.rules; track r.id) {
              <li class="pt-alm-rule" [class.pt-alm-paused]="r.status === 'paused'">
                <p class="pt-alm-name">{{ r.name }}@if (r.status === 'paused') {<span class="pt-alm-tag">Paused</span>}
                  @else if (r.status === 'pending') {<span class="pt-alm-tag">Waiting for your confirmation</span>}</p>
                <p class="pt-alm-say">{{ say(r) }}</p>
                <div class="pt-alm-acts">
                  @if (r.status === 'active') {<button type="button" [disabled]="busy()" (click)="act({ op: 'pause', id: r.id })">Pause</button>}
                  @else if (r.status === 'paused') {<button type="button" [disabled]="busy()" (click)="act({ op: 'resume', id: r.id })">Resume</button>}
                  <button type="button" [disabled]="busy()" (click)="edit(r)">Edit</button>
                  <button type="button" [disabled]="busy()" (click)="act({ op: 'delete', id: r.id })">Delete</button>
                </div>
              </li>
            } @empty {<li class="pt-note">No alerts yet: press the bell under any chart to create one.</li>}
          </ul>
          <p class="pt-alm-weekly">pretickt's weekly email: <b>{{ s.weekly ? 'on' : 'off' }}</b>
            <button type="button" [disabled]="busy()" (click)="act({ op: 'weekly', on: !s.weekly })">{{ s.weekly ? 'Turn off' : 'Turn on' }}</button></p>
          <button type="button" class="pt-alm-unsub" [disabled]="busy()" (click)="act({ op: 'unsubscribe' })">Unsubscribe from everything</button>
        }
      </section>
    }`,
})
export class PtAlertManage {
  private readonly alerts = inject(PtAlerts);
  private readonly appRef = inject(ApplicationRef);
  private readonly env = inject(EnvironmentInjector);
  private readonly injector = inject(Injector);
  /** the link was read (a browser with the page's backend and a token): until then the server's note */
  protected readonly asked = signal(false);
  /** undefined while asking, null for a link that no longer works */
  protected readonly state = signal<ManageState | null | undefined>(undefined);
  protected readonly done = signal<string | null>(null);
  /** a call is on its way: the buttons wait */
  protected readonly busy = signal(false);
  /** the call that did not get through, for Retry; the list shown stays as it was */
  protected readonly failed = signal<{ op: ManageOp; said: string | null; then?: () => void } | null>(null);
  /** what the email's link is for, until the reader presses it: a link scanner opening it confirms nothing, turns nothing on */
  protected readonly asking = signal<'confirm' | 'weekly' | null>(null);

  constructor() {
    // every answer, the editor's update of a rule included
    effect(() => {
      const m = this.alerts.managed();
      if (m) this.state.set(m);
    });
    afterNextRender(() => {
      const l = this.alerts.landing();
      if (!this.alerts.enabled || !l.token) return;
      this.asked.set(true);
      this.asking.set(l.action === 'confirm' || l.action === 'weekly' ? l.action : null);
      this.run({ op: 'list' }, null);
    });
  }

  protected waiting(s: ManageState): boolean { return s.status === 'pending' || s.rules.some((r) => r.status === 'pending'); }
  protected confirm(): void { this.run({ op: 'confirm' }, null, () => this.asking.set(null)); }
  protected weeklyOn(): void { this.run({ op: 'weekly', on: true }, "You will get pretickt's weekly email.", () => this.asking.set(null)); }

  protected nameOf(s: ManageState, id: string): string { return s.rules.find((r) => r.id === id)?.name ?? 'your alert'; }
  /** the rule as words: "Falls more than 5% in one session · Is a mega cap, over $200B" */
  protected say(r: ManagedRule): string {
    return r.rule.all.filter((rc) => CONDITIONS[rc.c]).map((rc) => sentence(rc.c, rc.p)).join(' · ');
  }

  protected act(op: ManageOp): void {
    this.run(op, op.op === 'delete' ? 'Alert deleted.' : op.op === 'unsubscribe' ? 'Done: no more emails.' : null);
  }

  protected retry(): void {
    const f = this.failed();
    if (f) this.run(f.op, f.said, f.then);
  }

  /** The editor (mounted on the first Edit) opens on the rule; its saved change comes back through `managed`. */
  protected edit(r: ManagedRule): void {
    const t = this.alerts.landing().token;
    if (t) mountEditor(this.appRef, this.env, this.injector).edit(r, t);
  }

  /** One call at a time: its answer replaces the list, a link that no longer works says so, a call that failed keeps the list. */
  private run(op: ManageOp, said: string | null, then?: () => void): void {
    const t = this.alerts.landing().token;
    if (!t || this.busy()) return;
    this.busy.set(true);
    this.done.set(null);
    this.failed.set(null);
    void this.alerts.manage(t, op).then((s) => {
      this.busy.set(false);
      if (s === 'failed') return this.failed.set({ op, said, then });
      this.state.set(s);
      if (s && said) this.done.set(said);
      if (s) then?.();
    });
  }
}

/** The alerts' page (`[data-pt-alerts]`, its note for a browser without the page app): the manage page in its place. */
export function mountManage(host: Element, appRef: ApplicationRef, env: EnvironmentInjector): void {
  const el = host.ownerDocument.createElement('pt-alert-manage');
  host.replaceChildren(el);
  appRef.attachView(createComponent(PtAlertManage, { environmentInjector: env, hostElement: el }).hostView);
}

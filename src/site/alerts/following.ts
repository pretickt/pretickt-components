import { afterNextRender, Component, computed, inject, InjectionToken, signal } from '@angular/core';
import { PtFollow } from '@pretickt/components/follow';
import { plainName } from '@pretickt/components/format';
import type { FollowFile } from '@pretickt/components/typologies';
import type { ManageState } from '../../alerts/token';
import { PT_FOLLOW_EMAIL } from './follow-backend';
import { PtFollowRows } from './follow-panel';
import { landingOf } from './landing';

/** The night file of every company's recent alerts: one file for every reader, so nobody's follows reach the server or the CDN. */
export const FOLLOW_FILE_URL = '/data/alerts-v1.json';
/** How the page gets that file (the stories and the specs give it their own). */
export const PT_FOLLOW_FILE = new InjectionToken<() => Promise<FollowFile | null>>('PT_FOLLOW_FILE');
/** The page's address query (an email's link: `?t=`, `?do=confirm&t=`); the specs give their own. */
export const PT_FOLLOW_SEARCH = new InjectionToken<string>('PT_FOLLOW_SEARCH');

/** The whole night file, or null when it does not come. */
export async function fetchFollowFile(get: (u: string) => Promise<Response> = (u) => fetch(u)): Promise<FollowFile | null> {
  const r = await get(FOLLOW_FILE_URL);
  return r.ok ? ((await r.json()) as FollowFile) : null;
}

/**
 * /alerts/ (noindex): the companies this browser follows, in the order followed, each with its alerts of the last 5 sessions from the night
 * file, and × to stop following (Romeo, 2026-11-14: «quando attivi la campanella, ti arrivano allarmi»). No logo files and no hover cards here:
 * either would name a followed company in a request.
 */
@Component({
  selector: 'pt-following',
  imports: [PtFollowRows],
  // the site's hover cards listen on the document and ask the API for the ticker they show: here a hover stays inside (as on /portfolio/)
  host: { '(pointerover)': '$event.stopPropagation()', '(pointerout)': '$event.stopPropagation()' },
  template: `
    @if (email && follow.link(); as l) {
      <p class="pt-following-mail">Emails to {{ l.email }} ·
        <button type="button" class="pt-abtn" [attr.aria-pressed]="l.cadence === 'day'" (click)="cadence('day')">Daily</button>
        <button type="button" class="pt-abtn" [attr.aria-pressed]="l.cadence === 'week'" (click)="cadence('week')">Weekly</button> ·
        <button type="button" class="pt-abtn" (click)="stop()">Stop the emails</button></p>
    }
    @if (!follow.ready() || file() === undefined) {<p class="pt-following-none">Reading what this browser follows…</p>}
    @else {
      @if (!follow.follows().length) {<p class="pt-following-none">Tap the bell on a company to follow it here.</p>}
      @else if (file() === null) {<p class="pt-following-none">Your alerts could not be loaded. Try again later.</p>}
      @else {
        <ul class="pt-following">
          @for (r of rows(); track r.t) {
            <li class="pt-following-co">
              <div class="pt-following-id">
                <span class="pt-logo pt-logo-initials" aria-hidden="true">{{ r.t.slice(0, 2) }}</span>
                <a [href]="'/stocks/' + r.t.toLowerCase() + '/'">{{ r.name }}</a>
                <span class="pt-meta">{{ r.t }}</span>
                <button type="button" class="pt-following-x" [attr.aria-label]="'Stop following ' + r.name" (click)="follow.toggle(r.t)">×</button>
              </div>
              <pt-follow-rows [alerts]="r.alerts" />
            </li>
          }
        </ul>
      }
    }`,
})
export class PtFollowing {
  protected readonly follow = inject(PtFollow);
  private readonly load = inject(PT_FOLLOW_FILE, { optional: true }) ?? (() => fetchFollowFile());
  /** undefined while it comes, null when it did not */
  protected readonly file = signal<FollowFile | null | undefined>(undefined);
  protected readonly rows = computed(() => {
    const f = this.file();
    return this.follow.follows().map((t) => ({ t, name: plainName(f?.companies[t]?.name ?? t), alerts: f?.companies[t]?.alerts ?? [] }));
  });

  /** The email (part 2), where the email alerts are on. */
  protected readonly email = inject(PT_FOLLOW_EMAIL, { optional: true });
  private readonly search = inject(PT_FOLLOW_SEARCH, { optional: true }) ?? globalThis.location?.search ?? '';

  constructor() {
    this.load().then((f) => this.file.set(f), () => this.file.set(null));
    // an email's link (or this browser's own link): the server's follows and this browser's become one list on both sides
    afterNextRender(() => { void this.sync(); });
  }

  private async sync(): Promise<void> {
    const e = this.email;
    if (!e) return;
    await this.whenReady();
    const landing = landingOf(this.search), token = landing.token ?? this.follow.link()?.token;
    if (!token) return;
    const st = await e.backend.manage(token, { op: landing.token && landing.action === 'confirm' ? 'confirm' : 'list' }).catch(() => undefined);
    if (st === null) { this.follow.setLink(null); return; }
    if (st) await this.adopt(st);
  }

  /** The server's state: its link kept, its follows first and this browser's others after them, sent back when they differ. */
  private async adopt(st: ManageState): Promise<void> {
    if (!st.manage || st.status === 'unsubscribed') { this.follow.setLink(null); return; }
    this.follow.setLink({ token: st.manage, email: st.email, cadence: st.cadence ?? 'day' });
    const server = st.follows ?? [], union = [...server, ...this.follow.follows().filter((t) => !server.includes(t))];
    this.follow.replaceFollows(union);
    if (union.length !== server.length && this.email) await this.email.backend.manage(st.manage, { op: 'follows', tickers: union }).catch(() => undefined);
  }

  private whenReady(): Promise<void> {
    return new Promise((done) => { const tick = () => (this.follow.ready() ? done() : setTimeout(tick, 20)); tick(); });
  }

  protected async cadence(value: 'day' | 'week'): Promise<void> {
    const l = this.follow.link();
    if (!l || !this.email) return;
    const st = await this.email.backend.manage(l.token, { op: 'cadence', value }).catch(() => undefined);
    if (st === null) this.follow.setLink(null);
    else if (st) this.follow.setLink({ ...l, cadence: st.cadence ?? value });
  }

  protected async stop(): Promise<void> {
    const l = this.follow.link();
    if (!l || !this.email) return;
    const st = await this.email.backend.manage(l.token, { op: 'unsubscribe' }).catch(() => undefined);
    if (st !== undefined) this.follow.setLink(null);
  }
}

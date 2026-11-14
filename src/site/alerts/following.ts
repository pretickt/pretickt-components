import { Component, computed, inject, InjectionToken, signal } from '@angular/core';
import { PtFollow } from '@pretickt/components/follow';
import { plainName } from '@pretickt/components/format';
import type { FollowFile } from '@pretickt/components/typologies';
import { PtFollowRows } from './follow-panel';

/** The night file of every company's recent alerts: one file for every reader, so nobody's follows reach the server or the CDN. */
export const FOLLOW_FILE_URL = '/data/alerts-v1.json';
/** How the page gets that file (the stories and the specs give it their own). */
export const PT_FOLLOW_FILE = new InjectionToken<() => Promise<FollowFile | null>>('PT_FOLLOW_FILE');

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

  constructor() {
    this.load().then((f) => this.file.set(f), () => this.file.set(null));
  }
}

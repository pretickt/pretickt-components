import { afterNextRender, computed, inject, Injectable, InjectionToken, signal, type Signal } from '@angular/core';
import type { FollowAlert } from '../typologies';
import { seenUpTo, toggled, unseenCount, type FollowState } from './follow-state';

export type { FollowState } from './follow-state';

/** Where the page keeps what the reader follows (the site: this browser's localStorage). Never on the server, never sent anywhere. */
export interface FollowStore {
  read(): FollowState;
  write(s: FollowState): void;
}
/** Provided by the page in the browser while follow is on; absent on the server and in the checks. */
export const PT_FOLLOW = new InjectionToken<FollowStore>('PT_FOLLOW');
/** The page has the bells (FOLLOW_ENABLED): provided on the server and in the browser alike, so both draw them. */
export const PT_FOLLOW_ON = new InjectionToken<boolean>('PT_FOLLOW_ON');

/** A bell's press: the company, its alerts and where the bell is, for the page's panel. */
export interface FollowPress {
  ticker: string; name: string; alerts: readonly FollowAlert[];
  rect: { left: number; right: number; top: number; bottom: number };
  at: number;
}

/**
 * The companies this browser follows and the alerts it has seen (Romeo, 2026-11-14: «quando attivi la campanella, ti arrivano allarmi»;
 * following starts in the browser, spec 2026-11-14-follow-alerts-design.md). Read after the first render, as `PtPicks`: the server HTML and
 * hydration show every recent alert as new and nothing followed, the browser's own marks apply right after. A bell's press is handed to the
 * page (`pressed`), which opens its panel from a chunk of its own.
 */
@Injectable({ providedIn: 'root' })
export class PtFollow {
  private readonly store = inject(PT_FOLLOW, { optional: true });
  readonly on = inject(PT_FOLLOW_ON, { optional: true }) === true;
  /** null until read, after the first render in the browser */
  private readonly state = signal<FollowState | null>(null);
  private readonly pressedSig = signal<FollowPress | null>(null);
  readonly ready = computed(() => this.state() !== null);
  readonly follows = computed<readonly string[]>(() => this.state()?.follows ?? []);
  readonly pressed = this.pressedSig.asReadonly();

  constructor() {
    const store = this.store;
    if (store) afterNextRender(() => {
      let read: FollowState = { follows: [], seen: {} };
      try { read = store.read(); } catch { /* a store that fails follows nothing */ }
      this.state.set(read);
    });
  }

  following(t: () => string | null): Signal<boolean> {
    return computed(() => { const k = t(); return k != null && (this.state()?.follows.includes(k) ?? false); });
  }

  /** How many of the alerts this browser has not seen (every one before the first render). */
  unseen(t: () => string | null, alerts: () => readonly FollowAlert[] | undefined): Signal<number> {
    return computed(() => { const k = t(); return unseenCount(alerts(), k == null ? undefined : this.state()?.seen[k]); });
  }

  toggle(t: string): void { this.change((s) => toggled(s, t)); }

  markSeen(t: string, session: string): void { this.change((s) => seenUpTo(s, t, session)); }

  press(p: FollowPress): void { this.pressedSig.set(p); }

  private change(f: (s: FollowState) => FollowState): void {
    const s = this.state();
    if (!this.store || s === null) return;
    const next = f(s);
    if (next === s) return;
    this.state.set(next);
    try { this.store.write(next); } catch { /* not kept: this page still shows it */ }
  }
}

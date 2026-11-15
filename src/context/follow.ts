import { afterNextRender, computed, inject, Injectable, signal, type Signal } from '@angular/core';
import type { FollowAlert } from '../typologies';
import { replaced, seenUpTo, toggled, unseenCount, type FollowLink, type FollowState } from './follow-state';
import { PT_FOLLOW, PT_FOLLOW_ON } from './follow-tokens';

/** A bell's press: the company, its alerts and where the bell is, for the page's panel; `at` counts the presses (the same bell twice is two presses). */
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
  private presses = 0;
  private listener: ((p: FollowPress) => void) | null = null;
  private changes: ((c: { ticker: string; on: boolean }) => void) | null = null;
  private readonly later: (() => void)[] = [];
  readonly ready = computed(() => this.state() !== null);
  readonly follows = computed<readonly string[]>(() => this.state()?.follows ?? []);
  readonly pressed = this.pressedSig.asReadonly();
  /** The email this browser's follows go to (part 2), or null. */
  readonly link = computed<FollowLink | null>(() => this.state()?.link ?? null);

  constructor() {
    const store = this.store;
    if (store) afterNextRender(() => {
      const none: FollowState = { follows: [], seen: {} };
      let read: FollowState | Promise<FollowState> = none;
      try { read = store.read(); } catch { /* a store that fails follows nothing */ }
      if (read instanceof Promise) read.then((s) => this.arrive(s), () => this.arrive(none));
      else this.arrive(read);
    });
  }

  /** The store's first read: the changes made while it came apply now, in order. */
  private arrive(s: FollowState): void {
    this.state.set(s);
    for (const f of this.later.splice(0)) f();
  }

  /** Before that first read a change waits for it (a press on a slow page is not lost). */
  private waits(f: () => void): boolean {
    if (!this.store || this.state() !== null) return false;
    this.later.push(f);
    return true;
  }

  following(t: () => string | null): Signal<boolean> {
    return computed(() => { const k = t(); return k != null && (this.state()?.follows.includes(k) ?? false); });
  }

  /** How many of the alerts this browser has not seen (every one before the first render). */
  unseen(t: () => string | null, alerts: () => readonly FollowAlert[] | undefined): Signal<number> {
    return computed(() => { const k = t(); return unseenCount(alerts(), k == null ? undefined : this.state()?.seen[k]); });
  }

  /**
   * Heard as the store's list changed (another tab's changes are not this one's to report): a company that went first — at the limit the
   * oldest makes room, so the server does too — then the one that came.
   */
  toggle(t: string): void {
    if (this.waits(() => this.toggle(t))) return;
    const r = this.change((s) => toggled(s, t));
    if (!r || !this.changes) return;
    const [a, b] = r;
    for (const x of a.follows) if (!b.follows.includes(x)) this.changes({ ticker: x, on: false });
    for (const x of b.follows) if (!a.follows.includes(x)) this.changes({ ticker: x, on: true });
  }

  /** The page hears each reader's toggle that changed the list (to tell the server, once the follows are linked to an email). */
  listenChanges(fn: (c: { ticker: string; on: boolean }) => void): void { this.changes = fn; }

  /** The email link the server gave (null: none, after unsubscribing). */
  setLink(l: FollowLink | null): void { if (!this.waits(() => this.setLink(l))) this.change((s) => { const { link: _, ...rest } = s; return l ? { ...rest, link: l } : rest; }); }

  /** The follows become this list (the server's, merged by the page): no change is heard. */
  replaceFollows(tickers: readonly string[]): void { if (!this.waits(() => this.replaceFollows(tickers))) this.change((s) => replaced(s, tickers)); }

  markSeen(t: string, session: string): void { if (!this.waits(() => this.markSeen(t, session))) this.change((s) => seenUpTo(s, t, session)); }

  press(p: Omit<FollowPress, 'at'>): void {
    const full = { ...p, at: ++this.presses };
    this.pressedSig.set(full);
    this.listener?.(full);
  }

  /** The page's panel hears each press (a plain callback: an effect would make the main bundle export Angular's effect for its chunk). */
  listen(fn: (p: FollowPress) => void): void { this.listener = fn; }

  /** A change starts from the store, not from this page's copy: another tab may have followed something since (its follows stay). */
  /** The state before and after (null: no store, or not read yet). */
  private change(f: (s: FollowState) => FollowState): [FollowState, FollowState] | null {
    const s = this.state();
    if (!this.store || s === null) return null;
    let base = s;
    try { const fresh = this.store.read(); if (!(fresh instanceof Promise)) base = fresh; } catch { /* a store that cannot be read: this page's copy */ }
    const next = f(base);
    this.state.set(next);
    if (next !== base) try { this.store.write(next); } catch { /* not kept: this page still shows it */ }
    return [base, next];
  }
}

import { afterNextRender, computed, inject, Injectable, InjectionToken, signal, type Signal } from '@angular/core';

/** Where the page keeps the reader's picks (the site: this browser's localStorage). Never on the server, never sent anywhere. */
export interface PickStore {
  read(): Record<string, string>;
  /** `null` removes the pick. */
  write(key: string, value: string | null): void;
}
/** Provided by the page in the browser; absent on the server and in the checks, where nobody can pick. */
export const PT_PICKS = new InjectionToken<PickStore>('PT_PICKS');

/**
 * The reader's own calls on open outcomes ("Beat" / "Miss"), remembered by the page: `picks.of(() => key)` is the pick of a key,
 * `picks.set(key, value)` changes it (null clears). `ready()` is true only in a browser whose page stores picks, after the first
 * render — so the server HTML and hydration never depend on a pick: render the pick buttons inside `@if (picks.ready())`.
 */
@Injectable({ providedIn: 'root' })
export class PtPicks {
  private readonly store = inject(PT_PICKS, { optional: true });
  /** null until read, after the first render in the browser */
  private readonly all = signal<Record<string, string> | null>(null);
  readonly ready = computed(() => this.all() !== null);

  constructor() {
    const store = this.store;
    if (store) afterNextRender(() => {
      let read: Record<string, string> = {};
      try { read = { ...store.read() }; } catch { /* a store that fails holds no picks */ }
      this.all.set(read);
    });
  }

  of(key: () => string | null): Signal<string | null> {
    return computed(() => {
      const k = key();
      const all = this.all();
      return k != null && all && Object.hasOwn(all, k) ? all[k]! : null;
    });
  }

  set(key: string, value: string | null): void {
    if (!this.store || this.all() === null) return;
    this.store.write(key, value);
    this.all.update((all) => {
      const next = { ...all };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }
}

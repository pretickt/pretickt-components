import { assertInInjectionContext, computed, effect, inject, Injectable, InjectionToken, PendingTasks, signal, untracked, type Signal } from '@angular/core';
import type * as z from 'zod/mini';
import { needKey, type TypologyId } from '../api';
import { TYPOLOGY_IDS } from '../typologies/ids';
import type { TYPOLOGY_SCHEMAS, TypologyKey } from '../typologies/schemas';
import { FAILED, methodOf, PtStore } from './store';

type T = typeof TYPOLOGY_SCHEMAS;
type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;
type MethodName<K extends string> = K extends `${infer N}@${number}` ? Camel<N> : never;
export type PtParams<K extends TypologyKey> = z.input<T[K]['params']>;
export type PtPayload<K extends TypologyKey> = z.output<T[K]['payload']>;

/** The page's store: provided by the page app (browser: from the page state), by `renderPage` (build) or by a test. */
export const PT_STORE = new InjectionToken<PtStore>('PT_STORE');

/**
 * One call's answer as signals. `value()`: the payload, `null` when the data is not available, `undefined` only while a call never
 * answered before is pending (never on the first render of a hydrated page: the build recorded it). `params()`: the params of the
 * value shown (captions follow the data on screen, not the control pressed). `failed()`: the browser request for the current
 * params failed — the last value stays. `retry()`: ask again after a failure.
 */
export interface PtResource<V> {
  value: Signal<V | null | undefined>;
  loading: Signal<boolean>;
  failed: Signal<boolean>;
  params: Signal<unknown>;
  retry(): void;
}

type Methods = { readonly [K in TypologyKey as MethodName<K>]: (params: () => PtParams<K> | null) => PtResource<PtPayload<K>> };

/**
 * The data context of one placement (`PtSlot` provides it; tests provide it with a `PT_STORE`). One method per typology:
 * `pt.moveBreakdown(() => ({ ticker: this.ticker(), window: this.win() }))`, called where a component declares its fields.
 * Latest params win; equal calls share one answer (the page cache). `failed()`: some request of this placement failed (the page
 * shows the `.pt-island-error` notice).
 */
@Injectable()
export class Pt {
  private readonly store = inject(PT_STORE);
  private readonly tasks = inject(PendingTasks);
  private readonly failures = signal(0);
  readonly failed = computed(() => this.failures() > 0);

  constructor() {
    for (const t of TYPOLOGY_IDS) (this as unknown as Record<string, unknown>)[methodOf(t)] = (p: () => unknown) => this.resource(t, p);
  }

  private resource<V>(t: TypologyKey, params: () => unknown): PtResource<V> {
    assertInInjectionContext(this.resource);
    const store = this.store;
    const tick = signal(0);           // bumps when an answer this resource asked for lands
    const failedKeys = new Set<string>();
    let shown: { v: V | null; params: unknown } | undefined;
    let mineFailed = false;
    const setFailed = (f: boolean) => { if (f !== mineFailed) { mineFailed = f; this.failures.update((n) => n + (f ? 1 : -1)); } };

    const current = computed(() => {
      const p = params();
      return p == null ? null : { p, key: needKey({ t: t as TypologyId, params: p }) };
    });
    // reading only: the first render (server or hydration) shows what is known, never starts work
    const state = computed(() => {
      tick();
      const c = current();
      if (!c) return { v: undefined as V | null | undefined, loading: false, failed: false, params: undefined as unknown };
      const hit = store.peek(c.key);
      if (hit) { shown = { v: hit.v as V | null, params: c.p }; return { v: shown.v, loading: false, failed: false, params: c.p }; }
      const failed = failedKeys.has(c.key);
      return { v: shown?.v, loading: !failed, failed, params: shown?.params };
    });
    // asking: after the render, for params whose answer is not known (the build waits for it; the browser fetches it)
    const asked = new Set<string>();
    const ask = (c: { p: unknown; key: string }) => {
      asked.add(c.key);
      failedKeys.delete(c.key);
      const done = store.server ? this.tasks.add() : null;
      store.ask(t, c.p).then((v) => {
        if (v === FAILED) failedKeys.add(c.key);
        if (untracked(current)?.key === c.key) setFailed(v === FAILED);
        tick.update((n) => n + 1);
      }).finally(() => done?.());
    };
    effect(() => {
      const c = current();
      if (!c || store.peek(c.key) || asked.has(c.key)) { if (c && store.peek(c.key)) untracked(() => setFailed(false)); return; }
      untracked(() => ask(c));
    });
    return {
      value: computed(() => state().v),
      loading: computed(() => state().loading),
      failed: computed(() => state().failed),
      params: computed(() => state().params),
      retry: () => {
        const c = untracked(current);
        if (c && failedKeys.has(c.key)) ask(c);
      },
    };
  }
}
export interface Pt extends Methods {}

import { inject, type InjectionKey } from 'vue';
import type * as z from 'zod/mini';
import { needKey } from '../api';
import { TYPOLOGY_IDS } from '../typologies/ids';
import type { TYPOLOGY_SCHEMAS, TypologyKey } from '../typologies/schemas';

type T = typeof TYPOLOGY_SCHEMAS;
type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;
type MethodName<K extends string> = K extends `${infer N}@${number}` ? Camel<N> : never;

export type PtParams<K extends TypologyKey> = z.input<T[K]['params']>;
export type PtPayload<K extends TypologyKey> = z.output<T[K]['payload']>;
/** One async method per typology: `pt.moveBreakdown({ ticker, window })` → the payload, or null when the data is not available. */
export type PtContext = { readonly [K in TypologyKey as MethodName<K>]: (params: PtParams<K>) => Promise<PtPayload<K> | null> };

/** `move-breakdown@1` → `moveBreakdown`. */
export const methodOf = (id: string): string => id.split('@')[0]!.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const BY_METHOD = new Map(TYPOLOGY_IDS.map((id) => [methodOf(id), id as TypologyKey]));
/** `moveBreakdown` → `move-breakdown@1`. */
export const typologyOf = (method: string): TypologyKey | undefined => BY_METHOD.get(method);

export const PT: InjectionKey<PtContext> = Symbol('pt');

/** The data context of the island this component renders in. */
export function usePt(): PtContext {
  const pt = inject(PT, null);
  if (!pt) throw new Error('usePt(): no pt context — components render inside a pretickt island (renderIsland / the island runtime)');
  return pt;
}

export interface PtOptions {
  /** Answers one call (build: the database; browser: the API). A rejection means the data is not available. */
  resolve: (t: TypologyKey, params: unknown) => Promise<unknown>;
  /** Browser: the calls the build recorded for this page, by need key — answered without the network. */
  replay?: Record<string, unknown>;
  /** Build: filled with every answered call, by need key (nulls included, so the browser replays "not available" too). */
  record?: Record<string, unknown>;
  /** Answers by need key, shared between contexts (the islands of a page, the pages of a build step). */
  cache?: Map<string, Promise<unknown>>;
  /** Build time and checks: throw on params the typology rejects (validateParams). The browser trusts the API, which validates. */
  validate?: (t: TypologyKey, params: unknown) => void;
  /**
   * Browser: the island's interaction counter (the runtime bumps it on every pointer or key press inside the island). It is what
   * "latest wins" compares; without it (build, checks) no call is ever dropped.
   */
  epoch?: () => number;
  /**
   * Browser: hears whether each request was answered or failed. With it, a failed request (429, 5xx, offline) never settles — the
   * component keeps what it shows — instead of answering null, which means "not available"; without it (build) a failure is null.
   */
  status?: (s: 'ok' | 'failed') => void;
}

const FAILED = Symbol('failed');
const never = () => new Promise<never>(() => {});

/**
 * The platform's implementation of the context. A call's key is its typology and the params exactly as the component passed them
 * (the same component makes the same call on the server and in the browser, so the browser finds the recorded answer); answers are
 * cached per key. Latest wins per method, between interactions: a call made in an earlier interaction than a newer call of the
 * same method never settles (a stale click cannot overwrite a fresh one); calls of one interaction — or of the build, which has
 * none — never supersede each other, however they are nested.
 */
export function createPt(o: PtOptions): PtContext {
  const cache = o.cache ?? new Map<string, Promise<unknown>>();
  for (const [k, v] of Object.entries(o.replay ?? {})) if (!cache.has(k)) cache.set(k, Promise.resolve(v));
  const newest = new Map<string, number>();

  const call = (t: TypologyKey) => async (raw: unknown): Promise<unknown> => {
    o.validate?.(t, raw);
    const key = needKey({ t, params: raw });
    const mine = o.epoch?.() ?? 0;
    newest.set(t, Math.max(newest.get(t) ?? 0, mine));
    let p = cache.get(key);
    if (!p) {
      p = o.resolve(t, raw).then((v) => v ?? null, () => { cache.delete(key); return o.status ? FAILED : null; });
      cache.set(key, p);
    }
    const value = await p;
    o.status?.(value === FAILED ? 'failed' : 'ok');
    if (value === FAILED) return never(); // the component keeps what it shows; the runtime says the data could not load
    if (o.record) o.record[key] = value;
    if ((newest.get(t) ?? 0) > mine) return never(); // superseded by a newer interaction's call
    return value;
  };
  return Object.freeze(Object.fromEntries(TYPOLOGY_IDS.map((t) => [methodOf(t), call(t)]))) as unknown as PtContext;
}

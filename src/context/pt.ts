import { inject, type InjectionKey } from 'vue';
import type * as z from 'zod/mini';
import { needKey } from '../sdk/key';
import { TYPOLOGY_SCHEMAS, type TypologyKey } from '../typologies/schemas';

type T = typeof TYPOLOGY_SCHEMAS;
type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S;
type MethodName<K extends string> = K extends `${infer N}@${number}` ? Camel<N> : never;

export type PtParams<K extends TypologyKey> = z.input<T[K]['params']>;
export type PtPayload<K extends TypologyKey> = z.output<T[K]['payload']>;
/** One async method per typology: `pt.moveBreakdown({ ticker, window })` → the payload, or null when the data is not available. */
export type PtContext = { readonly [K in TypologyKey as MethodName<K>]: (params: PtParams<K>) => Promise<PtPayload<K> | null> };

/** `move-breakdown@1` → `moveBreakdown`. */
export const methodOf = (id: string): string => id.split('@')[0]!.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const BY_METHOD = new Map(Object.keys(TYPOLOGY_SCHEMAS).map((id) => [methodOf(id), id as TypologyKey]));
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
}

/**
 * The platform's implementation of the context. Params are parsed by the typology (defaults applied, so equal calls share a key);
 * answers are cached per key. Latest wins per method: a call started in an earlier turn than a newer call of the same method never
 * settles if it would answer after it (a stale click cannot overwrite a fresh one); calls started together (Promise.all) do not
 * supersede each other.
 */
export function createPt(o: PtOptions): PtContext {
  const cache = o.cache ?? new Map<string, Promise<unknown>>();
  for (const [k, v] of Object.entries(o.replay ?? {})) if (!cache.has(k)) cache.set(k, Promise.resolve(v));
  let turn = 0, turnScheduled = false;
  const currentTurn = () => {
    if (!turnScheduled) { turnScheduled = true; queueMicrotask(() => { turn++; turnScheduled = false; }); }
    return turn;
  };
  const newest = new Map<string, number>();

  const call = (t: TypologyKey) => async (raw: unknown): Promise<unknown> => {
    const parsed = TYPOLOGY_SCHEMAS[t].params.safeParse(raw);
    if (!parsed.success) throw new Error(`pt.${methodOf(t)}: params rejected by ${t}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    const key = needKey({ t, params: parsed.data });
    const mine = currentTurn();
    newest.set(t, Math.max(newest.get(t) ?? 0, mine));
    let p = cache.get(key);
    if (!p) {
      p = o.resolve(t, parsed.data).then((v) => v ?? null, () => { cache.delete(key); return null; });
      cache.set(key, p);
    }
    const value = await p;
    if (o.record) o.record[key] = value;
    if ((newest.get(t) ?? 0) > mine) return new Promise(() => {}); // superseded by a newer call: never settles
    return value;
  };
  return Object.freeze(Object.fromEntries(Object.keys(TYPOLOGY_SCHEMAS).map((t) => [methodOf(t), call(t as TypologyKey)]))) as unknown as PtContext;
}

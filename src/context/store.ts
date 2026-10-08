import { needKey, type TypologyId } from '../api';
import { TYPOLOGY_IDS } from '../typologies/ids';
import type { TypologyKey } from '../typologies/schemas';

/** `move-breakdown@1` → `moveBreakdown`. */
export const methodOf = (id: string): string => id.split('@')[0]!.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const BY_METHOD = new Map(TYPOLOGY_IDS.map((id) => [methodOf(id), id as TypologyKey]));
/** `moveBreakdown` → `move-breakdown@1`. */
export const typologyOf = (method: string): TypologyKey | undefined => BY_METHOD.get(method);

export interface PtStoreOptions {
  /** Answers one call (build: the database; browser: the API). A rejection means the request failed. */
  resolve: (t: TypologyKey, params: unknown) => Promise<unknown>;
  /** Browser: the answers the build recorded for this page, by need key — read without the network. */
  replay?: Record<string, unknown>;
  /** Build: filled with every answered call, by need key (nulls included, so the browser replays "not available" too). */
  record?: Record<string, unknown>;
  /** Answers by need key, shared (the pages of a build step; the placements and hover cards of a page). */
  cache?: Map<string, Promise<unknown>>;
  /** Build and checks: throw on params the typology rejects (validateParams). The browser trusts the API, which validates. */
  validate?: (t: TypologyKey, params: unknown) => void;
  /** Build time (a failed call means "not available"); in the browser a failed request is a failure, never "not available". */
  server: boolean;
}

/** A request that failed in the browser (429, 5xx, offline): the component keeps what it shows. */
export const FAILED: unique symbol = Symbol('failed');

/**
 * The page's data: every answer by need key (`t|canonical params`), so the same call made on the server and in the browser finds
 * the same entry. Framework-free; `Pt` (per placement) builds signals on it.
 */
export class PtStore {
  private readonly cache: Map<string, Promise<unknown>>;
  private readonly settled = new Map<string, unknown>();

  constructor(private readonly o: PtStoreOptions) {
    this.cache = o.cache ?? new Map();
    for (const [k, v] of Object.entries(o.replay ?? {})) this.settled.set(k, v);
  }

  get server(): boolean { return this.o.server; }

  /** The answer of a call already known (replayed, or settled in this page), synchronously; `undefined` when not known. */
  peek(key: string): { v: unknown } | undefined {
    return this.settled.has(key) ? { v: this.settled.get(key) } : undefined;
  }

  /** Asks for a call (or joins the same call already asked). Server: a failure is null; browser: a failure is FAILED (not cached). */
  ask(t: TypologyKey, params: unknown): Promise<unknown> {
    this.o.validate?.(t, params);
    const key = needKey({ t: t as TypologyId, params });
    let p = this.cache.get(key);
    if (!p) {
      p = this.o.resolve(t, params).then((v) => v ?? null, () => {
        this.cache.delete(key);
        return this.o.server ? null : FAILED;
      });
      this.cache.set(key, p);
    }
    return p.then((v) => {
      if (v !== FAILED) {
        this.settled.set(key, v);
        if (this.o.record) this.o.record[key] = v;
      }
      return v;
    });
  }

  /** Everything this page's renders recorded (server). */
  recorded(): Record<string, unknown> { return this.o.record ?? {}; }
}

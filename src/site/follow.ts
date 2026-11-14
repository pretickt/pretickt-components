import type { FollowState, FollowStore } from '@pretickt/components/context';

/** The localStorage key of what this browser follows. */
export const FOLLOW_KEY = 'pt-follow-v1';
const TICKER = /^[A-Z][A-Z0-9]{0,5}(\.[A-Z])?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** This browser's localStorage, or null where reading it throws (blocked storage, sandboxed frames). */
function browserStorage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** The site's follow store: one JSON object in localStorage. Any failure (no storage, garbage, quota) follows nothing, never an error. */
export function localFollows(storage: Storage | null = browserStorage()): FollowStore {
  return {
    read(): FollowState {
      try {
        const v: unknown = JSON.parse(storage?.getItem(FOLLOW_KEY) ?? '{}');
        const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as { follows?: unknown; seen?: unknown }) : {};
        const follows = Array.isArray(o.follows) ? o.follows.filter((t): t is string => typeof t === 'string' && TICKER.test(t)) : [];
        const seen = o.seen && typeof o.seen === 'object' && !Array.isArray(o.seen)
          ? Object.fromEntries(Object.entries(o.seen).filter((e): e is [string, string] => TICKER.test(e[0]) && typeof e[1] === 'string' && DAY.test(e[1])))
          : {};
        return { follows: [...new Set(follows)], seen };
      } catch { return { follows: [], seen: {} }; }
    },
    write(s) {
      try { storage?.setItem(FOLLOW_KEY, JSON.stringify({ v: 1, follows: s.follows, seen: s.seen })); } catch { /* full or blocked: not kept */ }
    },
  };
}

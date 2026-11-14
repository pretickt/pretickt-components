import type { FollowLink, FollowState, FollowStore } from '@pretickt/components/context';

/** The localStorage key of what this browser follows. */
export const FOLLOW_KEY = 'pt-follow-v1';
const TICKER = /^[A-Z][A-Z0-9]{0,5}(\.[A-Z])?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** a manage link's token: its claims and their signature, both base64url (platform site/src/alerts.ts) */
const TOKEN = /^[A-Za-z0-9_-]{1,1500}\.[A-Za-z0-9_-]{1,100}$/;
const linkOf = (v: unknown): FollowLink | undefined => {
  const l = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  return l && typeof l['token'] === 'string' && TOKEN.test(l['token']) && typeof l['email'] === 'string' && l['email'].length <= 254 &&
    (l['cadence'] === 'day' || l['cadence'] === 'week') ? { token: l['token'], email: l['email'], cadence: l['cadence'], ...(l['dirty'] === true ? { dirty: true as const } : {}) } : undefined;
};

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
        const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as { follows?: unknown; seen?: unknown; link?: unknown }) : {};
        const follows = Array.isArray(o.follows) ? o.follows.filter((t): t is string => typeof t === 'string' && TICKER.test(t)) : [];
        const seen = o.seen && typeof o.seen === 'object' && !Array.isArray(o.seen)
          ? Object.fromEntries(Object.entries(o.seen).filter((e): e is [string, string] => TICKER.test(e[0]) && typeof e[1] === 'string' && DAY.test(e[1])))
          : {};
        const link = linkOf(o.link);
        return { follows: [...new Set(follows)], seen, ...(link ? { link } : {}) };
      } catch { return { follows: [], seen: {} }; }
    },
    write(s) {
      try { storage?.setItem(FOLLOW_KEY, JSON.stringify({ v: 1, follows: s.follows, seen: s.seen, ...(s.link ? { link: s.link } : {}) })); } catch { /* full or blocked: not kept */ }
    },
  };
}

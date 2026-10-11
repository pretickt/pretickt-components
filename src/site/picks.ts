import type { PickStore } from '@pretickt/components/context';

/** The localStorage key of every pick, and how many it keeps (the oldest goes first). */
export const PICKS_KEY = 'pt-picks';
export const PICKS_MAX = 300;
const KEY_MAX = 200;
const VALUE_MAX = 40;

/** This browser's localStorage, or null where reading it throws (blocked storage, sandboxed frames). */
function browserStorage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** The site's pick store: one JSON object in localStorage. Any failure (no storage, garbage, quota) means no picks, never an error. */
export function localPicks(storage: Storage | null = browserStorage()): PickStore {
  const read = (): Record<string, string> => {
    try {
      const v: unknown = JSON.parse(storage?.getItem(PICKS_KEY) ?? '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
      return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'));
    } catch { return {}; }
  };
  return {
    read,
    write(key, value) {
      if (!storage || key.length > KEY_MAX || (value !== null && value.length > VALUE_MAX)) return;
      const all = read();
      delete all[key]; // a rewritten pick moves to the end: the newest
      if (value !== null) all[key] = value;
      const keys = Object.keys(all);
      for (const k of keys.slice(0, Math.max(0, keys.length - PICKS_MAX))) delete all[k];
      try { storage.setItem(PICKS_KEY, JSON.stringify(all)); } catch { /* full or blocked: the pick is not kept */ }
    },
  };
}

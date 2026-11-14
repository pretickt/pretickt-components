import type { FollowAlert } from '../typologies';

/** What this browser follows (tickers, in the order followed) and, per ticker, the newest session of its alerts already seen. */
export interface FollowState { follows: string[]; seen: Record<string, string> }
/** At most this many follows (the oldest goes first), and this many seen marks. */
export const FOLLOW_LIMIT = 200;
const SEEN_LIMIT = 400;

/** The alerts after the newest seen session; every one when none was seen. */
export function unseenCount(alerts: readonly FollowAlert[] | undefined, seen: string | undefined): number {
  return (alerts ?? []).filter((a) => seen === undefined || a.session > seen).length;
}

/** The ticker followed (at the end) or no longer followed. */
export function toggled(s: FollowState, t: string): FollowState {
  const follows = s.follows.includes(t) ? s.follows.filter((x) => x !== t) : [...s.follows, t].slice(-FOLLOW_LIMIT);
  return { ...s, follows };
}

/** The ticker's alerts seen up to `session` (a later mark is kept); the oldest marks go past the limit. */
export function seenUpTo(s: FollowState, t: string, session: string): FollowState {
  const was = s.seen[t];
  if (was !== undefined && was >= session) return s;
  const seen = { ...s.seen };
  delete seen[t]; // the newest mark at the end
  seen[t] = session;
  const keys = Object.keys(seen);
  for (const k of keys.slice(0, Math.max(0, keys.length - SEEN_LIMIT))) delete seen[k];
  return { ...s, seen };
}

import type { FollowAlert } from '../typologies';

/** The email this browser's follows go to (part 2): the manage token the server gave, the address as it shows it, how often. */
export interface FollowLink { token: string; email: string; cadence: 'day' | 'week'; /** a change that did not reach the server: /alerts/ sends the whole list */ dirty?: true }
/** What this browser follows (tickers, in the order followed), per ticker the newest session of its alerts already seen, and its email link. */
export interface FollowState { follows: string[]; seen: Record<string, string>; link?: FollowLink }
const TICKER = /^[A-Z][A-Z0-9]{0,5}(\.[A-Z])?$/;
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

/**
 * Many at once (a portfolio's companies): on, the missing ones join at the end in the group's order and, at the limit, the oldest companies
 * outside the group make room (never one of the group already followed); off, they go.
 */
export function manyFollowed(s: FollowState, tickers: readonly string[], on: boolean): FollowState {
  const group = new Set(tickers);
  let follows = s.follows.filter((t) => !group.has(t));
  if (on) {
    const joined = [...s.follows, ...[...group].filter((t) => !s.follows.includes(t))];
    let over = joined.length - FOLLOW_LIMIT;
    follows = joined.filter((t) => { if (over > 0 && !group.has(t)) { over--; return false; } return true; }).slice(-FOLLOW_LIMIT);
  }
  return follows.length === s.follows.length && follows.every((t, i) => t === s.follows[i]) ? s : { ...s, follows };
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

/** The follows become this list (the server's): valid tickers, once each, in its order, at most the limit. */
export function replaced(s: FollowState, tickers: readonly string[]): FollowState {
  return { ...s, follows: [...new Set(tickers.filter((t) => TICKER.test(t)))].slice(0, FOLLOW_LIMIT) };
}

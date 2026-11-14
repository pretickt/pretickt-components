import { describe, expect, it } from 'vitest';
import { FOLLOW_LIMIT, replaced, seenUpTo, toggled, unseenCount, type FollowState } from '../context/follow-state';
import type { FollowAlert } from '../typologies';
import { FOLLOW_KEY, localFollows } from './follow';

/** A Storage in memory, or one whose every call throws (a private window, blocked site data). */
function storage(throws = false): Storage {
  const m = new Map<string, string>();
  const no = () => { throw new Error('blocked'); };
  return {
    getItem: throws ? no : (k: string) => m.get(k) ?? null,
    setItem: throws ? no : (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; },
  } as Storage;
}
const alert = (session: string): FollowAlert => ({ kind: 'rsi', session, tone: 'flat', label: 'RSI', value: '72', line: 'RSI at 72', pic: null });

describe('what this browser follows (localStorage, never sent anywhere)', () => {
  it('follows and seen survive a reload, a broken value reads as empty, a throwing storage keeps nothing and never throws', () => {
    const s = storage();
    localFollows(s).write({ follows: ['NVDA', 'AAPL'], seen: { NVDA: '2026-11-12' } });
    expect(localFollows(s).read()).toEqual({ follows: ['NVDA', 'AAPL'], seen: { NVDA: '2026-11-12' } });
    s.setItem(FOLLOW_KEY, '{');
    expect(localFollows(s).read()).toEqual({ follows: [], seen: {} });
    s.setItem(FOLLOW_KEY, JSON.stringify({ v: 1, follows: ['NVDA', 3, 'bad ticker'], seen: { NVDA: 'x', AAPL: '2026-11-10' } }));
    expect(localFollows(s).read()).toEqual({ follows: ['NVDA'], seen: { AAPL: '2026-11-10' } });
    const blocked = localFollows(storage(true));
    expect(blocked.read()).toEqual({ follows: [], seen: {} });
    expect(() => blocked.write({ follows: ['NVDA'], seen: {} })).not.toThrow();
    expect(localFollows(null).read()).toEqual({ follows: [], seen: {} });
  });
  it('unseen counts the alerts after the newest seen session; nothing seen counts them all', () => {
    const a = [alert('2026-11-13'), alert('2026-11-12'), alert('2026-11-10')];
    expect(unseenCount(a, undefined)).toBe(3);
    expect(unseenCount(a, '2026-11-12')).toBe(1);
    expect(unseenCount(a, '2026-11-13')).toBe(0);
    expect(unseenCount(undefined, undefined)).toBe(0);
  });
  it('toggling adds at the end and removes; the 201st follow drops the oldest; seen keeps the later session', () => {
    const none: FollowState = { follows: [], seen: {} };
    expect(toggled(toggled(none, 'NVDA'), 'AAPL').follows).toEqual(['NVDA', 'AAPL']);
    expect(toggled({ follows: ['NVDA', 'AAPL'], seen: {} }, 'NVDA').follows).toEqual(['AAPL']);
    const full: FollowState = { follows: Array.from({ length: FOLLOW_LIMIT }, (_, i) => `T${i}`), seen: {} };
    const more = toggled(full, 'NVDA');
    expect(more.follows).toHaveLength(FOLLOW_LIMIT);
    expect(more.follows[0]).toBe('T1');
    expect(more.follows.at(-1)).toBe('NVDA');
    expect(seenUpTo(seenUpTo(none, 'NVDA', '2026-11-13'), 'NVDA', '2026-11-10').seen).toEqual({ NVDA: '2026-11-13' });
  });
  it("the email link (part 2) survives a reload; a malformed one is dropped, the follows kept", () => {
    const s = storage();
    const link = { token: 'eyJzIjoiMSJ9.c2ln', email: 'r•••@gmail.com', cadence: 'week' as const };
    localFollows(s).write({ follows: ['NVDA'], seen: {}, link });
    expect(localFollows(s).read()).toEqual({ follows: ['NVDA'], seen: {}, link });
    s.setItem(FOLLOW_KEY, JSON.stringify({ v: 1, follows: ['NVDA'], seen: {}, link: { token: 'not a token', email: 'x', cadence: 'day' } }));
    expect(localFollows(s).read()).toEqual({ follows: ['NVDA'], seen: {} });
  });
  it('the follows replaced by a list (the server\'s): valid tickers once each, in its order, at most the limit', () => {
    const r = replaced({ follows: ['AAPL'], seen: { AAPL: '2026-11-13' } }, ['NVDA', 'AAPL', 'NVDA', 'bad']);
    expect(r).toEqual({ follows: ['NVDA', 'AAPL'], seen: { AAPL: '2026-11-13' } });
    expect(replaced(r, Array.from({ length: FOLLOW_LIMIT + 5 }, (_, i) => `T${i}`)).follows).toHaveLength(FOLLOW_LIMIT);
  });
});

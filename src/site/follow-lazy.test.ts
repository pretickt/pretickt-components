import { describe, expect, it } from 'vitest';
import type { FollowState, FollowStore } from '@pretickt/components/context';
import { lazyFollows } from './follow-lazy';

describe('the follow store, loaded on first use (out of the main bundle)', () => {
  it('the first read waits for the store, the later ones are at once; a write before it arrives is kept', async () => {
    let data: FollowState = { follows: ['NVDA'], seen: {} };
    const real: FollowStore = { read: () => data, write: (s) => { data = s; } };
    let arrive!: (s: FollowStore) => void;
    const lazy = lazyFollows(() => new Promise((r) => { arrive = r; }));
    const first = lazy.read();
    expect(first).toBeInstanceOf(Promise);
    lazy.write({ follows: ['AAPL'], seen: {} });
    arrive(real);
    expect(await first).toEqual({ follows: ['NVDA'], seen: {} });
    await Promise.resolve();
    expect(lazy.read()).toEqual({ follows: ['AAPL'], seen: {} });
  });
  it('a store whose code does not come (a chunk that fails): this page keeps its changes in memory, no rejection is left unhandled', async () => {
    const lazy = lazyFollows(() => Promise.reject(new Error('chunk failed')));
    lazy.write({ follows: ['AAPL'], seen: {} });
    expect(await lazy.read()).toEqual({ follows: ['AAPL'], seen: {} });
    lazy.write({ follows: ['AAPL', 'KO'], seen: {} });
    expect(lazy.read()).toEqual({ follows: ['AAPL', 'KO'], seen: {} });
  });
  it('a store that fails before anything reads it leaves no unhandled rejection', async () => {
    lazyFollows(() => Promise.reject(new Error('chunk failed')));
    await new Promise((r) => setTimeout(r, 0));
  });
});

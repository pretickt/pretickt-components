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
});

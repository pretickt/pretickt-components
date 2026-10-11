import { describe, expect, it } from 'vitest';
import { localPicks, PICKS_KEY, PICKS_MAX } from './picks';

/** A Storage in memory (only what localPicks uses). */
function storage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage,
  };
}
const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => undefined } as unknown as Storage;

describe('localPicks (the site\'s store: this browser only)', () => {
  it('a write is read back, under one key; null removes', () => {
    const { m, s } = storage();
    const p = localPicks(s);
    p.write('ep:earnings:NVDA:2026-11-19', 'beat');
    expect(p.read()).toEqual({ 'ep:earnings:NVDA:2026-11-19': 'beat' });
    expect(JSON.parse(m.get(PICKS_KEY)!)).toEqual({ 'ep:earnings:NVDA:2026-11-19': 'beat' });
    p.write('ep:earnings:NVDA:2026-11-19', null);
    expect(p.read()).toEqual({});
  });

  it('garbage in the storage reads as no picks; only string values survive', () => {
    for (const raw of ['{not json', '[1,2]', '42', 'null']) expect(localPicks(storage({ [PICKS_KEY]: raw }).s).read()).toEqual({});
    expect(localPicks(storage({ [PICKS_KEY]: '{"a":"beat","b":3,"c":null}' }).s).read()).toEqual({ a: 'beat' });
  });

  it('a storage that throws, or none at all: no picks, writes ignored, never an error', () => {
    for (const s of [throwing, null]) {
      const p = localPicks(s);
      expect(p.read()).toEqual({});
      expect(() => p.write('k', 'beat')).not.toThrow();
    }
  });

  it(`keeps at most ${PICKS_MAX} picks, dropping the oldest; a rewritten pick counts as new`, () => {
    const { s } = storage();
    const p = localPicks(s);
    for (let i = 0; i <= PICKS_MAX; i++) p.write(`k${i}`, 'beat');
    const all = p.read();
    expect(Object.keys(all)).toHaveLength(PICKS_MAX);
    expect(all).not.toHaveProperty('k0');
    p.write('k1', 'miss');
    p.write('new', 'beat');
    expect(p.read()).not.toHaveProperty('k2');
    expect(p.read().k1).toBe('miss');
  });

  it('refuses keys over 200 characters and values over 40', () => {
    const { s } = storage();
    const p = localPicks(s);
    p.write('k'.repeat(201), 'beat');
    p.write('k', 'v'.repeat(41));
    expect(p.read()).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';
import { liveSource, parseLive } from './live';

const FILE = { v: 1, session: '2026-10-22', prev: '2026-10-21', asOf: '2026-10-22T15:30:00.000Z', delayMin: 15, closed: false,
  q: { META: { p: 646.1, pc: 694.73, r: -0.07, m: 0.01, s: 0.005, x: -0.085 } }, news: {}, earnings: {} };

describe('the intraday file in the page', () => {
  it('reads the file and says when its newest bar ended, New York time', () => {
    expect(parseLive(FILE)).toMatchObject({ session: '2026-10-22', prev: '2026-10-21', time: '11:30 AM ET', closed: false, q: FILE.q });
    expect(parseLive({ ...FILE, asOf: '2026-12-14T21:00:00Z' })?.time).toBe('4:00 PM ET'); // EST
  });
  it('refuses what is not the file', () => {
    for (const bad of [null, [], { ...FILE, v: 2 }, { ...FILE, session: 'today' }, { ...FILE, asOf: 'x' }, { ...FILE, q: [] }]) expect(parseLive(bad)).toBeNull();
  });
  it('asks once, whoever asks; no address or any failure means no live prices', async () => {
    const asked: string[] = [];
    const src = liveSource('https://storage.example/live/v1.json', { fetch: async (u) => { asked.push(u); return new Response(JSON.stringify(FILE)); } })!;
    const [a, b] = await Promise.all([src.load(), src.load()]);
    expect(a?.q.META?.p).toBe(646.1);
    expect(b).toBe(a);
    expect(asked).toEqual(['https://storage.example/live/v1.json']);
    expect(liveSource(undefined)).toBeNull();
    expect(await liveSource('u', { fetch: async () => new Response('nope', { status: 404 }) })!.load()).toBeNull();
    expect(await liveSource('u', { fetch: async () => { throw new Error('offline'); } })!.load()).toBeNull();
    expect(await liveSource('u', { fetch: async () => new Response('<html>') })!.load()).toBeNull();
  });
});

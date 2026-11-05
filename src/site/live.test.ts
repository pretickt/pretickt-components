import { describe, expect, it } from 'vitest';
import { liveSource, parseBars, parseLive } from './live';

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
  const LINES = { v: 1, session: '2026-10-22', prev: '2026-10-21', asOf: '2026-10-22T15:30:00.000Z', closed: false, start: '09:30', step: 5, bars: { META: [650.1, null, 646.1] } };
  it('reads the session\'s lines and says when the newest bar ended', () => {
    expect(parseBars(LINES)).toEqual({ session: '2026-10-22', prev: '2026-10-21', asOf: LINES.asOf, time: '11:30 AM ET', closed: false, bars: LINES.bars });
  });
  it('a file uploaded before prev and closed existed still reads, not closed', () => {
    const { prev: _p, closed: _c, ...old } = LINES;
    expect(parseBars(old)).toMatchObject({ session: '2026-10-22', closed: false });
    expect(parseBars(old)).not.toHaveProperty('prev');
  });
  it('refuses what is not the lines', () => {
    for (const bad of [null, [], { ...LINES, v: 2 }, { ...LINES, session: 'today' }, { ...LINES, asOf: 'x' }, { ...LINES, bars: [] }]) expect(parseBars(bad)).toBeNull();
  });
  it('reads the lines beside the file, afresh on every call; a failure answers null', async () => {
    const asked: string[] = [];
    let fail = false;
    const src = liveSource('https://storage.example/live/v1.json', { fetch: async (u) => {
      asked.push(u);
      if (fail) throw new Error('offline');
      return new Response(JSON.stringify(LINES));
    } })!;
    expect((await src.bars!())?.bars['META']).toEqual([650.1, null, 646.1]);
    await src.bars!();
    expect(asked).toEqual(['https://storage.example/live/bars-v1.json', 'https://storage.example/live/bars-v1.json']);
    fail = true;
    expect(await src.bars!()).toBeNull();
  });
});

import type { FollowStore } from '@pretickt/components/context';

/**
 * The follow store, loaded on first use (pages with the bells only): its code — reading and checking localStorage — stays out of the
 * main bundle. The first read waits for it; once it is here, reads and writes are at once (PtFollow's changes start from a fresh read).
 */
export function lazyFollows(load: () => Promise<FollowStore> = () => import('./follow').then((m) => m.localFollows())): FollowStore {
  let real: FollowStore | null = null;
  const ready = load().then((s) => (real = s));
  return {
    read: () => (real ? real.read() : ready.then((s) => s.read())),
    write: (s) => { if (real) real.write(s); else void ready.then((r) => r.write(s)); },
  };
}

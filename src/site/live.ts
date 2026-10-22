import type { LiveDay, LiveSource } from '@pretickt/components/context';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The file as the components read it, or null when it is not one (an old or broken upload shows nothing rather than nonsense). */
export function parseLive(v: unknown): LiveDay | null {
  if (!isObject(v) || v['v'] !== 1 || typeof v['session'] !== 'string' || !DAY.test(v['session']) || typeof v['prev'] !== 'string'
    || typeof v['asOf'] !== 'string' || !isObject(v['q'])) return null;
  const at = new Date(v['asOf']);
  if (Number.isNaN(at.getTime())) return null;
  return {
    session: v['session'], prev: v['prev'], asOf: v['asOf'], time: `${TIME.format(at)} ET`,
    delayMin: typeof v['delayMin'] === 'number' ? v['delayMin'] : 15, closed: v['closed'] === true,
    q: v['q'] as LiveDay['q'], news: (isObject(v['news']) ? v['news'] : {}) as LiveDay['news'],
    earnings: (isObject(v['earnings']) ? v['earnings'] : {}) as LiveDay['earnings'],
  };
}

/**
 * The site's intraday file: read once, when a component first asks for it (a page without a company card or "why it moved" never
 * does). No address (a preview, the admin), or any failure: null, and the page keeps its end-of-day data.
 */
export function liveSource(url: string | undefined, o: { fetch?: (u: string) => Promise<Response> } = {}): LiveSource | null {
  if (!url) return null;
  const get = o.fetch ?? ((u: string) => fetch(u, { credentials: 'omit' }));
  let once: Promise<LiveDay | null> | null = null;
  const read = async () => {
    try {
      const res = await get(url);
      return res.ok ? parseLive(await res.json()) : null;
    } catch { return null; }
  };
  return { load: () => (once ??= read()) };
}

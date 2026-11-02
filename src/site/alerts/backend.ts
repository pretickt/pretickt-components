import { FAILED, type PtStore } from '@pretickt/components/context';
import type { AlertUniverse } from '../../alerts/rows';
import type { AlertsBackend, ManageState } from '../../alerts/token';
import { landingOf } from './landing';

export interface SiteBackendOptions {
  store: Pick<PtStore, 'ask'>;
  /** the API's origin ('' on www: the same site) */
  api: string;
  /** the intraday file (`live/v1.json`): the session's 5-minute closes are beside it, in `bars-v1.json` */
  live?: string;
  /** the page address's query: the email link's landing */
  search: string;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
}
interface BarsFile { session: string; bars: Record<string, unknown> }

/**
 * The alerts' side of www (spec §4): the universe through the page's store (`alert-universe@1`), a stock's line of the session from
 * the live job's bars file (read once; none when it is an older session than the universe's), and the Worker's `/v1/alerts`
 * (save) and `/v1/alerts/manage` (the link's token and an op).
 */
export function siteBackend(o: SiteBackendOptions): AlertsBackend {
  const get = o.fetch ?? ((u: string, init?: RequestInit) => fetch(u, init));
  const post = (path: string, body: unknown) => get(`${o.api}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' });
  let asOf: string | null = null;
  let file: Promise<BarsFile | null> | null = null;
  const barsFile = (url: string) => get(url, { credentials: 'omit' })
    .then(async (r) => {
      const v = r.ok ? (await r.json()) as Partial<BarsFile> : null;
      return v && typeof v.session === 'string' && v.bars && typeof v.bars === 'object' ? { session: v.session, bars: v.bars } : null;
    })
    .catch(() => null);
  return {
    async universe() {
      const u = await o.store.ask('alert-universe@1', {});
      if (!u || u === FAILED) return null;
      asOf = (u as AlertUniverse).asOf;
      return u as AlertUniverse;
    },
    async bars(ticker) {
      if (!o.live) return null;
      const f = await (file ??= barsFile(o.live.replace(/v1\.json$/, 'bars-v1.json')));
      const line = f && asOf && f.session >= asOf ? f.bars[ticker] : null;
      // null before the first trade of the session (a gap afterwards keeps the last close)
      const closes = Array.isArray(line) ? line.filter((v): v is number => typeof v === 'number') : [];
      return closes.length ? closes : null;
    },
    async save(req) {
      const r = await post('/v1/alerts', req);
      return r.ok ? { ok: true } : { ok: false, reason: r.status === 400 ? 'invalid' : r.status === 429 ? 'limit' : 'network' };
    },
    async manage(token, op) {
      const r = await post('/v1/alerts/manage', { t: token, op });
      if (r.ok) return (await r.json()) as ManageState;
      if (r.status === 403 || r.status === 410) return null;   // a link that no longer works
      throw new Error(`alerts ${r.status}`);
    },
    landing: () => landingOf(o.search),
  };
}

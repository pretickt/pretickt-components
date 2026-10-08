import { needPath, type TypologyId } from '../api';
import { PtStore } from '@pretickt/components/context';
import type { PageModel } from './model';

/** The browser's store: the build's answers replayed from the page; any other call goes to `/v1/t` (the API validated it). */
export function browserStore(page: PageModel, replay: Record<string, unknown>, fetchImpl: (url: string) => Promise<Response> = (u) => fetch(u)): PtStore {
  return new PtStore({
    server: false,
    replay,
    resolve: async (t, params) => {
      const r = await fetchImpl(`${page.api}${needPath({ t: t as TypologyId, params }, page.buildId)}`);
      if (!r.ok) throw new Error(`api ${r.status}`);
      return r.json() as Promise<unknown>;
    },
  });
}

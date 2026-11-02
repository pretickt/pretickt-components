import { describe, expect, it } from 'vitest';
import { FAILED } from '@pretickt/components/context';
import { MOCK_UNIVERSE } from '../../alerts/mock';
import { siteBackend } from './backend';

type Call = { url: string; init?: RequestInit };
function fake(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = async (url: string, init?: RequestInit) => { calls.push({ url, init }); return answer(url, init); };
  return { calls, fetch };
}
const res = (status: number, body: unknown = null) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const store = (u: unknown = MOCK_UNIVERSE) => {
  const asked: [string, unknown][] = [];
  return { asked, ask: async (t: string, p: unknown) => { asked.push([t, p]); return u; } };
};
const LIVE = 'https://storage.example/live/v1.json';

describe("the site's alerts backend (the page's /v1/alerts, the store, the live files)", () => {
  it('the universe comes through the page store; a failed call is none', async () => {
    const s = store();
    const b = siteBackend({ store: s, api: '', search: '', fetch: fake(() => res(500)).fetch });
    expect(await b.universe()).toEqual(MOCK_UNIVERSE);
    expect(s.asked).toEqual([['alert-universe@1', {}]]);
    expect(await siteBackend({ store: store(FAILED), api: '', search: '' }).universe()).toBeNull();
  });

  it("a stock's line is the session's 5-minute closes beside the live file, read once; none from an older session", async () => {
    const f = fake(() => res(200, { v: 1, session: MOCK_UNIVERSE.asOf, asOf: 'x', start: '09:30', step: 5,
      bars: { AMD: [null, null, 100, 99.5, 99], NVDA: [null] } }));
    const b = siteBackend({ store: store(), api: '', live: LIVE, search: '', fetch: f.fetch });
    await b.universe();
    expect(await b.bars('AMD')).toEqual([100, 99.5, 99]);
    expect(await b.bars('NVDA')).toBeNull();
    expect(await b.bars('ZZZ')).toBeNull();
    expect(f.calls.map((c) => c.url)).toEqual(['https://storage.example/live/bars-v1.json']);

    const old = fake(() => res(200, { v: 1, session: '2020-01-02', bars: { AMD: [1, 2] } }));
    const b2 = siteBackend({ store: store(), api: '', live: LIVE, search: '', fetch: old.fetch });
    await b2.universe();
    expect(await b2.bars('AMD')).toBeNull();
    expect(await siteBackend({ store: store(), api: '', search: '', fetch: old.fetch }).bars('AMD')).toBeNull();   // no live file
  });

  it('save posts the alert and the human check\'s token to /v1/alerts: 200 saved, 400 invalid, 403 the check, 429 over a limit, anything else a network failure', async () => {
    const req = { email: 'r@example.com', name: 'Drops', rule: { v: 1 as const, all: [{ c: 'session-move' as const, p: { dir: 'down', pct: 5 } }] },
      from: { tag: 'pt-movers', section: 'moves', path: '/' }, weekly: false, turnstile: 'tok' };
    for (const [status, want] of [[200, { ok: true }], [400, { ok: false, reason: 'invalid' }], [403, { ok: false, reason: 'captcha' }],
      [429, { ok: false, reason: 'limit' }], [503, { ok: false, reason: 'network' }]] as const) {
      const f = fake(() => res(status, { ok: status === 200 }));
      expect(await siteBackend({ store: store(), api: 'https://api.example', search: '', fetch: f.fetch }).save(req)).toEqual(want);
      expect(f.calls[0]!.url).toBe('https://api.example/v1/alerts');
      expect(f.calls[0]!.init?.method).toBe('POST');
      expect(JSON.parse(String(f.calls[0]!.init?.body))).toEqual(req);
    }
  });

  it("manage posts the link's token and the op: 200 the alerts, 403 and 410 a link that no longer works, anything else fails", async () => {
    const state = { email: 'r•••@example.com', status: 'active', weekly: false, rules: [] };
    const f = fake(() => res(200, state));
    const b = siteBackend({ store: store(), api: '', search: '', fetch: f.fetch });
    expect(await b.manage('tok', { op: 'list' })).toEqual(state);
    expect(f.calls[0]!.url).toBe('/v1/alerts/manage');
    expect(JSON.parse(String(f.calls[0]!.init?.body))).toEqual({ t: 'tok', op: { op: 'list' } });
    for (const status of [403, 410]) {
      expect(await siteBackend({ store: store(), api: '', search: '', fetch: fake(() => res(status)).fetch }).manage('tok', { op: 'list' })).toBeNull();
    }
    await expect(siteBackend({ store: store(), api: '', search: '', fetch: fake(() => res(502)).fetch }).manage('tok', { op: 'list' })).rejects.toThrow();
  });

  it("the human check is Turnstile with the page's site key; without one there is none", () => {
    expect(siteBackend({ store: store(), api: '', search: '', turnstile: 'site-key' }).check?.mount).toBeTypeOf('function');
    expect(siteBackend({ store: store(), api: '', search: '' }).check).toBeUndefined();
  });

  it("the landing is the page address's", () => {
    expect(siteBackend({ store: store(), api: '', search: '?do=confirm&t=a.b' }).landing()).toEqual({ alert: null, token: 'a.b', action: 'confirm' });
  });
});

import { describe, expect, it } from 'vitest';
import { answerOf, fetchReader } from './ai';

describe("the site's AI reader, from the page", () => {
  it('posts the text and its kind to /v1/ai/portfolio, nothing else', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return Response.json({ ok: true, holdings: [], ignored: [], left: 3 }); }) as unknown as typeof fetch;
    expect(await fetchReader(f).read('AAPL 10', 'portfolio')).toEqual({ ok: true, holdings: [], ignored: [], left: 3 });
    expect(seen).toEqual([{ url: '/v1/ai/portfolio', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"AAPL 10","kind":"portfolio"}' } }]);
  });
  it("the admin's refusals as they are; a network failure, a page that is not JSON, an answer of another shape: network", async () => {
    expect(answerOf({ ok: false, reason: 'limit' })).toEqual({ ok: false, reason: 'limit' });
    expect(answerOf({ ok: false, reason: 'off' })).toEqual({ ok: false, reason: 'off' });
    expect(answerOf({ ok: false, reason: 'whatever' })).toEqual({ ok: false, reason: 'network' });
    expect(answerOf(null)).toEqual({ ok: false, reason: 'network' });
    expect(answerOf({ ok: true, holdings: [{ line: 1, symbol: 'AAPL' }], ignored: [], left: 1 })).toEqual({ ok: false, reason: 'network' });
    expect(answerOf({ ok: true, holdings: [{ line: 1, symbol: 'AAPL', name: null, amount: 10, unit: 'lots', date: null }], ignored: [], left: 1 })).toEqual({ ok: false, reason: 'network' });
    const down = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await fetchReader(down).read('AAPL', 'watchlist')).toEqual({ ok: false, reason: 'network' });
    const html = (async () => new Response('<html>', { status: 502 })) as unknown as typeof fetch;
    expect(await fetchReader(html).read('AAPL', 'watchlist')).toEqual({ ok: false, reason: 'network' });
  });
});

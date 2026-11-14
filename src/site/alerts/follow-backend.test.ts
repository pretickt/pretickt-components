import { describe, expect, it } from 'vitest';
import { followBackend } from './follow-backend';

describe("the follows' email calls (the Worker's /v1/alerts/follow and /manage)", () => {
  it('signup posts the email, the follows and the human check; manage posts the token and the op; the answers are read', async () => {
    const calls: [string, unknown][] = [];
    const answer = (status: number, body: unknown = {}) => async (u: string, init?: RequestInit) => {
      calls.push([u, JSON.parse(String(init!.body))]); return new Response(JSON.stringify(body), { status });
    };
    expect(await followBackend('', answer(200, { ok: true })).signup('r@example.com', ['NVDA'], 'tok')).toBe('ok');
    expect(calls[0]).toEqual(['/v1/alerts/follow', { email: 'r@example.com', follows: ['NVDA'], turnstile: 'tok' }]);
    expect(await followBackend('', answer(403)).signup('r@example.com', ['NVDA'], null)).toBe('captcha');
    expect(await followBackend('', answer(429)).signup('r@example.com', ['NVDA'], null)).toBe('limit');
    expect(await followBackend('', answer(400)).signup('x', ['NVDA'], null)).toBe('invalid');
    expect(await followBackend('', async () => { throw new Error('offline'); }).signup('r@example.com', ['NVDA'], null)).toBe('network');
    const st = await followBackend('', answer(200, { email: 'r•••@example.com', follows: ['NVDA'] })).manage('a.b', { op: 'list' });
    expect(st?.follows).toEqual(['NVDA']);
    expect(calls.at(-1)).toEqual(['/v1/alerts/manage', { t: 'a.b', op: { op: 'list' } }]);
    expect(await followBackend('', answer(410)).manage('a.b', { op: 'list' })).toBeNull();
  });
});

import { InjectionToken } from '@angular/core';
import type { HumanCheck, ManageOp, ManageState } from '../../alerts/token';

/** The follows' email (follow alerts, part 2): the sign-up with this browser's follows, and the manage link's calls. */
export interface FollowBackend {
  signup(email: string, follows: string[], turnstile: string | null): Promise<'ok' | 'invalid' | 'captcha' | 'limit' | 'network'>;
  /** The state after the op; null when the link no longer works (expired, the reader gone). */
  manage(token: string, op: ManageOp): Promise<ManageState | null>;
}
/** What the panel and /alerts/ need for the email; absent where the email alerts are off (no email row). */
export interface FollowEmail { backend: FollowBackend; check: HumanCheck | null }
export const PT_FOLLOW_EMAIL = new InjectionToken<FollowEmail>('PT_FOLLOW_EMAIL');

/** The Worker's `/v1/alerts/follow` and `/v1/alerts/manage` (platform site/src/alerts.ts), from the site's own origin. */
export function followBackend(api = '', get: (u: string, init?: RequestInit) => Promise<Response> = (u, init) => fetch(u, init)): FollowBackend {
  const post = (path: string, body: unknown) => get(`${api}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit' });
  return {
    async signup(email, follows, turnstile) {
      try {
        const r = await post('/v1/alerts/follow', { email, follows, turnstile });
        return r.ok ? 'ok' : r.status === 400 ? 'invalid' : r.status === 403 ? 'captcha' : r.status === 429 ? 'limit' : 'network';
      } catch { return 'network'; }
    },
    async manage(token, op) {
      const r = await post('/v1/alerts/manage', { t: token, op });
      if (r.ok) return (await r.json()) as ManageState;
      if (r.status === 403 || r.status === 410) return null;
      throw new Error(`alerts ${r.status}`);
    },
  };
}

import type { AlertsLanding } from '../../alerts/token';

const EVENT = /^[A-Za-z0-9_-]{16,40}$/;
/** a link's token: its claims and their signature, both base64url (platform site/src/alerts.ts) */
const TOKEN = /^[A-Za-z0-9_-]{1,1500}\.[A-Za-z0-9_-]{1,100}$/;
const ACTIONS = ['confirm', 'manage', 'weekly'] as const;

/**
 * What an email's link says (spec §4): `?alert=<event>` on a company page (the alert that fired), `?do=confirm|weekly&t=<token>` on
 * the alerts' page (confirm, the weekly email on), `?t=<token>` alone to manage. Anything malformed is no landing.
 */
export function landingOf(search: string): AlertsLanding {
  const q = new URLSearchParams(search);
  const alert = q.get('alert'), t = q.get('t'), act = q.get('do');
  const token = t && TOKEN.test(t) ? t : null;
  return {
    alert: alert && EVENT.test(alert) ? alert : null,
    token,
    action: token ? ACTIONS.find((a) => a === act) ?? 'manage' : null,
  };
}

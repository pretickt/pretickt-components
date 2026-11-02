/** pt-alert-manage on made-up answers (the page's backend faked): confirming, managing, editing, a weekly email, an expired link, a failure. */
import type { Provider } from '@angular/core';
import { MOCK_BARS, MOCK_UNIVERSE } from '../alerts/mock';
import type { Rule } from '../alerts/rule';
import { PtAlerts } from '../alerts/service';
import { PT_ALERTS, type AlertsBackend, type AlertsLanding, type ManageState } from '../alerts/token';
import { PtAlertManage } from '../site/alerts/manage';
import { story } from './story';

const DROP: Rule = { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'below-average', p: { dir: 'below', pct: 15, days: '50' } },
  { c: 'mega-caps', p: {} }] };
const STATE: ManageState = { email: 'r•••@example.com', status: 'active', weekly: false, rules: [
  { id: 'r1', name: 'Mega-cap drops', rule: DROP, status: 'active' },
  { id: 'r2', name: 'News 3× · NVDA', rule: { v: 1, all: [{ c: 'news-spike', p: { times: 3 } }, { c: 'one-stock', p: { ticker: 'NVDA' } }] }, status: 'active' },
  { id: 'r3', name: 'Near 52-week low · Energy', rule: { v: 1, all: [{ c: 'near-52w', p: { side: 'low', pct: 2 } }, { c: 'sector', p: { sector: 'Energy' } }] }, status: 'paused' },
] };
/**
 * A backend that answers from memory: pause, resume, delete, an edit and the weekly email change what the next answer shows.
 * `failFirst`: the first call does not get through (the page offers Retry).
 */
function fake(landing: AlertsLanding, first: ManageState | null, o: { failFirst?: boolean } = {}): Provider[] {
  let s = first, failing = !!o.failFirst;
  const backend: AlertsBackend = {
    universe: async () => MOCK_UNIVERSE, bars: async (t) => MOCK_BARS[t] ?? null, save: async () => ({ ok: true }), landing: () => landing,
    manage: async (_t, op) => {
      await new Promise((r) => setTimeout(r, 400));
      if (failing) { failing = false; throw new Error('offline'); }
      if (!s) return null;
      if (op.op === 'update') s = { ...s, rules: s.rules.map((r) => (r.id === op.id ? { ...r, name: op.name, rule: op.rule } : r)) };
      if (op.op === 'pause' || op.op === 'resume') s = { ...s, rules: s.rules.map((r) => (r.id === op.id ? { ...r, status: op.op === 'pause' ? 'paused' : 'active' } : r)) };
      if (op.op === 'delete') s = { ...s, rules: s.rules.filter((r) => r.id !== op.id) };
      if (op.op === 'weekly') s = { ...s, weekly: op.on };
      if (op.op === 'unsubscribe') s = { ...s, status: 'unsubscribed' };
      return s;
    },
  };
  // PtAlerts beside its backend: the root's would never see a story's provider
  return [PtAlerts, { provide: PT_ALERTS, useValue: backend }];
}
const GROUP = 'Alerts · the manage page (made-up answers)';
const at = (action: AlertsLanding['action']): AlertsLanding => ({ alert: null, token: 'demo', action });

export const stories = [
  story(PtAlertManage, { name: 'Confirmed · AMD meets it right now', providers: fake(at('confirm'), { ...STATE, confirmed: { id: 'r1', now: ['AMD'] } }), group: GROUP }),
  story(PtAlertManage, { name: 'Manage · three alerts, one paused', providers: fake(at('manage'), STATE), group: GROUP }),
  story(PtAlertManage, { name: 'A new alert waiting for its confirmation', providers: fake(at('manage'), { ...STATE, rules: [
    { id: 'r4', name: 'Quality pullback · MU', rule: { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'piotroski', p: { side: 'high', score: 7 } },
      { c: 'one-stock', p: { ticker: 'MU' } }] }, status: 'pending' }, ...STATE.rules] }), group: GROUP }),
  story(PtAlertManage, { name: 'A call that does not get through · Retry', providers: fake(at('manage'), STATE, { failFirst: true }), group: GROUP }),
  story(PtAlertManage, { name: 'Weekly email turned on', providers: fake(at('weekly'), { ...STATE, weekly: true }), group: GROUP }),
  story(PtAlertManage, { name: 'Unsubscribed', providers: fake(at('manage'), { ...STATE, status: 'unsubscribed' }), group: GROUP }),
  story(PtAlertManage, { name: 'Expired link', providers: fake(at('manage'), null), group: GROUP }),
  story(PtAlertManage, { name: 'Without a link (the server)', group: GROUP }),
];

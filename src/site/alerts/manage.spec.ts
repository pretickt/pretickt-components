import { TestBed } from '@angular/core/testing';
import type { Rule } from '../../alerts/rule';
import { PT_ALERTS, type AlertsBackend, type AlertsLanding, type ManageOp, type ManageState } from '../../alerts/token';
import { PtAlertManage } from './manage';

const RULE: Rule = { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'mega-caps', p: {} }] };
const STATE: ManageState = { email: 'm•••@example.com', status: 'active', weekly: false,
  rules: [{ id: 'r1', name: 'Mega-cap drops', rule: RULE, status: 'active' }] };

async function mount(landing: AlertsLanding | null, answer: (op: ManageOp) => ManageState | null = () => STATE) {
  const ops: ManageOp[] = [];
  const backend: AlertsBackend = {
    universe: async () => null, bars: async () => null, save: async () => ({ ok: true }),
    manage: async (_t, op) => { ops.push(op); return answer(op); },
    landing: () => landing ?? { alert: null, token: null, action: null },
  };
  TestBed.configureTestingModule({ providers: landing ? [{ provide: PT_ALERTS, useValue: backend }] : [] });
  const f = TestBed.createComponent(PtAlertManage);
  const settle = async () => { for (let i = 0; i < 4; i++) { f.detectChanges(); TestBed.tick(); await new Promise((r) => setTimeout(r, 1)); } };
  await settle();
  const el = f.nativeElement as HTMLElement;
  return { el, ops, settle, text: () => el.textContent!.replace(/\s+/g, ' ') };
}
const press = (el: HTMLElement, label: string) => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === label)!.click();

describe('pt-alert-manage: confirm and manage alerts from the email\'s link, no account', () => {
  it('without a backend shows the note', async () => {
    const { el, text } = await mount(null);
    expect(el.querySelector('.pt-na')).not.toBeNull();
    expect(text()).toContain('Open the link in one of our emails');
  });

  it('confirm shows the rule on and who meets it right now', async () => {
    const { ops, text } = await mount({ alert: null, token: 't', action: 'confirm' }, () => ({ ...STATE, confirmed: { id: 'r1', now: ['AMD'] } }));
    expect(ops).toEqual([{ op: 'confirm' }]);
    expect(text()).toContain('Your alert “Mega-cap drops” is on.');
    expect(text()).toContain('Right now: AMD meets all of these');
    expect(text()).toContain('Falls more than 5% in one session · Is a mega cap, over $200B');
  });

  it('pause and resume a rule', async () => {
    let paused = false;
    const { el, ops, settle, text } = await mount({ alert: null, token: 't', action: 'manage' }, (op) => {
      if (op.op === 'pause') paused = true;
      if (op.op === 'resume') paused = false;
      return { ...STATE, rules: [{ ...STATE.rules[0]!, status: paused ? 'paused' : 'active' }] };
    });
    press(el, 'Pause');
    await settle();
    expect(text()).toContain('Paused');
    press(el, 'Resume');
    await settle();
    expect(ops.map((o) => o.op)).toEqual(['list', 'pause', 'resume']);
    expect(text()).not.toContain('Paused');
  });

  it('an expired link says so', async () => {
    const { text } = await mount({ alert: null, token: 'old', action: 'manage' }, () => null);
    expect(text()).toContain('This link has expired');
  });
});

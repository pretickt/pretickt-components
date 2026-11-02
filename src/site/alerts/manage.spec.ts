import { TestBed } from '@angular/core/testing';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { demoFor } from '../../typologies';
import type { Rule } from '../../alerts/rule';
import { PT_ALERTS, type AlertsBackend, type AlertsLanding, type ManageOp, type ManageState } from '../../alerts/token';
import { PtAlertManage } from './manage';

const RULE: Rule = { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'mega-caps', p: {} }] };
const STATE: ManageState = { email: 'm•••@example.com', status: 'active', weekly: false, digest: false,
  rules: [{ id: 'r1', name: 'Mega-cap drops', rule: RULE, status: 'active' }] };

async function mount(landing: AlertsLanding | null, answer: (op: ManageOp) => ManageState | null | Promise<ManageState | null> = () => STATE) {
  const ops: ManageOp[] = [];
  const backend: AlertsBackend = {
    universe: async () => null, bars: async () => null, save: async () => ({ ok: true }),
    manage: async (_t, op) => { ops.push(op); return answer(op); },
    landing: () => landing ?? { alert: null, token: null, action: null },
  };
  TestBed.configureTestingModule({ providers: [...(landing ? [{ provide: PT_ALERTS, useValue: backend }] : []),
    { provide: PT_STORE, useValue: new PtStore({ server: true, resolve: async (t, params) => demoFor({ t, params } as never) }) }] });
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

  it('a confirmation link asks for a press — a scanner opening it confirms nothing —, then shows the alert on and who meets it right now', async () => {
    const waiting: ManageState = { ...STATE, status: 'pending', rules: [{ ...STATE.rules[0]!, status: 'pending' }] };
    const { el, ops, settle, text } = await mount({ alert: null, token: 't', action: 'confirm' },
      (op) => (op.op === 'confirm' ? { ...STATE, confirmed: { id: 'r1', now: ['AMD'] } } : waiting));
    expect(ops).toEqual([{ op: 'list' }]);
    expect(text()).toContain('Waiting for your confirmation');
    press(el, 'Confirm');
    await settle();
    expect(ops).toEqual([{ op: 'list' }, { op: 'confirm' }]);
    expect(text()).toContain('Your alert “Mega-cap drops” is on.');
    expect(text()).toContain('Right now: AMD meets all of these');
    expect(text()).toContain('Falls more than 5% in one session · Is a mega cap, over $200B');
    expect([...el.querySelectorAll('button')].map((b) => b.textContent!.trim())).not.toContain('Confirm');
  });

  it('the weekly link asks before turning the weekly email on', async () => {
    let weekly = false;
    const { el, ops, settle, text } = await mount({ alert: null, token: 't', action: 'weekly' }, (op) => {
      if (op.op === 'weekly') weekly = op.on;
      return { ...STATE, weekly };
    });
    expect(ops).toEqual([{ op: 'list' }]);
    press(el, 'Yes, send it');
    await settle();
    expect(ops).toEqual([{ op: 'list' }, { op: 'weekly', on: true }]);
    expect(text()).toContain("You will get pretickt's weekly email.");
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

  it('Edit opens the editor on the rule; the saved change shows in the list', async () => {
    const { el, ops, settle, text } = await mount({ alert: null, token: 't', action: 'manage' }, (op) =>
      op.op === 'update' ? { ...STATE, rules: [{ ...STATE.rules[0]!, name: op.name, rule: op.rule }] } : STATE);
    press(el, 'Edit');
    await settle();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain('Edit your alert');
    const name = dialog!.querySelector<HTMLInputElement>('.pt-al-name')!;
    name.value = 'Big drops';
    name.dispatchEvent(new Event('input'));
    await settle();
    dialog!.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(ops.at(-1)).toMatchObject({ op: 'update', id: 'r1', name: 'Big drops' });
    expect(text()).toContain('Big drops');
  });

  it('a failed call keeps the list and offers Retry; the buttons wait while a call is out', async () => {
    let fail = true, release = () => {};
    const { el, ops, settle, text } = await mount({ alert: null, token: 't', action: 'manage' }, async (op) => {
      if (op.op !== 'pause') return STATE;
      await new Promise<void>((r) => (release = r));
      if (fail) throw new Error('offline');
      return { ...STATE, rules: [{ ...STATE.rules[0]!, status: 'paused' }] };
    });
    press(el, 'Pause');
    await settle();
    expect([...el.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    release();
    await settle();
    expect(text()).toContain('Mega-cap drops');
    expect(text()).not.toContain('This link has expired');
    expect(text()).toContain('Could not reach pretickt');
    fail = false;
    press(el, 'Retry');
    await settle();
    release();
    await settle();
    expect(text()).toContain('Paused');
    expect(text()).not.toContain('Could not reach pretickt');
    expect(ops.map((o) => o.op)).toEqual(['list', 'pause', 'pause']);
  });

  it('a first load that fails offers Retry, not "expired"', async () => {
    let fail = true;
    const { el, settle, text } = await mount({ alert: null, token: 't', action: 'manage' }, () => {
      if (fail) throw new Error('offline');
      return STATE;
    });
    expect(text()).toContain('Could not reach pretickt');
    expect(text()).not.toContain('expired');
    fail = false;
    press(el, 'Retry');
    await settle();
    expect(text()).toContain('Mega-cap drops');
  });

  it('a rule waiting for its confirmation says so and cannot be paused', async () => {
    const { el, text } = await mount({ alert: null, token: 't', action: 'manage' },
      () => ({ ...STATE, status: 'pending', rules: [{ ...STATE.rules[0]!, status: 'pending' }] }));
    expect(text()).toContain('Waiting for your confirmation');
    const labels = [...el.querySelectorAll('button')].map((b) => b.textContent!.trim());
    expect(labels).not.toContain('Pause');
    expect(labels).not.toContain('Resume');
    expect(labels).toContain('Delete');
  });

  it('an expired link says so', async () => {
    const { text } = await mount({ alert: null, token: 'old', action: 'manage' }, () => null);
    expect(text()).toContain('This link has expired');
  });

  it('one email a day is offered from the second alert (Romeo, 2026-11-02); with one, only to turn it off', async () => {
    const { text } = await mount({ alert: null, token: 't', action: 'manage' }, () => STATE);
    expect(text()).not.toContain('Alert emails');
    TestBed.resetTestingModule();
    const on = await mount({ alert: null, token: 't', action: 'manage' }, () => ({ ...STATE, digest: true }));
    expect(on.text()).toContain('Alert emails: one a day, in the evening');
  });

  it('confirming the alert that makes two asks once: each as it happens, or one email a day', async () => {
    const two: ManageState = { ...STATE, rules: [...STATE.rules, { id: 'r2', name: 'News 3×', rule: RULE, status: 'pending' }] };
    let digest = false;
    const { el, ops, settle, text } = await mount({ alert: null, token: 't', action: 'confirm' }, (op) => {
      if (op.op === 'digest') digest = op.on;
      const rules = two.rules.map((r) => ({ ...r, status: 'active' as const }));
      return op.op === 'confirm' ? { ...two, rules, digest, confirmed: { id: 'r2', now: [] } } : op.op === 'list' ? two : { ...two, rules, digest };
    });
    press(el, 'Confirm');
    await settle();
    expect(text()).toContain('You have 2 alerts now: their emails can come as they happen, or all in one email a day, in the evening.');
    press(el, 'One email a day');
    await settle();
    expect(ops.at(-1)).toEqual({ op: 'digest', on: true });
    expect(text()).toContain('Your alerts will come in one email a day, after the close.');
    expect(text()).not.toContain('You have 2 alerts now');
  });

  it('one email a day or each as it happens: the reader switches it, and the page says which', async () => {
    let digest = false;
    const two: ManageState = { ...STATE, rules: [...STATE.rules, { id: 'r2', name: 'News 3×', rule: RULE, status: 'active' }] };
    const { el, ops, settle, text } = await mount({ alert: null, token: 't', action: 'manage' }, (op) => {
      if (op.op === 'digest') digest = op.on;
      return { ...two, digest };
    });
    expect(text()).toContain('Alert emails: as they happen');
    press(el, 'One a day instead');
    await settle();
    expect(ops).toEqual([{ op: 'list' }, { op: 'digest', on: true }]);
    expect(text()).toContain('Alert emails: one a day, in the evening');
    expect(text()).toContain('Your alerts will come in one email a day, after the close.');
    press(el, 'Send them as they happen');
    await settle();
    expect(ops.at(-1)).toEqual({ op: 'digest', on: false });
    expect(text()).toContain('Alert emails: as they happen');
  });

  it('an alert set to once a week says so under its conditions', async () => {
    const { text } = await mount({ alert: null, token: 't', action: 'manage' },
      () => ({ ...STATE, rules: [{ ...STATE.rules[0]!, rule: { ...RULE, once: 'week' } }] }));
    expect(text()).toContain('Falls more than 5% in one session · Is a mega cap, over $200B · the same stock at most once a week');
  });
});

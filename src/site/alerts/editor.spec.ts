import { TestBed } from '@angular/core/testing';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { PtAlerts } from '../../alerts/service';
import { PT_ALERTS, type AlertsBackend, type SaveResult } from '../../alerts/token';
import { MOCK_BARS, MOCK_UNIVERSE } from '../../alerts/mock';
import { demoFor } from '../../typologies';
import { PtAlertEditor } from './editor';

function setup(save: () => Promise<SaveResult> = async () => ({ ok: true })) {
  const saved: unknown[] = [];
  const backend: AlertsBackend = {
    universe: async () => MOCK_UNIVERSE,
    bars: async (t) => MOCK_BARS[t] ?? null,
    save: (req) => { saved.push(req); return save(); },
    manage: async () => null,
    landing: () => ({ alert: null, token: null, action: null }),
  };
  TestBed.configureTestingModule({ providers: [{ provide: PT_ALERTS, useValue: backend },
    { provide: PT_STORE, useValue: new PtStore({ server: true, resolve: async (t, params) => demoFor({ t, params } as never) }) }] });
  const alerts = TestBed.inject(PtAlerts);
  return { alerts, saved };
}
async function mount() {
  const f = TestBed.createComponent(PtAlertEditor);
  for (let i = 0; i < 3; i++) { f.detectChanges(); await new Promise((r) => setTimeout(r, 5)); await f.whenStable(); }
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const text = () => el.textContent!.replace(/\s+/g, ' ');
  const settle = async () => { for (let i = 0; i < 3; i++) { f.detectChanges(); await new Promise((r) => setTimeout(r, 5)); } f.detectChanges(); };
  return { f, el, text, settle };
}
const from = { tag: 'pt-movers', section: 'moves', path: '/' };
const type = (el: HTMLElement, sel: string, v: string) => { const i = el.querySelector<HTMLInputElement>(sel)!; i.value = v; i.dispatchEvent(new Event('input')); };

describe('PtAlertEditor', () => {
  it('opens on the draft with a card per condition and "and" between', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el } = await mount();
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.querySelectorAll('pt-alert-card')).toHaveLength(2);
    expect(el.querySelectorAll('.pt-al-and')).toHaveLength(1);
  });

  it('a badge adds its condition; used badges are marked', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move' }, from);
    const { el, settle } = await mount();
    const badge = (name: string) => [...el.querySelectorAll<HTMLButtonElement>('.pt-al-badge')].find((b) => b.textContent!.trim() === name)!;
    expect(badge('Session move').classList).toContain('pt-al-badge-used');
    badge('Below its average').click();
    await settle();
    expect(alerts.draft()!.rule.all.map((rc) => rc.c)).toEqual(['session-move', 'below-average']);
    expect(badge('Below its average').classList).toContain('pt-al-badge-used');
  });

  it('save sends email, name, rule, from and the weekly choice', async () => {
    const { alerts, saved } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el, settle, text } = await mount();
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    el.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(saved).toEqual([{ email: 'me@example.com', name: 'Drops 5%+ · Mega caps', rule: { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }, { c: 'mega-caps', p: {} }] }, from, weekly: false }]);
    expect(text()).toContain('Check your inbox to confirm');
    expect(text()).toContain('me@example.com');
  });

  it('shows the error and keeps the draft', async () => {
    const { alerts } = setup(async () => ({ ok: false, reason: 'network' }));
    alerts.add({ c: 'session-move' }, from);
    const { el, settle, text } = await mount();
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    el.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(text()).toContain('Could not save');
    expect(alerts.draft()!.rule.all).toHaveLength(1);
  });

  it('save is disabled for a universe-only rule and for an invalid email', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'mega-caps' }, from);
    const { el, settle, text } = await mount();
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    expect(el.querySelector<HTMLButtonElement>('.pt-al-save')!.disabled).toBe(true);
    expect(text()).toContain('Add a condition beyond the universe');
    alerts.addCondition({ c: 'session-move', p: { dir: 'down', pct: 5 } });
    type(el, 'input[type="email"]', 'not-an-email');
    await settle();
    expect(el.querySelector<HTMLButtonElement>('.pt-al-save')!.disabled).toBe(true);
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    expect(el.querySelector<HTMLButtonElement>('.pt-al-save')!.disabled).toBe(false);
  });

  it('labels the last session when no newer live day', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move' }, from);
    const { text } = await mount();
    expect(text()).toContain('Last session, Oct 30');
  });

  it('Escape closes and keeps the draft', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move' }, from);
    const { el, settle } = await mount();
    el.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(alerts.opened()).toBe(false);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(alerts.draft()!.rule.all).toHaveLength(1);
  });
});

import { TestBed } from '@angular/core/testing';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { PtAlerts } from '../../alerts/service';
import { PT_ALERTS, type AlertsBackend, type CheckState, type HumanCheck, type SaveResult } from '../../alerts/token';
import { MOCK_BARS, MOCK_UNIVERSE } from '../../alerts/mock';
import { demoFor } from '../../typologies';
import { PtAlertEditor } from './editor';

function setup(save: () => Promise<SaveResult> = async () => ({ ok: true }), manageState: unknown = null, check?: HumanCheck,
  estimate?: AlertsBackend['estimate']) {
  const saved: unknown[] = [];
  const backend: AlertsBackend = {
    universe: async () => MOCK_UNIVERSE,
    bars: async (t) => MOCK_BARS[t] ?? null,
    save: (req) => { saved.push(req); return save(); },
    manage: async () => manageState as never,
    landing: () => ({ alert: null, token: null, action: null }),
    ...(check ? { check } : {}),
    ...(estimate ? { estimate } : {}),
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
/** A human check the test drives: where it was drawn, its hand-over, its resets and removals. */
function fakeCheck() {
  const st = { el: null as HTMLElement | null, on: null as ((s: CheckState) => void) | null, resets: 0, removed: 0 };
  const check: HumanCheck = { mount: (el, on) => { st.el = el as HTMLElement; st.on = on; return { reset: () => { st.resets++; }, remove: () => { st.removed++; } }; } };
  return { check, st };
}

describe('PtAlertEditor', () => {
  it('opens on the draft with a card per condition and "and" between', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el } = await mount();
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.querySelectorAll('pt-alert-card')).toHaveLength(2);
    expect(el.querySelectorAll('.pt-al-and')).toHaveLength(1);
  });

  it('empty: tap a badge or drag it into the dashed box below, which lights up while a badge is over it and takes the drop', async () => {
    const { alerts } = setup();
    alerts.open();
    const { el, settle, text } = await mount();
    expect(text()).toContain('Tap a badge to add a condition or drag it below');
    const box = el.querySelector<HTMLElement>('.pt-al-drop')!;
    expect(box.textContent!.trim()).toBe('Drag a condition here');
    box.dispatchEvent(new Event('dragenter', { bubbles: true }));
    await settle();
    expect(box.classList).toContain('pt-al-drop-over');
    box.dispatchEvent(new Event('dragleave', { bubbles: true }));
    await settle();
    expect(box.classList).not.toContain('pt-al-drop-over');
    box.dispatchEvent(new Event('dragenter', { bubbles: true }));
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'session-move' } });
    box.dispatchEvent(drop);
    await settle();
    expect(alerts.draft()!.rule.all.map((rc) => rc.c)).toEqual(['session-move']);
    expect(el.querySelector('.pt-al-drop')).toBeNull();                  // the empty state's box, gone with the first card
  });

  it('My portfolio: empty, it asks for companies and Save waits; a pasted text fills it; an edited Mega caps card becomes one', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el, settle, text } = await mount();
    const badge = (name: string) => [...el.querySelectorAll<HTMLButtonElement>('.pt-al-badge')].find((b) => b.textContent!.trim() === name)!;
    // the Mega caps card, one company taken away: the draft's universe is now the reader's list
    el.querySelector<HTMLButtonElement>('pt-alert-card .pt-al-logos')!.click();
    await settle();
    el.querySelector<HTMLButtonElement>('[aria-label="Remove AMD"]')!.click();
    await settle();
    expect(alerts.draft()!.rule.all[1]!.c).toBe('companies');
    expect(alerts.draft()!.rule.all[1]!.p['tickers']).not.toContain('AMD');
    // a new, empty portfolio: the hint, and Save waits
    badge('My portfolio').click();
    await settle();
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    expect(text()).toContain('Add at least one company to My portfolio');
    expect(el.querySelector<HTMLButtonElement>('.pt-al-save')!.disabled).toBe(true);
    const box = el.querySelectorAll<HTMLTextAreaElement>('.pt-al-paste');
    box[box.length - 1]!.value = 'NVDA';
    box[box.length - 1]!.dispatchEvent(new Event('input'));
    await settle();
    const add = [...el.querySelectorAll<HTMLButtonElement>('.pt-al-list button')].filter((b) => b.textContent!.trim() === 'Add from text');
    add[add.length - 1]!.click();
    await settle();
    expect(alerts.draft()!.rule.all[2]).toEqual({ c: 'companies', p: { tickers: 'NVDA' } });
    expect(el.querySelector<HTMLButtonElement>('.pt-al-save')!.disabled).toBe(false);
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

  it('save sends email, name, rule and from; the editor asks nothing about the weekly email (Romeo, 2026-11-02)', async () => {
    const { alerts, saved } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el, settle, text } = await mount();
    expect(el.querySelector('input[type="checkbox"]')).toBeNull();
    expect(text()).not.toContain('weekly');
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

  it("the human check starts when the email field is first touched; Save waits for its token and sends it", async () => {
    const c = fakeCheck();
    const { alerts, saved } = setup(undefined, null, c.check);
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el, settle, text } = await mount();
    const save = () => el.querySelector<HTMLButtonElement>('.pt-al-save')!;
    expect(c.st.el).toBeNull();                                        // nothing of Cloudflare's before the email
    el.querySelector('input[type="email"]')!.dispatchEvent(new Event('focus'));
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    expect(c.st.el).toBe(el.querySelector('.pt-al-check'));
    expect(save().disabled).toBe(true);
    expect(text()).toContain("Checking that you're not a robot");
    expect(el.querySelector('.pt-al-human')!.hasAttribute('hidden')).toBe(false);
    c.st.on!({ token: 'tok' });
    await settle();
    expect(save().disabled).toBe(false);
    expect(text()).not.toContain("Checking that you're not a robot");
    // with its token the check's row takes no room (the footer as without it); an expired token shows it again
    expect(el.querySelector('.pt-al-human')!.hasAttribute('hidden')).toBe(true);
    c.st.on!({ token: null, failed: false });
    await settle();
    expect(el.querySelector('.pt-al-human')!.hasAttribute('hidden')).toBe(false);
    c.st.on!({ token: 'tok' });
    await settle();
    save().click();
    await settle();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ email: 'me@example.com', turnstile: 'tok' });
    expect(text()).toContain('Check your inbox to confirm');
    expect(c.st.removed).toBe(1);                                      // the widget goes with the form
  });

  it('a refused check: its message, a fresh token asked for (the last one is spent), Save waiting again', async () => {
    const c = fakeCheck();
    const { alerts } = setup(async () => ({ ok: false, reason: 'captcha' }), null, c.check);
    alerts.add({ c: 'session-move' }, from);
    const { el, settle, text } = await mount();
    el.querySelector('input[type="email"]')!.dispatchEvent(new Event('focus'));
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    c.st.on!({ token: 'tok' });
    await settle();
    el.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(text()).toContain("The check that you're not a robot did not pass: try again");
    expect(c.st.resets).toBe(1);
    expect(el.querySelector<HTMLButtonElement>('.pt-al-save')!.disabled).toBe(true);
  });

  it("a check that cannot run says so", async () => {
    const c = fakeCheck();
    const { alerts } = setup(undefined, null, c.check);
    alerts.add({ c: 'session-move' }, from);
    const { el, settle, text } = await mount();
    el.querySelector('input[type="email"]')!.dispatchEvent(new Event('focus'));
    await settle();
    c.st.on!({ token: null, failed: true });
    await settle();
    expect(text()).toContain("We could not check that you're not a robot: reload the page and try again");
  });

  it('over a limit: the message names every limit it can be (a sign-up never says whether the address was known)', async () => {
    const { alerts } = setup(async () => ({ ok: false, reason: 'limit' }));
    alerts.add({ c: 'session-move' }, from);
    const { el, settle, text } = await mount();
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    el.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(text()).toContain('Not saved: too many sign-ups right now, or this address has 10 alerts already');
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

  it('saving an edit says it is saved', async () => {
    const { alerts } = setup(undefined, { email: 'r•••@example.com', status: 'active', weekly: false, rules: [] });
    alerts.edit({ id: 'r1', name: 'Mega-cap drops', rule: { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }] }, status: 'active' }, 'tok');
    const { el, settle, text } = await mount();
    expect(el.querySelector('input[type="email"]')).toBeNull();
    el.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(text()).toContain('Your alert is saved.');
    expect(text()).not.toContain('Create an alert');
  });

  it('Escape anywhere on the page closes it; the focus goes into the dialog and back to where it was', async () => {
    const { alerts } = setup();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    alerts.add({ c: 'session-move' }, from);
    const { el, settle } = await mount();
    expect(el.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(alerts.opened()).toBe(false);
    expect(document.activeElement).toBe(outside);
    outside.remove();
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

  it('no name to type when creating (the conditions name it); editing a saved alert shows its name to change (Romeo, 2026-11-02)', async () => {
    const { alerts, saved } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el, settle } = await mount();
    expect(el.querySelector('.pt-al-name')).toBeNull();
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    el.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(saved[0]).toMatchObject({ name: 'Drops 5%+ · Mega caps' });
    alerts.edit({ id: 'r1', name: 'My drops', rule: { v: 1, all: [{ c: 'session-move', p: { dir: 'down', pct: 5 } }] }, status: 'active' }, 'tok');
    el.querySelector<HTMLButtonElement>('.pt-al-save')?.click();   // the saved panel's Done
    await settle();
    alerts.open();
    await settle();
    expect(el.querySelector<HTMLInputElement>('.pt-al-name')!.value).toBe('My drops');
  });

  it('dragging a badge shows a drop zone before, between and after the cards, and it lands where it is dropped', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el, settle } = await mount();
    const zones = () => [...el.querySelectorAll<HTMLElement>('.pt-al-zone')];
    expect(zones()).toHaveLength(0);
    expect(el.querySelectorAll('.pt-al-and')).toHaveLength(1);
    const badge = [...el.querySelectorAll<HTMLButtonElement>('.pt-al-badge')].find((b) => b.textContent!.trim() === 'Volume spike')!;
    const start = new Event('dragstart', { bubbles: true });
    Object.defineProperty(start, 'dataTransfer', { value: { setData: () => {} } });
    badge.dispatchEvent(start);
    await settle();
    expect(zones().map((z) => z.dataset['zone'])).toEqual(['0', '1', '2']);
    expect(el.querySelectorAll('.pt-al-and')).toHaveLength(0);
    zones()[1]!.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    await settle();
    expect(zones()[1]!.classList).toContain('pt-al-zone-over');
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'volume-spike' } });
    zones()[1]!.dispatchEvent(drop);
    await settle();
    expect(alerts.draft()!.rule.all.map((rc) => rc.c)).toEqual(['session-move', 'volume-spike', 'mega-caps']);
    expect(zones()).toHaveLength(0);
    // a drag that ends anywhere else takes its zones away
    badge.dispatchEvent(start);
    await settle();
    badge.dispatchEvent(new Event('dragend', { bubbles: true }));
    await settle();
    expect(zones()).toHaveLength(0);
  });

  it('a card once in stays where it is: no grip to move it (Romeo, 2026-11-02)', async () => {
    const { alerts } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    alerts.addCondition({ c: 'volume-spike', p: { times: 3 } });
    const { el } = await mount();
    expect(el.querySelectorAll('pt-alert-card')).toHaveLength(3);
    expect(el.querySelectorAll('.pt-al-grip')).toHaveLength(0);
  });

  it('the same stock at most once a day (as before) or a week: the rule keeps the choice, the saved note repeats it', async () => {
    const { alerts, saved } = setup();
    alerts.add({ c: 'session-move', mega: true }, from);
    const { el, settle, text } = await mount();
    const once = (label: string) => [...el.querySelectorAll<HTMLButtonElement>('.pt-al-once button')].find((b) => b.textContent!.trim() === label)!;
    expect(text()).toContain('the same stock at most once');
    expect(once('a day').getAttribute('aria-pressed')).toBe('true');
    expect(once('a week').getAttribute('aria-pressed')).toBe('false');
    once('a week').click();
    await settle();
    expect(alerts.draft()!.rule.once).toBe('week');
    expect(once('a week').getAttribute('aria-pressed')).toBe('true');
    type(el, 'input[type="email"]', 'me@example.com');
    await settle();
    el.querySelector<HTMLButtonElement>('.pt-al-save')!.click();
    await settle();
    expect(saved[0]).toMatchObject({ rule: { once: 'week' } });
    expect(text()).toContain('at most once a week per stock');
  });

  it('the estimate: asked once the rule can be saved, again when the choice changes; "about N", "1 email", "no email"', async () => {
    const asked: unknown[] = [];
    const { alerts } = setup(undefined, null, undefined, async (r) => { asked.push(r); return r.once ? 1 : 25; });
    alerts.add({ c: 'mega-caps' }, from);
    const { el, settle, text } = await mount();
    await new Promise((r) => setTimeout(r, 450));
    await settle();
    // a universe alone cannot be saved: nothing to estimate
    expect(asked).toHaveLength(0);
    expect(el.querySelector('.pt-al-est')).toBeNull();
    alerts.addCondition({ c: 'session-move', p: { dir: 'down', pct: 5 } });
    await new Promise((r) => setTimeout(r, 450));
    await settle();
    expect(asked).toHaveLength(1);
    expect(text()).toContain('In the last month it would have sent about 25 emails');
    alerts.setOnce('week');
    await new Promise((r) => setTimeout(r, 450));
    await settle();
    expect(text()).toContain('In the last month it would have sent 1 email');
  });

  it('no estimate line without a page estimate, and "no email" for a quiet rule', async () => {
    setup();
    const { alerts } = { alerts: TestBed.inject(PtAlerts) };
    alerts.add({ c: 'session-move' }, from);
    const a = await mount();
    await new Promise((r) => setTimeout(r, 450));
    await a.settle();
    expect(a.el.querySelector('.pt-al-est')).toBeNull();
    TestBed.resetTestingModule();
    const quiet = setup(undefined, null, undefined, async () => 0);
    quiet.alerts.add({ c: 'session-move' }, from);
    const b = await mount();
    await new Promise((r) => setTimeout(r, 450));
    await b.settle();
    expect(b.text()).toContain('In the last month it would have sent no email');
  });
});

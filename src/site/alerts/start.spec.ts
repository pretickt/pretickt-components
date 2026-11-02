import { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { PtAlerts } from '../../alerts/service';
import { demoFor } from '../../typologies';
import type { PageModel } from '../model';
import { alertsEnv } from './env';
import { startAlerts } from './start';

const page: PageModel = { buildId: 'b', api: '', alerts: true, sections: [] };
function setup() {
  TestBed.configureTestingModule({ providers: [
    { provide: PT_STORE, useValue: new PtStore({ server: false, resolve: async (t, params) => demoFor({ t, params } as never) }) }] });
  return { appRef: TestBed.inject(ApplicationRef), env: TestBed.inject(EnvironmentInjector) };
}
const until = async (ok: () => boolean) => {
  for (let i = 0; i < 200 && !ok(); i++) { TestBed.tick(); await new Promise((r) => setTimeout(r, 5)); }
};

describe('startAlerts: a page with alerts, once rendered', () => {
  afterEach(() => { document.body.innerHTML = ''; history.replaceState(null, '', '/'); });

  it("a bell's press opens the editor on the site's backend with its section's badge", async () => {
    const { appRef, env } = setup();
    document.body.innerHTML = `<section id="moves"><div class="pt-island" data-island="pt-movers@1.0.0"><p>…</p>
      <div class="pt-island-foot"><button class="pt-alert-bell" data-alert='{"c":"session-move"}'>Alert</button></div></div></section>`;
    startAlerts(document, appRef, env, page);
    document.querySelector<HTMLElement>('[data-alert]')!.click();
    const alerts = alertsEnv(env, page, '').get(PtAlerts);
    await until(() => alerts.opened() && !!document.querySelector('[role="dialog"]'));
    expect(alerts.enabled).toBe(true);
    expect(alerts.draft()!.rule.all.map((rc) => rc.c)).toEqual(['session-move']);
    expect(alerts.draft()!.from).toEqual({ tag: 'pt-movers', section: 'moves', path: location.pathname });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("an alert email's link (?alert=) shows the alert above the company page", async () => {
    const { appRef, env } = setup();
    history.replaceState(null, '', '/stocks/amd/?alert=AbCdEf0123456789_-xy');
    document.body.innerHTML = '<pt-page></pt-page>';
    startAlerts(document, appRef, env, { ...page, subject: 'AMD' });
    await until(() => !!document.querySelector('.pt-alev'));
    expect(document.querySelector('pt-alert-event + pt-page')).not.toBeNull();
    expect(document.querySelector('.pt-alev')!.textContent).toContain('Mega-cap drops');
  });

  it("the alerts' page mounts the manage page in its place", async () => {
    const { appRef, env } = setup();
    document.body.innerHTML = '<div data-pt-alerts><p class="pt-na">Open the link in one of our emails to confirm or manage your alerts.</p></div>';
    startAlerts(document, appRef, env, page);
    await until(() => !!document.querySelector('[data-pt-alerts] pt-alert-manage .pt-na'));
    expect(document.querySelectorAll('[data-pt-alerts] .pt-na')).toHaveLength(1);
    expect(document.querySelector('[data-pt-alerts]')!.textContent).toContain('Open the link in one of our emails');   // no token in the address
  });

  it('a click elsewhere loads nothing', async () => {
    const { appRef, env } = setup();
    document.body.innerHTML = `<button id="other">Other</button>`;
    startAlerts(document, appRef, env, page);
    document.querySelector<HTMLElement>('#other')!.click();
    await until(() => false);
    expect(alertsEnv(env, page, '').get(PtAlerts).opened()).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

import { createEnvironmentInjector, type EnvironmentInjector, inject } from '@angular/core';
import { PT_STORE } from '@pretickt/components/context';
import { PtAlerts } from '../../alerts/service';
import { PT_ALERTS } from '../../alerts/token';
import type { PageModel } from '../model';
import { siteBackend } from './backend';

const envs = new WeakMap<EnvironmentInjector, EnvironmentInjector>();

/**
 * The page's alerts: PtAlerts on the site's backend, in an injector of their own under the page app's (main.ts provides nothing —
 * its bundle is full; ruling I-11). One per page: the bells, the editor, the manage page and the alert on top share it.
 */
export function alertsEnv(env: EnvironmentInjector, page: PageModel, search: string): EnvironmentInjector {
  let e = envs.get(env);
  if (!e) {
    e = createEnvironmentInjector([
      { provide: PT_ALERTS, useFactory: () => siteBackend({ store: inject(PT_STORE), api: page.api, live: page.live, search, turnstile: page.turnstile }) },
      PtAlerts,
    ], env);
    envs.set(env, e);
  }
  return e;
}

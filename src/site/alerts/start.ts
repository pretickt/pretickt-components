import type { ApplicationRef, EnvironmentInjector } from '@angular/core';
import type { PageModel } from '../model';

/**
 * A page with alerts, once rendered: the one alerts chunk such a page loads (ruling I-11), small — the editor, the manage page and
 * the alert that fired come in chunks of their own when needed. A bell's press opens the editor with its section's badge.
 */
export function startAlerts(doc: Document, appRef: ApplicationRef, env: EnvironmentInjector, page: PageModel): void {
  const search = doc.defaultView?.location.search ?? '';
  const alerts = () => import('./env').then((m) => m.alertsEnv(env, page, search));
  doc.addEventListener('click', (e) => {
    const bell = (e.target as Element | null)?.closest?.('[data-alert]');
    if (bell) void Promise.all([import('./editor'), alerts()]).then(([m, a]) => m.pressBell(bell, appRef, a));
  });
}

import { alertSourceOf } from '../../alerts/sources';
import type { PageModel } from '../model';

/**
 * The bells of a page with alerts: each placement gets the badge its section adds, as the bell's data (null: no bell). renderPage
 * runs it on the server and the page model carries the result to the browser, so the mapping never weighs on the main bundle.
 */
export function withAlerts(m: PageModel): PageModel {
  if (!m.alerts) return m;
  return { ...m, sections: m.sections.map((s) => ({ ...s, items: s.items.map((it) => {
    const src = it.off ? null : alertSourceOf(it.c, it.props);
    return { ...it, alert: src ? JSON.stringify(src) : null };
  }) })) };
}

import { describe, expect, it } from 'vitest';
import type { PageModel } from '../model';
import { withAlerts } from './annotate';

const model = (alerts?: true): PageModel => ({ buildId: 'b', api: '', ...(alerts ? { alerts } : {}), sections: [{ id: 'why', items: [
  { c: 'pt-why-today', props: { ticker: 'NVDA' } }, { c: 'pt-calendar', props: { kind: 'dividend' } }, { c: 'pt-x', props: {}, off: true }] }] });

describe('withAlerts (renderPage, on the server)', () => {
  it('a page with alerts gives each placement its bell', () => {
    const items = withAlerts(model(true)).sections[0]!.items;
    expect(items[0]!.alert).toBe('{"c":"session-move","ticker":"NVDA"}');
    expect(items[1]!.alert).toBeNull();   // the dividend calendar: no badge fits
    expect(items[2]!.alert).toBeNull();   // switched off by the build
  });

  it('a page without alerts is left as it is', () => {
    const m = model();
    expect(withAlerts(m)).toBe(m);
  });
});

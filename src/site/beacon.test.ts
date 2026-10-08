// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { startBeacon } from './beacon';

describe('beacon', () => {
  it('one page view, then each component action once, named by its placement (tag@version); no cookies', () => {
    document.body.innerHTML = '<div data-island="pt-probe@1.0.0"><button id="b">x</button></div><button id="out">y</button>';
    const sent: { url: string; body: unknown }[] = [];
    startBeacon(document, '', (url, body) => sent.push({ url, body: JSON.parse(body) }));
    const fire = (id: string, action: string) => document.getElementById(id)!.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action } }));
    fire('b', 'set'); fire('b', 'set'); fire('b', 'zoom'); fire('out', 'set');
    expect(sent).toEqual([
      { url: '/v1/e', body: { t: 'pv', p: '/', r: '' } },
      { url: '/v1/e', body: { t: 'ix', p: '/', c: 'pt-probe@1.0.0', a: 'set' } },
      { url: '/v1/e', body: { t: 'ix', p: '/', c: 'pt-probe@1.0.0', a: 'zoom' } },
    ]);
  });
});

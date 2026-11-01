// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachAlerts } from './attach';

let detach: (() => void) | null = null;
afterEach(() => { detach?.(); detach = null; document.body.innerHTML = ''; });

const page = (alert: string) => {
  document.body.innerHTML = `<section id="why"><div class="pt-island" data-island="pt-why-today@1.2.0"><p>…</p>
    <div class="pt-island-foot"><button class="pt-share" data-share>Share</button><button class="pt-alert-bell" data-alert='${alert}'><svg></svg>Alert</button></div></div></section>`;
  return document.querySelector<HTMLElement>('.pt-alert-bell svg')!;
};

describe('attachAlerts (the bells of the page)', () => {
  it("a click on a bell opens with the placement's badge and section", () => {
    const open = vi.fn();
    const svg = page('{"c":"session-move","ticker":"NVDA"}');
    detach = attachAlerts(document, open);
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(open).toHaveBeenCalledWith({ c: 'session-move', ticker: 'NVDA' }, { tag: 'pt-why-today', section: 'why', path: location.pathname });
  });

  it('a malformed data-alert is ignored', () => {
    const open = vi.fn();
    const svg = page('{"c":');
    detach = attachAlerts(document, open);
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(open).not.toHaveBeenCalled();
  });

  it('a click elsewhere is not a bell', () => {
    const open = vi.fn();
    page('{"c":"session-move"}');
    detach = attachAlerts(document, open);
    document.querySelector<HTMLElement>('.pt-share')!.click();
    expect(open).not.toHaveBeenCalled();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { bellOf } from './attach';

afterEach(() => { document.body.innerHTML = ''; });

const page = (alert: string) => {
  document.body.innerHTML = `<section id="why"><div class="pt-island" data-island="pt-why-today@1.2.0"><p>…</p>
    <div class="pt-island-foot"><button class="pt-share" data-share>Share</button><button class="pt-alert-bell" data-alert='${alert}'><svg></svg>Alert</button></div></div></section>`;
  return document.querySelector<HTMLElement>('.pt-alert-bell')!;
};

describe('bellOf (a pressed bell, read by the editor\'s chunk)', () => {
  it("a bell gives the placement's badge and section", () => {
    const bell = page('{"c":"session-move","ticker":"NVDA"}');
    expect(bellOf(bell, document)).toEqual({ src: { c: 'session-move', ticker: 'NVDA' }, from: { tag: 'pt-why-today', section: 'why', path: location.pathname } });
  });

  it('a malformed data-alert is ignored', () => {
    expect(bellOf(page('{"c":'), document)).toBeNull();
    expect(bellOf(page('{"x":1}'), document)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { checkMarkup } from './markup';

describe('checkMarkup (rendered HTML a page will accept)', () => {
  it('accepts what the published components render', () => {
    expect(checkMarkup(`<svg viewBox="0 0 10 10"><defs><linearGradient id="ptNVDAg0"></linearGradient></defs><path d="M0 0"/></svg>` +
      `<a href="/stocks/nvda/" data-tip="{&quot;A&quot;:1}">x</a><a href="https://x.com" rel="nofollow">y</a><button data-set="{}">z</button>`)).toEqual([]);
  });
  it('rejects scripts, event handlers, script URLs, page-data hijacking and dangerous elements', () => {
    const bad = {
      script: '<script>1</script>', handler: '<img src=x onerror=alert(1)>', handler2: `<svg><g ONLOAD="x"></g></svg>`,
      jsUrl: '<a href="javascript:alert(1)">x</a>', jsUrlSpaced: `<a href=' javascript:x'>x</a>`, xlink: '<use xlink:href="data:image/svg+xml,x"/>',
      pageState: '<div id="ng-state">{}</div>', mount: '<div data-pt="{}"></div>', style: '<style>*{}</style>', iframe: '<iframe src=/x>',
      meta: '<meta http-equiv="refresh" content="0;url=/x">', form: '<form action="/x">', base: '<base href="/x">', object: '<object data="x">',
      foreign: '<svg><foreignObject></foreignObject></svg>', link: '<link rel="stylesheet" href="/x">',
    };
    for (const [name, html] of Object.entries(bad)) expect(checkMarkup(html).length, name).toBeGreaterThan(0);
  });
  it('judges a URL as the browser reads it: entities decoded, controls and spaces gone, backslash as slash', () => {
    const bad = {
      entity: '<a href="&#106;avascript:alert(1)">x</a>', hexEntity: '<a href="&#x6A;avascript:x">x</a>', named: '<a href="javascript&colon;x">x</a>',
      tab: '<a href="java\tscript:x">x</a>', tabEntity: '<a href="java&#9;script:x">x</a>', newline: '<a href="java\nscript:x">x</a>',
      backslash: '<a href="/\\evil.example">x</a>', backslashes: '<a href="\\\\evil.example">x</a>', slashEntity: '<a href="&#x2F;&#x2F;evil">x</a>',
      unknownEntity: '<a href="&Jfr;avascript:x">x</a>', srcset: '<img srcset="/a.png 1x, javascript:x 2x">',
    };
    for (const [name, html] of Object.entries(bad)) expect(checkMarkup(html).length, name).toBeGreaterThan(0);
    expect(checkMarkup('<a href="https://x.com/?a=1&amp;b=2">x</a><a href="#top">t</a><a href="/stocks/brk.b/">b</a><a href="news/">n</a>')).toEqual([]);
  });
});

it('component output may not forge an island or its props (the page owns them)', async () => {
  const { checkMarkup } = await import('./markup');
  expect(checkMarkup('<div data-island="pt-x">')).toEqual([expect.stringMatching(/reserved for the page/)]);
  expect(checkMarkup('<div data-props=\'{}\'>')).toEqual([expect.stringMatching(/reserved for the page/)]);
  expect(checkMarkup('<p>data-island is a word here</p>')).toEqual([]);
});

it('component output may not stand in for the page state or Angular\'s event contract (the first id in the document wins)', () => {
  expect(checkMarkup('<span id="ng-state">{}</span>')).toEqual([expect.stringMatching(/reserved for the page/)]);
  expect(checkMarkup("<b ID='ng-event-dispatch-contract'></b>")).toEqual([expect.stringMatching(/reserved for the page/)]);
  expect(checkMarkup('<i id=ng-state></i>')).toEqual([expect.stringMatching(/reserved for the page/)]);
  expect(checkMarkup('<p id="ng-statement">ok</p><p>id="ng-state" in text is escaped</p>')).toEqual([]);
});

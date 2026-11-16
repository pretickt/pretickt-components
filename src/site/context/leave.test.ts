// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { answer, CTX_ASK, type ClickData, type ClickNote } from '../../context/click';
import { attachLeave, rememberPanel } from './leave';
import { NOTE_KEY, type NoteStore } from './note';

const NEWS: ClickData = { kind: 'news', d: { title: 'Nvidia beats', url: 'https://example.com/a', site: 'example.com', publishedAt: '2026-11-16T14:00:00Z' } };
const EARN = { kind: 'earnings', d: { title: 'AMD' } } as unknown as ClickData;
const MENTION: ClickData = { kind: 'mention', d: { said: ['AMD said'] } };

let data: Map<string, string>;
let store: NoteStore;
const stored = (): ClickNote | null => (data.has(NOTE_KEY) ? JSON.parse(data.get(NOTE_KEY)!) : null);
const listen = (el: Element, d: ClickData) => el.addEventListener(CTX_ASK, (e) => answer(e, d));
// a click that does not navigate (happy-dom would try): the runtime only reads it
const click = (el: Element, init: MouseEventInit = {}, type = 'click') => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  el.ownerDocument.addEventListener(type, (ev) => ev.preventDefault(), { once: true });
  el.dispatchEvent(e);
};

describe('attachLeave', () => {
  // one document per test: the runtime's listeners live on it
  let doc: Document;
  beforeEach(() => {
    data = new Map();
    store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
    doc = document.implementation.createHTMLDocument();
    doc.title = 'Earnings calendar November 2026 | pretickt';
    attachLeave(doc, 'NVDA', store);
  });
  const html = (s: string) => { doc.body.innerHTML = s; };

  it('a click on a company link leaves its origin\'s answer, for the page it leads to', () => {
    html('<div id="o"><a id="l" href="/stocks/amd/news/">AMD</a></div>');
    listen(doc.getElementById('o')!, NEWS);
    click(doc.getElementById('l')!);
    const n = stored()!;
    expect(n).toMatchObject({ v: 1, to: 'AMD', land: '/stocks/amd/news/', kind: 'news', d: NEWS.d });
    expect(n.from).toEqual({ path: doc.location?.pathname ?? location.pathname, title: 'Earnings calendar November 2026' });
    expect(typeof n.at).toBe('number');
  });

  it('the outer origin wins over a sentence inside it', () => {
    html('<div id="out"><p id="in"><a id="l" href="/stocks/amd/">AMD</a></p></div>');
    listen(doc.getElementById('in')!, MENTION);
    listen(doc.getElementById('out')!, EARN);
    click(doc.getElementById('l')!);
    expect(stored()!.kind).toBe('earnings');
  });

  const none: [string, string][] = [
    ['no origin answers', '<a id="l" href="/stocks/amd/">AMD</a>'],
    ['the header', '<header class="pt-header"><a id="l" href="/stocks/amd/">AMD</a></header>'],
    ['the company tabs', '<nav class="pt-subnav"><a id="l" href="/stocks/amd/">AMD</a></nav>'],
    ['the crumbs', '<nav class="pt-crumbs"><ol><li><a id="l" href="/stocks/amd/">AMD</a></li></ol></nav>'],
    ['the page\'s own company', '<a id="l" href="/stocks/nvda/earnings/">NVDA</a>'],
    ['a page that is not a company\'s', '<a id="l" href="/etfs/xlk/">XLK</a>'],
  ];
  for (const [what, body] of none) {
    it(`no note for ${what}`, () => {
      html(`<div id="o">${body}</div>`);
      if (what !== 'no origin answers') listen(doc.getElementById('o')!, NEWS);
      click(doc.getElementById('l')!);
      expect(data.size).toBe(0);
    });
  }

  it('a new tab: Cmd-click and the middle button leave it, the right button does not', () => {
    html('<div id="o"><a id="l" href="/stocks/amd/">AMD</a></div>');
    listen(doc.getElementById('o')!, NEWS);
    click(doc.getElementById('l')!, { button: 2 }, 'auxclick');
    expect(data.size).toBe(0);
    click(doc.getElementById('l')!, { button: 1 }, 'auxclick');
    expect(stored()!.to).toBe('AMD');
    data.clear();
    click(doc.getElementById('l')!, { metaKey: true });
    expect(stored()!.to).toBe('AMD');
  });

  it('a hover card keeps the answer of the link it opened over; a card over a link with no answer leaves none', () => {
    html('<div id="p"><a id="l" href="/stocks/amd/">AMD</a></div><div id="q"><a id="m" href="/stocks/amd/">AMD</a></div>');
    let asked = 0;
    doc.addEventListener(CTX_ASK, () => asked++);
    rememberPanel(doc.getElementById('p')!, NEWS);
    rememberPanel(doc.getElementById('q')!, null);
    click(doc.getElementById('m')!);
    expect(data.size).toBe(0);
    click(doc.getElementById('l')!);
    expect(stored()!.kind).toBe('news');
    expect(asked).toBe(0);
  });
});

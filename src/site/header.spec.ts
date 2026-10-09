import { startBeacon } from './beacon';
import { attachHeader, rankCompanies } from './header';

const ROWS: [string, string][] = [['A', 'Agilent Technologies Inc.'], ['AAPL', 'Apple Inc.'], ['AMAT', 'Applied Materials, Inc.'], ['BRK.B', 'Berkshire Hathaway Inc.'],
  ['NVDA', 'NVIDIA Corporation'], ['T', 'AT&T Inc.'], ['TSLA', 'Tesla, Inc.'], ['TXN', 'Texas Instruments Incorporated']];
const tickers = (q: string, max?: number) => rankCompanies(ROWS, q, max).map(([t]) => t);

describe('rankCompanies', () => {
  it('ticker exact, then ticker prefix, then a word of the name, then the name anywhere; punctuation and case ignored', () => {
    expect(tickers('nvda')).toEqual(['NVDA']);
    expect(tickers('nvidia')).toEqual(['NVDA']);
    expect(tickers('brk.b')).toEqual(['BRK.B']);
    expect(tickers('BRK B')).toEqual(['BRK.B']);
    expect(tickers('berkshire')).toEqual(['BRK.B']);
    expect(tickers('at&t')[0]).toBe('T');
    expect(tickers('t').slice(0, 3)).toEqual(['T', 'TSLA', 'TXN']);
    expect(tickers('appl')).toEqual(['AAPL', 'AMAT']);
    expect(tickers('instruments')).toEqual(['TXN']);
  });
  it('nothing for an empty or blank query; at most `max` results', () => {
    expect(tickers('')).toEqual([]);
    expect(tickers('   ')).toEqual([]);
    expect(tickers('a', 3)).toHaveLength(3);
  });
});

const HEADER = `<header class="pt-header"><div class="pt-header-in"><a class="pt-brand" href="/">pretickt</a>
  <nav class="pt-sectors" aria-label="Sectors"><details class="pt-menu"><summary>Sectors</summary><ul><li><a href="/sectors/energy/">Energy</a></li></ul></details></nav>
  <form class="pt-search" role="search" action="/stocks/" method="get" data-beacon="pt-search@1.0.0"><label class="pt-sr" for="pt-q">Search companies</label>
  <input id="pt-q" name="q" type="search" placeholder="Search stocks" autocomplete="off"><div class="pt-search-list" id="pt-q-list" hidden></div></form></div></header>
  <main><p id="outside">x</p></main>`;

describe('attachHeader', () => {
  let fetched: string[];
  let went: string[];
  let sent: string[];
  let doc: Document;
  /** A page of its own per case: the header's and the beacon's listeners live on its document. */
  const setup = (index: unknown = { rows: ROWS }) => {
    doc = document.implementation.createHTMLDocument('page');
    doc.body.innerHTML = HEADER;
    fetched = []; went = []; sent = [];
    startBeacon(doc, '', (_u, body) => sent.push(body));
    attachHeader(doc, {
      buildId: 'b1',
      fetch: async (u) => { fetched.push(u); if (index === 'fail') throw new Error('offline'); return new Response(JSON.stringify(index)); },
      navigate: (href) => went.push(href),
    });
    return doc.querySelector<HTMLInputElement>('#pt-q')!;
  };
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };
  const type = async (input: HTMLInputElement, q: string) => { input.value = q; input.dispatchEvent(new Event('input', { bubbles: true })); await flush(); };
  const key = (input: HTMLInputElement, k: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const options = () => [...doc.querySelectorAll<HTMLAnchorElement>('#pt-q-list [role="option"]')];

  it('loads the index once, on the first focus, and lists the matches as links to the company pages', async () => {
    const input = setup();
    expect(fetched).toEqual([]);
    input.dispatchEvent(new FocusEvent('focus'));
    await flush();
    input.dispatchEvent(new FocusEvent('focus'));
    await type(input, 'appl');
    expect(fetched).toEqual(['/search.json?v=b1']);
    expect(options().map((o) => [o.getAttribute('href'), o.querySelector('strong')!.textContent])).toEqual([['/stocks/aapl/', 'AAPL'], ['/stocks/amat/', 'AMAT']]);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(doc.querySelector('#pt-q-list')!.hasAttribute('hidden')).toBe(false);
  });
  it('↓ / ↑ move the active option, Enter opens it (the first without moving); one "search" beacon', async () => {
    const input = setup();
    input.dispatchEvent(new FocusEvent('focus'));
    await type(input, 'appl');
    key(input, 'ArrowDown'); key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[1]!.id);
    expect(options()[1]!.getAttribute('aria-selected')).toBe('true');
    key(input, 'ArrowUp');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]!.id);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(went).toEqual(['/stocks/aapl/']);
    await type(input, 'nvidia');
    key(input, 'Enter');
    expect(went).toEqual(['/stocks/aapl/', '/stocks/nvda/']);
    expect(sent.filter((s) => s.includes('"t":"ix"'))).toEqual([JSON.stringify({ t: 'ix', p: '/', c: 'pt-search@1.0.0', a: 'search' })]);
  });
  it('Escape and a click outside close the list; a click outside closes the sector menu too', async () => {
    const input = setup();
    input.dispatchEvent(new FocusEvent('focus'));
    await type(input, 'appl');
    key(input, 'Escape');
    expect(doc.querySelector('#pt-q-list')!.hasAttribute('hidden')).toBe(true);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    await type(input, 'appl');
    const menu = doc.querySelector('details.pt-menu') as HTMLDetailsElement;
    menu.open = true;
    doc.querySelector('#outside')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(doc.querySelector('#pt-q-list')!.hasAttribute('hidden')).toBe(true);
    expect(menu.open).toBe(false);
  });
  it('no results for a blank query; when the index cannot load, the box stays a plain form (Enter submits to /stocks/)', async () => {
    const input = setup();
    input.dispatchEvent(new FocusEvent('focus'));
    await type(input, '  ');
    expect(options()).toHaveLength(0);
    const off = setup('fail');
    off.dispatchEvent(new FocusEvent('focus'));
    await type(off, 'appl');
    expect(options()).toHaveLength(0);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    off.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(went).toEqual([]);
  });
});

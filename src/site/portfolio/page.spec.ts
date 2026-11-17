import { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { askAt, PT_FOLLOW, PT_FOLLOW_ON, PT_STORE, PtStore, type FollowState } from '@pretickt/components/context';
import { PtFollow, type FollowPress } from '@pretickt/components/follow';
import { date, money } from '@pretickt/components/format';
import { DEMO_CLOSES, DEMO_FACTS, DEMO_FACTS_SPY, DEMO_PORTFOLIOS, demoPortfolio } from '../../stories/fake-portfolio';
import { PT_PORTFOLIO_FILES, PT_PORTFOLIO_STORAGE } from './files';
import { localToday, PtPortfolioPage, readyMade } from './page';
import { mount as mountPage } from './start';
import { PORTFOLIO_KEY, type Stored } from './store';

class Mem implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

async function mount(stored: Stored | string | null = null, o: { fail?: string[]; sheet?: string[]; mega?: string[]; follows?: string[]; spy?: boolean } = {}) {
  const storage = new Mem(), asked: string[] = [], events: string[] = [], logos: string[][] = [];
  const sheet = o.sheet ? { ...DEMO_FACTS, sprite: { file: '/logos/sprite.1a2b3c4d.webp', px: 40, cols: 25, tickers: o.sheet } } : DEMO_FACTS;
  const facts = o.spy ? WITH_SPY : o.mega ? { ...sheet, mega: o.mega } : sheet;
  let follow: FollowState = { follows: o.follows ?? [], seen: {} };
  const followed: unknown[] = o.follows ? [{ provide: PT_FOLLOW_ON, useValue: true }, { provide: PT_FOLLOW, useValue: { read: () => follow, write: (s: FollowState) => { follow = s; } } }] : [];
  // a logo cut out of the sheet, as the browser gives it (here its ticker in base64, so a test can tell whose it is)
  const cut = async (_s: unknown, ts: readonly string[]) => { logos.push([...ts]); return new Map(ts.map((t) => [t, `data:image/png;base64,${btoa(t)}`])); };
  if (stored) storage.setItem(PORTFOLIO_KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
  const listen = (e: Event) => events.push(`${(e.target as Element).closest('[data-beacon]')?.getAttribute('data-beacon')}|${(e as CustomEvent<{ action: string }>).detail.action}`);
  document.addEventListener('pt-interact', listen);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [
    { provide: PT_PORTFOLIO_FILES, useValue: { facts: async () => facts, closes: async (k: string) => { asked.push(k); return o.fail?.includes(k) ? null : DEMO_CLOSES.get(k) ?? null; }, logos: cut } },
    { provide: PT_PORTFOLIO_STORAGE, useValue: () => storage },
    { provide: PT_STORE, useValue: new PtStore({ server: false, resolve: async () => null }) },
    ...followed as never[],
  ] });
  const f = TestBed.createComponent(PtPortfolioPage);
  const settle = async () => { for (let i = 0; i < 6; i++) { f.detectChanges(); TestBed.tick(); await new Promise((r) => setTimeout(r, 1)); } };
  await settle();
  document.removeEventListener('pt-interact', listen);
  const el = f.nativeElement as HTMLElement;
  const press = async (label: string) => { [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === label)!.click(); await settle(); };
  const sum = () => Object.fromEntries([...el.querySelectorAll('.pt-pf-sum div')].map((d) => [d.querySelector('dt')!.textContent!.trim(), d.querySelector('dd')!.textContent!.trim()]));
  return { el, storage, asked, events, logos, press, sum, settle, text: () => el.textContent!.replace(/\s+/g, ' '), h2: () => [...el.querySelectorAll('h2')].map((h) => h.textContent!.trim()) };
}

const WITH_SPY = DEMO_FACTS_SPY;

describe('the ready-made lists (Romeo, 2026-11-17: «portafogli predefiniti: mega caps, tech top 20, sp500 top 20, e dei settori»)', () => {
  it("the largest first by SPY's weight, one line a company; tech the Technology sector; a list a sector with its companies", () => {
    const r = readyMade(WITH_SPY);
    expect(r.top.map((q) => [q.p.id, q.p.name, q.p.rows.map((x) => x.t)])).toEqual([
      ['example', 'Mega caps', ['NVDA', 'AAPL', 'MSFT']],
      ['sp20', 'S&P 500 top 20', ['MSFT', 'NVDA', 'AAPL', 'AMZN', 'KO']],
      ['tech20', 'Tech top 20', ['MSFT', 'NVDA', 'AAPL', 'KO', 'META', 'AVGO', 'AMD', 'BRK.B', 'JPM']],
    ]);
    expect(r.top.every((q) => q.p.kind === 'watchlist' && q.p.unit === 'equal')).toBe(true);
    expect(r.sectors.map((q) => [q.p.id, q.p.rows.map((x) => x.t), q.d])).toEqual([
      ['sector:Consumer Defensive', ['AMZN', 'INTC', 'NKE'], 'the 3 Consumer Defensive companies on pretickt, largest first'],
      ['sector:Technology', ['MSFT', 'NVDA', 'AAPL', 'KO', 'META', 'AVGO', 'AMD', 'BRK.B', 'JPM'], 'the 9 Technology companies on pretickt, largest first'],
    ]);
    // no SPY in the facts: no top 20, the sectors still
    expect(readyMade(DEMO_FACTS).top.map((q) => q.p.id)).toEqual(['example']);
  });

  it('the page offers them beside your own; one is shown until you pick yours, and its bell follows its companies', async () => {
    const m = await mount({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.watchlist] }, { spy: true, follows: [] });
    expect([...m.el.querySelectorAll('.pt-pf-ready button')].map((b) => b.textContent!.trim())).toEqual(['Mega caps', 'S&P 500 top 20', 'Tech top 20']);
    expect([...m.el.querySelectorAll('.pt-pf-ready option')].map((o) => o.textContent!.trim())).toEqual(['Sectors', 'Consumer Defensive', 'Technology']);
    expect(m.el.querySelector('.pt-pf-tab-on')!.textContent).toContain('Chips to watch');
    await m.press('S&P 500 top 20');
    expect(m.text()).toContain('Ready-made: the 20 largest companies of the S&P 500, weighted equally.');
    expect([...m.el.querySelectorAll('.pt-pf-tab-on')].map((b) => b.textContent!.trim())).toEqual(['S&P 500 top 20']);
    expect(m.text()).not.toContain('Edit lines'); // your list's tools wait: they would act on a list not shown
    const presses: FollowPress[] = [];
    TestBed.inject(PtFollow).listen((p) => presses.push(p));
    m.el.querySelector<HTMLButtonElement>('.pt-pf-bell')!.click();
    expect(presses.map(({ ticker, name, tickers }) => ({ ticker, name, tickers }))).toEqual([{ ticker: 'group:sp20', name: 'S&P 500 top 20', tickers: ['MSFT', 'NVDA', 'AAPL', 'AMZN', 'KO'] }]);
    const sel = m.el.querySelector<HTMLSelectElement>('.pt-pf-ready select')!;
    sel.value = 'sector:Consumer Defensive';
    sel.dispatchEvent(new Event('change'));
    await m.settle();
    expect(m.text()).toContain('Ready-made: the 3 Consumer Defensive companies on pretickt, largest first, weighted equally.');
    expect(m.el.querySelector('.pt-pf-bell')!.textContent!.trim()).toBe('Get alerts for these 3 companies');
    await m.press('Mega caps');
    expect(m.text()).toContain('Ready-made: the 3 companies worth $200 billion or more, weighted equally.');
    expect(m.text()).not.toContain('An example');
    await m.press('Chips to watch Watchlist');
    expect(m.text()).not.toContain('Ready-made:');
    expect(m.text()).toContain('Edit lines');
    // nothing saved: the mega caps are the example, their button on
    const none = await mount(null, { spy: true });
    expect(none.el.querySelector('.pt-pf-ready .pt-pf-tab-on')!.textContent!.trim()).toBe('Mega caps');
  });
});

describe('the portfolio page', () => {
  it('shows the example when nothing is saved', async () => {
    const m = await mount();
    expect(m.text()).toContain('An example: five large companies, weighted equally. Make your own with New portfolio or New watchlist.');
    expect(m.el.querySelectorAll('pt-basket')).toHaveLength(4);
    expect(m.events).toEqual(['pt-portfolio@1.0.0|holds-none']);
  });

  it("the example is the mega caps from the nightly's list: the companies on the site, in its order, weighted equally (Romeo, 2026-11-15: «il portafoglio base fallo delle mega caps»)", async () => {
    const m = await mount(null, { mega: ['NVDA', 'AAPL', 'ZZZZ', 'MSFT'] });
    expect(m.text()).toContain('An example: the 3 companies worth $200 billion or more, weighted equally. Make your own with New portfolio or New watchlist.');
    expect(m.text()).not.toContain('Amazon');
    expect(m.sum()['Covered']).toBe('100%');
  });
  it('a bell button on the portfolio shown: one press opens the panel for its companies (the funds out), and the click stays here', async () => {
    const m = await mount(null, { mega: ['NVDA', 'AAPL', 'MSFT'], follows: [] });
    const presses: FollowPress[] = [];
    TestBed.inject(PtFollow).listen((p) => presses.push(p));
    let outside = 0;
    const count = () => outside++;
    document.addEventListener('click', count);
    const btn = m.el.querySelector<HTMLButtonElement>('.pt-pf-bell')!;
    expect(btn.textContent!.trim()).toBe('Get alerts for these 3 companies');
    btn.click();
    document.removeEventListener('click', count);
    expect(outside).toBe(0);
    expect(presses.map(({ ticker, name, alerts, tickers }) => ({ ticker, name, alerts, tickers }))).toEqual([{ ticker: 'group:example', name: 'Mega caps', alerts: [], tickers: ['NVDA', 'AAPL', 'MSFT'] }]);
    const s = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] }, { follows: ['AAPL', 'NVDA', 'MSFT', 'KO'] });
    expect(s.el.querySelector('.pt-pf-bell')!.textContent!.trim()).toBe('Alerts on for these 4 companies');
    expect((await mount({ v: 1, active: 'demo-fund', list: [DEMO_PORTFOLIOS.fund] }, { follows: [] })).el.querySelector('.pt-pf-bell')).toBeNull();
    expect((await mount(null, { mega: ['NVDA'] })).el.querySelector('.pt-pf-bell')).toBeNull();   // the bells off
  });
  it("a saved portfolio's summary and sections", async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] });
    const b = demoPortfolio('shares');
    expect(m.sum()['Value at the last close']).toBe(money(b.value!));
    expect(m.sum()[`Since ${date(b.since!.from)}`]).toBeDefined();
    expect(m.h2()).toEqual(['Why it moved', 'Holdings', 'Analyst price target and consensus', 'What the questions say about your holdings', 'The year', 'Earnings ahead', 'News of the largest holdings']);
    expect(m.text()).toContain('Not investment advice: these figures add up what analysts and the questions say about each company.');
    expect(m.el.querySelector('pt-portfolio-line svg')).not.toBeNull();
    expect(m.events).toEqual(['pt-portfolio@1.0.0|holds-one']);
  });

  it("the click's ask on the earnings and news lists (2026-11-16): your line, with the date or the headline", async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] });
    const b = demoPortfolio('shares'), e = b.earnings[0]!, n = b.headlines[0]!;
    const line = (t: string) => { const h = b.holdings.find((x) => x.ticker === t)!; return { weight: h.weight, ret: h.ret, points: h.ret == null ? null : expect.closeTo(h.weight * h.ret, 9) }; };
    const lists = m.el.querySelectorAll('.pt-pf-list');
    expect(askAt(lists[0]!.querySelector('a')!)).toEqual({ kind: 'portfolio', d: { ...line(e.ticker), earnings: e.date, headline: null } });
    expect(askAt(lists[1]!.querySelector('a')!)).toEqual({ kind: 'portfolio', d: { ...line(n.ticker), earnings: null, headline: { title: n.title, url: n.url } } });
  });

  it("a watchlist's titles", async () => {
    const m = await mount({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.watchlist] });
    expect(m.h2()).toContain('What the questions say about these companies');
    expect(m.sum()['Value at the last close']).toBeUndefined();
  });

  it('loads the year file for the line and the dates, and a calendar year only for an older date', async () => {
    const recent = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] });
    expect(recent.asked).toEqual(['1y']);
    const old = await mount({ v: 1, active: 'old', list: [{ ...DEMO_PORTFOLIOS.shares, id: 'old', rows: [{ t: 'AAPL', n: 3, d: '2024-05-01' }] }] });
    expect(old.asked).toEqual(['1y', '2024']);
    // the 2024 file did not come: the line shows its date and no return, never a "no close" it cannot know
    expect(old.text()).not.toContain('no close then');
    expect(old.text()).toContain('May 1, 2024');
  });

  it('counts portfolios in words, never a symbol; a change in the editor is kept in this browser', async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares, DEMO_PORTFOLIOS.watchlist, DEMO_PORTFOLIOS.low] });
    expect(m.events).toEqual(['pt-portfolio@1.0.0|holds-few']);
    expect(m.asked.every((k) => /^(1y|\d{4})$/.test(k))).toBe(true);
    await m.press('Delete');
    await m.press('Yes, delete');
    expect((JSON.parse(m.storage.getItem(PORTFOLIO_KEY)!) as Stored).list.map((p) => p.id)).toEqual(['demo-watch', 'demo-low']);
  });

  it("hovering a company never reaches the site's hover cards, which would ask the API for that ticker: the holdings stay in the browser", async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] });
    const seen: string[] = [];
    const listen = (e: Event) => seen.push((e.target as Element).getAttribute('href') ?? '');
    document.body.appendChild(m.el);
    document.addEventListener('pointerover', listen);
    const link = m.el.querySelector('a[href^="/stocks/"]')!;
    link.dispatchEvent(new Event('pointerover', { bubbles: true }));
    document.removeEventListener('pointerover', listen);
    m.el.remove();
    expect(link).not.toBeNull();
    expect(seen).toEqual([]);
  });

  it("mounts in the generator's placeholder, replacing its note", () => {
    TestBed.configureTestingModule({ providers: [{ provide: PT_STORE, useValue: new PtStore({ server: false, resolve: async () => null }) }] });
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch; // no network in a test: the page says its data is not available
    const host = document.createElement('div');
    host.innerHTML = '<p class="pt-na">This page needs JavaScript</p>';
    mountPage(host, TestBed.inject(ApplicationRef), TestBed.inject(EnvironmentInjector), { buildId: 'b1', api: '', sections: [] });
    expect(host.querySelector('pt-portfolio-page')).not.toBeNull();
    expect(host.querySelector('.pt-na')).toBeNull();
    globalThis.fetch = real;
  });

  it("the deferred cases of the review: a value it could not read is said, another tab's save shows, a year that does not come is said", async () => {
    const unread = await mount('{not json');
    expect(unread.text()).toContain('What this browser had saved could not be read: it is kept aside, and the page starts empty.');
    const two = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] });
    two.storage.setItem(PORTFOLIO_KEY, JSON.stringify({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.shares, DEMO_PORTFOLIOS.watchlist] }));
    window.dispatchEvent(new StorageEvent('storage', { key: PORTFOLIO_KEY }));
    await two.settle();
    expect(two.el.querySelector('.pt-pf-tab-on')!.textContent).toContain('Chips to watch');
    const failed = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] }, { fail: ['1y'] });
    expect(failed.text()).toContain('The year is not available right now.');
    expect(failed.text()).not.toContain('Loading the year');
  });

  it("a watchlist's own titles; dollars typed are called what they are", async () => {
    const w = await mount({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.watchlist] });
    expect(w.h2()).toEqual(expect.arrayContaining(['Companies', 'News of these companies']));
    expect(w.h2()).not.toContain('Holdings');
    const usd = await mount({ v: 1, active: 'demo-low', list: [DEMO_PORTFOLIOS.low] });
    expect(usd.sum()['Value you entered']).toBeDefined();
    expect(usd.sum()['Value at the last close']).toBeUndefined();
  });

  it("the lines' logos, cut out of the one sheet every reader loads: asked once for the lines on it, shown in the table", async () => {
    const m = await mount({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.watchlist, DEMO_PORTFOLIOS.low] }, { sheet: ['AAPL', 'AMD', 'NVDA', 'ZZZ'] });
    expect(m.logos).toEqual([['NVDA', 'AMD']]);
    const shown = () => [...m.el.querySelectorAll('pt-basket img')].map((i) => i.getAttribute('src'));
    expect(shown()).toEqual(expect.arrayContaining([`data:image/png;base64,${btoa('NVDA')}`, `data:image/png;base64,${btoa('AMD')}`]));
    // another portfolio: only its own new lines are asked
    await m.press('Mostly elsewhere Portfolio');
    expect(m.logos).toEqual([['NVDA', 'AMD'], ['AAPL']]);
    expect(shown()).toContain(`data:image/png;base64,${btoa('AAPL')}`);
    expect(shown().join(' ')).not.toContain('/logos/');
    // facts with no sheet: no logo asked, the initials
    const none = await mount({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.watchlist] });
    expect(none.logos).toEqual([]);
    expect(none.el.querySelectorAll('pt-basket img')).toHaveLength(0);
  });

  it("the preview of a paste shows the logos from the same cut-outs as the table: a logo the table already has is not asked again", async () => {
    const m = await mount({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.watchlist] }, { sheet: ['AAPL', 'AMD', 'NVDA'] });
    expect(m.logos).toEqual([['NVDA', 'AMD']]);
    await m.press('New portfolio');
    const box = m.el.querySelector<HTMLTextAreaElement>('textarea.pt-pf-paste')!;
    box.value = 'NVDA 3\nAAPL 2';
    box.dispatchEvent(new Event('input'));
    await m.press('Read');
    expect(m.logos).toEqual([['NVDA', 'AMD'], ['AAPL']]);
    expect([...m.el.querySelectorAll('.pt-pf-dr img.pt-logo')].map((i) => i.getAttribute('src'))).toEqual([`data:image/png;base64,${btoa('NVDA')}`, `data:image/png;base64,${btoa('AAPL')}`]);
  });

  it("today is the reader's own date, not the UTC one", () => {
    expect(localToday(new Date(2026, 10, 8, 23, 30))).toBe('2026-11-08');
  });
});

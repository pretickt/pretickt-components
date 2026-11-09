import { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { date, money } from '@pretickt/components/format';
import { DEMO_CLOSES, DEMO_FACTS, DEMO_PORTFOLIOS, demoPortfolio } from '../../stories/fake-portfolio';
import { PT_PORTFOLIO_FILES, PT_PORTFOLIO_STORAGE } from './files';
import { localToday, PtPortfolioPage } from './page';
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

async function mount(stored: Stored | string | null = null, o: { fail?: string[]; sheet?: string[] } = {}) {
  const storage = new Mem(), asked: string[] = [], events: string[] = [], logos: string[][] = [];
  const facts = o.sheet ? { ...DEMO_FACTS, sprite: { file: '/logos/sprite.1a2b3c4d.webp', px: 40, cols: 25, tickers: o.sheet } } : DEMO_FACTS;
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

describe('the portfolio page', () => {
  it('shows the example when nothing is saved', async () => {
    const m = await mount();
    expect(m.text()).toContain('An example: five large companies, weighted equally. Make your own with New portfolio or New watchlist.');
    expect(m.el.querySelectorAll('pt-basket')).toHaveLength(4);
    expect(m.events).toEqual(['pt-portfolio@1.0.0|holds-none']);
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

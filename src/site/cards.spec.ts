import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PT_STORE } from '@pretickt/components/context';
import { PtCompanyCard } from '../../components/pt-company-card';
import { needPath } from '../api';
import { demoFor } from '../typologies';
import { attachCards, attachCardSlots, CARD_TARGET, companyOf, panelPosition } from './cards';
import { browserStore } from './store.browser';
import { attachTips } from './tips';

const ID = 'pt-company-card@1.1.0';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = vi.fn(async (url: string) => {
  const u = new URL(url, 'https://x');
  const t = decodeURIComponent(u.pathname.slice('/v1/t/'.length));
  return new Response(JSON.stringify(demoFor({ t, params: JSON.parse(u.searchParams.get('p')!) } as never)));
});

function page(o: { hover?: boolean; fetchImpl?: typeof api; sent?: string[] } = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: PT_STORE, useValue: browserStore({ buildId: 'b1', api: '', sections: [] }, {}, o.fetchImpl ?? api) }] });
  document.body.innerHTML = `<p><a id="aapl" href="/stocks/aapl/" data-tip='{"Earnings":"Oct 28, 2026","EPS est.":null}'>AAPL</a>` +
    `<a id="nvda" href="/stocks/nvda/">NVDA</a><a id="other" href="/earnings-calendar/">calendar</a></p>`;
  document.addEventListener('pt-interact', (e) => o.sent?.push(`${(e.target as Element).getAttribute('data-island')}|${(e as CustomEvent<{ action: string }>).detail.action}`));
  return attachCards(document, TestBed.inject(ApplicationRef), { id: ID, load: async () => PtCompanyCard, hover: o.hover ?? true, openMs: 20, closeMs: 20, pauseMs: 5000 });
}
const over = (id: string) => document.getElementById(id)!.dispatchEvent(new Event('pointerover', { bubbles: true }));
const out = (id: string, to: Element | null = document.body) => document.getElementById(id)!.dispatchEvent(Object.assign(new Event('pointerout', { bubbles: true }), { relatedTarget: to }));
const panel = () => document.querySelector<HTMLElement>('.pt-hovercard');
afterEach(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); document.body.innerHTML = ''; api.mockClear(); });

describe('company cards on hover', () => {
  it('a company link opens the compact card after a moment, with the link\'s tooltip rows as its footer', async () => {
    page();
    over('aapl');
    expect(panel()).toBeNull();
    await vi.waitFor(() => expect(panel()?.querySelector('.pt-card-compact')).toBeTruthy());
    expect(panel()!.textContent).toContain('Apple');
    expect(panel()!.textContent).not.toContain('Apple Inc.');
    expect(panel()!.querySelector('.pt-card-foot')!.textContent).toBe('Earnings Oct 28, 2026');
    expect(api.mock.calls.map((c) => c[0])).toContain(needPath({ t: 'company@1', params: { ticker: 'AAPL' } }, 'b1'));
  });
  it('stays open while the pointer moves into the card, closes after leaving it, and on Escape; one card at a time', async () => {
    page();
    over('aapl');
    await vi.waitFor(() => expect(panel()?.querySelector('.pt-card')).toBeTruthy());
    out('aapl', panel());
    panel()!.dispatchEvent(new Event('pointerenter'));
    await wait(60);
    expect(panel()).not.toBeNull();
    panel()!.dispatchEvent(new Event('pointerleave'));
    await vi.waitFor(() => expect(panel()).toBeNull());
    over('nvda');
    await vi.waitFor(() => expect(panel()?.textContent).toContain('Nvidia'));
    over('aapl');
    await vi.waitFor(() => expect(panel()?.textContent).toContain('Apple'));
    expect(document.querySelectorAll('.pt-hovercard')).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel()).toBeNull();
  });
  it('reopening a card asks nothing again (the page\'s answers are shared)', async () => {
    page();
    over('aapl');
    await vi.waitFor(() => expect(panel()?.textContent).toContain('Apple'));
    const asked = api.mock.calls.length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    out('aapl'); over('aapl');
    await vi.waitFor(() => expect(panel()?.textContent).toContain('Apple'));
    expect(api.mock.calls.length).toBe(asked);
  });
  it('after a card fails (e.g. the API rate limit), cards pause', async () => {
    let fail = true;
    const fetchImpl = vi.fn(async (url: string) => (fail ? new Response('{}', { status: 429 }) : api(url)));
    const cards = page({ fetchImpl });
    over('aapl');
    await wait(80);
    expect(panel()).toBeNull();
    expect(cards.active()).toBe(false);
    fail = false;
    out('aapl'); over('nvda');
    await wait(80);
    expect(panel()).toBeNull();
  });
  it('a quick pass over a link opens nothing; nothing without a mouse, or for other links', async () => {
    page();
    over('aapl'); out('aapl');
    await wait(60);
    expect(panel()).toBeNull();
    page({ hover: false });
    over('aapl');
    await wait(60);
    expect(panel()).toBeNull();
    page();
    over('other');
    await wait(60);
    expect(panel()).toBeNull();
  });
  it('hovering a ticker always shows its card, on the company\'s own page too; the sub-navigation (Overview) is not a ticker', async () => {
    page();
    document.body.insertAdjacentHTML('beforeend', '<nav class="pt-subnav"><a id="overview" href="/stocks/nvda/">Overview</a></nav>' +
      '<p>The target for <a id="self" class="pt-mention" href="/stocks/nvda/">Nvidia NVDA</a> is up.</p>');
    over('overview');
    await wait(60);
    expect(panel()).toBeNull();
    over('self');
    await vi.waitFor(() => expect(panel()?.querySelector('.pt-card-compact')).toBeTruthy());
  });
  it('a symbol that is not a link (a calendar row: one control, no link inside) opens its card when it names the company in data-card', async () => {
    page();
    document.body.insertAdjacentHTML('beforeend', '<details><summary><span id="row" data-card="MSFT"><b>Microsoft</b> MSFT</span> ±4.7%</summary></details>' +
      '<span id="junk" data-card="javascript:alert(1)">x</span>');
    over('junk');
    await wait(60);
    expect(panel()).toBeNull();
    document.querySelector('#row b')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    await vi.waitFor(() => expect(panel()?.querySelector('.pt-card-compact')).toBeTruthy());
    expect(api.mock.calls.some(([u]) => decodeURIComponent(String(u)).includes('"ticker":"MSFT"'))).toBe(true);
  });
  it('the header\'s search results are company links too, but open no card (it would cover the list)', async () => {
    page();
    document.body.insertAdjacentHTML('afterbegin', '<header class="pt-header"><div class="pt-search-list"><a id="opt" role="option" href="/stocks/msft/">MSFT</a></div></header>');
    over('opt');
    await wait(60);
    expect(panel()).toBeNull();
  });
  it('each opening counts as a hover on the card in the beacon', async () => {
    const sent: string[] = [];
    page({ sent });
    over('aapl');
    await vi.waitFor(() => expect(sent).toContain(`${ID}|hover`));
  });
  it('a company link is its page, with or without a section of it (#people-ask), and nothing else', () => {
    const a = (href: string) => Object.assign(document.createElement('a'), { href }) && (() => { const x = document.createElement('a'); x.setAttribute('href', href); return x; })();
    expect(['/stocks/nvda/', '/stocks/brk.b/#quality', '/stocks/nvda/#people-ask', '/stocks/nvda/news/', '/stocks/nvda', '/earnings-calendar/'].map((h) => companyOf(a(h))))
      .toEqual(['NVDA', 'BRK.B', 'NVDA', null, null, null]);
    const named = (t: string) => { const x = document.createElement('span'); x.setAttribute('data-card', t); return x; };
    expect(['MSFT', 'BRK.B', 'msft', '^GSPC', ''].map((t) => companyOf(named(t)))).toEqual(['MSFT', 'BRK.B', null, null, null]);
    expect(CARD_TARGET).toBe('a[href], [data-card]');
  });
  it('panel position: below the link when it fits, above when it does not, else pinned and scrollable', () => {
    expect(panelPosition({ left: 100, top: 100, bottom: 120 }, 340, 300, 1200, 800)).toEqual({ x: 100, y: 128, maxHeight: null });
    expect(panelPosition({ left: 100, top: 600, bottom: 620 }, 340, 300, 1200, 800)).toEqual({ x: 100, y: 292, maxHeight: null });
    expect(panelPosition({ left: 1000, top: 300, bottom: 320 }, 340, 900, 1200, 800)).toEqual({ x: 852, y: 8, maxHeight: 784 });
  });
});

describe('company cards in a slot', () => {
  it('a slot a component leaves (data-card-slot) gets the compact card on any device, a click away; when the slot goes, so does the card', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PT_STORE, useValue: browserStore({ buildId: 'b1', api: '', sections: [] }, {}, api) }] });
    const appRef = TestBed.inject(ApplicationRef);
    document.body.innerHTML = '<div id="pop"><p>Microsoft reports Wed</p><div id="slot" data-card-slot="MSFT"></div><div id="bad" data-card-slot="javascript:x"></div></div>';
    const slots = attachCardSlots(document, appRef, { id: ID, load: async () => PtCompanyCard });
    const slot = document.getElementById('slot')!;
    await vi.waitFor(() => expect(slot.querySelector('.pt-card-compact')).toBeTruthy());
    expect(slot.querySelector('[data-island]')!.getAttribute('data-island')).toBe(ID);
    expect(document.getElementById('bad')!.childElementCount).toBe(0);
    const views = appRef.viewCount;
    document.getElementById('pop')!.remove();
    await vi.waitFor(() => expect(appRef.viewCount).toBe(views - 1));
    // a slot added later (a box opened on a click) is filled too
    document.body.insertAdjacentHTML('beforeend', '<div><div id="later" data-card-slot="AAPL"></div></div>');
    await vi.waitFor(() => expect(document.getElementById('later')!.querySelector('.pt-card-compact')).toBeTruthy());
    slots.stop();
  });
});

describe('tooltips', () => {
  it('one tip node in <body>; a skipped target (a company link whose card opens) keeps its tooltip for the keyboard', () => {
    document.body.innerHTML = '<pt-page id="root"><a id="a" href="/stocks/aapl/" data-tip=\'{"Earnings":"Oct 28"}\'>AAPL</a><span id="s" data-tip=\'{"P/E":"21x","x":null}\'>s</span></pt-page>';
    const tip = attachTips(document.getElementById('root')!, (t) => t.id === 'a');
    expect(tip.parentElement).toBe(document.body);
    const a = document.getElementById('a')!;
    a.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(tip.hidden).toBe(true);
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('Earnings Oct 28');
    document.getElementById('s')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(tip.textContent).toBe('P/E 21x');
    document.getElementById('s')!.dispatchEvent(Object.assign(new Event('pointerout', { bubbles: true }), { relatedTarget: document.body }));
    expect(tip.hidden).toBe(true);
  });
});

import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PT_STORE } from '@pretickt/components/context';
import { PtCompanyCard } from '../../components/pt-company-card';
import { needPath } from '../api';
import { demoFor } from '../typologies';
import { attachCards, panelPosition } from './cards';
import { browserStore } from './store.browser';
import { attachTips } from './tips';

const ID = 'pt-company-card@1.1.0';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const api = vi.fn(async (url: string) => {
  const u = new URL(url, 'https://x');
  const t = decodeURIComponent(u.pathname.slice('/v1/t/'.length));
  return new Response(JSON.stringify(demoFor({ t, params: JSON.parse(u.searchParams.get('p')!) } as never)));
});

function page(o: { subject?: string; hover?: boolean; fetchImpl?: typeof api; sent?: string[] } = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: PT_STORE, useValue: browserStore({ buildId: 'b1', api: '', sections: [] }, {}, o.fetchImpl ?? api) }] });
  document.body.innerHTML = `<p><a id="aapl" href="/stocks/aapl/" data-tip='{"Earnings":"Oct 28, 2026","EPS est.":null}'>AAPL</a>` +
    `<a id="nvda" href="/stocks/nvda/">NVDA</a><a id="other" href="/earnings-calendar/">calendar</a></p>`;
  document.addEventListener('pt-interact', (e) => o.sent?.push(`${(e.target as Element).getAttribute('data-island')}|${(e as CustomEvent<{ action: string }>).detail.action}`));
  return attachCards(document, TestBed.inject(ApplicationRef), { id: ID, load: async () => PtCompanyCard, hover: o.hover ?? true, subject: o.subject, openMs: 20, closeMs: 20, pauseMs: 5000 });
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
    expect(panel()!.textContent).toContain('Apple Inc.');
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
    await vi.waitFor(() => expect(panel()?.textContent).toContain('NVIDIA'));
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
  it('a quick pass over a link opens nothing; nothing without a mouse, for the page\'s own company, or for other links', async () => {
    page();
    over('aapl'); out('aapl');
    await wait(60);
    expect(panel()).toBeNull();
    page({ hover: false });
    over('aapl');
    await wait(60);
    expect(panel()).toBeNull();
    page({ subject: 'AAPL' });
    over('aapl'); over('other');
    await wait(60);
    expect(panel()).toBeNull();
  });
  it('each opening counts as a hover on the card in the beacon', async () => {
    const sent: string[] = [];
    page({ sent });
    over('aapl');
    await vi.waitFor(() => expect(sent).toContain(`${ID}|hover`));
  });
  it('panel position: below the link when it fits, above when it does not, else pinned and scrollable', () => {
    expect(panelPosition({ left: 100, top: 100, bottom: 120 }, 340, 300, 1200, 800)).toEqual({ x: 100, y: 128, maxHeight: null });
    expect(panelPosition({ left: 100, top: 600, bottom: 620 }, 340, 300, 1200, 800)).toEqual({ x: 100, y: 292, maxHeight: null });
    expect(panelPosition({ left: 1000, top: 300, bottom: 320 }, 340, 900, 1200, 800)).toEqual({ x: 852, y: 8, maxHeight: 784 });
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

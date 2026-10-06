// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import PtCompanyCard from '../../components/pt-company-card.vue';
import { needPath } from '../api';
import { demoFor } from '../typologies';
import { hydrateIslands } from './client';
import type { PageData } from './page';

const CARD = { id: 'pt-company-card@1.0.0', url: '/c/card.js' };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The API, answered from the typology demos. */
const api = vi.fn(async (url: string) => {
  const u = new URL(url, 'https://x');
  const t = decodeURIComponent(u.pathname.slice('/v1/t/'.length));
  return new Response(JSON.stringify(demoFor({ t, params: JSON.parse(u.searchParams.get('p')!) })));
});

async function page(o: { card?: typeof CARD | null; subject?: string; hover?: boolean; fetchImpl?: typeof api; sent?: unknown[] } = {}) {
  const data: PageData = { buildId: 'b1', api: '', calls: {}, components: {}, ...(o.card === null ? {} : { card: o.card ?? CARD }), ...(o.subject ? { subject: o.subject } : {}) };
  document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(data)}</script>`;
  document.body.innerHTML = `<p><a id="aapl" href="/stocks/aapl/" data-tip='{"Earnings":"Oct 28, 2026","EPS est.":null}'>AAPL</a>` +
    `<a id="nvda" href="/stocks/nvda/">NVDA</a><a id="other" href="/earnings-calendar/">calendar</a></p>`;
  await hydrateIslands(document, { importer: async () => ({ default: PtCompanyCard }), fetchImpl: o.fetchImpl ?? api,
    send: (_u, b) => o.sent?.push(JSON.parse(b)), cards: { hover: o.hover ?? true, openMs: 20, closeMs: 20, pauseMs: 5000 } });
}
const over = (id: string) => document.getElementById(id)!.dispatchEvent(new Event('pointerover', { bubbles: true }));
const out = (id: string, to: Element | null = document.body) => document.getElementById(id)!.dispatchEvent(Object.assign(new Event('pointerout', { bubbles: true }), { relatedTarget: to }));
const panel = () => document.querySelector<HTMLElement>('.pt-hovercard');
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; api.mockClear(); });

describe('company cards on hover', () => {
  it('a company link opens the compact card after a moment, with the link\'s tooltip rows as its footer (and no text tooltip)', async () => {
    await page();
    over('aapl');
    expect(panel()).toBeNull();                                         // not before the delay
    await vi.waitFor(() => expect(panel()?.querySelector('.pt-card-compact')).toBeTruthy());
    expect(panel()!.textContent).toContain('Apple Inc.');
    expect(panel()!.querySelector('.pt-card-foot')!.textContent).toBe('Earnings Oct 28, 2026');
    expect(document.querySelector('.pt-tip:not([hidden])')).toBeNull();
    expect(api.mock.calls.map((c) => c[0])).toContain(needPath({ t: 'company@1', params: { ticker: 'AAPL' } }, 'b1'));
  });
  it('stays open while the pointer moves into the card, closes after leaving it, and on Escape; one card at a time', async () => {
    await page();
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
  it('moving straight from one company link to the next opens the next card (as when scanning a calendar)', async () => {
    await page();
    over('aapl');
    await vi.waitFor(() => expect(panel()?.textContent).toContain('Apple'));
    out('aapl', document.getElementById('nvda'));
    over('nvda');
    await vi.waitFor(() => expect(panel()?.textContent).toContain('NVIDIA'));
    // and while the first one is still loading
    over('aapl');
    await wait(25);
    out('aapl', document.getElementById('nvda'));
    over('nvda');
    await vi.waitFor(() => expect(panel()?.textContent).toContain('NVIDIA'));
  });
  it('after a card fails (e.g. the API rate limit), cards pause and the links get their text tooltips back', async () => {
    let fail = true;
    const fetchImpl = vi.fn(async (url: string) => (fail ? new Response('{}', { status: 429 }) : api(url)));
    await page({ fetchImpl });
    over('aapl');
    await wait(80);
    expect(panel()).toBeNull();
    fail = false;
    out('aapl'); over('nvda');
    await wait(80);
    expect(panel()).toBeNull();                       // paused
  });
  it('a quick pass over a link opens nothing', async () => {
    await page();
    over('aapl');
    out('aapl');
    await wait(60);
    expect(panel()).toBeNull();
  });
  it('nothing without a mouse, without a card module, for the page\'s own company, or for other links', async () => {
    for (const o of [{ hover: false }, { card: null }]) {
      await page(o);
      over('aapl');
      await wait(60);
      expect(panel(), JSON.stringify(o)).toBeNull();
    }
    await page({ subject: 'AAPL' });
    over('aapl'); over('other');
    await wait(60);
    expect(panel()).toBeNull();
  });
  it('a card whose data cannot load is not shown', async () => {
    await page({ fetchImpl: vi.fn(async () => new Response('{}', { status: 429 })) });
    over('aapl');
    await wait(80);
    expect(panel()).toBeNull();
  });
  it('each opening counts as a hover on the card in the beacon', async () => {
    const sent: unknown[] = [];
    await page({ sent });
    over('aapl');
    await vi.waitFor(() => expect(sent).toContainEqual(expect.objectContaining({ c: CARD.id, a: 'hover' })));
  });
});

describe('panelPosition', () => {
  it('below the link when it fits, above when it does not, else pinned to the window and scrollable', async () => {
    const { panelPosition } = await import('./cards');
    const r = { left: 100, top: 100, bottom: 120 };
    expect(panelPosition(r, 340, 300, 1200, 800)).toEqual({ x: 100, y: 128, maxHeight: null });
    expect(panelPosition({ left: 100, top: 600, bottom: 620 }, 340, 300, 1200, 800)).toEqual({ x: 100, y: 292, maxHeight: null });
    expect(panelPosition({ left: 1000, top: 300, bottom: 320 }, 340, 900, 1200, 800)).toEqual({ x: 852, y: 8, maxHeight: 784 });
  });
});

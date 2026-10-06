// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { needKey } from '../api';
import { newsDemo, NewsParams } from '../typologies';
import Broken from './__fixtures__/Broken.vue';
import Evil from './__fixtures__/Evil.vue';
import Probe from './__fixtures__/Probe.vue';
import { hydrateIslands } from './client';
import { islandMarkup, type PageData } from './page';
import { renderIsland } from './server';

const db = async (t: string, p: unknown) => (t === 'news@1' ? newsDemo(NewsParams.parse(p)) : null);
const key5 = needKey({ t: 'news@1', params: { ticker: 'NVDA', limit: 5 } });

async function pageWith(props = { ticker: 'NVDA' }) {
  const r = await renderIsland(Probe, props, { resolve: db });
  const page: PageData = { buildId: 'b1', api: '', calls: r.calls, components: { 'pt-probe@1.0.0': '/c/probe.js' } };
  document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(page)}</script>`;
  document.body.innerHTML = islandMarkup('pt-probe@1.0.0', props, r.html);
  return r;
}
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('renderIsland (build time)', () => {
  it('renders the component with awaited data and records the calls it made', async () => {
    const r = await renderIsland(Probe, { ticker: 'NVDA' }, { resolve: db });
    expect(r.html).toContain('class="probe"');
    expect(r.html.match(/<li /g)).toHaveLength(5);
    expect(Object.keys(r.calls)).toEqual([key5]);
    expect(r.failed).toEqual([]);
    expect(r.markup).toEqual([]);
  });
  it('a call answered null is listed as failed and the component shows its not-available state', async () => {
    const r = await renderIsland(Probe, { ticker: 'NVDA' }, { resolve: async () => null });
    expect(r.failed).toEqual([key5]);
    expect(r.html).toContain('pt-na');
  });
  it('reports markup that could run script', async () => {
    expect((await renderIsland(Evil, { ticker: 'X' }, { resolve: db })).markup).toEqual([expect.stringMatching(/non-http URL scheme/)]);
  });
  it('a component that throws after an await fails the render (Vue would otherwise render an empty island)', async () => {
    const C = defineComponent({ async setup() { await Promise.resolve(); throw new Error('component bug'); } });
    await expect(renderIsland(C, {}, { resolve: db })).rejects.toThrow('component bug');
  });
  it('shares a cache between islands of a build step (each need resolved once)', async () => {
    let n = 0;
    const cache = new Map<string, Promise<unknown>>();
    const counted = async (t: string, p: unknown) => { n++; return db(t, p); };
    await renderIsland(Probe, { ticker: 'NVDA' }, { resolve: counted, cache });
    await renderIsland(Probe, { ticker: 'NVDA' }, { resolve: counted, cache });
    expect(n).toBe(1);
  });
});

describe('hydrateIslands (browser)', () => {
  it('hydrates the server HTML in place, replays the recorded data (no network), no mismatch', async () => {
    await pageWith();
    const section = document.querySelector('.probe');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn();
    await hydrateIslands(document, { importer: async () => ({ default: Probe }), fetchImpl, send: () => {} });
    expect(document.querySelector('.probe')).toBe(section);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect([...warn.mock.calls, ...error.mock.calls].flat().join(' ')).not.toMatch(/[Hh]ydration|mismatch/);
  });
  it('a later call goes to /v1/t, parsed by the typology', async () => {
    await pageWith();
    const fetchImpl = vi.fn(async (url: string) => new Response(JSON.stringify(newsDemo(NewsParams.parse(JSON.parse(new URL(url, 'https://x').searchParams.get('p')!))))));
    await hydrateIslands(document, { importer: async () => ({ default: Probe }), fetchImpl, send: () => {} });
    (document.querySelectorAll('.pt-toggles button')[1] as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.probe li')).toHaveLength(8));
    expect(fetchImpl.mock.calls[0]![0]).toBe('/v1/t/news%401?p=%7B%22limit%22%3A8%2C%22ticker%22%3A%22NVDA%22%7D&b=b1');
  });
  it('tooltips: hovering a [data-tip] shows its rows as text, outside the Vue container', async () => {
    await pageWith();
    await hydrateIslands(document, { importer: async () => ({ default: Probe }), fetchImpl: vi.fn(), send: () => {} });
    const li = document.querySelector('.probe li')!;
    li.dispatchEvent(new Event('pointerover', { bubbles: true }));
    const tip = document.querySelector('[data-island] > .pt-tip') as HTMLElement;
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('Site Reuters');
  });
  it('beacon: one page view, then each component action once, named by the island (tag@version)', async () => {
    await pageWith();
    const sent: unknown[] = [];
    await hydrateIslands(document, { importer: async () => ({ default: Probe }), fetchImpl: vi.fn(), send: (_u, b) => sent.push(JSON.parse(b)) });
    const btn = document.querySelectorAll('.pt-toggles button')[1] as HTMLButtonElement;
    btn.click(); btn.click();
    expect(sent).toEqual([{ t: 'pv', p: '/', r: '' }, { t: 'ix', p: '/', c: 'pt-probe@1.0.0', a: 'set' }]);
  });
  it('one island that fails to load never stops the others', async () => {
    await pageWith();
    document.body.insertAdjacentHTML('afterbegin', islandMarkup('pt-missing@1.0.0', {}, '<p>static</p>'));
    await hydrateIslands(document, { importer: async (u) => { if (u !== '/c/probe.js') throw new Error('404'); return { default: Probe }; }, fetchImpl: vi.fn(), send: () => {} });
    expect(document.body.textContent).toContain('static');
    expect(document.querySelector('.probe')).not.toBeNull();
  });
  it('a component that throws while hydrating leaves its static HTML and does not hang the page', async () => {
    await pageWith();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const done = hydrateIslands(document, { importer: async () => ({ default: Broken }), fetchImpl: vi.fn(), send: () => {} });
    await expect(Promise.race([done.then(() => 'done'), new Promise((r) => setTimeout(() => r('hung'), 500))])).resolves.toBe('done');
    expect(document.querySelector('.probe')).not.toBeNull();
  });
});

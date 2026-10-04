// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { boot, createHost } from './browser';
import { needKey } from '../sdk/key';
import { metricDemo } from '../typologies';
import * as metric from '../../components/pt-metric';

const need = { t: 'metric@1' as const, params: { ticker: 'NVDA', metrics: ['pe'] } };
const payload = metricDemo({ ticker: 'NVDA', metrics: ['pe'] });
const page = (data: Record<string, unknown> = {}) => ({ buildId: 'b1', api: '', data, components: { 'pt-metric@1.0.0': '/c/pt-metric@1.0.0.js' } });

describe('createHost', () => {
  it('serves embedded page data without fetching', async () => {
    const f = vi.fn();
    expect(await createHost(page({ [needKey(need)]: payload }), f).resolve(need)).toEqual(payload);
    expect(f).not.toHaveBeenCalled();
  });
  it('fetches a miss with the canonical URL and validates the payload', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(payload)));
    const other = { t: 'metric@1' as const, params: { metrics: ['pe'], ticker: 'MSFT' } };
    expect(await createHost(page(), f as never).resolve(other)).toEqual(payload);
    expect(f).toHaveBeenCalledWith('/v1/t/metric%401?p=%7B%22metrics%22%3A%5B%22pe%22%5D%2C%22ticker%22%3A%22MSFT%22%7D&b=b1');
  });
  it('rejects invalid params before fetching and invalid payloads after', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify([{ nope: 1 }])));
    const host = createHost(page(), f as never);
    await expect(host.resolve({ t: 'metric@1', params: { ticker: '^GSPC', metrics: ['pe'] } })).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
    await expect(host.resolve({ t: 'metric@1', params: { ticker: 'MSFT', metrics: ['pe'] } })).rejects.toThrow();
  });
  it('does not cache failures', async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    const host = createHost(page(), f as never);
    const n = { t: 'metric@1' as const, params: { ticker: 'AMD', metrics: ['pe'] } };
    await expect(host.resolve(n)).rejects.toThrow(/503/);
    expect(await host.resolve(n)).toEqual(payload);
  });
});

describe('boot', () => {
  it('defines the element and hands it its embedded data', async () => {
    document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(page({ [needKey(need)]: payload }))}</script>`;
    document.body.innerHTML =
      `<pt-metric-v1 data-pt='${JSON.stringify({ c: 'pt-metric@1.0.0', p: { ticker: 'NVDA', metrics: ['pe'] }, k: { metrics: needKey(need) } })}'>static</pt-metric-v1>`;
    await boot(document, async () => metric, () => {}); // no real beacon from the test
    const el = document.querySelector('pt-metric-v1') as HTMLElement & { updateComplete: Promise<boolean> };
    await el.updateComplete;
    expect(customElements.get('pt-metric-v1')).toBeDefined();
    expect(el.textContent).toContain('P/E');
    expect(el.textContent).not.toContain('static');
  });
});

describe('beacon (first-party analytics, no cookies)', () => {
  it('sends one page view, then each component interaction once per page view', async () => {
    document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(page())}</script>`;
    document.body.innerHTML = `<div id="w"></div>`;
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    await boot(document, async () => metric, (url, body) => { sent.push({ url, body: JSON.parse(body) }); });
    expect(sent).toEqual([{ url: '/v1/e', body: { t: 'pv', p: location.pathname, r: '' } }]);
    const w = document.getElementById('w')!;
    const ix = (action: string) => w.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { component: 'pt-price-target@1.2.0', action } }));
    ix('zoom'); ix('zoom'); ix('hover');
    expect(sent.slice(1).map((s) => s.body)).toEqual([
      { t: 'ix', p: location.pathname, c: 'pt-price-target@1.2.0', a: 'zoom' },
      { t: 'ix', p: location.pathname, c: 'pt-price-target@1.2.0', a: 'hover' },
    ]);
  });
});

describe('boot cannot be steered by component markup', () => {
  const mount = (p: object) => `data-pt='${JSON.stringify({ c: 'pt-metric@1.0.0', p, k: { metrics: needKey(need) } })}'`;
  it('reads page data only from <head>: a data block in the body is ignored', async () => {
    document.head.innerHTML = '';
    document.body.innerHTML = `<pt-metric-v1 ${mount({ ticker: 'NVDA', metrics: ['pe'] })}></pt-metric-v1>` +
      `<script type="application/json" id="pt-data">${JSON.stringify({ ...page(), api: '/evil' })}</script>`;
    const imported: string[] = [];
    await boot(document, async (url) => { imported.push(url); return metric; }, () => {});
    expect(imported).toEqual([]);
  });
  it('mounts only top-level [data-pt]: a mount rendered inside a component is not a component', async () => {
    document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(page({ [needKey(need)]: payload }))}</script>`;
    document.body.innerHTML = `<pt-metric-v1 ${mount({ ticker: 'NVDA', metrics: ['pe'] })}><div id="nested" ${mount({ ticker: 'EVIL', metrics: ['pe'] })}></div></pt-metric-v1>`;
    const nested = document.getElementById('nested') as unknown as { params?: unknown };
    await boot(document, async () => metric, () => {});
    expect(nested.params).toBeUndefined();
    document.head.innerHTML = '';
  });
});

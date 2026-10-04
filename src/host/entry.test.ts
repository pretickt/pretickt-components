// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

const page = { buildId: 'b1', api: '', data: {}, components: {} };

describe('host modules', () => {
  it('importing the host library has no side effect; only the entry boots the page', async () => {
    document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(page)}</script>`;
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', f);
    await import('./browser');
    await new Promise((r) => setTimeout(r, 0));
    expect(f).not.toHaveBeenCalled();
    await import('./entry');
    await vi.waitFor(() => expect(f).toHaveBeenCalledWith('/v1/e', expect.objectContaining({ method: 'POST' })));
    vi.unstubAllGlobals();
  });
});

describe('host bundle', () => {
  it('validates with schemas only: no demo generator reaches the page', async () => {
    const { build } = await import('esbuild');
    const out = await build({ entryPoints: ['src/host/entry.ts'], bundle: true, write: false, format: 'esm', minify: true, platform: 'browser', logLevel: 'silent' });
    const js = out.outputFiles[0]!.text;
    for (const demo of ['Demo Corp', 'demo headline', 'Average of the latest target']) expect(js, demo).not.toContain(demo);
  });
});

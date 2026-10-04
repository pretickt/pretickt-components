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

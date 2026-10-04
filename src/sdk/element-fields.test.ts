// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LitElement, html, svg } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import * as z from 'zod/mini';
import { defineComponent } from './define';
import type { ComponentModule } from './types';

const mod: ComponentModule = {
  manifest: defineComponent({ tag: 'pt-fields-probe', version: '1.0.0', need: { question: 'q', evidence: [] }, params: z.object({ t: z.string() }), user: [], uses: [], needs: () => ({}) }),
  renderStatic: (_d, p) => `<p>${(p as { t?: string }).t ?? '-'}</p>`,
};

describe('PtElement under a consumer toolchain', () => {
  // The SDK ships as TypeScript: a consumer may bundle it with useDefineForClassFields (the ES2022 default), which turns
  // `data = {}` into a native field that shadows Lit's reactive accessor — assignments would then never re-render.
  it('stays reactive when bundled with useDefineForClassFields: true', async () => {
    const out = await build({ entryPoints: [join(process.cwd(), 'src/sdk/element.ts')], bundle: true, write: false, format: 'esm', target: 'es2022',
      external: ['lit', 'lit/*'], tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } }, logLevel: 'silent' });
    const dir = join(process.cwd(), 'node_modules/.cache/pt-fields'); // inside the repo, so the external `lit` resolves to the same copy
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'element.mjs');
    writeFileSync(file, out.outputFiles[0]!.text);
    const { classFor } = (await import(/* @vite-ignore */ file)) as typeof import('./element');
    customElements.define('pt-fields-probe-v1', classFor({ LitElement, html, svg, unsafeHTML }, mod, { resolve: async () => null }));
    const el = document.createElement('pt-fields-probe-v1') as HTMLElement & { params: unknown; updateComplete: Promise<boolean> };
    document.body.append(el);
    el.params = { t: 'first' };
    await el.updateComplete;
    el.params = { t: 'second' };
    await el.updateComplete;
    expect(el.textContent).toContain('second');
  });
});

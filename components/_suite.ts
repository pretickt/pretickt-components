import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import type { Component } from 'vue';
import { createChecker, type ComponentMeta } from 'vue-component-meta';
import { readComponentMeta } from '../src/checks/meta';
import { sampleProps, type PropInfo } from '../src/checks/props';
import { hydrateIslands } from '../src/islands/client';
import { islandMarkup, type PageData } from '../src/islands/page';
import { renderIsland } from '../src/islands/server';
import { demoFor, getTypology } from '../src/typologies';

let checker: ReturnType<typeof createChecker> | undefined;
/** The component's props from its types (vue-component-meta). Paths from the repo root: happy-dom's import.meta.url is not a file URL. */
export function propsOf(file: string): PropInfo[] {
  checker ??= createChecker(join(process.cwd(), 'tsconfig.json'), { forceUseTs: true, schema: { ignore: [] } });
  const meta: ComponentMeta = checker.getComponentMeta(join(process.cwd(), 'components', file));
  return meta.props.filter((p) => !p.global).map((p) => ({ name: p.name, required: p.required, schema: p.schema as PropInfo['schema'], default: p.default }));
}

/** Every call answered with the typology's demo; `variant` adds the catalogue entries a newer API may send. */
export const demo = (variant = false) => async (t: string, params: unknown) => {
  const d = demoFor({ t, params });
  const v = getTypology(t)?.unknownVariant;
  return variant && v ? v(d as never) : d;
};
/** Render with fixed data: every call to `t` answers `value`. */
export const withData = (answers: Record<string, unknown>) => async (t: string, params: unknown) => (t in answers ? answers[t] : demoFor({ t, params }));
export const render = (component: Component, props: Record<string, unknown>, resolve = demo()) => renderIsland(component, props, { resolve });

/** Hydrate the server HTML in a page like the generator writes it; returns the warnings Vue printed about hydration. */
export async function hydrationWarnings(component: Component, props: Record<string, unknown>, resolve = demo()) {
  const r = await renderIsland(component, props, { resolve });
  const page: PageData = { buildId: 'test', api: '', calls: r.calls, components: { 'pt-test@1.0.0': '/c/test.js' } };
  document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(page)}</script>`;
  document.body.innerHTML = islandMarkup('pt-test@1.0.0', props, r.html);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await hydrateIslands(document, { importer: async () => ({ default: component }), fetchImpl: async () => { throw new Error('no network in the check'); }, send: () => {} });
    return [...warn.mock.calls, ...error.mock.calls].map((c) => c.map(String).join(' ')).filter((m) => /[Hh]ydration|mismatch|island/.test(m));
  } finally {
    warn.mockRestore(); error.mockRestore();
    document.head.innerHTML = ''; document.body.innerHTML = '';
  }
}

/**
 * What every component must pass (call at the top level of a `// @vitest-environment happy-dom` test file): its metadata, and for
 * props sampled from its prop types — demo data renders with safe markup and hydrates without mismatch; missing data renders the
 * not-available state; catalogue entries it does not know are tolerated.
 */
export function standardSuite(file: string, component: Component) {
  it('declares its question, version and evidence', () => {
    expect(readComponentMeta(readFileSync(join(process.cwd(), 'components', file), 'utf8'))).toMatchObject({ ok: true });
  });
  for (const props of sampleProps(propsOf(file))) {
    const name = JSON.stringify(props);
    it(`${name}: demo data renders with safe markup and hydrates without mismatch`, async () => {
      const r = await render(component, props);
      expect(r.failed).toEqual([]);
      expect(r.markup).toEqual([]);
      expect(await hydrationWarnings(component, props)).toEqual([]);
    });
    it(`${name}: missing data renders the not-available state`, async () => {
      expect((await render(component, props, async () => null)).html).toContain('pt-na');
    });
    it(`${name}: catalogue entries it does not know are tolerated`, async () => {
      expect((await render(component, props, demo(true))).markup).toEqual([]);
    });
  }
}

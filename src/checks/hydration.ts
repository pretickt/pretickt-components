import type { Component } from 'vue';
import { hydrateIslands } from '../islands/client';
import { islandMarkup, type PageData } from '../islands/page';
import { renderIsland } from '../islands/server';

/**
 * Renders a component on the server, writes it into `document` the way the generator writes a page, hydrates it with the recorded
 * answers (no network) and returns the hydration problems Vue reported. Needs a DOM (happy-dom in tests and in the sandbox).
 */
export async function checkHydration(component: Component, props: Record<string, unknown>, resolve: (t: string, p: unknown) => Promise<unknown>): Promise<string[]> {
  const r = await renderIsland(component, props, { resolve });
  const page: PageData = { buildId: 'check', api: '', calls: r.calls, components: { 'pt-check@1.0.0': '/c/check.js' } };
  document.head.innerHTML = `<script type="application/json" id="pt-data">${JSON.stringify(page).replace(/</g, '\\u003c')}</script>`;
  document.body.innerHTML = islandMarkup('pt-check@1.0.0', props, r.html);
  const seen: string[] = [];
  const { warn, error } = console;
  const capture = (...a: unknown[]) => { seen.push(a.map(String).join(' ')); };
  console.warn = capture; console.error = capture;
  try {
    await hydrateIslands(document, { importer: async () => ({ default: component }), fetchImpl: async () => { throw new Error('no network in the check'); }, send: () => {} });
  } finally {
    console.warn = warn; console.error = error;
    document.head.innerHTML = ''; document.body.innerHTML = '';
  }
  return seen.filter((m) => /[Hh]ydration|mismatch|island/.test(m)).map((m) => m.slice(0, 400));
}

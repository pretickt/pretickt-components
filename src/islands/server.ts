import { createSSRApp, h, Suspense, type Component } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { checkMarkup } from '../checks/markup';
import { createPt, PT, type PtOptions } from '../context/pt';
import { validateParams } from '../context/validate';

export interface IslandResult {
  /** The component's server HTML (the inner content of the island). */
  html: string;
  /** Every call the component made, by need key — the page carries them so the browser replays them. */
  calls: Record<string, unknown>;
  /** Need keys answered null (data not available). */
  failed: string[];
  /** Markup the page must not ship (checkMarkup). */
  markup: string[];
}

/** The island root: `<Suspense>` lets a component `await` its data at the top level, on the server and while hydrating. */
export function islandApp(component: Component, props: Record<string, unknown>, pt: ReturnType<typeof createPt>, onResolve?: () => void) {
  const app = createSSRApp({ render: () => h(Suspense, { onResolve }, { default: () => h(component, props) }) });
  app.provide(PT, pt);
  return app;
}

/** Build time: render one component with a `pt` that resolves (database) and records. A render that throws is a component bug: it propagates. */
export async function renderIsland(component: Component, props: Record<string, unknown>, o: Pick<PtOptions, 'resolve' | 'cache'>): Promise<IslandResult> {
  const calls: Record<string, unknown> = {};
  const app = islandApp(component, props, createPt({ ...o, record: calls, validate: validateParams }));
  // Vue's server renderer turns an error thrown after an await into an empty comment: catch it, so a broken component fails the
  // build instead of shipping an empty island.
  let error: unknown;
  app.config.errorHandler = (e) => { error ??= e; };
  const html = await renderToString(app);
  if (error) throw error;
  return { html, calls, failed: Object.keys(calls).filter((k) => calls[k] === null), markup: checkMarkup(html) };
}

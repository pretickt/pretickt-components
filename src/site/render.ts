import { DOCUMENT, ErrorHandler, inject, mergeApplicationConfig, provideAppInitializer, TransferState, type ApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { BEFORE_APP_SERIALIZED, provideServerRendering, renderApplication } from '@angular/platform-server';
import { PT_STORE, PtStore, validateParams } from '@pretickt/components/context';
import { checkMarkup } from '../checks/markup';
import { demoFor, getTypology } from '../typologies';
import { appConfig } from './app.config';
import { CALLS_KEY, PT_PAGE, type PageModel, type RenderOptions, type RenderResult } from './model';

export type { RenderOptions, RenderResult } from './model';
import { PtPage } from './page';
import { REGISTRY } from './registry.generated';

/** A minute for one call: far above a healthy render, short enough that one stuck query cannot hold the nightly. */
export const CALL_TIMEOUT_MS = 60_000;
/** The document a check renders into when the caller gives none. */
export const BARE_DOCUMENT = '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><pt-page></pt-page></body></html>';

/** The placements Angular renders (in document order): `section/item` ids. Switched-off and unknown ones render static markup. */
const slots = (m: PageModel) => m.sections.flatMap((s, i) => s.items.flatMap((it, j) => (it.off || !Object.hasOwn(REGISTRY, it.c) ? [] : [`${i}/${j}`])));

/**
 * Build time: one page rendered on the server. Every call goes through `resolve` (params validated, answers recorded for the
 * browser, a slow call answered null after the timeout); the rendered DOM is checked per placement before it is serialized. A
 * component that throws fails the render.
 */
export async function renderPage(model: PageModel, o: RenderOptions): Promise<RenderResult> {
  const record: Record<string, unknown> = {};
  const timeouts = new Set<string>();
  const errors: unknown[] = [];
  const markup: Record<string, string[]> = {};
  const empty: string[] = [];
  const ms = o.timeoutMs ?? CALL_TIMEOUT_MS;
  const resolve = (t: string, params: unknown, who?: string) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      o.resolve(t, params),
      new Promise((done) => { timer = setTimeout(() => { timeouts.add(who ?? 'page'); done(null); }, ms); }),
    ]).finally(() => clearTimeout(timer));
  };
  const store = new PtStore({ server: true, resolve, record, cache: o.cache, validate: validateParams as (t: string, p: unknown) => void });
  const ids = slots(model);
  const config: ApplicationConfig = mergeApplicationConfig(appConfig, {
    providers: [
      provideServerRendering(),
      { provide: PT_PAGE, useValue: model },
      { provide: PT_STORE, useValue: store },
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => { errors.push(e); } } },
      // the recorded answers travel in the page state (the same object, filled as the calls answer)
      provideAppInitializer(() => { inject(TransferState).set(CALLS_KEY, record); }),
      { provide: BEFORE_APP_SERIALIZED, multi: true, useFactory: () => {
        const doc = inject(DOCUMENT);
        return () => {
          doc.querySelectorAll('[data-island]').forEach((el, i) => {
            const id = ids[i] ?? `?${i}`;
            const lines = checkMarkup(el.innerHTML);
            if (lines.length) markup[id] = lines;
            if (!el.querySelector('*')) empty.push(id);
          });
        };
      } },
    ],
  });
  const html = await renderApplication((context) => bootstrapApplication(PtPage, config, context), { document: o.document, url: 'http://localhost/', allowedHosts: ['localhost'] });
  if (errors.length) throw errors[0];
  return { html, calls: record, failed: Object.keys(record).filter((k) => record[k] === null), markup, empty, timeouts: [...timeouts] };
}

/**
 * Renders every component once (its registry sample), before a build renders pages concurrently: the first render of a deferred
 * placement loads its chunk, and that loading state is shared by every render in the process (a concurrent first render would
 * find it "in progress" and render the placement empty).
 */
export async function warmUp(resolve: RenderOptions['resolve'], document = BARE_DOCUMENT): Promise<void> {
  const items = Object.entries(REGISTRY).map(([c, e]) => ({ c, props: e.sample }));
  await renderPage({ buildId: 'warm-up', api: '', sections: [{ id: 'warm', items }] }, { document, resolve });
}

const demo = (variant: boolean) => async (t: string, params: unknown) => {
  const d = demoFor({ t, params });
  const v = getTypology(t)?.unknownVariant;
  return variant && v ? v(d as never) : d;
};

/**
 * The server-side checks of one component, for each props sample: demo data renders with every call answered and safe markup;
 * missing data (every call null) renders the not-available state; catalogue entries it does not know are tolerated. One line per
 * problem.
 */
export async function checkComponent(tag: string, samples: Record<string, unknown>[], document = BARE_DOCUMENT): Promise<string[]> {
  const errors: string[] = [];
  for (const props of samples) {
    const label = JSON.stringify(props);
    const model: PageModel = { buildId: 'check', api: '', sections: [{ id: 'check', items: [{ c: tag, props }] }] };
    const run = async (what: string, resolve: RenderOptions['resolve'], judge: (r: RenderResult) => string[]) => {
      try { errors.push(...judge(await renderPage(model, { document, resolve })).map((e) => `${label}: ${what}: ${e}`)); }
      catch (e) { errors.push(`${label}: ${what}: throws ${(e as Error).message}`); }
    };
    const marked = (r: RenderResult) => Object.values(r.markup).flat().map((m) => `markup ${m}`);
    await run('demo data', demo(false), (r) => [...r.failed.map((k) => `no answer for ${k}`), ...marked(r), ...r.empty.map(() => 'renders nothing')]);
    await run('missing data', async () => null, (r) => (/class="pt-na"/.test(r.html.slice(r.html.indexOf('<pt-page'))) ? [] : ['does not render the not-available state (class "pt-na")']));
    await run('unknown catalogue entries', demo(true), marked);
  }
  return errors;
}

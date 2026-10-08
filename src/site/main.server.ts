import { type BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { appConfig } from './app.config';
import { PT_PAGE } from './model';
import { PtPage } from './page';

// The CLI's server entry: it prerenders an empty page of its own (ignored). Pages are rendered by the generator with renderPage below.
const bootstrap = (context: BootstrapContext) => bootstrapApplication(PtPage, mergeApplicationConfig(appConfig, { providers: [
  provideServerRendering(),
  { provide: PT_PAGE, useValue: { buildId: '', api: '', sections: [] } },
  { provide: PT_STORE, useValue: new PtStore({ server: true, resolve: async () => null }) },
] }), context);
export default bootstrap;
export { BARE_DOCUMENT, CALL_TIMEOUT_MS, checkComponent, renderPage, warmUp, type RenderOptions, type RenderResult } from './render';
export { REGISTRY } from './registry.generated';
export type { PageModel, PagePlacement, PageSection } from './model';

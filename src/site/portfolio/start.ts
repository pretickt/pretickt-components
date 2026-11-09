import { createComponent, Injector, type ApplicationRef, type EnvironmentInjector } from '@angular/core';
import type { PageModel } from '../model';
import { fetchReader, PT_PORTFOLIO_AI } from './ai';
import { fetchFiles, PT_PORTFOLIO_FILES, PT_PORTFOLIO_STORAGE } from './files';
import { PtPortfolioPage } from './page';

/**
 * The portfolio page (`[data-pt-pf]`, its note for a browser without the page app): the page in its place, from this chunk alone, so it
 * costs the main bundle one line. Its files are the build's; its storage this browser's; its paste reader the site's AI.
 */
export function mount(host: Element, appRef: ApplicationRef, env: EnvironmentInjector, page: PageModel): void {
  const el = host.ownerDocument.createElement('pt-portfolio-page');
  host.replaceChildren(el);
  const elementInjector = Injector.create({ parent: env, providers: [
    { provide: PT_PORTFOLIO_FILES, useValue: fetchFiles(page.buildId) },
    { provide: PT_PORTFOLIO_STORAGE, useValue: () => host.ownerDocument.defaultView!.localStorage },
    // the paste's reader (2026-11-09): www's /v1/ai/portfolio, asked only when the reader presses Read
    { provide: PT_PORTFOLIO_AI, useValue: fetchReader() },
  ] });
  appRef.attachView(createComponent(PtPortfolioPage, { environmentInjector: env, elementInjector, hostElement: el }).hostView);
}

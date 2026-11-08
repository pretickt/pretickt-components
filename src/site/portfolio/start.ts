import { createComponent, Injector, type ApplicationRef, type EnvironmentInjector } from '@angular/core';
import type { PageModel } from '../model';
import { fetchFiles, PT_PORTFOLIO_FILES, PT_PORTFOLIO_STORAGE } from './files';
import { PtPortfolioPage } from './page';

/**
 * The portfolio page (`[data-pt-pf]`, its note for a browser without the page app): the page in its place, from this chunk alone, so it
 * costs the main bundle one line. Its files are the build's; its storage this browser's.
 */
export function mount(host: Element, appRef: ApplicationRef, env: EnvironmentInjector, page: PageModel): void {
  const el = host.ownerDocument.createElement('pt-portfolio-page');
  host.replaceChildren(el);
  const elementInjector = Injector.create({ parent: env, providers: [
    { provide: PT_PORTFOLIO_FILES, useValue: fetchFiles(page.buildId) },
    { provide: PT_PORTFOLIO_STORAGE, useValue: () => host.ownerDocument.defaultView!.localStorage },
  ] });
  appRef.attachView(createComponent(PtPortfolioPage, { environmentInjector: env, elementInjector, hostElement: el }).hostView);
}

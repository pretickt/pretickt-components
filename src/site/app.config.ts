import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withNoHttpTransferCache } from '@angular/platform-browser';

/** Shared by the browser and the build: hydration (incremental, Angular's default) without the HttpClient cache (no HttpClient). */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideClientHydration(withNoHttpTransferCache())],
};

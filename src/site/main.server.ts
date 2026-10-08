import { type BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { PtPage } from './page';

const config = mergeApplicationConfig(appConfig, { providers: [provideServerRendering()] });
const bootstrap = (context: BootstrapContext) => bootstrapApplication(PtPage, config, context);
export default bootstrap;
// the generator renders each page with the Angular this bundle carries (never a second copy)
export { renderApplication } from '@angular/platform-server';

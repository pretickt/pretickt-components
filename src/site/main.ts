import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { PtPage } from './page';

bootstrapApplication(PtPage, appConfig).catch((e) => console.error(e));

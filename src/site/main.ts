import { inject, mergeApplicationConfig, TransferState } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PT_PICKS, PT_STORE } from '@pretickt/components/context';
import { appConfig } from './app.config';
import { CALLS_KEY, PAGE_KEY, PT_PAGE } from './model';
import { PtPage } from './page';
import { localPicks } from './picks';
import { browserStore } from './store.browser';

const config = mergeApplicationConfig(appConfig, {
  providers: [
    { provide: PT_PAGE, useFactory: () => inject(TransferState).get(PAGE_KEY, null) ?? { buildId: '', api: '', sections: [] } },
    { provide: PT_STORE, useFactory: () => browserStore(inject(PT_PAGE), inject(TransferState).get(CALLS_KEY, {})) },
    // the reader's picks, in this browser only (the build has none: see PtPicks)
    { provide: PT_PICKS, useFactory: () => localPicks() },
  ],
});
bootstrapApplication(PtPage, config).catch((e) => console.error(e));

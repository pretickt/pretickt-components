/** The stories app (`npm run stories`): a dev page, never part of the site build. */
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PT_STORE, PtStore, validateParams } from '@pretickt/components/context';
import { answerer, storyOf } from './story';
import { PtVisual } from './visual';

Object.assign(window, { storyOf }); // in the console, with an element of a story selected: copy(storyOf($0))
// the hover cards' data (attachCards mounts them in the app, outside any story): www's, through the dev proxy
const cards = new PtStore({ server: false, resolve: answerer({ live: true }), validate: validateParams });
bootstrapApplication(PtVisual, { providers: [provideBrowserGlobalErrorListeners(), { provide: PT_STORE, useValue: cards }] }).catch((e: unknown) => console.error(e));

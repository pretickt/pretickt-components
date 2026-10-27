/** The stories app (`npm run stories`): a dev page, never part of the site build. */
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { storyOf } from './story';
import { PtVisual } from './visual';

Object.assign(window, { storyOf }); // in the console, with an element of a story selected: copy(storyOf($0))
bootstrapApplication(PtVisual, { providers: [provideBrowserGlobalErrorListeners()] }).catch((e: unknown) => console.error(e));

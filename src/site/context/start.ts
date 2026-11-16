/**
 * The click's context on every page (a small chunk loaded right after the page renders: main is at its budget): company links leave
 * their origin's note, and a company page whose note is its own loads the box (a chunk of its own) above the page.
 */
import type { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { attachLeave } from './leave';
import { dropNote, landingNote, type NoteStore } from './note';

type Here = { path: string; subject: string | undefined; search: string };

const localStore = (doc: Document): NoteStore | null => {
  try { return doc.defaultView?.localStorage ?? null; } catch { return null; }
};
const hereOf = (doc: Document, subject: string | undefined): Here => {
  const loc = doc.defaultView?.location;
  return { path: loc?.pathname ?? '/', subject, search: loc?.search ?? '' };
};

/** The box's chunk, as the page loads it (`import('./context/box')` written in page.ts: a lazy chunk importing another split main). */
export type LoadBox = () => Promise<typeof import('./box')>;

/** The box gets the note and the way to drop it: it imports nothing from this chunk. */
export async function startContext(doc: Document, appRef: ApplicationRef, env: EnvironmentInjector, subject: string | undefined, load: LoadBox,
  store: NoteStore | null = localStore(doc), here: Here = hereOf(doc, subject)): Promise<void> {
  attachLeave(doc, subject, store);
  const note = landingNote(store, here, Date.now());
  if (note) (await load()).showContext(doc, appRef, env, note, () => dropNote(store));
}

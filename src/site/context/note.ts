/**
 * The click's note in this browser's storage: one at a time, under one key, valid 30 minutes, shown only on the page the link led to.
 * Every access in try/catch: no storage (private window, blocked site data) = no box, never an error.
 */
import type { ClickKind, ClickNote } from '../../context/click';

export const NOTE_KEY = 'pt-click';
export const NOTE_TTL_MS = 30 * 60 * 1000;
export const KINDS: readonly ClickKind[] = [
  'earnings', 'dividend', 'mover', 'heat-map', 'talk-map', 'feed', 'list', 'peers', 'holding', 'portfolio', 'news', 'holder', 'mention', 'following',
];

export interface NoteStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const COMPANY_PAGE = /^\/stocks\/([a-z0-9.\-]+)\/(?:([a-z0-9\-]+)\/)?(?:#.*)?$/i;

/** The company page a link leads to (`/stocks/<t>/` or one of its pages), or null. */
export function companyPageOf(href: string): { ticker: string; path: string } | null {
  const [, t, sub] = COMPANY_PAGE.exec(href) ?? [];
  if (!t) return null;
  return { ticker: t.toUpperCase(), path: `/stocks/${t}/${sub ? `${sub}/` : ''}` };
}

export function writeNote(store: NoteStore | null, note: ClickNote): void {
  try { store?.setItem(NOTE_KEY, JSON.stringify(note)); } catch { /* no storage: no box */ }
}

/** Deletes a note that is too old or cannot be read: the note is gone after 30 minutes, not only ignored. */
export function sweepNote(store: NoteStore | null, now: number): void {
  try {
    const raw = store?.getItem(NOTE_KEY);
    if (raw == null) return;
    let note: unknown = null;
    try { note = JSON.parse(raw); } catch { /* unreadable: dropped below */ }
    if (!valid(note) || now - note.at > NOTE_TTL_MS) store!.removeItem(NOTE_KEY);
  } catch { /* no storage */ }
}

export function dropNote(store: NoteStore | null): void {
  try { store?.removeItem(NOTE_KEY); } catch { /* nothing to drop */ }
}

const valid = (n: unknown): n is ClickNote => {
  if (!n || typeof n !== 'object') return false;
  const o = n as Record<string, unknown>;
  const from = o['from'] as Record<string, unknown> | null;
  return o['v'] === 1 && KINDS.includes(o['kind'] as ClickKind) && typeof o['to'] === 'string' && typeof o['land'] === 'string'
    && typeof o['at'] === 'number' && !!o['d'] && typeof o['d'] === 'object' && !!from && typeof from['path'] === 'string';
};

/** Where a page is: its path, its company, its query, and the path of the page of this site that led to it (null from outside). */
export interface Here { path: string; subject: string | undefined; search: string; referrer: string | null }

/**
 * The note for this page, or null: the same company, the very page clicked, within 30 minutes, not from this page, no alert box — and
 * reached from the page the note was left on (a later arrival by search, from outside, or by a link that answered nothing shows none).
 */
export function landingNote(store: NoteStore | null, here: Here, now: number): ClickNote | null {
  if (!store || !here.subject || /[?&]alert=/.test(here.search)) return null;
  let note: unknown;
  try { note = JSON.parse(store.getItem(NOTE_KEY) ?? 'null'); } catch { return null; }
  if (!valid(note)) return null;
  if (note.to !== here.subject.toUpperCase() || note.land !== here.path || note.from.path === here.path || note.from.path !== here.referrer) return null;
  if (now - note.at > NOTE_TTL_MS || now < note.at - 60_000) return null;
  return note;
}

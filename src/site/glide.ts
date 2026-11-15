/**
 * Rows that scroll sideways on a phone (styles/ds.css, below 40rem): the company tabs and each section's head (its title and its link).
 * Once, slowly, a row wider than the screen goes to its end and comes back, so the reader sees there is more (Romeo, 2026-11-15: «al
 * telefono lascia una sola linea orizzontale scrollabile che scrolla lentamente in automatico una volta quando accedi alla pagina, con
 * testi brevi»). The tabs glide when the page opens and come back to the current page's tab; a section head when it first comes into
 * view, back to its start. A touch, a press or the wheel stops it where it is; with reduced motion nothing slides. A row that fits
 * (a laptop's, where the rows wrap) does not move.
 */
const ROWS = '.pt-subnav, .pt-section-head';
/** Slowly: px a second on the way there, in MIN to MAX ms (a long row goes quicker, never past 4 s); the way back in BACK ms after a PAUSE. */
const SPEED = 60, MIN = 1500, MAX = 4000, BACK = 600, PAUSE = 700;
/** A row over by less than this does not glide: a slide of a few pixels shows nothing. */
const WORTH = 24;
/** Room before the current tab, so it does not sit on the edge. */
const ROOM = 16;

/** Scrolls `el` to `to` in `ms` after `delay` ms; false when stopped on the way. */
export type Animate = (el: HTMLElement, to: number, ms: number, o: { delay: number; stopped: () => boolean }) => Promise<boolean>;
/** `part`: how much of the way to its end the row goes (1, all; the home's tabs ½ — Romeo, 2026-11-15: «nella home l'animazione non deve
 * arrivare alla fine, ma dare l'idea di scroll. basta circa metà»). */
export interface GlideOptions { animate?: Animate; reduced?: boolean; part?: number }

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const slide: Animate = (el, to, ms, { delay, stopped }) => new Promise((done) => {
  const win = el.ownerDocument.defaultView;
  if (!win) return done(false);
  win.setTimeout(() => {
    const from = el.scrollLeft, t0 = win.performance.now();
    const step = (now: number) => {
      if (stopped()) return done(false);
      const k = Math.min(1, (now - t0) / ms);
      el.scrollLeft = from + (to - from) * ease(k);
      if (k < 1) win.requestAnimationFrame(step); else done(true);
    };
    win.requestAnimationFrame(step);
  }, delay);
});

/** Where the row rests: the tabs on the current page's tab, a head at its start. */
function restOf(row: HTMLElement, over: number): number {
  const cur = row.querySelector<HTMLElement>('[aria-current]');
  return cur ? Math.max(0, Math.min(over, cur.offsetLeft - ROOM)) : 0;
}

/** Glides one row, once: to its end slowly, then back to where it rests. */
export async function glide(row: HTMLElement, o: GlideOptions = {}): Promise<void> {
  const over = row.scrollWidth - row.clientWidth;
  if (over < WORTH) return;
  const rest = restOf(row, over);
  const reduced = o.reduced ?? !!row.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { row.scrollLeft = rest; return; }
  let stop = false;
  const halt = () => { stop = true; };
  const events = ['pointerdown', 'touchstart', 'wheel'] as const;
  for (const e of events) row.addEventListener(e, halt, { passive: true });
  const animate = o.animate ?? slide, stopped = () => stop;
  try {
    const to = Math.round(over * (o.part ?? 1));
    if (!(await animate(row, to, Math.min(MAX, Math.max(MIN, (to / SPEED) * 1000)), { delay: 0, stopped })) || stop) return;
    await animate(row, rest, BACK, { delay: PAUSE, stopped });
  } finally {
    for (const e of events) row.removeEventListener(e, halt);
  }
}

export interface AttachGlideOptions extends GlideOptions {
  /** Calls `on` when `el` comes fully into view; the default uses an IntersectionObserver. */
  observe?: (el: Element, on: () => void) => void;
}
function inView(el: Element, on: () => void): void {
  const IO = el.ownerDocument.defaultView?.IntersectionObserver;
  if (!IO) return;
  const io = new IO((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); on(); } }, { threshold: 1 });
  io.observe(el);
}

/** The page's rows: the tabs glide now, each section head when it first comes into view. */
export function attachGlide(doc: Document, o: AttachGlideOptions = {}): void {
  const observe = o.observe ?? inView;
  for (const row of doc.querySelectorAll<HTMLElement>(ROWS)) {
    // the home's tabs are the site's lists, a long row: half way shows it scrolls
    if (row.matches('.pt-subnav')) { void glide(row, doc.location?.pathname === '/' ? { ...o, part: 0.5 } : o); continue; }
    let done = false;
    observe(row, () => { if (!done) { done = true; void glide(row, o); } });
  }
}

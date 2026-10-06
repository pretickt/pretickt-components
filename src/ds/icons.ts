/** A fixed icon set. Components reference icons by name; unknown names render nothing. */
const P = (d: string) => d;

/** name → the path of a 16×16 stroke icon (PtIcon draws it). */
export const ICON_PATHS: Record<string, string> = {
  calendar: P('M3 2v2M13 2v2M2 5h12M2 4h12v10H2z'),
  target: P('M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'),
  'trend-up': P('M1 12l5-5 3 3 6-6M11 4h4v4'),
  'trend-down': P('M1 4l5 5 3-3 6 6M11 12h4V8'),
  alert: P('M8 1l7 13H1zM8 6v4M8 12v1'),
  peak: P('M1 14l5-10 3 6 2-3 4 7z'),
};

/** Legacy markup of the same icons (string renderers). */
export const ICONS: Record<string, string> = Object.fromEntries(Object.entries(ICON_PATHS).map(([k, d]) =>
  [k, `<svg class="pt-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`]));

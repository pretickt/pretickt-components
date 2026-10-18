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
  // the feed's glyphs (pt-feed: one per kind of event)
  valley: P('M1 2l5 10 3-6 2 3 4-7'),
  earnings: P('M3 1h7l3 3v11H3zM10 1v3h3M5.5 8h5M5.5 11h5'),
  dividend: P('M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM10 5.5H7.25a1.5 1.5 0 0 0 0 3h1.5a1.5 1.5 0 0 1 0 3H6M8 4v1.5M8 11.5V13'),
  split: P('M8 2v12M1 8h4M11 8h4M3 6l-2 2 2 2M13 6l2 2-2 2'),
  upgrade: P('M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM8 11.5V5M5 7.5l3-3 3 3'),
  downgrade: P('M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM8 4.5V11M5 8.5l3 3 3-3'),
  insider: P('M8 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 14c0-2.8 2.2-5 5-5s5 2.2 5 5'),
  bolt: P('M9 1L3 9h5l-1 6 6-8H8z'),
  news: P('M2 3h10v10H3a1 1 0 0 1-1-1zM12 6h2v6a1 1 0 0 1-2 0M4.5 6h5M4.5 8.5h5M4.5 11h3'),
  cross: P('M1 12C5 12 8 4 15 4M1 4c4 0 7 8 14 8'),
  gauge: P('M2 12a6 6 0 1 1 12 0M8 12l3-4'),
  bank: P('M1 6l7-4 7 4zM3 7v5M6.3 7v5M9.7 7v5M13 7v5M1 14h14'),
  dot: P('M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'),
};

/** Legacy markup of the same icons (string renderers). */
export const ICONS: Record<string, string> = Object.fromEntries(Object.entries(ICON_PATHS).map(([k, d]) =>
  [k, `<svg class="pt-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`]));

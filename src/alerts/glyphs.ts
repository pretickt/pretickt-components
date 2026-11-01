import type { ConditionId } from './catalog';

/**
 * The 22×14 drawing on each badge (the editor's mockup, approved by Romeo on 2026-11-01), as data — a template draws each part as an
 * svg path: `fill` filled, `dash` dashed, `faint` lighter, `thick` a wide stroke.
 */
export interface GlyphPart { d: string; fill?: true; dash?: true; faint?: true; thick?: true }

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const GLYPHS: Record<ConditionId, readonly GlyphPart[]> = {
  'session-move': [{ d: 'M1 9H21', dash: true, faint: true }, { d: 'M1 3L5 4L9 5L12 8L16 10L20 12' }],
  'price-crosses': [{ d: 'M1 6H21', dash: true, faint: true }, { d: 'M1 11L6 9L10 10L14 5L18 6L21 3' }],
  'below-average': [{ d: 'M1 5C7 2.8 14 2.8 21 4' }, { d: 'M1 7L6 8L11 10L16 11L21 12.5', faint: true }],
  'near-52w': [{ d: 'M3 7H19', thick: true, faint: true }, { d: circle(3.5, 7, 2.6), fill: true }],
  'volume-spike': [{ d: 'M1 9h3v4h-3zM5.5 8h3v5h-3zM10 9h3v4h-3zM19 8h2.5v5h-2.5z', fill: true, faint: true }, { d: 'M14.5 1h3v12h-3z', fill: true }],
  'pe-vs-sector': [{ d: 'M1 2.5h11v3.5h-11z', fill: true }, { d: 'M1 8h20v3.5h-20z', fill: true, faint: true }],
  undervalued: [{ d: 'M2 3.5h9l6 3.5l-6 3.5h-9z' }, { d: circle(5.5, 7, 1.2), fill: true }],
  'analyst-upside': [{ d: 'M1 2.5H21', dash: true }, { d: circle(7, 11, 2.2), fill: true }, { d: 'M7 8.5V4M5 6l2-2l2 2' }],
  piotroski: [{ d: 'M1 7.5l2 2l3.5-4M8.5 7.5l2 2l3.5-4' }, { d: 'M16.5 5.5l4 4M20.5 5.5l-4 4', faint: true }],
  'earnings-surprise': [{ d: 'M1 9H21', dash: true, faint: true }, { d: 'M9 2h4v7h-4z', fill: true }],
  'insider-buying': [{ d: circle(11, 4.5, 2.6) }, { d: 'M5 13c1-3 3-4.5 6-4.5s5 1.5 6 4.5' }],
  'news-spike': [{ d: 'M3 1.5h16v11h-16z' }, { d: 'M6 5h10' }, { d: 'M6 8h10M6 10.5h6', faint: true }],
  'earnings-soon': [{ d: 'M4 2.5h14v10h-14zM4 5.5h14' }, { d: circle(14, 9.3, 1.4), fill: true }],
  'grade-change': [{ d: 'M11 2v9M7 7.5l4 4l4-4' }],
  'social-buzz': [{ d: 'M3 2.5h16v7h-8.5l-3.5 3v-3h-4z' }],
  'mega-caps': [{ d: 'M1 1.5h11v11h-11zM13.5 1.5h7.5v6h-7.5zM13.5 9h7.5v3.5h-7.5z' }],
  sector: [{ d: 'M1.5 2h5.5v4.5h-5.5zM15 2h5.5v4.5h-5.5zM1.5 8h5.5v4.5h-5.5zM8.25 8h5.5v4.5h-5.5zM15 8h5.5v4.5h-5.5z' },
    { d: 'M8.25 2h5.5v4.5h-5.5z', fill: true }],
  'one-stock': [{ d: circle(11, 7, 5.2) }, { d: circle(11, 7, 1.8), fill: true }],
};

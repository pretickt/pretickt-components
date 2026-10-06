/* Pure, deterministic indicators shared by the nightly enrichment and by components. Safe in Node, QuickJS and the browser.
   Fields named *Pct are in percent (2.5 = +2.5%), not fractions: divide by 100 for h.pct or a Badge with unit '%'. */
export * from './types';
export * from './series';
export { atr } from './ohlc';
export * from './technicals';
export * from './support-resistance';
export { vectorise, dailySigmaPct, SCALES, type Pivot } from './pivots';
export * from './trend-structure';
export * from './trend';
export { buildSectorIndex } from './sector';
export * from './cross';

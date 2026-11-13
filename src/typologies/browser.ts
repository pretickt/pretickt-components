/**
 * What components (browser code) may take from the typologies: the zod-free constants and the payload types. The Angular builds
 * map `@pretickt/components/typologies` here, so no schema (zod) ever reaches a page; the server keeps the full index.
 */
export * from './values';
export * from './basket-words';
export * from './basket-math';
export type * from './analysts';
export type * from './attention';
export type * from './basket';
export type * from './alerts';
export type * from './common';
export type * from './company';
export type * from './daily';
export type * from './events';
export type * from './feed';
export type * from './fundamentals';
export type * from './insider';
export type * from './metric';
export type * from './move-breakdown';
export type * from './news';
export type * from './ongoing-moves';
export type * from './portfolio';
export type * from './price-series';
export type * from './screen';
export type * from './sector';
export type * from './value';

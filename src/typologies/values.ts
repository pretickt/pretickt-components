/**
 * Plain values components use in the browser (no zod: the schemas stay on the server). The typology schemas are built from these,
 * so the two can never disagree.
 */
export const RANGES = ['1m', '3m', '6m', '1y', '2y', '5y'] as const;
export type RangeValue = (typeof RANGES)[number];

/** |sentiment| at or below this is neutral (news dots, why-today). */
export const SENTIMENT_FLAT = 0.15;

/** Code-unit string order: the same in Node and every browser (localeCompare depends on the locale). */
export const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

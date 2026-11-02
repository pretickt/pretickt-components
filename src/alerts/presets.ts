import type { ParamSpec } from './catalog';

type NumberSpec = Extract<ParamSpec, { kind: 'number' }>;
/** the percentages people pick */
const ROUND_PCT = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100];
/** a price's neighbours, nearest first: about ±5%, ±10%, then further while rounding makes two of them the same */
const UP = [1.05, 1.1, 1.15, 1.2, 1.3], DOWN = [0.95, 0.9, 0.85, 0.8, 0.7];
const onStep = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-9;

/**
 * The values a percentage or a price offers above and below its field (Romeo, 2026-11-02): the two nearest on each side, nearest
 * first. A percentage's are round ones within its limits and on its step; a price's are about ±5% and ±10%, rounded to two
 * significant digits.
 */
export function presets(spec: NumberSpec, v: number): { up: number[]; down: number[] } {
  if (spec.unit === 'price') {
    const near = (ks: number[], side: 1 | -1) => [...new Set(ks.map((k) => Number((v * k).toPrecision(2))))]
      .filter((x) => side * (x - v) > 0 && x >= spec.min && x <= spec.max).slice(0, 2);
    return { up: near(UP, 1), down: near(DOWN, -1) };
  }
  const round = ROUND_PCT.filter((x) => x >= spec.min && x <= spec.max && onStep(x, spec.step));
  return { up: round.filter((x) => x > v).slice(0, 2), down: round.filter((x) => x < v).reverse().slice(0, 2) };
}

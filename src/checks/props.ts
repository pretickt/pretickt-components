import { DEMO_ASOF } from '../typologies/common';
import { METRIC_GROUPS } from '../typologies/metric';
import type { InputInfo } from './inputs';

/** Required inputs with no literal type get a value by name; anything else must have a default or a literal union. */
const KNOWN: Record<string, unknown> = { ticker: 'NVDA', peersOf: 'NVDA', month: DEMO_ASOF.slice(0, 7), metrics: [...METRIC_GROUPS.snapshot] };

/**
 * The props the checks render a component with: required inputs filled (known name, else the first literal of their union), then
 * one variant per other literal of every union input — so each branch a literal selects is rendered at least once.
 */
export function sampleProps(inputs: InputInfo[]): Record<string, unknown>[] {
  const base: Record<string, unknown> = {};
  for (const p of inputs.filter((x) => x.required)) {
    if (p.name in KNOWN) base[p.name] = KNOWN[p.name];
    else if (p.literals.length) base[p.name] = p.literals[0];
    else throw new Error(`cannot sample the required input "${p.name}": give it a default, a literal union type, or use a known name (${Object.keys(KNOWN).join(', ')})`);
  }
  const variants = [base];
  for (const p of inputs) {
    const used = p.required ? base[p.name] : p.default;
    for (const v of p.literals) if (v !== used) variants.push({ ...base, [p.name]: v });
    if (!p.required && p.name in KNOWN && !p.literals.length) variants.push({ ...base, [p.name]: KNOWN[p.name] }); // e.g. peersOf
  }
  return variants;
}

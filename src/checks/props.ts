import { DEMO_ASOF } from '../typologies/common';
import { METRIC_GROUPS } from '../typologies/metric';

/** A prop as vue-component-meta reports it (the fields the sampler reads). */
export interface PropInfo { name: string; required: boolean; schema: string | { kind: string; schema?: unknown }; default?: string }

/** Required props with no literal type get a value by name; anything else must have a default or a literal union. */
const KNOWN: Record<string, unknown> = { ticker: 'NVDA', peersOf: 'NVDA', month: DEMO_ASOF.slice(0, 7), metrics: [...METRIC_GROUPS.snapshot] };

const literals = (s: PropInfo['schema']): (string | number)[] => {
  if (typeof s === 'string' || s.kind !== 'enum' || !Array.isArray(s.schema)) return [];
  return (s.schema as unknown[]).flatMap((x) => {
    if (typeof x !== 'string' || ['undefined', 'null', 'string', 'number', 'boolean', 'true', 'false'].includes(x)) return [];
    try { const v = JSON.parse(x) as unknown; return typeof v === 'string' || typeof v === 'number' ? [v] : []; } catch { return []; }
  });
};

/**
 * The props the checks render a component with: required props filled (known name, else the first literal of their union), then
 * one variant per other literal of every union prop — so each branch a literal selects is rendered at least once.
 */
export function sampleProps(props: PropInfo[]): Record<string, unknown>[] {
  const base: Record<string, unknown> = {};
  for (const p of props.filter((x) => x.required)) {
    const lit = literals(p.schema);
    if (p.name in KNOWN) base[p.name] = KNOWN[p.name];
    else if (lit.length) base[p.name] = lit[0];
    else throw new Error(`cannot sample the required prop "${p.name}": give it a default, a literal union type, or use a known name (${Object.keys(KNOWN).join(', ')})`);
  }
  const variants = [base];
  for (const p of props) {
    const used = p.required ? base[p.name] : (() => { try { return p.default ? JSON.parse(p.default) : undefined; } catch { return undefined; } })();
    for (const v of literals(p.schema)) if (v !== used) variants.push({ ...base, [p.name]: v });
    if (!p.required && p.name in KNOWN && !literals(p.schema).length) variants.push({ ...base, [p.name]: KNOWN[p.name] }); // e.g. peersOf
  }
  return variants;
}

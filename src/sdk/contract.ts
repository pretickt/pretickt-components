import { checkMarkup } from './markup';
import { demoFor, getTypology } from '../typologies';
import { helpers } from './helpers';
import type { ComponentModule } from './types';

export const NO_SAMPLES = 'declares no samples, so nothing can be checked';

/** The data a component gets for `params` when every need is answered by its typology's demo. Throws on a bad need. */
export function demoData(mod: ComponentModule, params: unknown): Record<string, unknown> {
  return Object.fromEntries(Object.entries(mod.manifest.needs(params as never)).map(([name, need]) => [name, demoFor(need)]));
}

export function checkContract(mod: ComponentModule, samples: unknown[] = mod.samples ?? []): string[] {
  const tag = mod.manifest.tag;
  if (!samples.length) return [`${tag}: ${NO_SAMPLES}`];
  const errors: string[] = [];
  for (const raw of samples) {
    const label = `${tag} ${JSON.stringify(raw)}`;
    const parsed = mod.manifest.params.safeParse(raw);
    if (!parsed.success) { errors.push(`${label}: sample params do not match the manifest params`); continue; }
    const params = parsed.data;
    const needs = mod.manifest.needs(params as never);
    const demo: Record<string, unknown> = {};
    const unknown: Record<string, unknown> = {};
    let ok = true;
    for (const [name, need] of Object.entries(needs)) {
      try { demo[name] = demoFor(need); } catch (e) { errors.push(`${label}: need "${name}" ${(e as Error).message}`); ok = false; continue; }
      const variant = getTypology(need.t)!.unknownVariant;
      unknown[name] = variant ? variant(demo[name] as never) : demo[name];
    }
    if (!ok) continue;
    const render = (d: Record<string, unknown>, what: string): string | null => {
      try { return mod.renderStatic(d, params, helpers); }
      catch (e) { errors.push(`${label}: renderStatic threw on ${what}: ${String(e)}`); return null; }
    };
    const a = render(demo, 'demo data');
    const b = render(demo, 'demo data');
    if (a != null && b != null) {
      if (a !== b) errors.push(`${label}: renderStatic is not deterministic`);
      for (const why of checkMarkup(a)) errors.push(`${label}: renderStatic output has ${why}`);
      if (!a.trim()) errors.push(`${label}: renderStatic returned an empty string`);
    }
    const nulls = Object.fromEntries(Object.keys(needs).map((k) => [k, null]));
    const n = render(nulls, 'null data');
    if (n != null && !n.includes('pt-na')) errors.push(`${label}: with null data the output must contain the pt-na state`);
    render(unknown, 'unknown catalogue entries');
  }
  return errors;
}

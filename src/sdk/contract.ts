import { checkMarkup } from './markup';
import { getTypology } from '../typologies';
import { helpers } from './helpers';
import type { ComponentModule } from './types';

/** Payload variants a component must survive: catalogue entries it has never seen. */
function withUnknown(t: string, payload: unknown): unknown {
  if (t === 'metric@1' && Array.isArray(payload) && payload[0])
    return [...payload, { ...payload[0], key: 'unknown_metric', label: 'Unknown', icon: 'no-such-icon', text: null }];
  if (t === 'events@1' && payload && typeof payload === 'object') {
    const p = payload as { asOf: string; items: Record<string, unknown>[] };
    const first = p.items[0] ?? { date: p.asOf, ticker: 'ZZZ', name: 'Unknown', logo: null, mcap: null };
    // one unknown kind shaped like a company event, one shaped like a market-wide date (no ticker)
    return { ...p, items: [...p.items, { ...first, kind: 'unknown_kind', meta: {} }, { date: (p.items.at(-1)?.date as string | undefined) ?? p.asOf, kind: 'unknown_market_kind', meta: {} }] };
  }
  return payload;
}

export function checkContract(mod: ComponentModule, samples: unknown[]): string[] {
  const errors: string[] = [];
  const tag = mod.manifest.tag;
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
      const t = getTypology(need.t);
      if (!t) { errors.push(`${label}: need "${name}" uses unknown typology ${need.t}`); ok = false; continue; }
      const np = t.params.safeParse(need.params);
      if (!np.success) { errors.push(`${label}: need "${name}" has invalid params for ${need.t}`); ok = false; continue; }
      demo[name] = t.demo(np.data);
      unknown[name] = withUnknown(need.t, demo[name]);
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

import { TYPOLOGY_SCHEMAS, type TypologyKey } from '../typologies/schemas';
import { methodOf } from './store';

/** Build time and checks: params a typology rejects are a component bug — throw with the reasons. */
export function validateParams(t: TypologyKey, params: unknown): void {
  const r = TYPOLOGY_SCHEMAS[t].params.safeParse(params);
  if (!r.success) throw new Error(`pt.${methodOf(t)}: params rejected by ${t}: ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
}

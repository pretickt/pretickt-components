import { CONDITIONS, type ConditionId, type Params } from './catalog';
import type { AlertRow } from './rows';

/** One badge of an alert: a condition and its values. */
export interface RuleCondition { c: ConditionId; p: Params }
/** An alert's rule: every condition true together. Stored as is by the platform (JSON). */
export interface Rule { v: 1; all: RuleCondition[] }
export const RULE_MAX = 6;
export type RuleProblem = 'empty' | 'universe-only' | 'too-many';

const isUniverse = (rc: RuleCondition) => CONDITIONS[rc.c].group === 'universe';
const passes = (rc: RuleCondition, row: AlertRow) => CONDITIONS[rc.c].test(row, rc.p).pass;

/** Why a rule cannot be saved, or null. */
export function ruleProblem(r: Rule): RuleProblem | null {
  if (!r.all.length) return 'empty';
  if (r.all.length > RULE_MAX) return 'too-many';
  return r.all.every(isUniverse) ? 'universe-only' : null;
}

/** A condition with its defaults, then what the example stock suggests, then the given values. */
export function condition(c: ConditionId, p?: Params, seed?: AlertRow | null): RuleCondition {
  const def = CONDITIONS[c];
  return { c, p: { ...def.defaults, ...(seed && def.seed ? def.seed(seed) : {}), ...(p ?? {}) } };
}

/** The companies a rule watches: those passing its universe conditions (all of them without one). */
export function inUniverse(r: Rule, rows: AlertRow[]): AlertRow[] {
  const u = r.all.filter(isUniverse);
  return rows.filter((row) => u.every((rc) => passes(rc, row)));
}

const byCap = (a: AlertRow, b: AlertRow) => (b.marketCap ?? -1) - (a.marketCap ?? -1) || (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0);

/** The companies meeting every condition, the largest first. */
export function matches(r: Rule, rows: AlertRow[]): AlertRow[] {
  return inUniverse(r, rows).filter((row) => r.all.every((rc) => passes(rc, row))).sort(byCap);
}

/** A card's "Today: N of M": a universe condition over every company, any other over the rule's universe. */
export function passCount(r: Rule, i: number, rows: AlertRow[]): { pass: number; of: number } {
  const rc = r.all[i];
  if (!rc) return { pass: 0, of: 0 };
  const pool = isUniverse(rc) ? rows : inUniverse(r, rows);
  return { pass: pool.filter((row) => passes(rc, row)).length, of: pool.length };
}

/** The stock the cards draw: the one clicked when the rule watches it, else the one closest to firing (ties: the largest). */
export function exampleOf(r: Rule, rows: AlertRow[], prefer?: string | null): AlertRow | null {
  const pool = inUniverse(r, rows);
  if (prefer) {
    const p = pool.find((row) => row.ticker === prefer);
    if (p) return p;
  }
  const rest = r.all.filter((rc) => !isUniverse(rc));
  let best: AlertRow | null = null, bestN = -1;
  for (const row of [...pool].sort(byCap)) {
    const k = rest.filter((rc) => passes(rc, row)).length;
    if (k > bestN) { best = row; bestN = k; }
  }
  return best;
}

const NAME_MAX = 60, SEP = ' · ';
/** The alert's proposed name: the conditions' short names, as many as fit in 60 characters. */
export function nameOf(r: Rule): string {
  let name = '';
  for (const rc of r.all) {
    const next = name ? name + SEP + CONDITIONS[rc.c].short(rc.p) : CONDITIONS[rc.c].short(rc.p);
    if (next.length > NAME_MAX) break;
    name = next;
  }
  return name;
}

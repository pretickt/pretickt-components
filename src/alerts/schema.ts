import * as z from 'zod/mini';
import { Ticker } from '../typologies/common';
import { SECTORS } from '../typologies/values';
import { CONDITION_IDS, CONDITIONS, type ConditionId } from './catalog';
import { RULE_MAX, ruleProblem, type Rule } from './rule';

/**
 * A rule as the server accepts it (`@pretickt/components/alerts/schema`; never on a page): the version, 1 to RULE_MAX conditions of
 * the catalog, each param its own condition's, numbers within their limits and on their step, known choices, sectors and tickers,
 * and at least one condition that is not a universe.
 */
const Value = z.union([z.string(), z.number()]);
const RuleConditionSchema = z.object({ c: z.enum(CONDITION_IDS as [ConditionId, ...ConditionId[]]), p: z.record(z.string(), Value) });

function paramProblem(c: ConditionId, p: Record<string, string | number>): string | null {
  const def = CONDITIONS[c];
  for (const k of Object.keys(p)) if (!def.params.some((s) => s.key === k)) return `${c}: unknown param ${k}`;
  for (const s of def.params) {
    const v = p[s.key];
    if (v === undefined) return `${c}: missing ${s.key}`;
    if (s.kind === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < s.min || v > s.max) return `${c}: ${s.key} out of range`;
      const k = (v - s.min) / s.step;
      if (Math.abs(k - Math.round(k)) > 1e-9) return `${c}: ${s.key} off its step`;
    } else if (s.kind === 'choice') {
      if (!s.options.some(([o]) => o === v)) return `${c}: ${s.key} unknown choice`;
    } else if (s.kind === 'sector') {
      if (!(SECTORS as readonly string[]).includes(String(v))) return `${c}: unknown sector`;
    } else if (!Ticker.safeParse(v).success) return `${c}: invalid ticker`;
  }
  return null;
}

export const ruleSchema = z.object({ v: z.literal(1), all: z.array(RuleConditionSchema).check(z.minLength(1), z.maxLength(RULE_MAX)) })
  .check(z.refine((r) => r.all.every((rc) => paramProblem(rc.c, rc.p) === null), 'a param does not fit its condition'),
    z.refine((r) => ruleProblem(r as Rule) === null, 'the rule cannot be saved'));

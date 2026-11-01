/**
 * Email alerts (`@pretickt/components/alerts`): the rows the conditions read, the catalog of conditions, rules, the badge each
 * component's bell adds and the cards' charts. Pure TypeScript, shared by the page's editor and the platform's check; no zod here
 * (the rule's schema is `@pretickt/components/alerts/schema`, for the server).
 */
export { rowsOf, type AlertRow, type AlertUniverse, type AlertUniverseRow, type LiveInput } from './rows';
export { CONDITIONS, CONDITION_IDS, GROUPS, abs, pillText, sentence, type ChartKind, type Condition, type ConditionId, type Freq, type Group, type ParamSpec, type Params, type SayPart, type Test } from './catalog';

/**
 * Email alerts (`@pretickt/components/alerts`): the rows the conditions read, the catalog of conditions, rules, the badge each
 * component's bell adds and the cards' charts. Pure TypeScript, shared by the page's editor and the platform's check; no zod here
 * (the rule's schema is `@pretickt/components/alerts/schema`, for the server).
 */
export { rowsOf, type AlertRow, type AlertUniverse, type AlertUniverseRow, type LiveInput } from './rows';
export { CONDITIONS, CONDITION_IDS, GROUPS, abs, pillText, sentence, type ChartKind, type Condition, type ConditionId, type Freq, type Group, type ParamSpec, type Params, type SayPart, type Test } from './catalog';
export { condition, exampleOf, inUniverse, matches, nameOf, passCount, RULE_MAX, ruleProblem, sourceConditions, type Rule, type RuleCondition, type RuleProblem } from './rule';
export { estimate, MONTH_SESSIONS, type AlertHistory, type AlertHistoryDay, type AlertHistoryRow, type Estimate } from './estimate';
export { alertSourceOf, eventHref, SECTION_OF, type AlertSource } from './sources';
export { CHART_W, chartOf, LABEL_X, placeLabels, PLOT_L, PLOT_R, type Bar, type ChartData, type ChartModel, type ChecksChart, type CountdownChart, type FlagChart, type GradeChart, type Level, type LevelChart, type LogosChart, type RangeChart, type Tone } from './charts';
export { GLYPHS, type GlyphPart } from './glyphs';
export { PtAlerts } from './service';
export { PT_ALERTS, type AlertDraft, type AlertFrom, type AlertsBackend, type AlertsLanding, type ManagedRule, type ManageOp, type ManageState, type SaveResult } from './token';

import * as z from 'zod/mini';
import { IsoDate, Ticker } from './common';

/**
 * "Is {company} a good stock to buy?" — pt-value's six plain questions about one company (Demand, Advantage, Economics, Execution,
 * Fragility, Price), each with a verdict in words and a few cards: a title, a big number, a small picture, the fact in a sentence that
 * names the company, the number and the date. A fact without data has no card and a question without cards is left out: never a
 * placeholder on a public page. The nightly reads the numbers (FMP, SEC EDGAR, the agents' facts); the resolver writes the words.
 */
export const VALUE_KEYS = ['demand', 'advantage', 'economics', 'execution', 'fragility', 'price'] as const;
export const VALUE_TONES = ['pos', 'flat', 'neg', 'na'] as const;
/** The nine Piotroski checks, in their order (the nightly counts them from the statements: `piotroski_checks`). */
export const PIOTROSKI_CHECKS = ['roa', 'cfo', 'droa', 'accruals', 'leverage', 'liquidity', 'shares', 'margin', 'turnover'] as const;
export type ValueKey = (typeof VALUE_KEYS)[number];
export type ValueTone = (typeof VALUE_TONES)[number];
export type CheckKey = (typeof PIOTROSKI_CHECKS)[number];

const Text = z.string().check(z.minLength(1));
const Tone = z.enum(VALUE_TONES);
const some = <T extends z.ZodMiniType>(t: T) => z.array(t).check(z.minLength(1));

export const ValueParams = z.object({ ticker: Ticker });

/** A quarter of a record as the company names it (`Q3`, `FY26`), and by how much it beat what was expected: 0.06 is 6%, a miss below 0. */
export const ValueQuarter = z.object({ q: z.string().check(z.regex(/^Q[1-4]$/)), fy: z.string().check(z.regex(/^FY\d{2}$/)), by: z.number() });
/**
 * One company on a card that reads others: `ticker` only when it has a page on pretickt (the ticker links there and opens its card),
 * `name` always (a holder such as Vanguard has no ticker); `value` sizes its bar, `label` is its number; `self` is the page's company.
 */
export const ValueCompany = z.object({
  ticker: z.nullable(Ticker), name: Text, logo: z.nullable(z.string()), value: z.nullable(z.number()), label: Text,
  tone: z.optional(Tone), self: z.optional(z.boolean()),
});
const once = (rows: { ticker: string | null; name: string }[]) => new Set(rows.map((r) => r.ticker ?? r.name)).size === rows.length;
const whole = (parts: { share: number }[]) => Math.abs(parts.reduce((s, p) => s + p.share, 0) - 1) < 0.01;
export const ValueViz = z.discriminatedUnion('kind', [
  /** A trend, oldest first (years or quarters), the last one in the card's tone; a label per bar when it has labels. */
  z.object({ kind: z.literal('bars'), values: some(z.number()), labels: z.optional(z.array(z.string())) })
    .check(z.refine((v) => !v.labels || v.labels.length === v.values.length, 'a label per bar')),
  /** The company against its peers' median. */
  z.object({ kind: z.literal('vs'), value: z.number(), peers: z.number(), unit: z.enum(['%', '×']) }),
  /** The nine Piotroski checks, each passed or missed. */
  z.object({ kind: z.literal('checks'), ok: z.record(z.enum(PIOTROSKI_CHECKS), z.boolean()) }),
  /** A record over time, oldest first, against `vs`: what was expected ("the analysts' estimate", "its forecast"). */
  z.object({ kind: z.literal('quarters'), quarters: some(ValueQuarter), vs: Text }),
  /** A score with its red, amber and green zones (`zones`: where amber and green start). */
  z.object({ kind: z.literal('gauge'), value: z.number(), min: z.number(), max: z.number(), zones: z.tuple([z.number(), z.number()]) }),
  /** Where `value` sits in a range; `mark` a reference in it (a median, a target), `labels` its two ends. */
  z.object({ kind: z.literal('range'), low: z.number(), high: z.number(), value: z.number(), mark: z.optional(z.number()),
    labels: z.optional(z.tuple([z.string(), z.string()])) }),
  /** Shares of a whole (segments, pay): they add up to it. */
  z.object({ kind: z.literal('split'), parts: some(z.object({ label: Text, share: z.number().check(z.gte(0), z.lte(1)) })) })
    .check(z.refine((v) => whole(v.parts), 'the shares add up to the whole')),
  /** Other companies — customers, competitors, holders, the banks' analysts — each once. */
  z.object({ kind: z.literal('companies'), rows: some(ValueCompany), bars: z.boolean() })
    .check(z.refine((v) => once(v.rows), 'each company once')),
]);
/**
 * A card: its title (it reads after the ticker, in lower case but for acronyms: "NVDA sales growth"), `term` the words people search
 * its fact with when they differ, the big number, a plain line under it, the fact in a sentence (`say`: the company, the number, the
 * date or period), why it matters, where the number comes from, its picture. `via` marks pretickt's own analysis: a fact read across
 * other companies (its customers' spending, its competitors' returns, its holders, the banks' analysts) that no single number gives.
 */
export const ValueCard = z.object({
  tone: Tone, title: Text, term: z.optional(Text), big: Text, line: Text, say: Text, why: Text, source: Text, viz: ValueViz, via: z.optional(Text),
});
export const ValueSection = z.object({ key: z.enum(VALUE_KEYS), tone: Tone, verdict: Text, cards: some(ValueCard) });
/** A question people search and its answer, both written from the cards' numbers. */
export const ValueFaq = z.object({ q: Text, a: Text });
const inOrder = (sections: { key: ValueKey }[]) =>
  sections.every((s, i) => i === 0 || VALUE_KEYS.indexOf(s.key) > VALUE_KEYS.indexOf(sections[i - 1]!.key));
export const ValuePayload = z.object({
  asOf: IsoDate, ticker: Ticker, name: Text, logo: z.nullable(z.string()),
  /** The questions that have data, in VALUE_KEYS order, each once. */
  sections: z.array(ValueSection).check(z.refine(inOrder, 'the questions in their order, each once')),
  /** The P/E against its 3-year median, as pt-quality computes it: `now` null after a loss over the last 12 months; null: no reading. */
  pe: z.nullable(z.object({ now: z.nullable(z.number()), median: z.nullable(z.number()) })),
  faq: z.array(ValueFaq),
});
export type ValueParams = z.output<typeof ValueParams>;
export type ValueQuarter = z.infer<typeof ValueQuarter>;
export type ValueCompany = z.infer<typeof ValueCompany>;
export type ValueViz = z.infer<typeof ValueViz>;
export type ValueCard = z.infer<typeof ValueCard>;
export type ValueSection = z.infer<typeof ValueSection>;
export type ValueFaq = z.infer<typeof ValueFaq>;
export type Value = z.infer<typeof ValuePayload>;

export const valueSamples: z.input<typeof ValueParams>[] = [{ ticker: 'NVDA' }, { ticker: 'INTC' }];

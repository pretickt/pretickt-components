import * as z from 'zod/mini';
import { BasketConsensus, BasketMoves, BasketPe, BasketQuestion, BasketTarget } from './basket';
import { HttpUrl, IsoDate, Num, Ticker } from './common';
import { SectorHolding } from './sector';
import { VALUE_KEYS, VALUE_TONES } from './value';

/**
 * The portfolio page's static files (design 2026-11-07, Part B, amended 2026-11-08): what the nightly writes once for every reader, so a reader's
 * holdings never leave the browser. `/data/facts-v1.json`: every company's basket facts and each fund's covered weights. `/data/closes-<key>-v1.json`:
 * daily closes on the split basis (`close`: a broker's gain, the targets' basis), the key `1y` (the last 252 sessions) or a calendar year.
 */
const Text = z.string().check(z.minLength(1));

/** A company's basket facts, as the funds and sectors read them (BasketFacts without the nightly's own fields). */
export const FactsCompany = z.object({
  ticker: Ticker, name: Text, logo: z.nullable(z.string()), sector: z.nullable(z.string()), close: Num, ret: Num, upside: Num, firms: z.int().check(z.gte(0)),
  consensus: z.nullable(z.object({ strongBuy: z.number(), buy: z.number(), hold: z.number(), sell: z.number(), strongSell: z.number() })),
  pe: Num, nextEarnings: z.nullable(IsoDate),
  sections: z.nullable(z.partialRecord(z.enum(VALUE_KEYS), z.enum(VALUE_TONES))),
  headline: z.nullable(z.object({ title: Text, url: HttpUrl })),
  news: z.array(z.nullable(z.number())),
});
/** A fund of the site: its close and day, how much of it we cover, and its covered companies' weights (they sum to `coverage`). */
export const FactsFund = z.object({ name: Text, logo: z.nullable(z.string()), close: z.number(), ret: Num, coverage: z.number(), weights: z.array(z.tuple([Ticker, z.number()])) });
export const FactsFile = z.object({ v: z.literal(1), asOf: IsoDate, companies: z.record(Ticker, FactsCompany), funds: z.record(Ticker, FactsFund) });

const ascending = (d: readonly string[]) => d.every((x, i) => i === 0 || d[i - 1]! < x);
/** Closes on the dates, one value a date (null before a ticker's first close or before its corporate break). */
export const ClosesFile = z.object({
  v: z.literal(1), from: IsoDate, to: IsoDate, dates: z.array(IsoDate).check(z.refine(ascending, 'oldest first')),
  closes: z.record(Ticker, z.array(z.nullable(z.number()))),
}).check(z.refine((f) => Object.values(f.closes).every((c) => c.length === f.dates.length), 'one close a date'));

/**
 * A reader's portfolio or watchlist computed on the page from the files above (never sent anywhere): the funds' and sectors' figures on its lines,
 * a fund looked through to its covered companies. `holdings` are the reader's own lines (a fund as one line, `fund` true), each with its purchase
 * date and its return since then (split basis; `noSince` when the date has no close within a week after it); `since` the whole portfolio's, for
 * dated shares only. Weights and returns are fractions.
 */
export const PortfolioHolding = z.extend(SectorHolding, { ticker: Ticker, fund: z.boolean(), bought: z.nullable(IsoDate), since: Num, noSince: z.boolean() });
export const PortfolioBasket = z.object({
  kind: z.enum(['portfolio', 'watchlist']), name: Text, asOf: IsoDate, unit: z.enum(['shares', 'pct', 'usd', 'equal']),
  value: Num, ret: Num, since: z.nullable(z.object({ from: IsoDate, ret: z.number() })),
  coverage: z.number(), state: z.enum(['ok', 'low']),
  /** What the figures cannot see: a fund's companies we do not cover, a symbol no longer on the site (weight null: no price to weigh it). */
  uncovered: z.array(z.object({ name: Text, weight: Num })),
  target: z.nullable(BasketTarget), consensus: z.nullable(BasketConsensus), pe: z.nullable(BasketPe), questions: z.nullable(z.array(BasketQuestion)),
  moves: BasketMoves,
  holdings: z.array(PortfolioHolding),
  earnings: z.array(z.object({ ticker: Ticker, name: Text, logo: z.nullable(z.string()), date: IsoDate })),
  headlines: z.array(z.object({ ticker: Ticker, name: Text, title: Text, url: HttpUrl })),
});
export type PortfolioHolding = z.infer<typeof PortfolioHolding>;
export type PortfolioBasket = z.infer<typeof PortfolioBasket>;

export type FactsCompany = z.infer<typeof FactsCompany>;
export type FactsFund = z.infer<typeof FactsFund>;
export type FactsFile = z.infer<typeof FactsFile>;
export type ClosesFile = z.infer<typeof ClosesFile>;

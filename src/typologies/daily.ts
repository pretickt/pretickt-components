import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, demoName, IsoDate, Ticker } from './common';

/**
 * A company's card of the day (pt-daily): what changed since the session before, in one sentence and a short body, with the dated
 * facts it rests on. The card is worded each night by an AI model from the platform's own facts — the same sentences the site's pages
 * show — and kept only when every figure and date in it is in a fact it cites; the facts are the platform's. `card` is the company's
 * latest kept card of the last five sessions (its `session` says which: a quiet company keeps an older one), null without one; then
 * `facts` are the session's new and changed facts, at most four — what the page shows without a card. Both empty: the night did not
 * read the company (every night's facts hold something new, the day's move). `asOf` is the latest session.
 */
export const DailyParams = z.object({ ticker: Ticker });
/** A fact's chip: a short label and its figure, both the platform's (the figure is always in the fact's sentence); neutral, never a direction. */
export const DailyChip = z.object({ label: z.string(), value: z.optional(z.string()) });
/** A dated sentence of the platform; `was` is the same fact's sentence the session before, when its value moved; `chip` since 1.1. */
export const DailyFact = z.object({ kind: z.string(), date: IsoDate, text: z.string(), was: z.optional(z.string()), chip: z.optional(DailyChip) });
const Nums = z.array(z.number());
const Ratings = z.object({ buy: z.number(), hold: z.number(), sell: z.number() });
/**
 * The numbers of one fact's small picture (pt-daily 1.1), as the platform computed them — the component draws them and never computes a level:
 * a level, the 200-day average or a crossed level beside the closes (oldest first); the 52-week range; RSI's last values; the 20- and 50-day
 * averages; the sessions to a date; the day's move split (fractions summing to `ret`); the mean target or the ratings before and after; the
 * closes around an event's day.
 */
export const DailyVisual = z.discriminatedUnion('v', [
  z.object({ v: z.literal('level'), close: z.number(), level: z.number(), distPct: z.number(), closes: Nums }),
  z.object({ v: z.literal('range'), lo: z.number(), hi: z.number(), close: z.number() }),
  z.object({ v: z.literal('rsi'), values: z.array(z.nullable(z.number())) }),
  z.object({ v: z.literal('ma'), fast: Nums, slow: Nums, crossAgo: z.nullable(z.number()) }),
  z.object({ v: z.literal('ma200'), close: z.number(), ma200: z.number(), closes: Nums }),
  z.object({ v: z.literal('date'), date: IsoDate, sessions: z.number() }),
  z.object({ v: z.literal('split'), ret: z.number(), market: z.number(), sector: z.number(), specific: z.number() }),
  z.object({ v: z.literal('target'), before: z.number(), after: z.number() }),
  z.object({ v: z.literal('ratings'), before: Ratings, after: Ratings }),
  z.object({ v: z.literal('event'), date: IsoDate, closes: z.array(z.object({ t: IsoDate, c: z.number() })) }),
  z.object({ v: z.literal('crossed'), level: z.number(), close: z.number(), closes: Nums }),
]);
/**
 * The card's second half, "What to watch" (spec 2026-11-14 what-to-watch): what is close to the last close — a level, a date, RSI — never what
 * will happen. `half`: worded by the model on the night it was written for, every figure in a fact it cites; `fact`: no half tonight, the
 * platform's own sentence of the nearest fact; `nothing`: the night read the company and nothing is near (the line names the thresholds).
 */
/** `visualAt`: the index, among the facts, of the one the picture was drawn from (its tooltip); the platform picks it, the component never guesses. */
const VisualAt = z.optional(z.int().check(z.minimum(0)));
export const DailyWatch = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('half'), session: IsoDate, writtenAt: z.string(), message: z.string(), body: z.string(), facts: z.array(DailyFact), visual: z.optional(DailyVisual), visualAt: VisualAt }),
  z.object({ kind: z.literal('fact'), fact: DailyFact, visual: z.optional(DailyVisual) }),
  z.object({ kind: z.literal('nothing'), text: z.string() }),
]);
/** `watch` (since pt-daily 1.1): absent while the half's switch is off; null when the night stored nothing to watch for the company (it claims nothing). */
export const DailyPayload = z.object({
  asOf: IsoDate, ticker: Ticker, name: z.string(),
  card: z.nullable(z.object({ session: IsoDate, writtenAt: z.string(), message: z.string(), body: z.string(), facts: z.array(DailyFact), visual: z.optional(DailyVisual), visualAt: VisualAt })),
  facts: z.array(DailyFact),
  watch: z.optional(z.nullable(DailyWatch)),
});
export type DailyFact = z.infer<typeof DailyFact>;
export type DailyChip = z.infer<typeof DailyChip>;
export type DailyVisual = z.infer<typeof DailyVisual>;
export type DailyWatch = z.infer<typeof DailyWatch>;
export type DailyParams = z.output<typeof DailyParams>;
export type Daily = z.infer<typeof DailyPayload>;

export const dailySamples: z.input<typeof DailyParams>[] = [{ ticker: 'NVDA' }];

/** Made up: a card of the demo's session resting on two facts, the mean target changed (with what it was) and the day's move, each with its chip, the target drawn before and after. No `watch`: the half's switch is off. */
export function dailyDemo(p: DailyParams): Daily {
  const t = p.ticker, name = DEMO_COMPANIES.find(([x]) => x === t)?.[1] ?? demoName(t);
  return { asOf: DEMO_ASOF, ticker: t, name,
    card: { session: DEMO_ASOF, writtenAt: '2026-10-01T00:12:00.000Z',
      message: `Analysts' mean price target for ${t} rose to $212.40 on Sep 30`,
      body: 'Two firms published higher targets in the session, lifting the mean from $208.10. The stock closed higher on the day, mostly on its own.',
      facts: [
        { kind: 'analysts', date: DEMO_ASOF, text: 'Analysts\' mean price target as of Sep 30: $212.40 from 41 firms; last close $188.20.',
          was: 'Analysts\' mean price target as of Sep 29: $208.10 from 40 firms; last close $185.00.', chip: { label: 'Mean target', value: '$212.40' } },
        { kind: 'day', date: DEMO_ASOF, text: `Last close (Sep 30): ${t} +1.7% = market (SPY) +0.2% + Technology sector +0.3% + ${t} on its own +1.2%.`,
          chip: { label: 'Sep 30', value: '+1.7%' } },
      ],
      visual: { v: 'target', before: 208.1, after: 212.4 }, visualAt: 0 },
    facts: [] };
}

/** Made up: a "What to watch" half of the demo's session — a support 2.1% below the last close and RSI at 31 — with one phrase in bold and the level drawn beside 20 closes. */
export function dailyWatchDemo(t: string): DailyWatch {
  const closes = Array.from({ length: 20 }, (_, i) => Math.round((196 - i * 0.4 + (i % 3) * 0.6) * 100) / 100);
  return { kind: 'half', session: DEMO_ASOF, writtenAt: '2026-10-01T00:14:00.000Z',
    message: `${t} closed 2.1% above a support it held 4 times`,
    body: 'The support at $184.25 is the nearest level, and the stock **turned there 4 times** this year. RSI stands at 31, a point above the 30 line.',
    facts: [
      { kind: 'level-below', date: DEMO_ASOF, text: 'Support as of Sep 30: $184.25, 2.1% below the last close; it held 4 times.', chip: { label: 'Support', value: '2.1% below' } },
      { kind: 'rsi', date: DEMO_ASOF, text: 'RSI (14 days) as of Sep 30: 31, a point above the 30 line read as oversold.', chip: { label: 'RSI', value: '31' } },
    ],
    visual: { v: 'level', close: 188.2, level: 184.25, distPct: -2.1, closes: [...closes, 188.2] }, visualAt: 0 };
}

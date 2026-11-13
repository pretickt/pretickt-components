import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, demoName, IsoDate, Ticker } from './common';

/**
 * A company's card of the day (pt-daily): what changed since the session before, in one sentence and a short body, with the dated
 * facts it rests on. The card is worded each night by an AI model from the platform's own facts — the same sentences the site's pages
 * show — and kept only when every figure and date in it is in a fact it cites; the facts are the platform's. `card` is the company's
 * latest kept card of the last five sessions (its `session` says which: a quiet company keeps an older one), null without one; then
 * `facts` are the session's new and changed facts, at most four — what the page shows without a card. Both empty: nothing new was
 * recorded. `asOf` is the latest session.
 */
export const DailyParams = z.object({ ticker: Ticker });
/** A dated sentence of the platform; `was` is the same fact's sentence the session before, when its value moved. */
export const DailyFact = z.object({ kind: z.string(), date: IsoDate, text: z.string(), was: z.optional(z.string()) });
export const DailyPayload = z.object({
  asOf: IsoDate, ticker: Ticker, name: z.string(),
  card: z.nullable(z.object({ session: IsoDate, writtenAt: z.string(), message: z.string(), body: z.string(), facts: z.array(DailyFact) })),
  facts: z.array(DailyFact),
});
export type DailyFact = z.infer<typeof DailyFact>;
export type DailyParams = z.output<typeof DailyParams>;
export type Daily = z.infer<typeof DailyPayload>;

export const dailySamples: z.input<typeof DailyParams>[] = [{ ticker: 'NVDA' }];

/** Made up: a card of the demo's session resting on two facts, the mean target changed (with what it was) and the day's move. */
export function dailyDemo(p: DailyParams): Daily {
  const t = p.ticker, name = DEMO_COMPANIES.find(([x]) => x === t)?.[1] ?? demoName(t);
  return { asOf: DEMO_ASOF, ticker: t, name,
    card: { session: DEMO_ASOF, writtenAt: '2026-10-01T00:12:00.000Z',
      message: `Analysts' mean price target for ${t} rose to $212.40 on Sep 30`,
      body: 'Two firms published higher targets in the session, lifting the mean from $208.10. The stock closed higher on the day, mostly on its own.',
      facts: [
        { kind: 'analysts', date: DEMO_ASOF, text: 'Analysts\' mean price target as of Sep 30: $212.40 from 41 firms; last close $188.20.',
          was: 'Analysts\' mean price target as of Sep 29: $208.10 from 40 firms; last close $185.00.' },
        { kind: 'day', date: DEMO_ASOF, text: `Last close (Sep 30): ${t} +1.7% = market (SPY) +0.2% + Technology sector +0.3% + ${t} on its own +1.2%.` },
      ] },
    facts: [] };
}

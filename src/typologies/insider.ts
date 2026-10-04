import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, intParam, IsoDate, prng, round, Ticker, cmp } from './common';

/** Insider transactions (SEC Form 4 via FMP), newest first. `type` is open-market buy, sell, or anything else. */
export const InsiderParams = z.object({ ticker: Ticker, days: intParam(30, 730, 365) });
export const InsiderPayload = z.object({
  asOf: IsoDate,
  items: z.array(z.object({
    date: IsoDate, filingDate: z.nullable(IsoDate), name: z.string(), title: z.nullable(z.string()),
    type: z.enum(['buy', 'sell', 'other']), shares: z.number(), price: z.nullable(z.number()), value: z.nullable(z.number()),
  })),
});
export type InsiderParams = z.output<typeof InsiderParams>;
export type Insider = z.infer<typeof InsiderPayload>;

export const insiderSamples: z.input<typeof InsiderParams>[] = [{ ticker: 'NVDA' }, { ticker: 'AAPL', days: 90 }];

const NAMES = [['Jane Doe', 'CEO'], ['John Roe', 'CFO'], ['Alex Poe', 'Director'], ['Sam Moe', 'EVP']] as const;

export function insiderDemo(p: InsiderParams): Insider {
  const r = prng(`${p.ticker}:insider`);
  const items = Array.from({ length: 6 }, (_, i) => {
    const [name, title] = NAMES[i % NAMES.length]!;
    const type = r() > 0.75 ? 'buy' as const : 'sell' as const;
    const shares = Math.round(1000 + r() * 50000);
    const price = round(50 + r() * 200);
    const date = addDays(DEMO_ASOF, -Math.floor(r() * p.days));
    return { date, filingDate: addDays(date, 2), name, title, type, shares, price, value: round(shares * price, 0) };
  }).sort((a, b) => cmp(b.date, a.date));
  return { asOf: DEMO_ASOF, items };
}

import { z } from 'zod';
import { addDays, DEMO_ASOF, IsoDate, Month, prng, Range, RANGE_SESSIONS, round, Ticker } from './common';

/** The kind catalogue. Adding a kind is a minor version of events@1; components render unknown kinds generically. */
export const EVENT_KINDS = ['earnings', 'dividend', 'split', 'analyst'] as const;

export const EventsParams = z.object({
  scope: z.discriminatedUnion('by', [
    /** One ticker: events in the `range` before the latest session plus `ahead` calendar days after it. */
    z.object({ by: z.literal('ticker'), ticker: Ticker, range: Range, ahead: z.number().int().min(0).max(180).default(90) }),
    /** The whole universe for one calendar month (calendar pages). */
    z.object({ by: z.literal('universe'), month: Month }),
  ]),
  kinds: z.array(z.enum(EVENT_KINDS)).min(1),
});

const Common = { date: IsoDate, ticker: Ticker, name: z.string(), logo: z.string().nullable(), mcap: z.number().nullable() };
export const EventItem = z.discriminatedUnion('kind', [
  z.object({ ...Common, kind: z.literal('earnings'), meta: z.object({
    time: z.enum(['bmo', 'amc']).nullable(), epsEst: z.number().nullable(), epsActual: z.number().nullable(),
    revEst: z.number().nullable(), revActual: z.number().nullable() }) }),
  z.object({ ...Common, kind: z.literal('dividend'), meta: z.object({ amount: z.number(), payDate: IsoDate.nullable() }) }),
  z.object({ ...Common, kind: z.literal('split'), meta: z.object({ numerator: z.number(), denominator: z.number() }) }),
  z.object({ ...Common, kind: z.literal('analyst'), meta: z.object({
    firm: z.string(), action: z.string(), from: z.string().nullable(), to: z.string().nullable() }) }),
]);
/** `asOf` is the latest price session: components use it to tell past from future (they have no clock). */
export const EventsPayload = z.object({ asOf: IsoDate, items: z.array(EventItem) });
export type EventItem = z.infer<typeof EventItem>;
export type Events = z.infer<typeof EventsPayload>;

const DEMO_COS = [['AAPL', 'Apple Inc.'], ['MSFT', 'Microsoft Corporation'], ['NVDA', 'NVIDIA Corporation'], ['AMZN', 'Amazon.com, Inc.'],
  ['JPM', 'JPMorgan Chase & Co.'], ['KO', 'The Coca-Cola Company'], ['BRK.B', 'Berkshire Hathaway Inc.'], ['NKE', 'NIKE, Inc.']] as const;

export function eventsDemo(p: z.infer<typeof EventsParams>): Events {
  const items: EventItem[] = [];
  const want = new Set(p.kinds);
  if (p.scope.by === 'ticker') {
    const { ticker, range, ahead } = p.scope;
    const r = prng(`${ticker}:events`);
    const from = addDays(DEMO_ASOF, -Math.ceil((RANGE_SESSIONS[range] * 7) / 5));
    const to = addDays(DEMO_ASOF, ahead);
    const co = { ticker, name: `${ticker} Demo Corp.`, logo: null, mcap: round(1e10 + r() * 1e12, 0) };
    for (let d = addDays(to, -Math.floor(r() * 80)); d >= from; d = addDays(d, -91)) {
      const future = d > DEMO_ASOF;
      const est = round(1 + r() * 3);
      if (want.has('earnings')) items.push({ ...co, date: d, kind: 'earnings', meta: { time: r() > 0.5 ? 'amc' : 'bmo', epsEst: est,
        epsActual: future ? null : round(est * (0.9 + r() * 0.25)), revEst: round(1e9 + r() * 5e10, 0), revActual: null } });
      const ex = addDays(d, -20);
      if (want.has('dividend') && ex >= from) items.push({ ...co, date: ex, kind: 'dividend', meta: { amount: round(0.1 + r()), payDate: addDays(ex, 14) } });
    }
    if (want.has('analyst')) for (let i = 0; i < 6; i++) {
      const d = addDays(DEMO_ASOF, -Math.floor(r() * 300));
      items.push({ ...co, date: d, kind: 'analyst', meta: { firm: ['Morgan Stanley', 'Citi', 'Barclays'][i % 3]!, action: i % 4 === 0 ? 'upgrade' : 'maintain',
        from: 'Hold', to: i % 4 === 0 ? 'Buy' : 'Hold' } });
    }
    if (want.has('split') && r() > 0.5) items.push({ ...co, date: addDays(DEMO_ASOF, -120), kind: 'split', meta: { numerator: 4, denominator: 1 } });
  } else {
    const r = prng(`universe:${p.scope.month}`);
    for (let i = 0; i < 40; i++) {
      const [ticker, name] = DEMO_COS[i % DEMO_COS.length]!;
      const day = String(1 + Math.floor(r() * 28)).padStart(2, '0');
      if (want.has('earnings')) items.push({ date: `${p.scope.month}-${day}`, ticker, name, logo: null, mcap: round(1e10 + r() * 3e12, 0), kind: 'earnings',
        meta: { time: r() > 0.5 ? 'amc' : 'bmo', epsEst: round(1 + r() * 3), epsActual: null, revEst: null, revActual: null } });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || (b.mcap ?? 0) - (a.mcap ?? 0) || a.ticker.localeCompare(b.ticker));
  return { asOf: DEMO_ASOF, items };
}

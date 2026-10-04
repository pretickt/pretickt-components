import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, DEMO_COMPANIES, DEMO_FIRMS, demoName, intParam, IsoDate, Month, Num, prng, Range, rangeStart, round, Ticker, cmp } from './common';

/** The kind catalogue. Adding a kind is a minor version of events@1; components render unknown kinds generically. */
export const EVENT_KINDS = ['earnings', 'dividend', 'split', 'analyst', 'macro'] as const;

export const EventsParams = z.object({
  scope: z.discriminatedUnion('by', [
    /** One ticker: events in the `range` (the last N sessions, as in price-series@1) plus `ahead` calendar days after it. */
    z.object({ by: z.literal('ticker'), ticker: Ticker, range: Range, ahead: intParam(0, 180, 90) }),
    /** The whole universe for one calendar month (calendar pages). */
    z.object({ by: z.literal('universe'), month: Month }),
  ]),
  kinds: z.array(z.enum(EVENT_KINDS)).check(z.minLength(1)),
});

const Common = { date: IsoDate, ticker: Ticker, name: z.string(), logo: z.nullable(z.string()), mcap: Num };
export const EventItem = z.discriminatedUnion('kind', [
  z.object({ ...Common, kind: z.literal('earnings'), meta: z.object({
    time: z.nullable(z.enum(['bmo', 'amc'])), epsEst: Num, epsActual: Num, revEst: Num, revActual: Num }) }),
  z.object({ ...Common, kind: z.literal('dividend'), meta: z.object({ amount: z.number(), payDate: z.nullable(IsoDate) }) }),
  z.object({ ...Common, kind: z.literal('split'), meta: z.object({ numerator: z.number(), denominator: z.number() }) }),
  z.object({ ...Common, kind: z.literal('analyst'), meta: z.object({
    firm: z.string(), action: z.string(), from: z.nullable(z.string()), to: z.nullable(z.string()) }) }),
  /** Market-wide dates (US economic calendar): no ticker. */
  z.object({ date: IsoDate, kind: z.literal('macro'), meta: z.object({ label: z.string(), event: z.string(), impact: z.nullable(z.string()) }) }),
]);
/** `asOf` is the latest price session: components use it to tell past from future (they have no clock). */
export const EventsPayload = z.object({ asOf: IsoDate, items: z.array(EventItem) });
export type EventsParams = z.output<typeof EventsParams>;
export type EventItem = z.infer<typeof EventItem>;
export type Events = z.infer<typeof EventsPayload>;

const sizeOf = (e: EventItem) => (e.kind === 'macro' ? Infinity : e.mcap ?? 0);
const tickerOf = (e: EventItem) => (e.kind === 'macro' ? '' : e.ticker);
/** Calendar order: date, then macro first, then biggest companies first. */
export const byDateThenSize = (a: EventItem, b: EventItem) =>
  cmp(a.date, b.date) || sizeOf(b) - sizeOf(a) || cmp(tickerOf(a), tickerOf(b)) || cmp(a.kind, b.kind);

export const eventsSamples: z.input<typeof EventsParams>[] = [
  { scope: { by: 'ticker', ticker: 'BRK.B', range: '1y', ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] },
  { scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings'] },
  { scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] },
];

/** Kinds this build has never seen — one shaped like a company event, one like a market-wide date (no ticker). */
export function eventsUnknownVariant(p: Events): unknown {
  const first = p.items.find((i) => i.kind !== 'macro') ?? { date: p.asOf, ticker: 'ZZZ', name: 'Unknown', logo: null, mcap: null };
  return { ...p, items: [...p.items, { ...first, kind: 'unknown_kind', meta: {} }, { date: p.items.at(-1)?.date ?? p.asOf, kind: 'unknown_market_kind', meta: {} }] };
}

export function eventsDemo(p: EventsParams): Events {
  const items: EventItem[] = [];
  const want = new Set(p.kinds);
  if (p.scope.by === 'ticker') {
    const { ticker, range, ahead } = p.scope;
    const r = prng(`${ticker}:events`);
    const from = rangeStart(DEMO_ASOF, range);
    const to = addDays(DEMO_ASOF, ahead);
    const co = { ticker, name: demoName(ticker), logo: null, mcap: round(1e10 + r() * 1e12, 0) };
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
      items.push({ ...co, date: d, kind: 'analyst', meta: { firm: DEMO_FIRMS[i % 3]!, action: i % 4 === 0 ? 'upgrade' : 'maintain',
        from: 'Hold', to: i % 4 === 0 ? 'Buy' : 'Hold' } });
    }
    if (want.has('split') && r() > 0.5) items.push({ ...co, date: addDays(DEMO_ASOF, -120), kind: 'split', meta: { numerator: 4, denominator: 1 } });
  } else {
    const r = prng(`universe:${p.scope.month}`);
    for (let i = 0; i < 40; i++) {
      const [ticker, name] = DEMO_COMPANIES[i % DEMO_COMPANIES.length]!;
      const day = String(1 + Math.floor(r() * 28)).padStart(2, '0');
      if (want.has('earnings')) items.push({ date: `${p.scope.month}-${day}`, ticker, name, logo: null, mcap: round(1e10 + r() * 3e12, 0), kind: 'earnings',
        meta: { time: r() > 0.5 ? 'amc' : 'bmo', epsEst: round(1 + r() * 3), epsActual: null, revEst: null, revActual: null } });
    }
  }
  if (want.has('macro')) {
    const start = p.scope.by === 'universe' ? `${p.scope.month}-01` : DEMO_ASOF;
    const macro = [['CPI', 'Consumer Price Index (YoY)'], ['Fed', 'Fed Interest Rate Decision'], ['Jobs', 'Nonfarm Payrolls'], ['PCE', 'Core PCE Price Index (MoM)']] as const;
    macro.forEach(([label, event], i) => items.push({ date: addDays(start, 3 + i * 7), kind: 'macro', meta: { label, event, impact: 'High' } }));
  }
  items.sort(byDateThenSize);
  return { asOf: DEMO_ASOF, items };
}

import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, DEMO_COMPANIES, DEMO_FIRMS, demoName, HttpUrl, intParam, IsoDate, Month, Num, prng, Range, rangeStart, round, Ticker, cmp } from './common';

/** The kind catalogue. Adding a kind is a minor version of events@1; components render unknown kinds generically. */
export const EVENT_KINDS = ['earnings', 'dividend', 'split', 'analyst', 'macro'] as const;

export const EventsParams = z.object({
  scope: z.discriminatedUnion('by', [
    /** One ticker: events in the `range` (the last N sessions, as in price-series@1) plus `ahead` calendar days after it. */
    z.object({ by: z.literal('ticker'), ticker: Ticker, range: Range, ahead: intParam(0, 180, 90) }),
    /** The whole universe for one calendar month (calendar pages). */
    z.object({ by: z.literal('universe'), month: Month }),
    /** The whole universe between two dates, at most 14 days apart (a week on the home page). Added in 1.1. */
    // strict calendar dates (no 2026-11-31 rolling into December), refused before the span check can read them
    z.object({ by: z.literal('dates'), from: z.iso.date({ abort: true }), to: z.iso.date({ abort: true }) })
      .check(z.refine((s) => s.from <= s.to && s.to <= addDays(s.from, 13), 'from ≤ to, at most 14 days')),
  ]),
  kinds: z.array(z.enum(EVENT_KINDS)).check(z.minLength(1)),
});

const Common = { date: IsoDate, ticker: Ticker, name: z.string(), logo: z.nullable(z.string()), mcap: Num };
/** How many past reports (or releases) and stories an event carries at most: a month of 300 reports stays small. */
export const EVENT_MOVES = 8, EVENT_NEWS = 5;
/** The market's (SPY) moves on the last releases of the same kind, oldest first (fractions). */
const Moves = z.array(z.number()).check(z.maxLength(EVENT_MOVES));
/**
 * A company's last reports, oldest first: `surprise`, its EPS against the estimate ((actual − estimate) / |estimate|; null without an
 * estimate); `move`, the stock's in the session that traded it (null without one).
 */
const Reports = z.array(z.object({ surprise: Num, move: Num })).check(z.maxLength(EVENT_MOVES));
/**
 * A story about the event — the company's report, before or after it; the release — newest first. `tag` says what it is once a
 * classifier has read it (an LLM or a decision model: "Preview", "Results", "Guidance"…), null until then.
 */
const EventNews = z.object({ publishedAt: z.string(), title: z.string(), site: z.string(), url: HttpUrl, tag: z.optional(z.nullable(z.string())) });
const News = z.array(EventNews).check(z.maxLength(EVENT_NEWS));
/**
 * What to expect (added in 1.2, every field optional: a payload without them is a 1.1 one). For a report: `reports`, the company's
 * last ones (each a beat or a miss, and the move after it); `move`, this report's, once a session has traded it (null before, and on
 * the evening of a report after the close).
 */
const Outlook = { move: z.optional(Num), news: z.optional(News) };
export const EventItem = z.discriminatedUnion('kind', [
  z.object({ ...Common, kind: z.literal('earnings'), meta: z.object({
    time: z.nullable(z.enum(['bmo', 'amc'])), confirmed: z.optional(z.nullable(z.boolean())), epsEst: Num, epsActual: Num, revEst: Num, revActual: Num,
    ...Outlook, reports: z.optional(Reports) }) }),
  z.object({ ...Common, kind: z.literal('dividend'), meta: z.object({ amount: z.number(), payDate: z.nullable(IsoDate) }) }),
  z.object({ ...Common, kind: z.literal('split'), meta: z.object({ numerator: z.number(), denominator: z.number() }) }),
  z.object({ ...Common, kind: z.literal('analyst'), meta: z.object({
    firm: z.string(), action: z.string(), from: z.nullable(z.string()), to: z.nullable(z.string()) }) }),
  /**
   * Market-wide dates (US economic calendar): no ticker. 1.2: `headline`, the figure the date is about (the Fed's rate, CPI YoY, the
   * payrolls), in its `unit` ('%', 'K'…): the consensus `expected`, the `previous` release, the `actual` once out; `moves`, the
   * market's (SPY) move on the last releases of this kind; `move`, the market's that session once released.
   */
  z.object({ date: IsoDate, kind: z.literal('macro'), meta: z.object({ label: z.string(), event: z.string(), impact: z.nullable(z.string()), ...Outlook,
    moves: z.optional(Moves),
    headline: z.optional(z.nullable(z.object({ name: z.string(), unit: z.nullable(z.string()), expected: Num, previous: Num, actual: Num }))) }) }),
]);
/**
 * `asOf` is the latest price session: components use it to tell past from future (they have no clock). 1.2: `normal`, the market's
 * (SPY) usual daily move (the mean absolute daily return of the last 252 sessions), to size a macro date against an ordinary day.
 */
export const EventsPayload = z.object({ asOf: IsoDate, normal: z.optional(Num), items: z.array(EventItem) });
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
  { scope: { by: 'dates', from: '2026-10-05', to: '2026-10-09' }, kinds: ['earnings', 'macro'] },
];

/** Kinds this build has never seen — one shaped like a company event, one like a market-wide date (no ticker). */
export function eventsUnknownVariant(p: Events): unknown {
  const first = p.items.find((i) => i.kind !== 'macro') ?? { date: p.asOf, ticker: 'ZZZ', name: 'Unknown', logo: null, mcap: null };
  return { ...p, items: [...p.items, { ...first, kind: 'unknown_kind', meta: {} }, { date: p.items.at(-1)?.date ?? p.asOf, kind: 'unknown_market_kind', meta: {} }] };
}

/** The demo market's usual daily move (SPY's mean absolute daily return is about 0.7%). */
const DEMO_NORMAL = 0.0068;
type EventStory = z.infer<typeof EventNews>;
const SITES = ['Reuters', 'Barron\'s', 'MarketWatch'] as const;
/**
 * Made-up stories about an event in the week around the demo's latest session, none published after it: a preview two days
 * before, the results on the day once it is out, sometimes an older story nobody has classified yet.
 */
function demoNews(seed: string, subject: string, date: string): EventStory[] | undefined {
  if (date < addDays(DEMO_ASOF, -7) || date > addDays(DEMO_ASOF, 7)) return undefined;
  const o = prng(`${seed}:${date}:news`), slug = `${seed}-${date}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const told = [
    { at: date, tag: 'Results', title: `${subject}: the results (demo story)` },
    { at: addDays(date, -2), tag: 'Preview', title: `${subject}: what to watch (demo story)` },
    ...(o() > 0.5 ? [{ at: addDays(date, -5), tag: null, title: `${subject} in the news (demo story)` }] : []),
  ].filter((s) => s.at <= DEMO_ASOF);
  return told.length ? told.map((s, i) => ({ publishedAt: `${s.at}T13:00:00Z`, title: s.title, site: SITES[(i + Math.floor(o() * 3)) % 3]!,
    url: `https://example.com/${slug}/${i + 1}`, tag: s.tag })) : undefined;
}
/**
 * A demo report's outlook (its own seed: the calendar's draws stay as they were): 3 to 8 reports on file, mostly beats, each with a
 * move around a usual size; once out, its EPS and the move (none yet on the evening of a report after the close).
 */
function demoReport(ticker: string, date: string, time: 'bmo' | 'amc', epsEst: number, confirmed: boolean) {
  const o = prng(`${ticker}:${date}:outlook`), n = 3 + Math.floor(o() * 6), usual = 0.02 + o() * 0.07, beats = 0.45 + o() * 0.5;
  const reports = Array.from({ length: n }, () => {
    const v = o();
    return { surprise: round(v < beats ? 0.025 + o() * 0.1 : v < beats + 0.15 ? (o() - 0.5) * 0.03 : -0.025 - o() * 0.08, 3),
      move: round((o() > 0.42 ? 1 : -1) * usual * (0.35 + o() * 1.3), 3) };
  });
  const out = date <= DEMO_ASOF, traded = date < DEMO_ASOF || (date === DEMO_ASOF && time === 'bmo');
  return {
    time, confirmed: out || confirmed, epsEst, epsActual: out ? round(epsEst * (0.94 + o() * 0.16)) : null, revEst: null, revActual: null,
    reports, move: traded ? round((o() > 0.45 ? 1 : -1) * usual * (0.3 + o() * 1.4), 3) : null, news: demoNews(ticker, `${ticker} earnings`, date),
  };
}
/** The demo's market dates: the release, its headline figure (expected, previous), the market's usual size on its releases. */
const DEMO_MACRO = [
  { label: 'CPI', event: 'Consumer Price Index (YoY)', name: 'CPI YoY', unit: '%', expected: 2.9, previous: 3, size: 0.011 },
  { label: 'Fed', event: 'Fed Interest Rate Decision', name: 'Fed funds rate', unit: '%', expected: 3.75, previous: 4, size: 0.012 },
  { label: 'Jobs', event: 'Nonfarm Payrolls', name: 'Nonfarm Payrolls', unit: 'K', expected: 120, previous: 22, size: 0.009 },
  { label: 'PCE', event: 'Core PCE Price Index (MoM)', name: 'Core PCE MoM', unit: '%', expected: 0.2, previous: 0.3, size: 0.007 },
] as const;

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
      if (want.has('earnings')) items.push({ ...co, date: d, kind: 'earnings', meta: { time: r() > 0.5 ? 'amc' : 'bmo', confirmed: future ? r() > 0.4 : true, epsEst: est,
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
  } else if (p.scope.by === 'dates') {
    // the months the span covers, cut to its days
    const { from, to } = p.scope;
    const months = [...new Set([from.slice(0, 7), to.slice(0, 7)])];
    const all = months.flatMap((month) => eventsDemo({ scope: { by: 'universe', month }, kinds: p.kinds }).items);
    return { asOf: DEMO_ASOF, normal: DEMO_NORMAL, items: all.filter((e) => e.date >= from && e.date <= to).sort(byDateThenSize) };
  } else {
    const r = prng(`universe:${p.scope.month}`);
    for (let i = 0; i < 40; i++) {
      const [ticker, name] = DEMO_COMPANIES[i % DEMO_COMPANIES.length]!;
      const day = String(1 + Math.floor(r() * 28)).padStart(2, '0');
      if (!want.has('earnings')) continue;
      // the draws in their old order (market value, time, confirmed, estimate): the outlook has a seed of its own
      const date = `${p.scope.month}-${day}`, mcap = round(1e10 + r() * 3e12, 0), time = r() > 0.5 ? 'amc' as const : 'bmo' as const;
      const confirmed = r() > 0.4, epsEst = round(1 + r() * 3);
      items.push({ date, ticker, name, logo: null, mcap, kind: 'earnings', meta: demoReport(ticker, date, time, epsEst, confirmed) });
    }
  }
  if (want.has('macro')) {
    const start = p.scope.by === 'universe' ? `${p.scope.month}-01` : DEMO_ASOF;
    DEMO_MACRO.forEach(({ label, event, name, unit, expected, previous, size }, i) => {
      const date = addDays(start, 3 + i * 7), o = prng(`${label}:${date}:spy`), out = date <= DEMO_ASOF;
      const moves = Array.from({ length: 8 }, () => round((o() > 0.45 ? 1 : -1) * size * (0.35 + o() * 1.3), 4));
      const actual = !out ? null : label === 'Fed' ? expected : round(expected + (o() - 0.5) * (unit === 'K' ? 60 : 0.2), unit === 'K' ? 0 : 1);
      items.push({ date, kind: 'macro', meta: { label, event, impact: 'High', headline: { name, unit, expected, previous, actual }, moves,
        move: out ? round((o() > 0.45 ? 1 : -1) * size * (0.3 + o() * 1.4), 4) : null, news: demoNews(label, event, date) } });
    });
  }
  items.sort(byDateThenSize);
  return { asOf: DEMO_ASOF, normal: DEMO_NORMAL, items };
}

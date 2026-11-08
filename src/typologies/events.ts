import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, DEMO_COMPANIES, DEMO_FIRMS, demoName, HttpUrl, intParam, IsoDate, Month, Num, prng, Range, rangeStart, round, Ticker, cmp } from './common';
import { SECTORS } from './values';

/** The kind catalogue. Adding a kind is a minor version of events@1; components render unknown kinds generically. */
export const EVENT_KINDS = ['earnings', 'dividend', 'split', 'analyst', 'macro'] as const;

export const EventsParams = z.object({
  scope: z.discriminatedUnion('by', [
    /** One ticker: events in the `range` (the last N sessions, as in price-series@1) plus `ahead` calendar days after it. */
    z.object({ by: z.literal('ticker'), ticker: Ticker, range: Range, ahead: intParam(0, 180, 90) }),
    /** One sector (added 2026-11-07): its 5 largest companies' reports and the market's dates, in the `range` plus `ahead` days, as a fund's. */
    z.object({ by: z.literal('sector'), sector: z.enum(SECTORS), range: Range, ahead: intParam(0, 180, 90) }),
    /**
     * The whole universe for one calendar month (calendar pages). 1.3: the month's grid (`monthGrid`, its weeks Monday to Sunday,
     * cut at the calendar window), so the days of the months around it that share a week with it come too; a month's `news` are its own.
     */
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
/** The moves of the sessions that traded the last reports (or the market's, SPY, on the last releases of the same kind), oldest first. */
const Moves = z.array(z.number()).check(z.maxLength(EVENT_MOVES));
/**
 * A story about the event — the company's report, before or after it; the release — newest first. `tag` says what it is once a
 * classifier has read it (an LLM or a decision model: "Preview", "Results", "Guidance"…), null until then.
 */
const EventNews = z.object({ publishedAt: z.string(), title: z.string(), site: z.string(), url: HttpUrl, tag: z.optional(z.nullable(z.string())) });
const News = z.array(EventNews).check(z.maxLength(EVENT_NEWS));
/**
 * What to expect (added in 1.2, every field optional: a payload without them is a 1.1 one). For a report: `moves`, the stock's move in
 * the session that traded each of its last reports (fractions to 0.1%: a month of 300 reports stays small); `record`, how many of those
 * with an EPS estimate beat it by more than 2% (`beats` of `of`); `move`, this report's, once a session has traded it (null before, and
 * on the evening of a report after the close).
 */
const Outlook = { moves: z.optional(Moves), move: z.optional(Num), news: z.optional(News) };
export const EventItem = z.discriminatedUnion('kind', [
  z.object({ ...Common, kind: z.literal('earnings'), meta: z.object({
    time: z.nullable(z.enum(['bmo', 'amc'])), confirmed: z.optional(z.nullable(z.boolean())), epsEst: Num, epsActual: Num, revEst: Num, revActual: Num,
    ...Outlook, record: z.optional(z.nullable(z.object({ beats: z.int().check(z.minimum(0)), of: z.int().check(z.minimum(0)) }))) }) }),
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
  // a sector page's price chart: its largest companies' events (Part A, 2026-11-07)
  { scope: { by: 'sector', sector: 'Energy', range: '1y', ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] },
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
 * A demo report's outlook (its own seed: the calendar's draws stay as they were): 3 to 8 reports on file, moves around a usual size,
 * a record against the estimate; once out, its EPS and the move (none yet on the evening of a report after the close).
 */
function demoReport(ticker: string, date: string, time: 'bmo' | 'amc', epsEst: number, confirmed: boolean) {
  const o = prng(`${ticker}:${date}:outlook`), n = 3 + Math.floor(o() * 6), usual = 0.02 + o() * 0.07;
  const moves = Array.from({ length: n }, () => round((o() > 0.42 ? 1 : -1) * usual * (0.35 + o() * 1.3), 3));
  const out = date <= DEMO_ASOF, traded = date < DEMO_ASOF || (date === DEMO_ASOF && time === 'bmo');
  return {
    time, confirmed: out || confirmed, epsEst, epsActual: out ? round(epsEst * (0.94 + o() * 0.16)) : null, revEst: null, revActual: null,
    moves, record: { beats: Math.round(n * (0.45 + o() * 0.55)), of: n },
    move: traded ? round((o() > 0.45 ? 1 : -1) * usual * (0.3 + o() * 1.4), 3) : null, news: demoNews(ticker, `${ticker} earnings`, date),
  };
}
/** The demo's market dates: the release, its headline figure (expected, previous), the market's usual size on its releases. */
const DEMO_MACRO = [
  { label: 'CPI', event: 'Consumer Price Index (YoY)', name: 'CPI YoY', unit: '%', expected: 2.9, previous: 3, size: 0.011 },
  { label: 'Fed', event: 'Fed Interest Rate Decision', name: 'Fed funds rate', unit: '%', expected: 3.75, previous: 4, size: 0.012 },
  { label: 'Jobs', event: 'Nonfarm Payrolls', name: 'Nonfarm Payrolls', unit: 'K', expected: 120, previous: 22, size: 0.009 },
  { label: 'PCE', event: 'Core PCE Price Index (MoM)', name: 'Core PCE MoM', unit: '%', expected: 0.2, previous: 0.3, size: 0.007 },
] as const;

/**
 * The days a month's calendar grid shows (1.3): its weeks, Monday to Sunday, so the days of the months around it that share a week
 * with it come too (the calendar's grey cells). The resolver cuts it at the calendar window.
 */
export function monthGrid(month: string): { from: string; to: string } {
  const first = `${month}-01`, last = addDays(`${addDays(`${month}-28`, 7).slice(0, 7)}-01`, -1);
  const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
  return { from: addDays(first, -((dow(first) + 6) % 7)), to: addDays(last, (7 - dow(last)) % 7) };
}

export function eventsDemo(p: EventsParams): Events { return demoOf(p, false); }

/** `own`: a month's own days only (the pieces a span is cut from). */
function demoOf(p: EventsParams, own: boolean): Events {
  if (p.scope.by === 'sector') {
    // a sector: its five largest companies' reports (here the first five demo companies) and the market's dates
    const { range, ahead } = p.scope, at = (ticker: string, kinds: EventsParams['kinds']) => demoOf({ scope: { by: 'ticker', ticker, range, ahead }, kinds }, own).items;
    const reports = p.kinds.includes('earnings') ? DEMO_COMPANIES.slice(0, 5).flatMap(([ticker, name]) => at(ticker, ['earnings']).map((e) => ({ ...e, name }) as EventItem)) : [];
    const macro = p.kinds.includes('macro') ? at('SPY', ['macro']) : [];
    return { asOf: DEMO_ASOF, normal: DEMO_NORMAL, items: [...reports, ...macro].sort(byDateThenSize) };
  }
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
  } else if (p.scope.by === 'dates' || !own) {
    // a span (or a month's grid, 1.3): each month it covers, cut to its days
    const { from, to } = p.scope.by === 'dates' ? p.scope : monthGrid(p.scope.month);
    const months: string[] = [];
    for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addDays(`${m}-28`, 7).slice(0, 7)) months.push(m);
    const all = months.flatMap((month) => demoOf({ scope: { by: 'universe', month }, kinds: p.kinds }, true).items);
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
      const moves = Array.from({ length: 8 }, () => round((o() > 0.45 ? 1 : -1) * size * (0.35 + o() * 1.3), 3));
      const actual = !out ? null : label === 'Fed' ? expected : round(expected + (o() - 0.5) * (unit === 'K' ? 60 : 0.2), unit === 'K' ? 0 : 1);
      items.push({ date, kind: 'macro', meta: { label, event, impact: 'High', headline: { name, unit, expected, previous, actual }, moves,
        move: out ? round((o() > 0.45 ? 1 : -1) * size * (0.3 + o() * 1.4), 3) : null, news: demoNews(label, event, date) } });
    });
  }
  items.sort(byDateThenSize);
  return { asOf: DEMO_ASOF, normal: DEMO_NORMAL, items };
}

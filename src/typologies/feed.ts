import * as z from 'zod/mini';
import { addDays, DEMO_ASOF, DEMO_COMPANIES, demoName, IsoDate, Num, Ticker } from './common';
import { FEED_GROUPS, FEED_IMPACTS, FEED_MAX, SECTORS, type FeedGroup, type FeedImpact } from './values';

/** A path on this site (lowercase, an optional #section): cards link only inside the site. */
const SitePath = z.string().check(z.regex(/^\/(?![/\\])[a-z0-9/#._-]*$/));

/**
 * The feed: the events around the latest session — the last 120 days and the next 60 — of one company, of a sector's companies or
 * of the market (its macro releases and SPY's signals, with the largest companies' events), each with the price move it came with.
 * At most FEED_MAX, the most relevant, in date order. Labels and sentences are templated by the platform (US English).
 */
export const FeedParams = z.object({
  scope: z.discriminatedUnion('by', [
    z.object({ by: z.literal('ticker'), ticker: Ticker }),
    z.object({ by: z.literal('sector'), sector: z.enum(SECTORS) }),
    z.object({ by: z.literal('market') }),
  ]),
});
export const FeedItem = z.object({
  date: IsoDate,
  group: z.enum(FEED_GROUPS),
  /** One of FEED_KINDS today; open, so a newer kind reaches older pages as a generic card. */
  kind: z.string().check(z.regex(/^[a-z0-9-]{1,24}$/)),
  /** The company; null for the market's own items (a macro release, SPY's signals). */
  ticker: z.nullable(Ticker), name: z.nullable(z.string()), logo: z.nullable(z.string()),
  /** One to three words ("Beat", "Golden cross"), a short detail ("EPS $1.05", "UBS") and the sentence (tooltip, indexed text). */
  label: z.string(), sub: z.nullable(z.string()), text: z.string(),
  /** A fraction; what it measures is `impactKind` (null: no number to show). */
  impact: Num, impactKind: z.nullable(z.enum(FEED_IMPACTS)),
  /** The session the impact is measured on (`day`: its move; `since`: from its close); null for coming events. */
  session: z.nullable(IsoDate),
  href: SitePath,
});
export const FeedPayload = z.object({ asOf: IsoDate, items: z.array(FeedItem).check(z.maxLength(FEED_MAX)) });
export type FeedParams = z.output<typeof FeedParams>;
export type FeedItem = z.infer<typeof FeedItem>;
export type Feed = z.infer<typeof FeedPayload>;

export const feedSamples: z.input<typeof FeedParams>[] = [
  { scope: { by: 'ticker', ticker: 'AAPL' } }, { scope: { by: 'sector', sector: 'Technology' } }, { scope: { by: 'market' } },
];

/** A kind this build has never seen, shaped like one of the market's own items. */
export function feedUnknownVariant(p: Feed): unknown {
  return { ...p, items: [...p.items, { date: p.asOf, group: 'market', kind: 'brand-new', ticker: null, name: null, logo: null, label: 'Something new',
    sub: null, text: 'Something new happened.', impact: null, impactKind: null, session: null, href: '/' }] };
}

const nameOf = (t: string) => DEMO_COMPANIES.find(([k]) => k === t)?.[1].replace(/,? (Inc\.|Corporation|Company)$/, '') ?? demoName(t);
const hub = (t: string) => `/stocks/${t.toLowerCase()}/`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const long = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
type Spec = [days: number, group: FeedGroup, kind: string, label: string, sub: string | null, impact: number | null, impactKind: FeedImpact | null, href: string, text: string];

/** One company's demo events: every group but the market's, each impact kind and a card without one, on both sides of the session. */
function companyItems(t: string, shift = 0): FeedItem[] {
  const n = nameOf(t), h = hub(t);
  const specs: Spec[] = [
    [-101, 'fundamental', 'split', 'Split', '4-for-1', null, null, `${h}#price`, `${n} split its stock 4-for-1 on %d.`],
    [-70, 'fundamental', 'earnings', 'Beat', 'EPS $1.05', 0.032, 'day', `${h}financials/`, `${n} reported EPS of $1.05 against $0.98 expected on %d; the stock moved +3.2% the next session.`],
    [-45, 'technical', 'big-move', 'Big drop', '4× usual', -0.061, 'day', `${h}#price`, `${n} fell 6.1% on %d, about 4 times its usual daily move.`],
    [-30, 'news', 'news', 'In the news', '12 stories', -0.018, 'day', `${h}news/`, `${n} had 12 stories on %d, 4 times its usual; the stock moved -1.8% that session.`],
    [-20, 'fundamental', 'upgrade', 'Upgrade', 'UBS', 0.012, 'day', `${h}price-target/`, `UBS upgraded ${n} to Buy on %d; the stock moved +1.2% that session.`],
    [-15, 'technical', 'golden-cross', 'Golden cross', 'MA50 > MA200', 0.043, 'since', `${h}#technicals`, `${n}'s 50-day average crossed above its 200-day average on %d; the stock is +4.3% since.`],
    [-5, 'technical', 'high-52w', '52-week high', '$245.10', 0.011, 'since', `${h}#technicals`, `${n} closed at a 52-week high of $245.10 on %d; it is +1.1% since.`],
    [10, 'fundamental', 'dividend', 'Ex-dividend', '$0.26', -0.004, 'expected', `${h}#price`, `${n} goes ex-dividend on %d: $0.26 a share, 0.4% of the price.`],
    [20, 'technical', 'cross-ahead', 'Death cross?', 'in ~14 sessions', null, null, `${h}#technicals`, `At the pace of the last five sessions, ${n}'s 50-day average would cross below its 200-day average in about 14 sessions.`],
    [28, 'fundamental', 'earnings', 'Earnings', 'after the close', 0.051, 'typical', `${h}financials/`, `${n} reports on %d after the close; over its last 8 reports the stock moved 5.1% on average the next session.`],
  ];
  return specs.map(([days, group, kind, label, sub, impact, impactKind, href, text]): FeedItem => {
    const date = addDays(DEMO_ASOF, days + shift);
    const session = impactKind === 'day' || impactKind === 'since' ? (kind === 'earnings' ? addDays(date, 1) : date) : null;
    return { date, group, kind, ticker: t, name: n, logo: null, label, sub, text: text.replace('%d', long(date)), impact, impactKind, session, href };
  });
}

function marketItems(): FeedItem[] {
  const m = (days: number, kind: string, label: string, sub: string | null, impact: number | null, impactKind: FeedImpact | null, href: string, text: string): FeedItem => {
    const date = addDays(DEMO_ASOF, days);
    return { date, group: 'market', kind, ticker: null, name: null, logo: null, label, sub, text: text.replace('%d', long(date)), impact, impactKind,
      session: impactKind === 'day' || impactKind === 'since' ? date : null, href };
  };
  return [
    m(-40, 'big-move', 'Market down', '4× usual', -0.021, 'day', '/#moves', 'The market (SPY) fell 2.1% on %d, about 4 times its usual daily move.'),
    m(-16, 'macro', 'CPI', 'Inflation', -0.012, 'day', '/earnings-calendar/', 'CPI (Inflation Rate YoY) came out on %d; the market (SPY) moved -1.2% that session.'),
    m(-3, 'high-52w', '52-week high', 'SPY', 0.006, 'since', '/#moves', 'The market (SPY) closed at a 52-week high on %d; it is +0.6% since.'),
    m(28, 'macro', 'Fed', 'Rate decision', 0.011, 'typical', '/earnings-calendar/', 'The Fed (Fed Interest Rate Decision) is due on %d; on its last releases the market (SPY) moved 1.1% on average that session.'),
  ];
}

const byDate = (a: FeedItem, b: FeedItem) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function feedDemo(p: FeedParams): Feed {
  const s = p.scope;
  const items = s.by === 'ticker' ? companyItems(s.ticker)
    // a sector or the market: a few companies' most telling events (earnings, big moves, news, analysts), shifted so they interleave
    : [...(s.by === 'market' ? marketItems() : []), ...(['AAPL', 'MSFT', 'NVDA', 'AMZN'] as const).flatMap((t, k) =>
      companyItems(t, k * 3 - 4).filter((i) => ['earnings', 'big-move', 'news', 'upgrade'].includes(i.kind)))];
  return { asOf: DEMO_ASOF, items: items.sort(byDate).slice(0, FEED_MAX) };
}

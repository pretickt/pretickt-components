import { level, money, num, usd } from '../ds/format';
import { MEGA_CAP } from '../typologies/values';
import type { AlertRow } from './rows';

/**
 * The conditions an alert is made of (Romeo, 2026-11-01: a badge per condition, all true together). Each is defined once: its
 * params, the sentence its card shows, the line of an event, and `test` — which the editor's preview and the platform's check both
 * run, so what the reader sees counted is what fires. Ids, params and defaults are stored in rules: change them with a migration.
 */
export type ConditionId = 'session-move' | 'price-crosses' | 'below-average' | 'ma-cross' | 'near-52w' | 'volume-spike'
  | 'pe-vs-sector' | 'undervalued' | 'analyst-upside' | 'piotroski' | 'earnings-surprise' | 'insider-buying'
  | 'news-spike' | 'earnings-soon' | 'grade-change' | 'social-buzz' | 'mega-caps' | 'sector' | 'one-stock' | 'companies';
export type Group = 'technical' | 'fundamental' | 'news' | 'social' | 'universe';
export const GROUPS: readonly (readonly [Group, string])[] = [
  ['technical', 'Technical'], ['fundamental', 'Fundamental'], ['news', 'News'], ['social', 'Social'], ['universe', 'Universe'],
];
/** When a condition's value can change: during the session (live prices, stories, results), once a day (the nightly), never. */
export type Freq = 'intraday' | 'daily' | 'fixed';
export type ChartKind = 'session' | 'average' | 'cross' | 'range' | 'versus' | 'pe' | 'target' | 'checks' | 'surprises'
  | 'insiders' | 'countdown' | 'grade' | 'logos' | 'flag';
export type Params = Record<string, string | number>;
export type ParamSpec =
  | { key: string; kind: 'number'; min: number; max: number; step: number; unit: 'pct' | 'usd' | 'price' | 'times' | 'days' | 'score' }
  | { key: string; kind: 'choice'; options: readonly (readonly [string, string])[] }
  | { key: string; kind: 'sector' } | { key: string; kind: 'ticker' }
  /** a list of tickers, kept as one string "AAPL,MSFT" (a rule's params are strings and numbers) */
  | { key: string; kind: 'tickers'; max: number };
/** A piece of a card's sentence: text, or a pill showing (and changing) one param. */
export type SayPart = string | { key: string };
export interface Test { pass: boolean; value: number | null }
export interface Condition {
  id: ConditionId; group: Group; name: string; freq: Freq; chart: ChartKind;
  /** measured on the session's own numbers (its move, volume, stories, posts): each session starts again, so the check re-arms it
   *  — an alert on it can fire every day it happens, one on a level (an average, a price, a score) only when a stock gets there */
  perSession?: true;
  params: readonly ParamSpec[]; defaults: Params;
  /** defaults that depend on the example stock (a price level near its price) */
  seed?(row: AlertRow): Params;
  say(p: Params): SayPart[];
  /** a few words for the alert's proposed name */
  short(p: Params): string;
  /** what happened, for the event's line and the email: "fell 7.9% in the session" */
  fact(p: Params, value: number | null): string;
  test(row: AlertRow, p: Params): Test;
}

const NO: Test = { pass: false, value: null };
/** a portfolio's companies at most */
export const LIST_MAX = 100;
/** A portfolio's tickers ("AAPL,MSFT" → ['AAPL', 'MSFT']; none while it is empty). */
export const listOf = (p: Params): string[] => String(p['tickers'] ?? '').split(',').filter(Boolean);
const n = (p: Params, k: string) => Number(p[k]);
const s = (p: Params, k: string) => String(p[k]);
const fixed = (v: number) => num(v, Number.isInteger(v) ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);
/** A move or a distance without its sign: 0.079 → "7.9%", 0.245 → "25%". */
export const abs = (v: number) => level(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0);
const dollars = (v: number) => (v >= 1e6 ? `$${fixed(v / 1e6)}M` : v >= 1e3 ? `$${fixed(v / 1e3)}K` : `$${fixed(v)}`);
/** A price as a price: never compacted, cents when it has them — $155, $1,234.56, $9.75. */
export const price = (v: number) => `$${num(v, Number.isInteger(v) ? 0 : 2)}`;

/** how long a report's surprise stays news: the next session, or a Friday's through Tuesday */
const REPORT_DAYS = 4;
const pct = (key: string, min: number, max: number, step: number) => ({ key, kind: 'number', min, max, step, unit: 'pct' } as const);
const times = (key: string) => ({ key, kind: 'number', min: 1.5, max: 10, step: 0.5, unit: 'times' } as const);
const choice = (key: string, options: readonly (readonly [string, string])[]) => ({ key, kind: 'choice', options } as const);
/** A price level a little under the example's, rounded as people write prices. */
const below = (price: number) => {
  const v = price * 0.95;
  return v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
};

const TECHNICAL: Condition[] = [
  {
    id: 'session-move', group: 'technical', name: 'Session move', freq: 'intraday', chart: 'session', perSession: true,
    params: [choice('dir', [['down', 'Falls'], ['up', 'Rises']]), pct('pct', 1, 20, 0.5)], defaults: { dir: 'down', pct: 5 },
    say: () => [{ key: 'dir' }, ' more than ', { key: 'pct' }, ' in one session'],
    short: (p) => `${s(p, 'dir') === 'up' ? 'Jumps' : 'Drops'} ${fixed(n(p, 'pct'))}%+`,
    fact: (_, v) => (v === null ? '' : `${v < 0 ? 'fell' : 'rose'} ${abs(v)} in the session`),
    test: (r, p) => {
      if (r.move === null) return NO;
      const t = n(p, 'pct') / 100;
      return { pass: s(p, 'dir') === 'up' ? r.move >= t - 1e-12 : r.move <= -t + 1e-12, value: r.move };
    },
  },
  {
    id: 'price-crosses', group: 'technical', name: 'Price crosses', freq: 'intraday', chart: 'session',
    params: [choice('dir', [['below', 'Trades below'], ['above', 'Trades above']]),
      { key: 'price', kind: 'number', min: 0.01, max: 100000, step: 0.01, unit: 'price' }],
    defaults: { dir: 'below', price: 100 },
    seed: (r) => ({ price: below(r.price) }),
    say: () => [{ key: 'dir' }, ' ', { key: 'price' }],
    short: (p) => `${s(p, 'dir') === 'above' ? 'Above' : 'Below'} ${price(n(p, 'price'))}`,
    fact: (_, v) => (v === null ? '' : `traded at ${money(v)}`),
    test: (r, p) => ({ pass: s(p, 'dir') === 'above' ? r.price > n(p, 'price') : r.price < n(p, 'price'), value: r.price }),
  },
  {
    id: 'below-average', group: 'technical', name: 'Below its average', freq: 'intraday', chart: 'average',
    params: [pct('pct', 1, 50, 1), choice('dir', [['below', 'below'], ['above', 'above']]),
      choice('days', [['20', '20'], ['50', '50'], ['100', '100'], ['200', '200']])],
    defaults: { dir: 'below', pct: 15, days: '50' },
    say: () => ['Trades ', { key: 'pct' }, ' ', { key: 'dir' }, ' its ', { key: 'days' }, '-day average'],
    short: (p) => `${fixed(n(p, 'pct'))}% ${s(p, 'dir') === 'above' ? 'over' : 'under'} ${s(p, 'days')}-day avg`,
    fact: (p, v) => (v === null ? '' : `trades ${abs(v)} ${v < 0 ? 'below' : 'above'} its ${s(p, 'days')}-day average`),
    test: (r, p) => {
      const ma = maOf(r, s(p, 'days'));
      if (!ma) return NO;
      const d = r.price / ma - 1, t = n(p, 'pct') / 100;
      return { pass: s(p, 'dir') === 'above' ? d >= t - 1e-12 : d <= -t + 1e-12, value: d };
    },
  },
  {
    // round 16 ("golden cross stocks" 1,000/month, "death cross stocks" 720): the state of the averages, so the check fires on the cross
    id: 'ma-cross', group: 'technical', name: 'Golden / death cross', freq: 'daily', chart: 'cross',
    params: [choice('dir', [['golden', 'above'], ['death', 'below']])], defaults: { dir: 'golden' },
    say: () => ['Its 50-day average is ', { key: 'dir' }, ' its 200-day'],
    short: (p) => (s(p, 'dir') === 'death' ? 'Death cross' : 'Golden cross'),
    fact: (p) => (s(p, 'dir') === 'death' ? 'saw its 50-day average cross below its 200-day (a death cross)'
      : 'saw its 50-day average cross above its 200-day (a golden cross)'),
    test: (r, p) => {
      if (r.ma50 === null || r.ma200 === null) return NO;
      const gap = r.ma50 / r.ma200 - 1;
      return { pass: s(p, 'dir') === 'death' ? gap < 0 : gap > 0, value: gap };
    },
  },
  {
    id: 'near-52w', group: 'technical', name: '52-week low / high', freq: 'intraday', chart: 'range',
    params: [pct('pct', 0, 10, 0.5), choice('side', [['low', 'low'], ['high', 'high']])], defaults: { side: 'low', pct: 2 },
    say: () => ['Trades within ', { key: 'pct' }, ' of its 52-week ', { key: 'side' }],
    short: (p) => `Near 52-week ${s(p, 'side') === 'high' ? 'high' : 'low'}`,
    fact: (p, v) => (v === null ? '' : `trades ${abs(v)} ${v < 0 ? 'below' : 'above'} its 52-week ${s(p, 'side')}`),
    test: (r, p) => {
      const high = s(p, 'side') === 'high', ref = high ? r.high52 : r.low52, t = n(p, 'pct') / 100;
      if (!ref) return NO;
      return { pass: high ? r.price >= ref * (1 - t) - 1e-9 : r.price <= ref * (1 + t) + 1e-9, value: r.price / ref - 1 };
    },
  },
  {
    id: 'volume-spike', group: 'technical', name: 'Volume spike', freq: 'daily', chart: 'versus', perSession: true,
    params: [times('times')], defaults: { times: 3 },
    say: () => ['Traded ', { key: 'times' }, ' its usual volume'],
    short: (p) => `Volume ${fixed(n(p, 'times'))}×`,
    fact: (_, v) => (v === null ? '' : `traded ${num(v, 1)}× its usual volume`),
    test: (r, p) => (r.volumeRatio === null ? NO : { pass: r.volumeRatio >= n(p, 'times') - 1e-12, value: r.volumeRatio }),
  },
];

/** Calendar days from one ISO date to another (the session to an earnings date). */
const daysBetween = (from: string, to: string) => {
  const t = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((t(to) - t(from)) / 86400000);
};
/** Today's count against the usual day's, with a floor of stories or posts so a quiet stock's 1 against 0.2 does not fire. */
const versus = (now: number | null, usual: number | null, times: number, floor: number): Test => {
  if (now === null || usual === null) return NO;
  return { pass: now >= Math.max(floor, times * usual) - 1e-12, value: usual > 0 ? now / usual : null };
};

const FUNDAMENTAL: Condition[] = [
  {
    id: 'pe-vs-sector', group: 'fundamental', name: 'P/E vs sector', freq: 'daily', chart: 'pe',
    params: [pct('pct', 5, 80, 5), choice('dir', [['below', 'below'], ['above', 'above']])], defaults: { dir: 'below', pct: 20 },
    say: () => ['P/E ', { key: 'pct' }, ' ', { key: 'dir' }, " its sector's"],
    short: (p) => `P/E ${fixed(n(p, 'pct'))}% ${s(p, 'dir') === 'above' ? 'over' : 'under'} sector`,
    fact: (_, v) => (v === null ? '' : `has a P/E ${abs(v)} ${v < 0 ? 'below' : 'above'} its sector's`),
    test: (r, p) => {
      if (r.peVsSector === null) return NO;
      const t = n(p, 'pct') / 100;
      return { pass: s(p, 'dir') === 'above' ? r.peVsSector >= t - 1e-12 : r.peVsSector <= -t + 1e-12, value: r.peVsSector };
    },
  },
  {
    id: 'undervalued', group: 'fundamental', name: 'Undervalued', freq: 'daily', chart: 'flag', params: [], defaults: {},
    say: () => ['Is on the undervalued list'],
    short: () => 'Undervalued',
    fact: () => 'is on the undervalued list',
    test: (r) => ({ pass: r.undervalued, value: null }),
  },
  {
    id: 'analyst-upside', group: 'fundamental', name: 'Analyst upside', freq: 'daily', chart: 'target',
    params: [pct('pct', 5, 100, 5)], defaults: { pct: 20 },
    say: () => ['Average analyst target ', { key: 'pct' }, ' above the price'],
    short: (p) => `Target +${fixed(n(p, 'pct'))}%`,
    fact: (_, v) => (v === null ? '' : `has an average analyst target ${abs(v)} ${v < 0 ? 'below' : 'above'} the price`),
    test: (r, p) => (r.ptUpside === null ? NO : { pass: r.ptUpside >= n(p, 'pct') / 100 - 1e-12, value: r.ptUpside }),
  },
  {
    id: 'piotroski', group: 'fundamental', name: 'Piotroski score', freq: 'daily', chart: 'checks',
    params: [{ key: 'score', kind: 'number', min: 0, max: 9, step: 1, unit: 'score' }, choice('side', [['high', 'or more'], ['low', 'or less']])],
    defaults: { side: 'high', score: 7 },
    say: () => ['Piotroski score ', { key: 'score' }, ' ', { key: 'side' }],
    short: (p) => `Piotroski ${s(p, 'side') === 'low' ? '≤' : '≥'}${n(p, 'score')}`,
    fact: (_, v) => (v === null ? '' : `has a Piotroski score of ${v}`),
    test: (r, p) => (r.piotroski === null ? NO
      : { pass: s(p, 'side') === 'low' ? r.piotroski <= n(p, 'score') : r.piotroski >= n(p, 'score'), value: r.piotroski }),
  },
  {
    id: 'earnings-surprise', group: 'fundamental', name: 'Earnings surprise', freq: 'intraday', chart: 'surprises',
    params: [choice('dir', [['beat', 'Beats'], ['miss', 'Misses']]), pct('pct', 1, 50, 1)], defaults: { dir: 'beat', pct: 5 },
    say: () => [{ key: 'dir' }, ' estimates by ', { key: 'pct' }],
    short: (p) => `${s(p, 'dir') === 'miss' ? 'Miss' : 'Beat'} ${fixed(n(p, 'pct'))}%+`,
    fact: (_, v) => (v === null ? '' : `${v >= 0 ? 'beat' : 'missed'} estimates by ${abs(v)}`),
    test: (r, p) => {
      const last = r.surprises?.at(-1), since = r.lastReport ? daysBetween(r.lastReport, r.session) : -1;
      // news in the days after its report only (an after-close report read the next session, a Friday's on Monday): each report once
      if (last === undefined || since < 0 || since > REPORT_DAYS) return NO;
      const t = n(p, 'pct') / 100;
      return { pass: s(p, 'dir') === 'miss' ? last <= -t + 1e-12 : last >= t - 1e-12, value: last };
    },
  },
  {
    id: 'insider-buying', group: 'fundamental', name: 'Insider buying', freq: 'daily', chart: 'insiders',
    params: [{ key: 'usd', kind: 'number', min: 100000, max: 50000000, step: 100000, unit: 'usd' }], defaults: { usd: 1000000 },
    say: () => ['Insiders bought more than ', { key: 'usd' }, ' net in 90 days'],
    short: (p) => `Insiders ${dollars(n(p, 'usd'))}+`,
    fact: (_, v) => (v === null ? '' : `saw ${dollars(v)} of net insider buying in 90 days`),
    test: (r, p) => (r.insiderNet90 === null ? NO : { pass: r.insiderNet90 >= n(p, 'usd'), value: r.insiderNet90 }),
  },
];

const NEWS: Condition[] = [
  {
    id: 'news-spike', group: 'news', name: 'News spike', freq: 'intraday', chart: 'versus', perSession: true,
    params: [times('times')], defaults: { times: 3 },
    say: () => [{ key: 'times' }, ' its usual number of stories'],
    short: (p) => `News ${fixed(n(p, 'times'))}×`,
    fact: (_, v) => (v === null ? 'had a burst of stories' : `had ${num(v, 1)}× its usual number of stories`),
    test: (r, p) => versus(r.news, r.newsUsual, n(p, 'times'), 4),
  },
  {
    id: 'earnings-soon', group: 'news', name: 'Earnings in N days', freq: 'daily', chart: 'countdown',
    params: [{ key: 'days', kind: 'number', min: 1, max: 30, step: 1, unit: 'days' }], defaults: { days: 3 },
    say: () => ['Reports earnings in ', { key: 'days' }, ' or less'],
    short: (p) => `Earnings ≤${n(p, 'days')} days`,
    fact: (_, v) => (v === null ? '' : v === 0 ? 'reports earnings today' : `reports earnings in ${v} ${v === 1 ? 'day' : 'days'}`),
    test: (r, p) => {
      if (!r.earningsDate) return NO;
      const d = daysBetween(r.session, r.earningsDate);
      return { pass: d >= 0 && d <= n(p, 'days'), value: d };
    },
  },
  {
    id: 'grade-change', group: 'news', name: 'Downgrade / Upgrade', freq: 'daily', chart: 'grade',
    params: [choice('dir', [['down', 'downgrades'], ['up', 'upgrades']])], defaults: { dir: 'down' },
    say: () => ['An analyst ', { key: 'dir' }, ' it'],
    short: (p) => (s(p, 'dir') === 'up' ? 'Upgrade' : 'Downgrade'),
    fact: (p) => `was ${s(p, 'dir') === 'up' ? 'upgraded' : 'downgraded'} by an analyst`,
    test: (r, p) => (r.grade === null ? NO : { pass: r.grade.dir === s(p, 'dir') && r.grade.date === r.session, value: null }),
  },
];

const SOCIAL: Condition[] = [
  {
    id: 'social-buzz', group: 'social', name: 'Talked about on Reddit/X', freq: 'daily', chart: 'versus', perSession: true,
    params: [times('times')], defaults: { times: 3 },
    say: () => [{ key: 'times' }, ' its usual posts on Reddit and X'],
    short: (p) => `Social ${fixed(n(p, 'times'))}×`,
    fact: (_, v) => (v === null ? 'was talked about on Reddit and X' : `was talked about ${num(v, 1)}× more than usual on Reddit and X`),
    test: (r, p) => versus(r.social, r.socialUsual, n(p, 'times'), 10),
  },
];

const UNIVERSE: Condition[] = [
  {
    id: 'mega-caps', group: 'universe', name: 'Mega caps', freq: 'daily', chart: 'logos', params: [], defaults: {},
    say: () => ['Is a mega cap, over $200B'],
    short: () => 'Mega caps',
    fact: (_, v) => (v === null ? '' : `is a mega cap (${usd(v, { compact: true })})`),
    test: (r) => (r.marketCap === null ? NO : { pass: r.marketCap >= MEGA_CAP, value: r.marketCap }),
  },
  {
    id: 'sector', group: 'universe', name: 'Sector', freq: 'fixed', chart: 'logos',
    params: [{ key: 'sector', kind: 'sector' }], defaults: { sector: 'Technology' },
    say: () => ['Is in ', { key: 'sector' }],
    short: (p) => s(p, 'sector'),
    fact: () => '',
    test: (r, p) => (r.sector === null ? NO : { pass: r.sector === s(p, 'sector'), value: null }),
  },
  {
    id: 'one-stock', group: 'universe', name: 'One stock', freq: 'fixed', chart: 'logos',
    params: [{ key: 'ticker', kind: 'ticker' }], defaults: { ticker: 'NVDA' },
    say: () => ['Is ', { key: 'ticker' }],
    short: (p) => s(p, 'ticker'),
    fact: () => '',
    test: (r, p) => ({ pass: r.ticker === s(p, 'ticker'), value: null }),
  },
  {
    // the reader's own list (Romeo, 2026-11-02): pasted, typed, or a universe card edited company by company or group by group
    id: 'companies', group: 'universe', name: 'My portfolio', freq: 'fixed', chart: 'logos',
    params: [{ key: 'tickers', kind: 'tickers', max: LIST_MAX }], defaults: { tickers: '' },
    say: () => ['Is one of ', { key: 'tickers' }],
    short: (p) => { const l = listOf(p); return l.length === 1 ? l[0]! : 'My portfolio'; },
    fact: () => '',
    test: (r, p) => ({ pass: listOf(p).includes(r.ticker), value: null }),
  },
];

function maOf(r: AlertRow, days: string): number | null {
  const ma = days === '20' ? r.ma20 : days === '100' ? r.ma100 : days === '200' ? r.ma200 : r.ma50;
  return ma && ma > 0 ? ma : null;
}

const ALL: Condition[] = [...TECHNICAL, ...FUNDAMENTAL, ...NEWS, ...SOCIAL, ...UNIVERSE];
export const CONDITIONS = Object.fromEntries(ALL.map((c) => [c.id, c])) as Record<ConditionId, Condition>;
export const CONDITION_IDS: readonly ConditionId[] = ALL.map((c) => c.id);

/** A pill's text: 5 → "5%", 3 → "3×", 1000000 → "$1M", 'down' → "Falls". */
export function pillText(spec: ParamSpec, v: string | number): string {
  if (spec.kind === 'choice') return spec.options.find(([o]) => o === String(v))?.[1] ?? String(v);
  if (spec.kind === 'tickers') { const k = String(v).split(',').filter(Boolean).length; return `${k} ${k === 1 ? 'company' : 'companies'}`; }
  if (spec.kind !== 'number') return String(v);
  const x = Number(v);
  switch (spec.unit) {
    case 'pct': return `${fixed(x)}%`;
    case 'times': return `${fixed(x)}×`;
    case 'usd': return dollars(x);
    case 'price': return price(x);
    case 'days': return `${fixed(x)} ${x === 1 ? 'day' : 'days'}`;
    default: return fixed(x);
  }
}

/** A condition's sentence as text: "Falls more than 5% in one session". */
export function sentence(id: ConditionId, p: Params): string {
  const c = CONDITIONS[id];
  return c.say(p).map((part) => {
    if (typeof part === 'string') return part;
    const spec = c.params.find((x) => x.key === part.key);
    return spec ? pillText(spec, p[part.key] ?? c.defaults[part.key] ?? '') : '';
  }).join('');
}

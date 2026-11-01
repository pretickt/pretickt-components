import { level, money, num, usd } from '../ds/format';
import { MEGA_CAP } from '../typologies/values';
import type { AlertRow } from './rows';

/**
 * The conditions an alert is made of (Romeo, 2026-11-01: a badge per condition, all true together). Each is defined once: its
 * params, the sentence its card shows, the line of an event, and `test` — which the editor's preview and the platform's check both
 * run, so what the reader sees counted is what fires. Ids, params and defaults are stored in rules: change them with a migration.
 */
export type ConditionId = 'session-move' | 'price-crosses' | 'below-average' | 'near-52w' | 'volume-spike'
  | 'pe-vs-sector' | 'undervalued' | 'analyst-upside' | 'piotroski' | 'earnings-surprise' | 'insider-buying'
  | 'news-spike' | 'earnings-soon' | 'grade-change' | 'social-buzz' | 'mega-caps' | 'sector' | 'one-stock';
export type Group = 'technical' | 'fundamental' | 'news' | 'social' | 'universe';
export const GROUPS: readonly (readonly [Group, string])[] = [
  ['technical', 'Technical'], ['fundamental', 'Fundamental'], ['news', 'News'], ['social', 'Social'], ['universe', 'Universe'],
];
/** When a condition's value can change: during the session (live prices, stories, results), once a day (the nightly), never. */
export type Freq = 'intraday' | 'daily' | 'fixed';
export type ChartKind = 'session' | 'average' | 'range' | 'versus' | 'pe' | 'target' | 'checks' | 'surprises'
  | 'insiders' | 'countdown' | 'grade' | 'logos' | 'flag';
export type Params = Record<string, string | number>;
export type ParamSpec =
  | { key: string; kind: 'number'; min: number; max: number; step: number; unit: 'pct' | 'usd' | 'times' | 'days' | 'score' }
  | { key: string; kind: 'choice'; options: readonly (readonly [string, string])[] }
  | { key: string; kind: 'sector' } | { key: string; kind: 'ticker' };
/** A piece of a card's sentence: text, or a pill showing (and changing) one param. */
export type SayPart = string | { key: string };
export interface Test { pass: boolean; value: number | null }
export interface Condition {
  id: ConditionId; group: Group; name: string; freq: Freq; chart: ChartKind;
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
const n = (p: Params, k: string) => Number(p[k]);
const s = (p: Params, k: string) => String(p[k]);
const fixed = (v: number) => num(v, Number.isInteger(v) ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);
/** A move or a distance without its sign: 0.079 → "7.9%", 0.245 → "25%". */
export const abs = (v: number) => level(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0);
const dollars = (v: number) => (v >= 1e6 ? `$${fixed(v / 1e6)}M` : v >= 1e3 ? `$${fixed(v / 1e3)}K` : `$${fixed(v)}`);

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
    id: 'session-move', group: 'technical', name: 'Session move', freq: 'intraday', chart: 'session',
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
      { key: 'price', kind: 'number', min: 0.01, max: 100000, step: 0.01, unit: 'usd' }],
    defaults: { dir: 'below', price: 100 },
    seed: (r) => ({ price: below(r.price) }),
    say: () => [{ key: 'dir' }, ' ', { key: 'price' }],
    short: (p) => `${s(p, 'dir') === 'above' ? 'Above' : 'Below'} ${dollars(n(p, 'price'))}`,
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
    id: 'volume-spike', group: 'technical', name: 'Volume spike', freq: 'daily', chart: 'versus',
    params: [times('times')], defaults: { times: 3 },
    say: () => ['Traded ', { key: 'times' }, ' its usual volume'],
    short: (p) => `Volume ${fixed(n(p, 'times'))}×`,
    fact: (_, v) => (v === null ? '' : `traded ${num(v, 1)}× its usual volume`),
    test: (r, p) => (r.volumeRatio === null ? NO : { pass: r.volumeRatio >= n(p, 'times') - 1e-12, value: r.volumeRatio }),
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
];

function maOf(r: AlertRow, days: string): number | null {
  const ma = days === '20' ? r.ma20 : days === '100' ? r.ma100 : days === '200' ? r.ma200 : r.ma50;
  return ma && ma > 0 ? ma : null;
}

const ALL: Condition[] = [...TECHNICAL, ...UNIVERSE];
export const CONDITIONS = Object.fromEntries(ALL.map((c) => [c.id, c])) as Record<ConditionId, Condition>;
export const CONDITION_IDS: readonly ConditionId[] = ALL.map((c) => c.id);

/** A pill's text: 5 → "5%", 3 → "3×", 1000000 → "$1M", 'down' → "Falls". */
export function pillText(spec: ParamSpec, v: string | number): string {
  if (spec.kind === 'choice') return spec.options.find(([o]) => o === String(v))?.[1] ?? String(v);
  if (spec.kind !== 'number') return String(v);
  const x = Number(v);
  switch (spec.unit) {
    case 'pct': return `${fixed(x)}%`;
    case 'times': return `${fixed(x)}×`;
    case 'usd': return dollars(x);
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

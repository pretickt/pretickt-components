/**
 * Made-up data for the earnings-calendar outlook draft: October 2026 as the calendar shows it on the evening of Tuesday Oct 27 (the
 * last session's close). The reports up to then carry what the stock did, the rest what it usually does. Real tickers and the site's
 * logo files, invented numbers: each usual move is the average of the eight reactions listed with it, MSFT, UPS and the Fed by hand,
 * the others drawn from a seed around a plausible size. A company's peers this season are the calendar's own reports in its sector
 * (MSFT's by hand); Polymarket odds only for the largest names and the Fed, Lilly's too thin to show.
 */
import { addDays } from '../pt-calendar';
import { co } from './mock';
import type { Analysts, CalOutlook, CoEvent, MacroEvent, Odds, PeerMove, Reaction, Verdict } from './pt-cal-outlook';

const ASOF = '2026-10-27';
/** A seeded draw in [0, 1): the same numbers on every build (the typologies' own prng is not in the browser entry). */
function prng(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const EXTRA: Record<string, string> = { ACN: 'Accenture', PEP: 'PepsiCo', DAL: 'Delta Air Lines', JNJ: 'Johnson & Johnson', ABT: 'Abbott' };
const who = (t: string) => ({ ...co(t), ...(EXTRA[t] ? { name: EXTRA[t] } : {}) });
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Eight quarterly reactions before `date`, sized around `u` with the ticker's seed, and their verdicts. */
function history(t: string, date: string, u: number): Reaction[] {
  const r = prng(`${t}:outlook`);
  return Array.from({ length: 8 }, (_, i) => {
    const size = u * (0.35 + r() * 1.3), sign = r() > 0.42 ? 1 : -1, v = r();
    return { date: addDays(date, -91 * (8 - i)), move: r3(sign * size), verdict: (v < 0.66 ? 'beat' : v < 0.84 ? 'inline' : 'miss') as Verdict };
  });
}
const hand = (date: string, rows: [number, Verdict][]): Reaction[] => rows.map(([move, verdict], i) => ({ date: addDays(date, -91 * (rows.length - i)), move, verdict }));

/** [ticker, date, time, price, market value ($B), usual size, result: [move (null: not traded yet), EPS surprise] | null, confirmed]. */
type Row = [string, string, 'bmo' | 'amc', number, number, number, [number | null, number] | null, boolean?];
const ROWS: Row[] = [
  ['ACN', '2026-10-01', 'bmo', 248, 155, 0.045, [-0.031, 0.012]], ['NKE', '2026-10-01', 'amc', 74.2, 110, 0.075, [0.064, 0.18]],
  ['PEP', '2026-10-08', 'bmo', 151, 207, 0.025, [0.014, 0.03]], ['DAL', '2026-10-09', 'bmo', 58.3, 38, 0.048, [0.042, 0.05]],
  ['JPM', '2026-10-13', 'bmo', 302, 830, 0.025, [-0.009, 0.06]], ['WFC', '2026-10-13', 'bmo', 84.6, 270, 0.035, [0.027, 0.04]],
  ['C', '2026-10-13', 'bmo', 101, 185, 0.035, [0.018, 0.08]], ['JNJ', '2026-10-13', 'bmo', 192, 462, 0.022, [0.011, 0.02]],
  ['BAC', '2026-10-14', 'bmo', 51.2, 380, 0.03, [0.006, 0.03]], ['MS', '2026-10-14', 'bmo', 158, 255, 0.035, [0.046, 0.11]],
  ['ABT', '2026-10-14', 'bmo', 129, 225, 0.03, [-0.024, 0.01]], ['GS', '2026-10-14', 'bmo', 774, 236, 0.03, [0.012, 0.07]],
  ['RTX', '2026-10-20', 'bmo', 171, 228, 0.035, [0.029, 0.27]], ['GE', '2026-10-20', 'bmo', 296, 314, 0.045, [0.038, 0.12]],
  ['NFLX', '2026-10-20', 'amc', 1185, 503, 0.075, [-0.052, 0.06]], ['TSLA', '2026-10-21', 'amc', 438, 1410, 0.085, [0.031, 0.05]],
  ['TXN', '2026-10-21', 'amc', 188, 171, 0.06, [-0.071, 0.07]], ['META', '2026-10-21', 'amc', 712, 1790, 0.085, [-0.058, 0.04]],
  ['PG', '2026-10-22', 'bmo', 158, 371, 0.025, [0.008, 0.06]], ['AXP', '2026-10-23', 'bmo', 352, 245, 0.04, [0.022, 0.04]],
  ['VZ', '2026-10-26', 'bmo', 41.2, 173, 0.031, [-0.024, -0.015]], ['BA', '2026-10-27', 'bmo', 214, 162, 0.035, [0.039, 0.4]],
  ['RCL', '2026-10-27', 'bmo', 268, 72, 0.065, [0.086, 0.042]], ['KO', '2026-10-27', 'bmo', 70.4, 303, 0.021, [0.011, 0.011]],
  ['V', '2026-10-27', 'amc', 345, 670, 0.032, [null, 0.023]],
  ['GOOGL', '2026-10-28', 'amc', 262, 3170, 0.062, null], ['AAPL', '2026-10-29', 'amc', 262, 3890, 0.038, null],
  ['AMZN', '2026-10-29', 'amc', 226, 2410, 0.068, null], ['LLY', '2026-10-29', 'bmo', 815, 772, 0.055, null],
  ['MRK', '2026-10-29', 'bmo', 86.1, 216, 0.035, null], ['CAT', '2026-10-29', 'bmo', 512, 241, 0.045, null],
  ['XOM', '2026-10-30', 'bmo', 117, 497, 0.022, null], ['CVX', '2026-10-30', 'bmo', 158, 276, 0.025, null, false],
];

/** The sector each name is in, for its peers this season. */
const SECTOR: Record<string, string> = {
  ACN: 'tech', TXN: 'tech', MSFT: 'tech', AAPL: 'tech', META: 'comm', NFLX: 'comm', GOOGL: 'comm', VZ: 'comm',
  NKE: 'cyclical', TSLA: 'cyclical', AMZN: 'cyclical', RCL: 'cyclical', JPM: 'fin', WFC: 'fin', C: 'fin', BAC: 'fin', MS: 'fin', GS: 'fin',
  AXP: 'fin', V: 'fin', JNJ: 'health', ABT: 'health', LLY: 'health', MRK: 'health', DAL: 'ind', RTX: 'ind', GE: 'ind', BA: 'ind', UPS: 'ind',
  CAT: 'ind', PEP: 'staples', PG: 'staples', KO: 'staples', XOM: 'energy', CVX: 'energy',
};
/** The calendar's reports in `t`'s sector traded before `date` (and by the evening of the 27th). */
const peersOf = (t: string, date: string): PeerMove[] => ROWS
  .filter(([p, d, , , , , res]) => p !== t && SECTOR[p] === SECTOR[t] && d < date && d <= ASOF && res?.[0] != null)
  .map(([ticker, d, , , , , res]) => ({ ticker, date: d, move: res![0]! }));
/** Analysts' average target a little above the price, a seeded count and the last 30 days' raises and cuts. */
function analysts(t: string, price: number): Analysts {
  const r = prng(`${t}:analysts`), target = price * (1.03 + r() * 0.17);
  return { target: target >= 100 ? Math.round(target) : r2(target), n: 14 + Math.floor(r() * 34), raised: Math.floor(r() * 7), cut: Math.floor(r() * 3) };
}
const BEAT = 'EPS above the estimate';
/** Polymarket's price of a beat and the dollars traded (these markets are thin: a few thousand dollars, the largest around $13K in
 *  October 2026), Lilly's too thin to show. */
const ODDS: Record<string, [number, number]> = {
  GOOGL: [0.79, 9_400], AAPL: [0.86, 11_200], AMZN: [0.74, 6_800], LLY: [0.81, 1_200], META: [0.8, 8_900], TSLA: [0.55, 10_600], NFLX: [0.77, 5_300],
};
const odds = (t: string): Odds | null => (ODDS[t] ? { what: BEAT, p: ODDS[t]![0], volume: ODDS[t]![1] } : null);

/** A quarter's revenue estimate, $B (about the companies' real size, so the card reads plausibly). */
const REV: Record<string, number> = {
  ACN: 17.6, NKE: 11.7, PEP: 23.9, DAL: 15.9, JPM: 46, WFC: 21, C: 21.5, JNJ: 23.5, BAC: 27.5, MS: 17.5, ABT: 11.4, GS: 15, RTX: 21.5, GE: 11.5,
  NFLX: 11.5, TSLA: 26, TXN: 4.6, META: 50, PG: 22, AXP: 18, VZ: 34, BA: 23, RCL: 5.2, KO: 12.4, V: 10.7, GOOGL: 100, AAPL: 102, AMZN: 178,
  LLY: 16, MRK: 16.3, CAT: 16.8, XOM: 85, CVX: 50,
};

function company([t, date, time, price, cap, u, res, confirmed = true]: Row): CoEvent {
  const r = prng(`${t}:bar`);
  const epsEst = r2(price / (4 * (18 + r() * 14))), revEst = (REV[t] ?? cap / 20) * 1e9;
  const eps = t === 'BA' ? -0.2 : epsEst;
  return { kind: 'earnings', date, ...who(t), time, confirmed, price, mcap: cap * 1e9, reactions: history(t, date, u),
    epsEst: eps, epsYearAgo: r2(eps / (1 + (-0.08 + r() * 0.38))), revEst, revYearAgo: Math.round(revEst / (1 + (-0.03 + r() * 0.23)) / 1e8) * 1e8,
    runup: r3(-0.08 + r() * 0.18), marketRunup: 0.018,
    result: res ? { move: res[0], epsActual: r2(eps + res[1] * Math.abs(eps)), revActual: Math.round((revEst * (1 + res[1] / 3)) / 1e8) * 1e8 } : null,
    analysts: analysts(t, price), peers: peersOf(t, date), odds: odds(t) };
}

/** Microsoft the day before its report: beat 7 of 8, rose after 5, a usual move of 4.7% (37.5 / 8); its software peers this season
 *  rose after 2 of 4 reports, by 5.6% on average either way (22.4 / 4). */
export const MSFT: CoEvent = { kind: 'earnings', date: '2026-10-28', ...who('MSFT'), time: 'amc', confirmed: true, price: 522.4, mcap: 3.88e12,
  reactions: hand('2026-10-28', [[0.042, 'beat'], [-0.061, 'beat'], [0.018, 'beat'], [0.075, 'beat'], [-0.039, 'miss'], [0.045, 'beat'], [0.083, 'beat'], [-0.012, 'beat']]),
  epsEst: 3.68, epsYearAgo: 3.3, revEst: 77.4e9, revYearAgo: 65.6e9, runup: 0.062, marketRunup: 0.018, result: null,
  analysts: { target: 625, n: 52, raised: 9, cut: 1 },
  peers: [{ ticker: 'IBM', date: '2026-10-21', move: -0.054 }, { ticker: 'META', date: '2026-10-21', move: -0.058 },
    { ticker: 'NOW', date: '2026-10-22', move: 0.081 }, { ticker: 'SAP', date: '2026-10-22', move: 0.031 }],
  odds: { what: BEAT, p: 0.83, volume: 12_000 } };

/** UPS this morning: a beat (+4.3%) and the stock down 6.8%, 1.2 times its usual 5.8% (46.4 / 8). */
export const UPS: CoEvent = { kind: 'earnings', date: '2026-10-27', ...who('UPS'), time: 'bmo', confirmed: true, price: 131.5, mcap: 112e9,
  reactions: hand('2026-10-27', [[-0.081, 'miss'], [0.035, 'beat'], [-0.052, 'inline'], [0.024, 'beat'], [-0.143, 'miss'], [0.041, 'beat'], [-0.028, 'beat'], [0.06, 'beat']]),
  epsEst: 1.64, epsYearAgo: 1.76, revEst: 22.1e9, revYearAgo: 22.2e9, runup: -0.034, marketRunup: 0.018,
  result: { move: -0.068, epsActual: 1.71, revActual: 22.4e9 }, analysts: analysts('UPS', 131.5), peers: peersOf('UPS', '2026-10-27'), odds: null };

const NORMAL = 0.0068;
const releases = (label: string, date: string, u: number) => {
  const r = prng(`${label}:spy`);
  return Array.from({ length: 8 }, (_, i) => ({ date: addDays(date, -45 * (8 - i)), move: r3((r() > 0.45 ? 1 : -1) * u * (0.35 + r() * 1.3)) }));
};
const macro = (date: string, label: string, event: string, u: number, expected: string | null, previous: string | null,
  result: MacroEvent['result'] = null): MacroEvent => ({ kind: 'macro', date, label, event, moves: releases(label, date, u), expected, previous, result, odds: null });

/** The Fed tomorrow: the market's usual move on the last eight decisions is 1.2% (9.8 / 8), 1.8 times a normal day; Polymarket prices
 *  the quarter-point cut at 94%. */
export const FED: MacroEvent = { kind: 'macro', date: '2026-10-28', label: 'Fed', event: 'Fed Interest Rate Decision',
  moves: [0.011, -0.016, 0.009, 0.012, -0.007, 0.014, -0.021, 0.008].map((move, i) => ({ date: addDays('2026-10-28', -45 * (8 - i)), move })),
  expected: '3.50%', previous: '3.75%', result: null, odds: { what: 'a 0.25-point cut', p: 0.94, volume: 5.2e6 } };
const MACRO: MacroEvent[] = [
  macro('2026-10-02', 'Jobs', 'Nonfarm Payrolls (Sep) · Unemployment Rate (Sep)', 0.009, '120K', '22K', { move: 0.004, actual: '142K' }),
  macro('2026-10-07', 'FOMC', 'FOMC Minutes', 0.005, null, null, { move: -0.003, actual: null }),
  macro('2026-10-14', 'CPI', 'Inflation Rate YoY (Sep)', 0.011, '2.8%', '2.9%', { move: -0.012, actual: '2.9%' }),
  FED,
  macro('2026-10-29', 'GDP', 'GDP Growth Rate QoQ Adv (Q3)', 0.006, '1.8%', '2.1%'),
  macro('2026-10-30', 'PCE', 'Core PCE Price Index MoM (Sep)', 0.007, '0.2%', '0.3%'),
];

const ALL = [...ROWS.map(company), MSFT, UPS, ...MACRO];
/** The month page: October 2026 on the evening of the 27th. */
export const OCTOBER: CalOutlook = { asOf: ASOF, from: '2026-10-01', to: '2026-10-31', normal: NORMAL, items: ALL };
/** The home's week: Monday Oct 26 to Friday Oct 30. */
export const WEEK: CalOutlook = { ...OCTOBER, from: '2026-10-26', to: '2026-10-30', items: ALL.filter((e) => e.date >= '2026-10-26' && e.date <= '2026-10-30') };
export const V_TONIGHT = ALL.find((e): e is CoEvent => e.kind === 'earnings' && e.ticker === 'V')!;
export const KO = ALL.find((e): e is CoEvent => e.kind === 'earnings' && e.ticker === 'KO')!;
export const CPI = MACRO[2]!;
export const NORMAL_DAY = NORMAL;

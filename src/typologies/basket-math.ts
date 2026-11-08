import type { BasketConsensus, BasketHolding, BasketMover, BasketPe, BasketQuestion, BasketTarget } from './basket';
import { oneMover } from './basket-words';
import type { ValueKey, ValueTone } from './value';
import { BASKET_MOVER_MIN, BASKET_MOVERS, FRAGILITY_NOT_READ, VALUE_KEYS } from './values';

/**
 * A basket's figures from its companies and their weights: one implementation for the nightly (a fund, a sector) and the portfolio page (a
 * reader's holdings, computed in the browser — design 2026-11-07, Part B). Pure and zod-free: the browser entry exports it.
 */

/** What the site already knows about a company in a basket: its stored numbers, never recomputed here. */
export interface BasketFacts {
  ticker: string; name: string; logo: string | null; sector: string | null; close: number | null; ret: number | null;
  /** The company's pt_upside and how many firms it rests on. */
  upside: number | null; firms: number;
  consensus: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
  pe: number | null; nextEarnings: string | null;
  /** Its pt-value questions' tones; a card hidden by the public checks is already out of them. */
  sections: Partial<Record<ValueKey, ValueTone>> | null;
  headline: { title: string; url: string } | null;
  /** The sentiment of its stories in the last session, newest first. */
  news: (number | null)[];
  /** The ratios of its recent splits (3 for 3:1), when a fund's file may still be on the old basis. */
  splits?: readonly number[];
  /** Its SEC number: a company's share classes (GOOGL and GOOG) share it. */
  cik?: string | null;
}
/** A company of the basket with its weight: a fund's covered holding, a sector's company, a reader's holding. */
export interface BasketLine { ticker: string; f: BasketFacts; weight: number }

/** A company's target counts with at least this many firms behind it (design 2026-11-05). */
export const MIN_FIRMS = 3;
/** Under this share of the covered weight a question has no reading for, it is not comparable. */
export const QUESTION_MIN = 0.5;
const CONSENSUS = [[4.5, 'Strong Buy'], [3.5, 'Buy'], [2.5, 'Hold'], [1.5, 'Sell'], [-Infinity, 'Strong Sell']] as const;

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const toShare = (v: number) => round(Math.max(0, Math.min(1, v)), 4);
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length / 2; return s.length % 2 ? s[Math.floor(m)]! : (s[m - 1]! + s[m]!) / 2; };

/** The analysts' counts read as the company badge's label (a score from 1 to 5); null with no rating. */
export function consensusOf(c: NonNullable<BasketFacts['consensus']>): { n: number; label: string } | null {
  const n = c.strongBuy + c.buy + c.hold + c.sell + c.strongSell;
  if (!n) return null;
  const score = (5 * c.strongBuy + 4 * c.buy + 3 * c.hold + 2 * c.sell + c.strongSell) / n;
  return { n, label: CONSENSUS.find(([min]) => score >= min)![1] };
}

/** The sum of the analysts' counts: a company with two share classes carries one set of analysts, so its name counts once. */
export function sumConsensus(lines: readonly BasketLine[]) {
  const seen = new Set<string>(), sum = { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 };
  let share = 0;
  for (const l of lines) {
    const c = l.f.consensus;
    if (!c) continue;
    share += l.weight;
    if (seen.has(l.f.name)) continue;
    seen.add(l.f.name);
    for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += c[k];
  }
  return { sum, share };
}

/**
 * What analysts' targets add up to over the basket: the companies with at least 3 firms behind their target, weighted; `price` is what they would put
 * the basket's `base` at (a fund's close, a sector's value), the median the plain median of those companies, `top` the three largest contributors.
 */
export function basketTarget(lines: readonly BasketLine[], base: number): BasketTarget | null {
  const targeted = lines.filter((l) => l.f.upside != null && l.f.firms >= MIN_FIRMS);
  const tw = targeted.reduce((s, l) => s + l.weight, 0);
  const upside = tw > 0 ? targeted.reduce((s, l) => s + l.weight * l.f.upside!, 0) / tw : null;
  return upside == null ? null : {
    upside: round(round(base * (1 + upside), 2) / base - 1, 6), price: round(base * (1 + upside), 2), share: toShare(tw), median: round(median(targeted.map((l) => l.f.upside!)), 4),
    top: oneMover(targeted.map((l) => ({ ticker: l.ticker, name: l.f.name, logo: l.f.logo, weight: l.weight, ret: l.f.upside!, points: l.weight * l.f.upside! / tw }))).sort((a, b) => b.points - a.points).slice(0, 3)
      .map((c) => ({ ticker: c.ticker, name: c.name, logo: c.logo, weight: round(c.weight, 5), upside: round(c.points * tw / c.weight, 4), points: round(c.points, 5) })),
  };
}
/** The ratings summed, unweighted, each company once; the label as the company badge's rule; `share` the weight with ratings. */
export function basketConsensus(lines: readonly BasketLine[]): BasketConsensus | null {
  const { sum, share } = sumConsensus(lines), read = consensusOf(sum);
  return read ? { buy: toShare((sum.strongBuy + sum.buy) / read.n), hold: toShare(sum.hold / read.n), sell: toShare((sum.sell + sum.strongSell) / read.n), n: read.n, label: read.label, share: toShare(share) } : null;
}
/** The weighted harmonic mean over positive P/E: a company with losses is left out of it and of its share. */
export function basketPe(lines: readonly BasketLine[]): BasketPe | null {
  const earning = lines.filter((l) => l.f.pe != null && l.f.pe > 0);
  const ew = earning.reduce((s, l) => s + l.weight, 0);
  return ew > 0 ? { value: round(ew / earning.reduce((s, l) => s + l.weight / l.f.pe!, 0), 2), share: toShare(ew) } : null;
}
/**
 * Each question: the covered weight with each tone over the companies with that section. Fragility leaves out utilities and real estate (the Altman
 * score behind it reads their normal debt as distress; XLU read 77% red on 2026-11-06). Under half the covered weight read, or named in `notComparable`
 * (a sector whose business the rule does not read), it is not comparable.
 */
export function basketQuestions(lines: readonly BasketLine[], coverage: number, notComparable: readonly ValueKey[] = []): BasketQuestion[] {
  return VALUE_KEYS.map((key) => {
    const tally = { pos: 0, flat: 0, neg: 0 };
    for (const l of lines) {
      const tone = l.f.sections?.[key];
      if (!tone || tone === 'na' || (key === 'fragility' && (FRAGILITY_NOT_READ as readonly string[]).includes(l.f.sector ?? ''))) continue;
      tally[tone] += l.weight;
    }
    const base = tally.pos + tally.flat + tally.neg, comparable = coverage > 0 && base / coverage >= QUESTION_MIN && !notComparable.includes(key);
    return { key, pos: comparable ? toShare(tally.pos / base) : 0, flat: comparable ? toShare(tally.flat / base) : 0, neg: comparable ? toShare(tally.neg / base) : 0, share: toShare(base), comparable };
  });
}
/** A company's row of the holdings list. */
export function holdingOf(l: BasketLine): BasketHolding {
  return { ticker: l.ticker, name: l.f.name, logo: l.f.logo, weight: round(l.weight, 5), ret: l.f.ret == null ? null : round(l.f.ret, 5), upside: l.f.upside == null ? null : round(l.f.upside, 4),
    label: l.f.consensus ? consensusOf(l.f.consensus)?.label ?? null : null };
}

/** A holding valued tonight, with its move on the day (null: no move). */
export interface ValueItem { ticker: string; name: string; logo: string | null; value: number; ret: number | null; headline: { title: string; url: string } | null }
/**
 * Why a basket valued company by company moved (a sector, a reader's holdings): the day's move from yesterday's values, exact as the sum of the companies'
 * points; five a side over BASKET_MOVER_MIN, largest first. No company with a move: no move.
 */
export function valueMoves(items: readonly ValueItem[]): { ret: number | null; up: BasketMover[]; down: BasketMover[] } {
  const moving = items.filter((x) => x.ret != null && x.ret > -1);
  const prevTotal = moving.reduce((s, x) => s + x.value / (1 + x.ret!), 0);
  const movers = prevTotal > 0 ? oneMover(moving.map((x): BasketMover => {
    const prev = x.value / (1 + x.ret!);
    return { ticker: x.ticker, name: x.name, logo: x.logo, weight: prev / prevTotal, ret: x.ret!, points: (x.value - prev) / prevTotal, headline: x.headline };
  })) : [];
  const pick = (list: BasketMover[]) => list.slice(0, BASKET_MOVERS).map((m) => ({ ...m, weight: round(m.weight, 6), ret: round(m.ret, 6), points: round(m.points, 6) }));
  return {
    ret: movers.length ? round(movers.reduce((s, m) => s + m.points, 0), 6) : null,
    up: pick(movers.filter((m) => m.points >= BASKET_MOVER_MIN).sort((a, b) => b.points - a.points)),
    down: pick(movers.filter((m) => m.points <= -BASKET_MOVER_MIN).sort((a, b) => a.points - b.points)),
  };
}

import * as z from 'zod/mini';
import { addDays, cmp, DEMO_ASOF, DEMO_COMPANIES, IsoDate, Num, prng, round, Ticker } from './common';
import { MARKET_TRENDS, MOVE_SORTS, MOVES_PER_SIDE, MOVES_THRESHOLD, type MoveSort } from './values';

/**
 * The companies in a move of more than 4% that is still running (beta's threshold zigzag: no reversal of 4% since it started), split
 * by this week's move — losers and gainers — and ranked by market cap or by the size of the week's move (the home's chart). Computed
 * every night; fractions throughout.
 */
export const OngoingMovesParams = z.object({ sort: z._default(z.enum(MOVE_SORTS), 'cap') });
export const MovePeer = z.object({ ticker: Ticker, move: z.number() });
export const OngoingMoveRow = z.object({
  ticker: Ticker, name: z.string(), logo: z.nullable(z.string()), marketCap: Num,
  /** The ongoing swing: its direction, start (`since`), calendar length and size. */
  kind: z.enum(['rally', 'drawdown']), since: IsoDate, days: z.int(), move: z.number(),
  /** The last close (adjusted). */
  close: z.number(),
  /** Last close against the first close on or after the last session minus 7 / 30 / 90 calendar days. */
  week: Num, month: Num, quarter: Num,
  /** Present when the company's industry moves the same way (its median since the move started, the three largest movers). */
  industry: z.nullable(z.object({ median: z.number(), peers: z.array(MovePeer) })),
});
export const OngoingMovesPayload = z.object({
  asOf: IsoDate,
  /** The size a move needs to count (and the reversal that ends it). */
  threshold: z.number(),
  /** SPY's structural trend; null when unknown. */
  market: z.nullable(z.enum(MARKET_TRENDS)),
  /** This week's losers then its gainers, each most important first, at most MOVES_PER_SIDE a side. */
  rows: z.array(OngoingMoveRow),
});
export type OngoingMovesParams = z.output<typeof OngoingMovesParams>;
export type OngoingMoveRow = z.infer<typeof OngoingMoveRow>;
export type OngoingMoves = z.infer<typeof OngoingMovesPayload>;

export const ongoingMovesSamples: z.input<typeof OngoingMovesParams>[] = [{}, { sort: 'move' }];

/**
 * The rows a chart draws, in order: this week's losers (`week < 0`) then its gainers (a flat week is a gainer), each most important
 * first — by market cap (unknown last) or by the size of the week's move — ties by ticker; at most `perSide` a side, rows without a
 * week dropped. The resolver orders the same way in SQL.
 */
export function rankMoves<R extends Pick<OngoingMoveRow, 'ticker' | 'marketCap' | 'week'>>(rows: readonly R[], sort: MoveSort, perSide = MOVES_PER_SIDE): R[] {
  const key = (r: R) => (sort === 'cap' ? r.marketCap ?? -Infinity : Math.abs(r.week ?? 0));
  const by = (a: R, b: R) => key(b) - key(a) || cmp(a.ticker, b.ticker);
  const known = rows.filter((r) => r.week != null);
  return [...known.filter((r) => r.week! < 0).sort(by).slice(0, perSide), ...known.filter((r) => r.week! >= 0).sort(by).slice(0, perSide)];
}

/** Market caps for the demo companies (rough, for a believable chart). */
const DEMO_CAPS = [4.1e12, 3.9e12, 5.2e12, 2.7e12, 1.8e12, 1.6e12, 3.8e11, 1.9e11, 3.0e11, 1.1e12, 7.4e11, 1.1e11];

export function ongoingMovesDemo(p: OngoingMovesParams): OngoingMoves {
  const r = prng('ongoing-moves');
  const rows: OngoingMoveRow[] = DEMO_COMPANIES.map(([ticker, name], i) => {
    const down = i % 3 !== 2; // two losers for every gainer
    const week = round((down ? -1 : 1) * (0.01 + r() * 0.11), 4);
    const move = round(Math.sign(week) * (MOVES_THRESHOLD + r() * 0.2), 4);
    const days = 5 + Math.floor(r() * 60);
    return {
      ticker, name, logo: null, marketCap: DEMO_CAPS[i] ?? null, kind: move > 0 ? 'rally' : 'drawdown', since: addDays(DEMO_ASOF, -days), days,
      move, close: round(50 + r() * 400), week, month: round(week * (1 + r() * 2), 4), quarter: i === 4 ? null : round(week * (1.5 + r() * 2.5), 4),
      industry: i === 1 || i === 5 ? { median: round(move / 2 + Math.sign(move) * 0.01, 4), peers: [{ ticker: 'AMD', move: round(move * 1.2, 4) }, { ticker: 'INTC', move: round(move * 0.8, 4) }] } : null,
    };
  });
  return { asOf: DEMO_ASOF, threshold: MOVES_THRESHOLD, market: 'bullish', rows: rankMoves(rows, p.sort) };
}

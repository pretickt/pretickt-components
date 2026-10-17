import { describe, expect, it } from 'vitest';
import { demoFor } from './index';
import { OngoingMovesPayload, rankMoves, type OngoingMoveRow, type OngoingMoves } from './ongoing-moves';
import { MOVES_PER_SIDE, MOVES_THRESHOLD } from './values';

/** A row with what ranking reads; the rest is filler. */
const row = (ticker: string, week: number | null, marketCap: number | null): OngoingMoveRow => ({
  ticker, name: ticker, logo: null, marketCap, kind: (week ?? 0) < 0 ? 'drawdown' : 'rally', since: '2026-09-01', days: 29,
  move: (week ?? 0) < 0 ? -0.08 : 0.08, close: 100, week, month: null, quarter: null, industry: null,
});
const tickers = (rows: OngoingMoveRow[]) => rows.map((r) => r.ticker);

describe('rankMoves', () => {
  const rows = [row('AAA', -0.05, 3e11), row('BBB', -0.02, 9e11), row('CCC', 0.03, 1e12), row('DDD', 0.09, 2e11), row('EEE', 0, null),
    row('FFF', null, 5e12), row('GGG', -0.07, null)];
  it('losers then gainers (a flat week is a gainer), each most important first; rows without a week are not drawn', () => {
    expect(tickers(rankMoves(rows, 'cap'))).toEqual(['BBB', 'AAA', 'GGG', 'CCC', 'DDD', 'EEE']);
    expect(tickers(rankMoves(rows, 'move'))).toEqual(['GGG', 'AAA', 'BBB', 'DDD', 'CCC', 'EEE']);
  });
  it('at most `perSide` a side; ties by ticker, in code-unit order (the same in SQL with collate "C")', () => {
    const many = Array.from({ length: 20 }, (_, i) => row(`T${String(i).padStart(2, '0')}`, -0.05, 1e11));
    expect(tickers(rankMoves([...many, row('BRK.B', -0.05, 1e11), row('BRKA', -0.05, 1e11)], 'cap', 3))).toEqual(['BRK.B', 'BRKA', 'T00']);
    expect(rankMoves(many, 'cap')).toHaveLength(MOVES_PER_SIDE);
  });
});

describe('ongoing-moves@1 demo', () => {
  const demo = (sort?: 'cap' | 'move') => demoFor({ t: 'ongoing-moves@1', params: sort ? { sort } : {} }) as OngoingMoves;
  it('is a valid payload with both sides, at most 14 a side, the 4% threshold and a market trend', () => {
    const d = demo();
    expect(OngoingMovesPayload.parse(d)).toEqual(d);
    const losers = d.rows.filter((r) => r.week! < 0), gainers = d.rows.filter((r) => r.week! >= 0);
    expect(losers.length).toBeGreaterThan(0);
    expect(gainers.length).toBeGreaterThan(0);
    expect(Math.max(losers.length, gainers.length)).toBeLessThanOrEqual(MOVES_PER_SIDE);
    expect(d.threshold).toBe(MOVES_THRESHOLD);
    expect(d.market).toMatch(/^(bullish|bearish|sideways)$/);
    expect(d.rows.every((r) => Math.abs(r.move) >= MOVES_THRESHOLD && (r.move > 0) === (r.kind === 'rally'))).toBe(true);
  });
  it('carries the cases a chart must draw: an industry moving too, a missing 90 days', () => {
    const d = demo();
    expect(d.rows.some((r) => r.industry && r.industry.peers.length > 0)).toBe(true);
    expect(d.rows.some((r) => r.quarter === null)).toBe(true);
  });
  it('the sort orders the same companies differently, as rankMoves does', () => {
    const cap = demo('cap'), move = demo('move');
    expect(tickers(cap.rows).sort()).toEqual(tickers(move.rows).sort());
    expect(tickers(move.rows)).toEqual(tickers(rankMoves(cap.rows, 'move')));
    expect(tickers(cap.rows)).not.toEqual(tickers(move.rows));
  });
});

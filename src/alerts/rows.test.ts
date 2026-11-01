import { describe, expect, it } from 'vitest';
import { rowsOf, type AlertUniverse, type AlertUniverseRow, type LiveInput } from './rows';

const base: AlertUniverseRow = {
  ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', logo: null, sector: 'Technology', marketCap: 310e9,
  close: 164, prevClose: 160,
  ma20: null, ma50: null, ma100: null, ma200: null, low52: null, high52: null, volumeRatio: null,
  peVsSector: null, undervalued: false, ptUpside: null, piotroski: null, checks: null,
  surprises: [0.02, 0.03, 0.01, 0.04], insiderNet90: null, earningsDate: null, grade: null,
  news: 2, newsUsual: 3, social: null, socialUsual: null,
};
const universe = (rows: Partial<AlertUniverseRow>[] = [{}]): AlertUniverse => ({ asOf: '2026-10-29', rows: rows.map((r) => ({ ...base, ...r })) });
const first = (rows: ReturnType<typeof rowsOf>) => rows[0]!;
const live = (session: string, o: Partial<LiveInput> = {}): LiveInput => ({
  session,
  q: { AMD: { p: 151, pc: 164, r: 151 / 164 - 1, m: -0.01, s: -0.02, x: -0.05 } },
  news: { AMD: { n: 9, top: [] } },
  earnings: {},
  ...o,
});

describe('rowsOf', () => {
  it('rowsOf uses the last session without a newer live day', () => {
    const r = first(rowsOf(universe(), live('2026-10-29')));
    expect(r.price).toBe(164);
    expect(r.move).toBeCloseTo(164 / 160 - 1, 10);
    expect(r.live).toBe(false);
    expect(r.session).toBe('2026-10-29');
    expect(r.news).toBe(2);
  });

  it('rowsOf takes price, move and news from a newer live day', () => {
    const r = first(rowsOf(universe(), live('2026-10-30')));
    expect(r.price).toBe(151);
    expect(r.move).toBeCloseTo(151 / 164 - 1, 10);
    expect(r.news).toBe(9);
    expect(r.live).toBe(true);
    expect(r.session).toBe('2026-10-30');
  });

  it('rowsOf ignores an older live day', () => {
    const r = first(rowsOf(universe(), live('2026-10-28')));
    expect(r.price).toBe(164);
    expect(r.live).toBe(false);
    expect(r.session).toBe('2026-10-29');
  });

  it('rowsOf counts no stories when the live file has none for the stock', () => {
    const r = first(rowsOf(universe(), live('2026-10-30', { news: {} })));
    expect(r.news).toBe(0);
  });

  it('rowsOf appends a just-reported surprise', () => {
    const r = first(rowsOf(universe(), live('2026-10-30', {
      earnings: { AMD: { date: '2026-10-30', time: 'bmo', eps: 1.1, epsEst: 1.0, rev: null, revEst: null } },
    })));
    expect(r.surprises).toHaveLength(4);
    [0.03, 0.01, 0.04, 0.1].forEach((v, i) => expect(r.surprises![i]).toBeCloseTo(v, 10));
  });

  it('a result without an estimate adds no surprise', () => {
    const r = first(rowsOf(universe(), live('2026-10-30', {
      earnings: { AMD: { date: '2026-10-30', time: 'amc', eps: 1.1, epsEst: 0, rev: null, revEst: null } },
    })));
    expect(r.surprises).toEqual([0.02, 0.03, 0.01, 0.04]);
  });

  it('a ticker missing from the live file keeps the last session', () => {
    const rows = rowsOf(universe([{}, { ticker: 'NVDA', close: 200, prevClose: null }]), live('2026-10-30'));
    const nvda = rows.find((r) => r.ticker === 'NVDA')!;
    expect(nvda.price).toBe(200);
    expect(nvda.move).toBeNull();
    expect(nvda.live).toBe(false);
    expect(nvda.session).toBe('2026-10-29');
  });

  it('no live day at all uses the last session', () => {
    const r = first(rowsOf(universe(), null));
    expect(r.price).toBe(164);
    expect(r.live).toBe(false);
  });
});

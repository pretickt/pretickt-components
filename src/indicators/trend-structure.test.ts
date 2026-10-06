import { describe, expect, it } from 'vitest';
import { applyPrice, structuralTrend } from './trend-structure';
import type { Pivot } from './pivots';

/** Build pivots alternating trough/peak from a price list, knowable two bars after each. */
const pivots = (prices: number[], firstKind: Pivot['kind'] = 'trough'): Pivot[] =>
  prices.map((price, i) => {
    const kind: Pivot['kind'] = i % 2 === 0 ? firstKind : firstKind === 'trough' ? 'peak' : 'trough';
    const day = (n: number) => new Date(Date.UTC(2024, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);
    return { idx: i * 10, date: day(i * 10), price, knowableIdx: i * 10 + 2, knowableFrom: day(i * 10 + 2), kind };
  });

describe('structuralTrend', () => {
  it('calls higher highs with higher lows an uptrend', () => {
    // L H L H L H — each pair above the last
    const s = structuralTrend(pivots([100, 120, 110, 130, 120, 140]));
    expect(s.trend).toBe('bullish');
    expect(s.since).not.toBeNull();
  });

  it('calls lower highs with lower lows a downtrend', () => {
    const s = structuralTrend(pivots([140, 120, 130, 110, 120, 100], 'peak'));
    expect(s.trend).toBe('bearish');
  });

  it('does not count a failed rally as a lower high — the uptrend survives it', () => {
    const up = [100, 120, 110, 130, 120, 140, 130];
    expect(structuralTrend(pivots(up)).trend).toBe('bullish');
    // 135 never takes out 140: it is the ceiling of a range, not a high. Nothing changes.
    expect(structuralTrend(pivots([...up, 135])).trend).toBe('bullish');
    // and it does not appear among the highs either — the reference is still 140
    expect(structuralTrend(pivots([...up, 135])).highs.map((h) => h.price)).toEqual([130, 140]);
  });

  it('ends the uptrend when the reference LOW goes, and needs a second break to call the downtrend', () => {
    const up = [100, 120, 110, 130, 120, 140, 130];
    // the reference low is 120 (the pullback that preceded the 140 high); 125 is above it
    expect(structuralTrend(pivots([...up, 135, 125])).trend).toBe('bullish');
    // 115 undercuts it: first break down ⇒ the uptrend is over, but it is not a downtrend yet
    expect(structuralTrend(pivots([...up, 135, 115])).trend).toBe('sideways');
    // a second lower low confirms it
    expect(structuralTrend(pivots([...up, 135, 115, 130, 105])).trend).toBe('bearish');
  });

  it('takes two breaks the other way too — a downtrend does not become an uptrend on one break', () => {
    const down = [140, 120, 130, 110, 120, 100];
    expect(structuralTrend(pivots(down, 'peak')).trend).toBe('bearish');
    // the reference high is 120 (the rally before the 100 low); 125 takes it out: one break up
    expect(structuralTrend(pivots([...down, 125], 'peak')).trend).toBe('sideways');
    // a second higher high confirms the turn
    expect(structuralTrend(pivots([...down, 125, 115, 135], 'peak')).trend).toBe('bullish');
  });

  it('stays sideways while the structure is mixed', () => {
    // higher highs but lower lows: a broadening range, not a trend
    const s = structuralTrend(pivots([100, 120, 95, 130, 90, 140]));
    expect(s.trend).toBe('sideways');
  });

  it('records when the current state was entered', () => {
    const s = structuralTrend(pivots([100, 120, 110, 130, 120, 140]));
    const all = pivots([100, 120, 110, 130, 120, 140]);
    expect(all.map((p) => p.date)).toContain(s.since);
  });

  it('reads only pivots that were KNOWABLE before the cutoff, not merely earlier', () => {
    const ps = pivots([100, 120, 110, 130, 120, 140]);
    const last = ps[ps.length - 1];
    // the final pivot happened before its own confirmation date; as of that day it is invisible
    const asOf = structuralTrend(ps, last!.knowableFrom);
    const including = structuralTrend(ps, '2099-01-01');
    expect(asOf.pivots).toBe(ps.length - 1);
    expect(including.pivots).toBe(ps.length);
  });

  it('is stable as later swings arrive — a past verdict never rewrites itself', () => {
    const early = pivots([100, 120, 110, 130, 120, 140]);
    const later = pivots([100, 120, 110, 130, 120, 140, 90, 80]);
    const cutoff = early[early.length - 1]!.knowableFrom;
    expect(structuralTrend(later, cutoff).trend).toBe(structuralTrend(early, cutoff).trend);
  });

  it('refuses to judge without enough swings', () => {
    expect(structuralTrend(pivots([100, 120])).trend).toBe('sideways');
    expect(structuralTrend([]).pivots).toBe(0);
  });

  it('needs a pivot to EXCEED the reference, not tie it', () => {
    // 130 twice: the second one extends nothing, so there is only one break up — not a trend yet
    const withEqual = structuralTrend(pivots([100, 120, 110, 130, 120, 130]));
    expect(withEqual.trend).toBe('sideways');
    expect(structuralTrend(pivots([100, 120, 110, 130, 120, 140])).trend).toBe('bullish');
  });

  it('reports only the highs and lows that actually moved the structure', () => {
    // 135 and 138 are failed rallies inside the range; neither belongs in the evidence
    const s = structuralTrend(pivots([100, 120, 110, 130, 120, 140, 130, 135, 125, 138]));
    expect(s.highs.map((h) => h.price)).toEqual([130, 140]);
    // and the lows that came with those breaks are higher ones — the property the label claims
    expect(s.lows.map((l) => l.price)).toEqual([110, 120]);
  });
});

describe('applyPrice', () => {
  const down = structuralTrend(pivots([140, 120, 130, 110, 120, 100], 'peak'));
  const up = structuralTrend(pivots([100, 120, 110, 130, 120, 140]));

  it('drops a downtrend the price has already climbed out of', () => {
    // last confirmed high is 120; trading above it means the lower-high sequence is over
    const s = applyPrice(down, 125);
    expect(s.trend).toBe('sideways');
    expect(s.broken).toBe('above');
  });

  it('drops an uptrend the price has already fallen out of', () => {
    // last confirmed low is 120
    const s = applyPrice(up, 115);
    expect(s.trend).toBe('sideways');
    expect(s.broken).toBe('below');
  });

  it('leaves a structure the price still respects alone', () => {
    expect(applyPrice(down, 115).trend).toBe('bearish');
    expect(applyPrice(down, 115).broken).toBeNull();
    expect(applyPrice(up, 125).trend).toBe('bullish');
  });

  it('never promotes — taking out one high is not a new uptrend', () => {
    expect(applyPrice(down, 1000).trend).toBe('sideways');
    expect(applyPrice(structuralTrend(pivots([100, 120, 110, 115])), 1000).trend).toBe('sideways');
  });

  it('passes the state through when there is no price or no pivot to compare', () => {
    expect(applyPrice(down, null)).toEqual(down);
    expect(applyPrice(down, Number.NaN)).toEqual(down);
    expect(applyPrice(structuralTrend([]), 100).trend).toBe('sideways');
  });
});


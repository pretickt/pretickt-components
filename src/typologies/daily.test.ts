import { describe, expect, it } from 'vitest';
import { needKey } from '../api';
import { DailyParams, DailyPayload, dailyDemo } from './daily';
import { getTypology } from './index';

describe('daily@1: a company\'s card of the day — what changed since the session before — or, without one, the session\'s own facts', () => {
  it('asks for one company by its ticker', () => {
    expect(DailyParams.parse({ ticker: 'NVDA' })).toEqual({ ticker: 'NVDA' });
    expect(DailyParams.safeParse({ ticker: 'nvda' }).success).toBe(false);
    expect(DailyParams.safeParse({}).success).toBe(false);
    expect(needKey({ t: 'daily@1', params: { ticker: 'NVDA' } })).toBe('daily@1|{"ticker":"NVDA"}');
  });
  it('the demo: a card of the session with its cited facts, one of them changed with what it was — a valid payload, the same twice', () => {
    const d = dailyDemo(DailyParams.parse({ ticker: 'NVDA' }));
    expect(DailyPayload.safeParse(d).success).toBe(true);
    expect(d).toEqual(dailyDemo({ ticker: 'NVDA' }));
    expect(d.card!.session).toBe(d.asOf);
    expect(d.card!.message.length).toBeLessThanOrEqual(90);
    expect(d.card!.body.length).toBeLessThanOrEqual(320);
    expect(d.card!.facts).toHaveLength(2);
    expect(d.card!.facts.filter((f) => f.was)).toHaveLength(1);
    expect(d.facts).toEqual([]);
    expect(getTypology('daily@1')).toBeTruthy();
  });
  it('no card is a valid answer: the facts alone, or nothing at all', () => {
    const d = dailyDemo({ ticker: 'MSFT' });
    expect(DailyPayload.safeParse({ ...d, card: null, facts: d.card!.facts }).success).toBe(true);
    expect(DailyPayload.safeParse({ ...d, card: null, facts: [] }).success).toBe(true);
    expect(DailyPayload.safeParse({ ...d, card: undefined }).success).toBe(false);
  });
});

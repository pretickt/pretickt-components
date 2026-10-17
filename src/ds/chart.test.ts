import { describe, expect, it } from 'vitest';
import { padTime, TIME_PAD } from './chart';

describe('padTime', () => {
  it('adds TIME_PAD of the span after the last day: a future marker or a 12-month target never sits on the price axis', () => {
    expect(TIME_PAD).toBe(0.06);
    expect(padTime(1000, 1100)).toEqual({ min: 1000, max: 1106 });
    expect(padTime(0, 365).max).toBeCloseTo(365 + 21.9, 6);
  });
  it('keeps at least three days of room on a short span, and never moves the start', () => {
    expect(padTime(500, 520)).toEqual({ min: 500, max: 523 });
    expect(padTime(500, 500)).toEqual({ min: 500, max: 503 });
  });
});

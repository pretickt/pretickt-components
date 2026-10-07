import { describe, expect, it } from 'vitest';
import { CALENDAR_MONTHS, EventsParams, eventsDemo } from './index';

describe('events@1, a span of dates (a week of the home page)', () => {
  it('accepts up to two weeks, in order', () => {
    expect(EventsParams.safeParse({ scope: { by: 'dates', from: '2026-09-28', to: '2026-10-02' }, kinds: ['earnings'] }).success).toBe(true);
    expect(EventsParams.safeParse({ scope: { by: 'dates', from: '2026-10-02', to: '2026-09-28' }, kinds: ['earnings'] }).success).toBe(false);
    expect(EventsParams.safeParse({ scope: { by: 'dates', from: '2026-10-01', to: '2026-10-20' }, kinds: ['earnings'] }).success).toBe(false);
  });
  it('the demo answers the days asked, across a month end', () => {
    const d = eventsDemo(EventsParams.parse({ scope: { by: 'dates', from: '2026-09-28', to: '2026-10-02' }, kinds: ['earnings', 'macro'] }));
    expect(d.items.length).toBeGreaterThan(0);
    expect(d.items.every((e) => e.date >= '2026-09-28' && e.date <= '2026-10-02')).toBe(true);
    expect(new Set(d.items.map((e) => e.date.slice(0, 7)))).toEqual(new Set(['2026-09', '2026-10']));
  });
  it('the calendar window is one shared value (the resolver refuses outside it, the calendar stops its arrows there)', () => {
    expect(CALENDAR_MONTHS).toEqual({ back: 1, ahead: 3 });
  });
});

import { describe, expect, it } from 'vitest';
import { CALENDAR_MONTHS, EventsParams, eventsDemo, monthGrid } from './index';

describe('events@1, a span of dates (a week of the home page)', () => {
  it('accepts up to two weeks, in order', () => {
    expect(EventsParams.safeParse({ scope: { by: 'dates', from: '2026-09-28', to: '2026-10-02' }, kinds: ['earnings'] }).success).toBe(true);
    expect(EventsParams.safeParse({ scope: { by: 'dates', from: '2026-10-02', to: '2026-09-28' }, kinds: ['earnings'] }).success).toBe(false);
    expect(EventsParams.safeParse({ scope: { by: 'dates', from: '2026-10-01', to: '2026-10-20' }, kinds: ['earnings'] }).success).toBe(false);
  });
  it('refuses dates that do not exist, without throwing (no rollover into the next month)', () => {
    for (const [from, to] of [['2026-11-30', '2026-11-31'], ['2026-02-27', '2026-02-30'], ['2026-10-32', '2026-10-33'], ['2026-13-01', '2026-13-02'], ['0', '1']])
      expect(() => expect(EventsParams.safeParse({ scope: { by: 'dates', from, to }, kinds: ['earnings'] }).success, `${from}..${to}`).toBe(false)).not.toThrow();
  });
  it('the demo answers the days asked, across a month end', () => {
    const d = eventsDemo(EventsParams.parse({ scope: { by: 'dates', from: '2026-09-28', to: '2026-10-02' }, kinds: ['earnings', 'macro'] }));
    expect(d.items.length).toBeGreaterThan(0);
    expect(d.items.every((e) => e.date >= '2026-09-28' && e.date <= '2026-10-02')).toBe(true);
    expect(new Set(d.items.map((e) => e.date.slice(0, 7)))).toEqual(new Set(['2026-09', '2026-10']));
  });
  it('a month answers its grid (1.3): its weeks, Monday to Sunday, the days of the months around it included', () => {
    expect(monthGrid('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(monthGrid('2026-06')).toEqual({ from: '2026-06-01', to: '2026-07-05' }); // starts on a Monday
    expect(monthGrid('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' }); // Monday to Sunday: no other month's day
    expect(monthGrid('2026-12')).toEqual({ from: '2026-11-30', to: '2027-01-03' });
    const d = eventsDemo(EventsParams.parse({ scope: { by: 'universe', month: '2026-11' }, kinds: ['earnings', 'macro'] }));
    expect(d.items.every((e) => e.date >= '2026-10-26' && e.date <= '2026-12-06')).toBe(true);
    expect(d.items.some((e) => e.date < '2026-11-01')).toBe(true);
    // the grey days are the other month's own, not drawn twice
    const oct = eventsDemo(EventsParams.parse({ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] }));
    expect(d.items.filter((e) => e.date < '2026-11-01')).toEqual(oct.items.filter((e) => e.date >= '2026-10-26' && e.date < '2026-11-01'));
  });
  it('the calendar window is one shared value (the resolver refuses outside it, the calendar stops its arrows there)', () => {
    expect(CALENDAR_MONTHS).toEqual({ back: 1, ahead: 3 });
  });
});

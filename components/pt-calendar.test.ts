// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { eventsDemo, type EventItem } from '../src/typologies';
import * as mod from './pt-calendar';
import { standardSuite } from './_harness';

const events = eventsDemo({ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] });
const companies = events.items.filter((e) => e.kind !== 'macro') as Extract<EventItem, { ticker: string }>[];

describe('pt-calendar', () => {
  standardSuite('pt-calendar.ts', mod);

  it('builds Monday-first weeks covering the month', () => {
    const m = mod.buildMonth('2026-10', [], '2026-10-02');
    expect(m.weeks[0]![0]!.date).toBe('2026-09-28');
    expect(m.weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(m.label).toBe('October 2026');
    expect(m.weeks.flat().find((c) => c.date === '2026-10-02')!.isAsOf).toBe(true);
  });
  it('shifts months across years', () => {
    expect(mod.shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(mod.shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('caps each day at four chips and reports the overflow', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...companies[0]!, date: '2026-10-15', ticker: `T${i}` }));
    const out = mod.renderStatic({ events: { asOf: '2026-10-02', items: many } }, { month: '2026-10' }, h);
    expect(out.match(/class="pt-cal-ev"/g)).toHaveLength(4);
    expect(out).toContain('+3 more');
  });
  it('lists every report in the text list, so nothing hides behind the cap', () => {
    const out = mod.renderStatic({ events }, { month: '2026-10' }, h);
    for (const e of companies) expect(out).toContain(`/stocks/${e.ticker.toLowerCase()}/`);
  });
  it('offers previous and next month', () => {
    const out = mod.renderStatic({ events }, { month: '2026-10' }, h);
    expect(out).toContain(`data-set='{"month":"2026-09"}'`);
    expect(out).toContain(`data-set='{"month":"2026-11"}'`);
  });
  it('shows macro dates as labels on their day and in the list, without a stock link', () => {
    const out = mod.renderStatic({ events }, { month: '2026-10' }, h);
    const macro = events.items.filter((e) => e.kind === 'macro');
    expect(macro.length).toBeGreaterThan(0);
    expect(out.match(/class="pt-cal-macro"/g)!.length).toBe(macro.length);
    expect(out).toContain('Fed');
    expect(out).not.toContain('/stocks//');
  });
  it('requests earnings and macro dates', () => {
    expect(mod.manifest.needs({ month: '2026-10' }).events!.params).toMatchObject({ kinds: ['earnings', 'macro'] });
  });
  it('renders not-available for null', () => {
    expect(mod.renderStatic({ events: null }, { month: '2026-10' }, h)).toContain('pt-na');
  });
});

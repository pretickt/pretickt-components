// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { eventsDemo, priceSeriesDemo, type EventItem } from '../src/typologies';
import * as mod from './pt-price-events';
import { standardSuite } from './_harness';

const series = priceSeriesDemo({ tickers: ['NVDA'], range: '1y', interval: '1d', rebase: false });
const events = eventsDemo({ scope: { by: 'ticker', ticker: 'NVDA', range: '1y', ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] });
const params = { ticker: 'NVDA', range: '1y' };

describe('pt-price-events', () => {
  standardSuite('pt-price-events.ts', mod);

  it('draws one path and one marker per in-window event', () => {
    const out = mod.renderStatic({ series, events }, params, h);
    expect(out.match(/<path class="pt-line"/g)).toHaveLength(1);
    const first = series[0]!.points[0]!.t;
    const inWindow = events.items.filter((e) => e.date >= first).length;
    expect(out.match(/class="pt-mk /g)).toHaveLength(inWindow);
  });
  it('marks events after the last bar as future', () => {
    const out = mod.renderStatic({ series, events }, params, h);
    const future = events.items.filter((e) => e.date > series[0]!.points.at(-1)!.t).length;
    expect((out.match(/pt-mk-future/g) ?? []).length).toBe(future);
  });
  it('renders the range toggles with the current one pressed', () => {
    const out = mod.renderStatic({ series, events }, { ticker: 'NVDA', range: '6m' }, h);
    expect(out).toContain(`data-set='{"range":"6m"}' aria-pressed="true"`);
    expect(out).toContain(`data-set='{"range":"5y"}' aria-pressed="false"`);
  });
  it('still draws the chart when events are missing', () => {
    const out = mod.renderStatic({ series, events: null }, params, h);
    expect(out).toContain('pt-line');
    expect(out).toContain('Events not available');
  });
  it('renders not-available without a series', () => {
    expect(mod.renderStatic({ series: null, events }, params, h)).toContain('pt-na');
    expect(mod.renderStatic({ series: [{ ticker: 'NVDA', points: [] }], events }, params, h)).toContain('pt-na');
  });
  it('stacks same-day markers instead of overlapping them', () => {
    const e = events.items.find((x) => x.date <= series[0]!.points.at(-1)!.t && x.date >= series[0]!.points[0]!.t)!;
    const twin: EventItem = { ...e, kind: 'analyst', meta: { firm: 'X', action: 'upgrade', from: null, to: 'Buy' } } as EventItem;
    const g = mod.layout(series[0]!.points, [e, twin]);
    expect(g!.markers[0]!.cy).not.toBe(g!.markers[1]!.cy);
  });
});

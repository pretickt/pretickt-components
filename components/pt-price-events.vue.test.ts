// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { date } from '../src/ds/format';
import { eventsDemo, priceSeriesDemo, type EventItem } from '../src/typologies';
import PtPriceEvents, { isEvent, layout } from './pt-price-events.vue';
import { render, standardSuite, withData } from './_suite';

const series = priceSeriesDemo({ tickers: ['NVDA'], range: '1y', interval: '1d', rebase: false });
const events = eventsDemo({ scope: { by: 'ticker', ticker: 'NVDA', range: '1y', ahead: 90 }, kinds: ['earnings', 'dividend', 'split', 'analyst'] });
const html = async (s: unknown, e: unknown, range = '1y') => (await render(PtPriceEvents, { ticker: 'NVDA', range }, withData({ 'price-series@1': s, 'events@1': e }))).html;
const unq = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

describe('pt-price-events', () => {
  standardSuite('pt-price-events.vue', PtPriceEvents);
  const shown = (from: string) => events.items.filter((e) => e.date >= from && isEvent(e));
  const groups = (list: EventItem[]) => new Set(list.map((e) => `${e.date}|${e.kind}`)).size;

  it('draws one path and one marker per day and kind, skipping rating reiterations', async () => {
    const out = await html(series, events);
    expect(out.match(/<path class="pt-line"/g)).toHaveLength(1);
    expect(out.match(/class="pt-mk /g)).toHaveLength(groups(shown(series[0]!.points[0]!.t)));
  });
  it('marks events after the last bar as future', async () => {
    const out = await html(series, events);
    const future = shown(series[0]!.points[0]!.t).filter((e) => e.date > series[0]!.points.at(-1)!.t);
    expect((out.match(/pt-mk-future/g) ?? []).length).toBe(groups(future));
  });
  it('collapses many same-day analyst actions into one marker that counts them', async () => {
    const d = series[0]!.points.at(-5)!.t;
    const many = Array.from({ length: 12 }, (_, i) => ({ date: d, ticker: 'NVDA', name: 'NVIDIA', logo: null, mcap: null, kind: 'analyst' as const,
      meta: { firm: `Firm ${i}`, action: i % 2 ? 'upgrade' : 'downgrade', from: 'Hold', to: 'Buy' } }));
    const out = await html(series, { asOf: events.asOf, items: many });
    expect(out.match(/class="pt-mk /g)).toHaveLength(1);
    expect(out).toContain('12 analyst actions');
  });
  it('zooms: the viewport narrows time and stretches price (shared viewport)', () => {
    const pts = series[0]!.points;
    const full = layout(pts, [])!;
    expect(layout(pts, [], { start: 0.5, end: 1, yScale: 1, yShift: 0 })!.xTicks[0]!.label).not.toBe(full.xTicks[0]!.label);
    expect(layout(pts, [], { start: 0, end: 1, yScale: 2, yShift: 0 })!.yTicks.map((t) => t.v)).not.toEqual(full.yTicks.map((t) => t.v));
    expect(layout(pts, [], { start: 0, end: 1, yScale: 1, yShift: 0 })!.path).toBe(full.path);
  });
  it('is zoomable: grab strips and a clipped plot, no view controls at the full view', async () => {
    const out = await html(series, events);
    expect(out).toContain('data-zoom=');
    expect(out).toContain('clip-path=');
    expect(out).not.toContain('pt-vctl');
  });
  it('renders the range toggles with the current one pressed', async () => {
    const out = await html(series, events, '6m');
    expect(out).toContain('aria-pressed="true">6M<');
    expect(out).toContain('aria-pressed="false">5Y<');
    expect(out).toContain('role="group" aria-label="Range"');
  });
  it('draws month labels on the time axis and price labels above the grab strip, with the legend', async () => {
    const out = await html(series, events);
    expect(out).toMatch(/text-anchor="(start|middle|end)">[A-Z][a-z]{2} \d{2}</);
    expect(out.indexOf('class="pt-axis-strip"')).toBeLessThan(out.indexOf('text-anchor="end">$'));
    expect(out).not.toContain('fill="white"');
    expect(out).toContain('E earnings · D dividend · S split · A analyst rating change');
  });
  it('shows a dividend as declared in its tooltip', async () => {
    const d = series[0]!.points.at(-10)!.t;
    const div = { date: d, ticker: 'NVDA', name: 'NVIDIA', logo: null, mcap: null, kind: 'dividend' as const, meta: { amount: 0.2625, payDate: null } };
    expect(unq(await html(series, { asOf: events.asOf, items: [div] }))).toContain(JSON.stringify({ Dividend: '$0.2625', 'Ex-date': date(d), 'Pay date': null }));
  });
  it('still draws the chart when events are missing', async () => {
    const out = await html(series, null);
    expect(out).toContain('pt-line');
    expect(out).toContain('Events not available');
  });
  it('shows the last close (the build verification reads it)', async () => {
    expect(await html(series, events)).toMatch(/Last close \$[\d,]+\.\d\d/);
  });
  it('renders not-available without points', async () => expect(await html([{ ticker: 'NVDA', points: [] }], events)).toContain('pt-na'));
  it('stacks same-day markers instead of overlapping them', () => {
    const e = events.items.find((x) => x.kind !== 'analyst' && x.date <= series[0]!.points.at(-1)!.t && x.date >= series[0]!.points[0]!.t)!;
    const twin: EventItem = { ...e, kind: 'analyst', meta: { firm: 'X', action: 'upgrade', from: null, to: 'Buy' } } as EventItem;
    const g = layout(series[0]!.points, [e, twin]);
    expect(g!.markers[0]!.cy).not.toBe(g!.markers[1]!.cy);
  });
});

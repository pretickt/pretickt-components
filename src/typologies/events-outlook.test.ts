import { describe, expect, it } from 'vitest';
import { EventsParams, EventsPayload, eventsDemo, type EventItem } from './index';

/** A month as www serves it before the platform fills the outlook fields, and the same month with them (events@1.2). */
const plain = {
  asOf: '2026-10-27',
  items: [
    { date: '2026-10-28', ticker: 'MSFT', name: 'Microsoft Corporation', logo: null, mcap: 3.9e12, kind: 'earnings',
      meta: { time: 'amc', confirmed: true, epsEst: 3.68, epsActual: null, revEst: 7.74e10, revActual: null } },
    { date: '2026-10-28', kind: 'macro', meta: { label: 'Fed', event: 'Fed Interest Rate Decision', impact: 'High' } },
  ],
};
const story = { publishedAt: '2026-10-26T14:00:00Z', title: 'What to watch in Microsoft\'s report', site: 'Reuters', url: 'https://example.com/msft-preview', tag: 'Preview' };
const full = {
  ...plain, normal: 0.0068,
  items: [
    { ...plain.items[0], meta: { ...plain.items[0]!.meta, move: null, news: [story],
      moves: [0.042, -0.061, 0.018, 0.075, -0.039, 0.045, 0.083, -0.012], record: { beats: 7, of: 8 } } },
    { ...plain.items[1], meta: { ...plain.items[1]!.meta, headline: { name: 'Fed funds rate', unit: '%', expected: 3.5, previous: 3.75, actual: null },
      moves: [0.011, -0.016, 0.009, 0.012, -0.007, 0.014, -0.021, 0.008], move: null, news: [{ ...story, tag: null }] } },
  ],
};

describe('events@1.2, what to expect from each event', () => {
  it('takes the outlook fields: the moves after the last reports and the record against the estimate, this report\'s move, the news; a macro date\'s headline figure; the market\'s normal day', () => {
    // parsing keeps them (a schema without them would drop them as unknown keys)
    expect(EventsPayload.parse(full)).toEqual(full);
  });
  it('they are optional: www\'s calendar before the platform fills them still reads', () => {
    expect(EventsPayload.safeParse(plain).success).toBe(true);
  });
  it('a story links to a web page only (http or https)', () => {
    const bad = structuredClone(full);
    (bad.items[0]!.meta as { news: { url: string }[] }).news[0]!.url = 'javascript:alert(1)';
    expect(EventsPayload.safeParse(bad).success).toBe(false);
  });
  it('at most the last 8 reports (or releases) and 5 stories an event, so a month stays small', () => {
    const many = structuredClone(full);
    (many.items[0]!.meta as { moves: number[] }).moves.push(0.01);
    expect(EventsPayload.safeParse(many).success).toBe(false);
    const releases = structuredClone(full);
    (releases.items[1]!.meta as { moves: number[] }).moves.push(0.01);
    expect(EventsPayload.safeParse(releases).success).toBe(false);
    const talk = structuredClone(full);
    (talk.items[1]!.meta as { news: unknown[] }).news = Array.from({ length: 6 }, () => story);
    expect(EventsPayload.safeParse(talk).success).toBe(false);
  });

  const month = eventsDemo(EventsParams.parse({ scope: { by: 'universe', month: '2026-09' }, kinds: ['earnings', 'macro'] }));
  const reports = month.items.filter((e): e is Extract<EventItem, { kind: 'earnings' }> => e.kind === 'earnings');
  const dates = month.items.filter((e): e is Extract<EventItem, { kind: 'macro' }> => e.kind === 'macro');
  it('the demo fills them, the same every time: each company\'s last moves (to 0.1%) and its record, the market\'s normal day', () => {
    expect(EventsPayload.safeParse(month).success).toBe(true);
    expect(eventsDemo(EventsParams.parse({ scope: { by: 'universe', month: '2026-09' }, kinds: ['earnings', 'macro'] }))).toEqual(month);
    expect(month.normal).toBeGreaterThan(0);
    expect(reports.every((e) => (e.meta.moves?.length ?? 0) <= 8 && e.meta.record != null && e.meta.record.beats <= e.meta.record.of)).toBe(true);
    expect(reports.flatMap((e) => e.meta.moves!).every((m) => Math.round(m * 1000) === m * 1000)).toBe(true);
    // some with too few reports on file for a usual move (fewer than 4)
    expect(reports.some((e) => e.meta.moves!.length < 4) && reports.some((e) => e.meta.moves!.length === 8)).toBe(true);
  });
  it('the demo\'s past reports carry what they did (EPS, the move), the coming ones none', () => {
    const past = reports.filter((e) => e.date < month.asOf), next = eventsDemo(EventsParams.parse({ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings'] })).items;
    expect(past.length).toBeGreaterThan(0);
    expect(past.every((e) => e.meta.epsActual != null && e.meta.move != null && e.meta.confirmed === true)).toBe(true);
    expect(next.every((e) => e.kind === 'earnings' && e.meta.epsActual === null && !e.meta.move)).toBe(true);
  });
  it('the demo\'s market dates: the headline figure expected and before, the actual once out, the market\'s move on them', () => {
    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) {
      expect(d.meta.headline?.expected).not.toBeNull();
      expect(d.meta.headline?.previous).not.toBeNull();
      expect(d.meta.moves).toHaveLength(8);
      if (d.date < month.asOf) { expect(d.meta.headline?.actual).not.toBeNull(); expect(d.meta.move).not.toBeNull(); }
    }
  });
  it('the demo has news about the events around its latest session, links to web pages, tagged', () => {
    const week = eventsDemo(EventsParams.parse({ scope: { by: 'dates', from: '2026-09-28', to: '2026-10-02' }, kinds: ['earnings', 'macro'] }));
    const news = week.items.flatMap((e) => (e.kind === 'earnings' || e.kind === 'macro' ? e.meta.news ?? [] : []));
    expect(news.length).toBeGreaterThan(0);
    expect(news.every((s) => /^https:\/\//.test(s.url) && s.title && s.site)).toBe(true);
    expect(new Set(news.map((s) => s.tag))).toContain('Preview');
    expect(week.normal).toBe(month.normal);
  });
});

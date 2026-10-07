// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { h, Suspense } from 'vue';
import { createPt, PT } from '../src/context/pt';
import { tone, usd } from '../src/ds/format';
import { eventsDemo, screenDemo, type EventItem } from '../src/typologies';
import PtCalendar, { buildMonth, shiftMonth } from './pt-calendar.vue';
import PtScreen from './pt-screen.vue';
import { column, demo, mountIsland, render, standardSuite, withData } from './_suite';

describe('pt-screen', () => {
  standardSuite('pt-screen.vue', PtScreen);
  it('renders one linked row per company with a sparkline', async () => {
    const data = screenDemo({ scope: { list: 'biggest_losers' }, limit: 10 });
    const { html } = await render(PtScreen, { list: 'biggest_losers', limit: 10 }, withData({ 'screen@1': data }));
    expect(html.match(/<tr class="pt-scr-row/g)).toHaveLength(data.rows.length);
    expect(html).toContain('href="/stocks/brk.b/"');
    expect(html.match(/<polyline/g)).toHaveLength(data.rows.length);
  });
  it('shows each company\'s logo from the site (initials when there is none)', async () => {
    const data = screenDemo({ scope: { list: 'biggest_losers' }, limit: 3 });
    data.rows[0]!.logo = `/logos/${data.rows[0]!.ticker.toLowerCase()}`;
    const { html } = await render(PtScreen, { list: 'biggest_losers', limit: 3 }, withData({ 'screen@1': data }));
    expect(html).toContain(`<img class="pt-logo" src="/logos/${data.rows[0]!.ticker.toLowerCase()}"`);
    expect(html.match(/pt-logo-initials/g)).toHaveLength(2);
  });
  it('sorts by a column header: 1D high to low, then low to high; the rank stays the list\'s own', async () => {
    const w = await mountIsland(PtScreen, { list: 'biggest_losers', limit: 10 });
    const before = column(w, 2);
    await w.findAll('thead th button').find((b) => b.text().startsWith('1D'))!.trigger('click');
    const pctOf = (s: string) => Number(s.replace('%', '').replace('−', '-'));
    const down = column(w, 4).map(pctOf);
    expect(down).toEqual([...down].sort((a, b) => b - a));
    expect(w.find('th[aria-sort="descending"]').text()).toMatch(/^1D/);
    const ranks = column(w, 1).map(Number);
    expect(ranks.map((r) => before[r - 1])).toEqual(column(w, 2)); // each row keeps its rank in the list
    await w.findAll('thead th button').find((b) => b.text().startsWith('1D'))!.trigger('click');
    expect(column(w, 4).map(pctOf)).toEqual([...down].reverse());
    w.unmount();
  });
  it('highlights the subject of a peer list', async () => {
    const data = screenDemo({ scope: { peersOf: 'NVDA' }, limit: 5 });
    expect((await render(PtScreen, { peersOf: 'NVDA', limit: 5 }, withData({ 'screen@1': data }))).html).toContain('pt-scr-row pt-scr-self');
  });
  it('shows the list-specific column', async () => {
    const data = screenDemo({ scope: { list: 'insider_buying' }, limit: 5 });
    const { html } = await render(PtScreen, { list: 'insider_buying', limit: 5 }, withData({ 'screen@1': data }));
    expect(html).toContain('>Insiders 90d<');
    const r = data.rows[0]!;
    expect(html).toContain(`<span class="pt-t-${tone(r.insiderNet)}">${usd(r.insiderNet, { compact: true, signed: true })}</span>`);
  });
  it('explains an empty list', async () => {
    expect((await render(PtScreen, { list: '52w_low' }, withData({ 'screen@1': { asOf: '2026-10-02', rows: [] } }))).html).toContain('No companies match');
  });
});

describe('pt-calendar', () => {
  standardSuite('pt-calendar.vue', PtCalendar);
  const events = eventsDemo({ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] });
  const companies = events.items.filter((e) => e.kind !== 'macro') as Extract<EventItem, { ticker: string }>[];
  const html = async (ev: unknown, kind?: 'earnings' | 'dividend') => (await render(PtCalendar, { month: '2026-10', ...(kind ? { kind } : {}) }, withData({ 'events@1': ev }))).html;
  it('builds Monday-first weeks covering the month', () => {
    const m = buildMonth('2026-10', [], '2026-10-02');
    expect(m.weeks[0]![0]!.date).toBe('2026-09-28');
    expect(m.weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(m.label).toBe('October 2026');
    expect(m.weeks.flat().find((c) => c.date === '2026-10-02')!.isAsOf).toBe(true);
  });
  it('shifts months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('caps each day at four chips and reports the overflow', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...companies[0]!, date: '2026-10-15', ticker: `T${i}` }));
    const out = await html({ asOf: '2026-10-02', items: many });
    expect(out.match(/class="pt-cal-ev"/g)).toHaveLength(4);
    expect(out).toContain('+3 more');
  });
  it('"+N more" opens the whole day over its cell, as Google Calendar does; ×, Escape or a click outside close it', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...companies[0]!, date: '2026-10-15', ticker: `T${i}`, name: `Co ${i}` }));
    const w = await mountIsland(PtCalendar, { month: '2026-10' }, withData({ 'events@1': { asOf: '2026-10-02', items: many } }));
    expect(w.find('.pt-cal-pop').exists()).toBe(false);
    await w.find('button.pt-cal-more').trigger('click');
    const pop = w.find('.pt-cal-pop');
    expect(pop.attributes('role')).toBe('dialog');
    expect(pop.find('.pt-cal-pop-head').text()).toMatch(/Thu\s*15/);
    expect(pop.findAll('.pt-cal-ev')).toHaveLength(7);              // every company of the day
    await pop.find('button.pt-cal-pop-x').trigger('click');
    expect(w.find('.pt-cal-pop').exists()).toBe(false);
    await w.find('button.pt-cal-more').trigger('click');
    await w.find('.pt-cal-pop').trigger('keydown', { key: 'Escape' });
    expect(w.find('.pt-cal-pop').exists()).toBe(false);
    await w.find('button.pt-cal-more').trigger('click');
    await w.find('.pt-cal-backdrop').trigger('click');
    expect(w.find('.pt-cal-pop').exists()).toBe(false);
    w.unmount();
  });
  it('closing the day box gives the focus back to its "+N more"; changing month closes it', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...companies[0]!, date: '2026-10-15', ticker: `T${i}`, name: `Co ${i}` }));
    const w = await mountIsland(PtCalendar, { month: '2026-10' }, withData({ 'events@1': { asOf: '2026-10-02', items: many } }));
    const more = () => w.find('button.pt-cal-more');
    await more().trigger('click');
    await w.find('button.pt-cal-pop-x').trigger('click');
    expect(document.activeElement).toBe(more().element);
    await more().trigger('click');
    await w.find('.pt-cal-pop').trigger('keydown', { key: 'Escape' });
    expect(document.activeElement).toBe(more().element);
    await more().trigger('click');
    await w.findAll('.pt-cal-nav button')[1]!.trigger('click');
    await flushPromises();
    expect(w.find('.pt-cal-pop').exists()).toBe(false);
    w.unmount();
  });
  it('a week with nothing scheduled says so', async () => {
    const w = await mountIsland(PtCalendar, { month: '2026-09', kind: 'dividend', view: 'week' }, withData({ 'events@1': { asOf: '2026-09-30', items: [] } }));
    expect(w.text()).toContain('No ex-dividend dates scheduled this week in the tracked universe yet.');
    w.unmount();
  });
  it('week view: the five sessions of the coming week (from the latest session), across a month end, with week arrows', async () => {
    const asked: unknown[] = [];
    const resolve = async (t: string, p: unknown) => { asked.push(p); return demo()(t, p); };
    const w = await mountIsland(PtCalendar, { month: '2026-09', view: 'week' }, resolve);
    // the demo's latest session is Wed 2026-09-30: the coming week is Mon Sep 28 – Fri Oct 2, half in each month
    expect(w.findAll('.pt-cal-day')).toHaveLength(5);
    expect(w.find('.pt-section-title').text()).toBe('Week of Sep 28, 2026');
    expect(w.findAll('.pt-cal-dow').map((d) => d.text())).toEqual(['Mon 28', 'Tue 29', 'Wed 30', 'Thu 1', 'Fri 2']);
    expect(asked.map((p) => (p as { scope: { month: string } }).scope.month)).toEqual(['2026-09', '2026-10']);
    expect(w.find('.pt-cal-list').exists()).toBe(false);             // compact: no month list
    await w.findAll('.pt-cal-nav button')[1]!.trigger('click');
    await flushPromises();
    expect(w.find('.pt-section-title').text()).toBe('Week of Oct 5, 2026');
    w.unmount();
  });
  it('lists every report in the text list, so nothing hides behind the cap', async () => {
    const out = await html(events);
    for (const e of companies) expect(out).toContain(`/stocks/${e.ticker.toLowerCase()}/`);
  });
  it('shows macro dates as labels on their day and in the list, without a stock link', async () => {
    const out = await html(events);
    const macro = events.items.filter((e) => e.kind === 'macro');
    expect(macro.length).toBeGreaterThan(0);
    expect(out.match(/class="pt-cal-macro"/g)!.length).toBe(macro.length);
    expect(out).toContain('Fed');
    expect(out).not.toContain('/stocks//');
  });
  it('shows a dividend calendar with amounts when asked', async () => {
    const d = { asOf: '2026-10-02', items: [{ date: '2026-10-15', ticker: 'KO', name: 'Coca-Cola', logo: null, mcap: 3e11, kind: 'dividend' as const, meta: { amount: 0.51, payDate: '2026-10-30' } }] };
    expect(await html(d, 'dividend')).toContain('$0.51');
    expect(await html({ ...d, items: [{ ...d.items[0]!, meta: { amount: 0.2625, payDate: null } }] }, 'dividend')).toContain('$0.2625');
  });
  it('asks earnings (or dividend) dates with the macro calendar, and moves between months', async () => {
    const asked: unknown[] = [];
    const resolve = async (t: string, p: unknown) => { asked.push(p); return demo()(t, p); };
    const w = mount({ render: () => h(Suspense, null, { default: () => h(PtCalendar, { month: '2026-10' }) }) },
      { global: { provide: { [PT as symbol]: createPt({ resolve }) } }, attachTo: document.body });
    await flushPromises();
    expect(w.text()).toContain('October 2026');
    await w.findAll('.pt-cal-nav button')[1]!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('November 2026');
    expect(asked).toEqual([{ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] }, { scope: { by: 'universe', month: '2026-11' }, kinds: ['earnings', 'macro'] }]);
    w.unmount();
  });
  it('puts each company\'s logo in its chip and in the list; the chip keeps its tooltip rows (the hover card shows them)', async () => {
    const ev = eventsDemo({ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] });
    const first = ev.items.find((e) => e.kind === 'earnings')!;
    first.logo = `/logos/${first.ticker.toLowerCase()}`;
    const { html } = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': ev }));
    const chip = html.slice(html.indexOf(`class="pt-cal-ev" href="/stocks/${first.ticker.toLowerCase()}/"`));
    expect(chip.slice(0, 400)).toMatch(/data-tip="[^"]*"><span class="pt-cal-who"><img class="pt-logo" src="\/logos\/[a-z.]+"/);
    expect(html).toMatch(/<li><span class="pt-cal-list-day">[^<]*<\/span>[^]*?<img class="pt-logo"/);
  });
  it('while the next month loads (or if it never does), the calendar still names the month its data is for', async () => {
    let n = 0;
    const resolve = (t: string, p: unknown) => (n++ === 0 ? demo()(t, p) : new Promise(() => {}));
    const w = mount({ render: () => h(Suspense, null, { default: () => h(PtCalendar, { month: '2026-10' }) }) },
      { global: { provide: { [PT as symbol]: createPt({ resolve }) } }, attachTo: document.body });
    await flushPromises();
    const before = w.find('.pt-cal-grid').html();
    await w.findAll('.pt-cal-nav button')[1]!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain('October 2026');
    expect(w.text()).not.toContain('November 2026');
    expect(w.find('.pt-cal-grid').html()).toBe(before);
    expect(w.find('.pt-cal').classes()).toContain('pt-busy');
    w.unmount();
  });
});

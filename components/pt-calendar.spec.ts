import { eventsDemo, type EventItem } from '../src/typologies';
import { buildMonth, PtCalendar, shiftMonth } from './pt-calendar';
import { basics, demo, render, settle, withData } from './_spec';

const events = eventsDemo({ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] });
const companies = events.items.filter((e) => e.kind !== 'macro') as Extract<EventItem, { ticker: string }>[];
const html = async (ev: unknown, kind?: 'earnings' | 'dividend') => (await render(PtCalendar, { month: '2026-10', ...(kind ? { kind } : {}) }, withData({ 'events@1': ev }))).html();
const many = Array.from({ length: 7 }, (_, i) => ({ ...companies[0]!, date: '2026-10-15', ticker: `T${i}`, name: `Co ${i}` }));
const click = async (r: { f: Parameters<typeof settle>[0] }, el: Element | null) => { (el as HTMLElement).click(); await settle(r.f); };
const navs = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.pt-cal-nav button')];

describe('pt-calendar', () => {
  basics(PtCalendar, { month: '2026-10' });
  it('builds Monday-first weeks covering the month; shifts months across years', () => {
    const m = buildMonth('2026-10', [], '2026-10-02');
    expect(m.weeks[0]![0]!.date).toBe('2026-09-28');
    expect(m.weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(m.label).toBe('October 2026');
    expect(m.weeks.flat().find((c) => c.date === '2026-10-02')!.isAsOf).toBe(true);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('caps each day at four chips and reports the overflow', async () => {
    const out = await html({ asOf: '2026-10-02', items: many });
    expect(out.match(/class="pt-cal-ev"/g)).toHaveLength(4 + 0);
    expect(out).toContain('+3 more');
  });
  it('"+N more" opens the whole day over its cell; ×, Escape or a click outside close it, giving the focus back', async () => {
    const r = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': { asOf: '2026-10-02', items: many } }));
    document.body.append(r.el);
    const more = () => r.el.querySelector<HTMLButtonElement>('button.pt-cal-more')!;
    expect(r.el.querySelector('.pt-cal-pop')).toBeNull();
    await click(r, more());
    const pop = r.el.querySelector('.pt-cal-pop')!;
    expect(pop.getAttribute('role')).toBe('dialog');
    expect(pop.querySelector('.pt-cal-pop-head')!.textContent).toMatch(/Thu\s*15/);
    expect(pop.querySelectorAll('.pt-cal-ev')).toHaveLength(7);
    expect(document.activeElement).toBe(pop);
    await click(r, pop.querySelector('button.pt-cal-pop-x'));
    expect(r.el.querySelector('.pt-cal-pop')).toBeNull();
    expect(document.activeElement).toBe(more());
    await click(r, more());
    r.el.querySelector('.pt-cal-pop')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(r.f);
    expect(r.el.querySelector('.pt-cal-pop')).toBeNull();
    expect(document.activeElement).toBe(more());
    await click(r, more());
    await click(r, r.el.querySelector('.pt-cal-backdrop'));
    expect(r.el.querySelector('.pt-cal-pop')).toBeNull();
    await click(r, more());
    await click(r, navs(r.el)[1]!);
    expect(r.el.querySelector('.pt-cal-pop')).toBeNull(); // changing month closes it
    r.el.remove();
  });
  it('a week with no company scheduled says so, even with a market-wide date in it', async () => {
    const closed = { date: '2026-09-28', kind: 'macro', meta: { label: 'Closed', event: 'Labor Day', impact: null } };
    const r = await render(PtCalendar, { month: '2026-09', kind: 'dividend', view: 'week', start: '2026-09-28' }, withData({ 'events@1': { asOf: '2026-09-30', items: [closed] } }));
    expect(r.text()).toContain('No ex-dividend dates scheduled in the week of Sep 28, 2026 in the tracked universe yet.');
  });
  it('week view: the five sessions of the week it is given, one call for the week (across a month end), week arrows', async () => {
    const asked: unknown[] = [];
    const r = await render(PtCalendar, { month: '2026-09', view: 'week', start: '2026-09-28' }, async (t, p) => { asked.push(p); return demo()(t, p); });
    expect(r.el.querySelectorAll('.pt-cal-day')).toHaveLength(5);
    expect(r.el.querySelector('h3.pt-section-title')!.textContent).toBe('Week of Sep 28, 2026');
    expect([...r.el.querySelectorAll('.pt-cal-dow')].map((d) => d.textContent)).toEqual(['Mon 28', 'Tue 29', 'Wed 30', 'Thu 1', 'Fri 2']);
    expect(asked).toEqual([{ scope: { by: 'dates', from: '2026-09-28', to: '2026-10-02' }, kinds: ['earnings', 'macro'] }]);
    expect(r.el.querySelector('.pt-cal-list')).toBeNull();
    await click(r, navs(r.el)[1]!);
    expect(r.el.querySelector('h3.pt-section-title')!.textContent).toBe('Week of Oct 5, 2026');
    expect(asked.at(-1)).toEqual({ scope: { by: 'dates', from: '2026-10-05', to: '2026-10-09' }, kinds: ['earnings', 'macro'] });
  });
  it('week view without a start: the first week of its month', async () => {
    expect((await render(PtCalendar, { month: '2026-09', view: 'week' })).el.querySelector('h3.pt-section-title')!.textContent).toBe('Week of Aug 31, 2026');
  });
  it('the arrows stop at the calendar window (a month back, three ahead of the latest session)', async () => {
    const at = async (inputs: Record<string, unknown>) => navs((await render(PtCalendar, inputs, withData({ 'events@1': { asOf: '2026-10-02', items: [] } }))).el).map((b) => b.disabled);
    expect(await at({ month: '2026-09' })).toEqual([true, false]);
    expect(await at({ month: '2026-10' })).toEqual([false, false]);
    expect(await at({ month: '2027-01' })).toEqual([false, true]);
    expect(await at({ month: '2027-01', view: 'week', start: '2027-01-25' })).toEqual([false, true]);
  });
  it('a week whose dates cannot be read says so', async () => {
    expect((await render(PtCalendar, { month: '2026-09', view: 'week', start: '2026-09-28' }, withData({ 'events@1': null }))).html()).toContain('pt-na');
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
    const r = await render(PtCalendar, { month: '2026-10' }, async (t, p) => { asked.push(p); return demo()(t, p); });
    expect(r.text()).toContain('October 2026');
    await click(r, navs(r.el)[1]!);
    expect(r.text()).toContain('November 2026');
    expect(asked).toEqual([{ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] }, { scope: { by: 'universe', month: '2026-11' }, kinds: ['earnings', 'macro'] }]);
  });
  it('puts each company\'s logo in its chip and in the list; the chip keeps its tooltip rows (the hover card shows them)', async () => {
    const ev = eventsDemo({ scope: { by: 'universe', month: '2026-10' }, kinds: ['earnings', 'macro'] });
    const first = ev.items.find((e) => e.kind === 'earnings')!;
    first.logo = `/logos/${first.ticker.toLowerCase()}`;
    const { el } = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': ev }));
    const chip = el.querySelector(`.pt-cal-grid a.pt-cal-ev[href="/stocks/${first.ticker.toLowerCase()}/"]`)!;
    expect(chip.getAttribute('data-tip')).toContain(first.ticker);
    expect(chip.querySelector('img.pt-logo')!.getAttribute('src')).toBe(first.logo);
    expect(el.querySelector('.pt-cal-list li img.pt-logo')).not.toBeNull();
  });
  it('while the next month loads (or if it never does), the calendar still names the month its data is for', async () => {
    let n = 0;
    const r = await render(PtCalendar, { month: '2026-10' }, (t, p) => (n++ === 0 ? demo()(t, p) : new Promise(() => {})), { browser: true });
    const before = r.el.querySelector('.pt-cal-grid')!.innerHTML;
    navs(r.el)[1]!.click();
    r.f.detectChanges();
    await Promise.resolve();
    r.f.detectChanges();
    expect(r.text()).toContain('October 2026');
    expect(r.text()).not.toContain('November 2026');
    expect(r.el.querySelector('.pt-cal-grid')!.innerHTML).toBe(before);
    expect(r.el.querySelector('.pt-cal')!.classList).toContain('pt-busy');
  });
});

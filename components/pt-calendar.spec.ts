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
    const { el } = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': { asOf: '2026-10-02', items: many } }));
    expect(el.querySelectorAll('.pt-cal-grid .pt-cal-ev')).toHaveLength(4);
    expect(el.querySelector('.pt-cal-grid')!.textContent).toContain('+3 more');
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
    const grid = (await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': events }))).el.querySelector('.pt-cal-grid')!;
    expect(grid.querySelectorAll('.pt-cal-macro').length).toBe(macro.length);
    expect(out).toContain('Fed');
    expect(out).not.toContain('/stocks//');
    const list = (await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': events }))).el.querySelector('.pt-cal-list')!.textContent!;
    expect(list).toContain('Fed rate decision');
    expect(list).not.toMatch(/\(Fed Interest Rate Decision\)/);
  });
  it('marks an estimated earnings date with ~ and says so in the tip; a confirmed one is plain', async () => {
    const base = { date: '2026-10-15', ticker: 'NVDA', name: 'NVIDIA', logo: null, mcap: 5e12, kind: 'earnings' as const };
    const d = { asOf: '2026-10-02', items: [
      { ...base, meta: { time: 'amc' as const, confirmed: false, epsEst: 1.3, epsActual: null, revEst: null, revActual: null } },
      { ...base, ticker: 'AAPL', name: 'Apple', meta: { time: 'amc' as const, confirmed: true, epsEst: 2, epsActual: null, revEst: null, revActual: null } },
      { ...base, ticker: 'KO', name: 'Coca-Cola', meta: { time: 'bmo' as const, epsEst: 1, epsActual: null, revEst: null, revActual: null } }] };
    const out = await html(d);
    expect(out).toContain('~AMC');
    expect(out).toContain('Estimated date');
    expect(out).toContain('Confirmed by the company');
    // the grid says no time (its chips carry the hint): the ~ is the text list's, and the chip's tooltip says it in words
    expect(out.match(/~AMC/g)!.length).toBe(1);
    expect(out).toContain('after the close');
    // the text list names each company as a link with its logo (its card on hover), the time after it
    const list = await render(PtCalendar, { month: '2026-10', kind: 'earnings' }, withData({ 'events@1': d }));
    const said = list.el.querySelector('.pt-cal-list')!.textContent!.replace(/\s+/g, ' ');
    expect(said).toContain('Nvidia NVDA ~AMC');
    expect(said).toContain('Apple AAPL AMC');
    expect([...list.el.querySelectorAll('.pt-cal-list a.pt-mention')].map((a) => a.getAttribute('href'))).toEqual(['/stocks/nvda/', '/stocks/aapl/', '/stocks/ko/']);
    expect(out).toContain('BMO');
    expect(out).not.toContain('~BMO');
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
    const chip = [...el.querySelectorAll('.pt-cal-grid button.pt-cal-ev')].find((b) => b.textContent!.includes(first.ticker))!;
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

/**
 * The evening of Tuesday Oct 27 (made-up numbers): the Fed tomorrow and CPI two weeks ago; Microsoft and Apple still to report,
 * Chevron's date not confirmed and nothing on file but its estimate (as www's calendar reads before the platform fills the outlook);
 * Coca-Cola reported this morning, Visa tonight (no session has traded it yet).
 */
const story = (title: string, tag: string | null, at: string) => ({ publishedAt: `${at}T14:00:00Z`, title, site: 'Reuters', url: `https://example.com/${at}`, tag });
const co = (ticker: string, name: string, date: string, time: 'bmo' | 'amc', mcap: number, meta: Record<string, unknown>) =>
  ({ date, ticker, name, logo: `/logos/${ticker.toLowerCase()}.webp`, mcap, kind: 'earnings' as const,
    meta: { time, confirmed: true, epsEst: null, epsActual: null, revEst: null, revActual: null, ...meta } });
const FED = { date: '2026-10-28', kind: 'macro' as const, meta: { label: 'Fed', event: 'Fed Interest Rate Decision', impact: 'High',
  headline: { name: 'Fed funds rate', unit: '%', expected: 3.5, previous: 3.75, actual: null },
  moves: [0.011, -0.016, 0.009, 0.012, -0.007, 0.014, -0.021, 0.008], move: null, news: [story('The Fed is expected to cut again', 'Preview', '2026-10-26')] } };
const CPI = { date: '2026-10-14', kind: 'macro' as const, meta: { label: 'CPI', event: 'Inflation Rate YoY (Sep) · Core Inflation Rate YoY (Sep)', impact: 'High',
  headline: { name: 'CPI YoY', unit: '%', expected: 2.8, previous: 2.9, actual: 2.9 }, moves: [0.01, -0.012, 0.008, 0.011, -0.009, 0.013, -0.01, 0.007], move: -0.012 } };
/** Each past report: its EPS surprise and the move after it, oldest first. */
const past = (surprises: (number | null)[], moves: number[]) => moves.map((move, i) => ({ surprise: surprises[i] ?? null, move }));
const MSFT = co('MSFT', 'Microsoft Corporation', '2026-10-28', 'amc', 3.88e12, { epsEst: 3.68, revEst: 77.4e9, move: null,
  reports: past([0.05, 0.03, 0.04, 0.08, -0.04, 0.06, 0.09, 0.03], [0.042, -0.061, 0.018, 0.075, -0.039, 0.045, 0.083, -0.012]),
  news: [story('Microsoft earnings preview: Azure in focus', 'Preview', '2026-10-26'), story('Microsoft signs a cloud deal', null, '2026-10-22')] });
const AAPL = co('AAPL', 'Apple Inc.', '2026-10-29', 'amc', 3.89e12, { epsEst: 1.77,
  reports: past([0.04, 0.05, 0.03, 0.06, 0.03, 0.04, 0.05, 0.07], [0.03, -0.02, 0.05, 0.04, -0.03, 0.06, 0.02, -0.04]) });
const CVX = co('CVX', 'Chevron Corporation', '2026-10-30', 'bmo', 2.76e11, { confirmed: false, epsEst: 1.3 });
const KO = co('KO', 'Coca-Cola', '2026-10-27', 'bmo', 3.03e11, { epsEst: 0.78, epsActual: 0.81, move: 0.011,
  reports: past([0.03, 0.01, 0.04, 0.05, -0.03, 0.03, 0.04, 0.03], [0.021, -0.018, 0.025, -0.02, 0.019, 0.023, -0.022, 0.02]) });
const V = co('V', 'Visa Inc.', '2026-10-27', 'amc', 6.7e11, { epsEst: 2.97, epsActual: 3.04, move: null,
  reports: past([0.03, 0.04, 0.05, 0.03, -0.01, 0.04, 0.03, 0.05], [0.03, -0.035, 0.028, 0.04, -0.031, 0.033, -0.029, 0.03]) });
const OCT27 = { asOf: '2026-10-27', normal: 0.0068, items: [CPI, KO, V, FED, MSFT, AAPL, CVX] };

const rowsOf = async (ev: unknown, inputs: Record<string, unknown> = { month: '2026-10' }) => {
  const r = await render(PtCalendar, inputs, withData({ 'events@1': ev }));
  const rows = [...r.el.querySelectorAll<HTMLElement>('.pt-cal-row')];
  const of = (key: string) => rows.find((x) => x.querySelector('summary')!.textContent!.includes(key))!;
  const line = (row: HTMLElement, cls: string) => row.querySelector(`.${cls}`)?.textContent!.replace(/\s+/g, ' ').trim() ?? null;
  return { r, rows, of, line };
};

describe('pt-calendar rows: what to expect from each event', () => {
  it('the market\'s dates first, then the companies still to report, the largest first, then those already reported', async () => {
    const { r, rows } = await rowsOf(OCT27);
    const keys = rows.map((x) => x.querySelector('[data-card]')?.getAttribute('data-card') ?? x.querySelector('.pt-cal-row-label')!.textContent!.trim());
    expect(keys).toEqual(['Fed', 'AAPL', 'MSFT', 'CVX', 'CPI', 'V', 'KO']);
    expect(r.el.querySelector('.pt-cal-rows-sep')!.textContent).toContain('Already reported');
    expect(r.el.querySelector('h3.pt-cal-rows-title')!.textContent).toBe('Important earnings and economic data in October 2026');
  });
  it('a row says when, the session that trades a report, and whether the date is confirmed', async () => {
    const { of, line } = await rowsOf(OCT27);
    expect(line(of('Fed'), 'pt-cal-row-when')).toBe('Due Wed, Oct 28');
    expect(line(of('MSFT'), 'pt-cal-row-when')).toBe('Wed, Oct 28 · after the close · reacts Thu');
    expect(line(of('CVX'), 'pt-cal-row-when')).toBe('Around Fri, Oct 30 · before the open · not confirmed');
    expect(line(of('CPI'), 'pt-cal-row-when')).toBe('Released Wed, Oct 14');
    expect(line(of('KO'), 'pt-cal-row-when')).toBe('Reported Tue, Oct 27 · before the open');
    expect(line(of('Visa'), 'pt-cal-row-when')).toBe('Reported Tue, Oct 27 · after the close · reacts Wed');
  });
  it('before a report: its usual move, its record against the estimate and how often it rose after, its last moves as bars', async () => {
    const { of, line } = await rowsOf(OCT27);
    const msft = of('MSFT');
    expect(line(msft, 'pt-cal-row-cue')).toBe('±4.7%');
    expect(line(msft, 'pt-cal-row-hint')).toBe('Beat 7 of 8 · rose after 5 of 8');
    // the bars stay (Romeo: "le barrette restano, erano meglio"): the move after each of its last reports, up green, down red
    expect([...msft.querySelectorAll('svg.pt-cal-row-bars rect')].map((r) => r.getAttribute('class')))
      .toEqual(['pt-t-pos', 'pt-t-neg', 'pt-t-pos', 'pt-t-pos', 'pt-t-neg', 'pt-t-pos', 'pt-t-pos', 'pt-t-neg']);
    expect(msft.querySelector('.pt-cal-row-thumbs')).toBeNull();
    expect(msft.querySelector('summary')!.querySelector('a')).toBeNull(); // one control: no link inside the summary
    expect(line(msft, 'pt-cal-row-who')).toBe('Microsoft MSFT');
    expect(msft.querySelector('summary [data-card="MSFT"]')!.textContent).toBe('MSFT'); // the symbol opens its card on hover
  });
  it('with fewer than four reports on file, no usual move: the EPS estimate says what is expected', async () => {
    const { of, line } = await rowsOf(OCT27);
    expect(line(of('CVX'), 'pt-cal-row-cue')).toBe('');
    expect(line(of('CVX'), 'pt-cal-row-hint')).toBe('EPS est. $1.30');
    expect(of('CVX').querySelector('svg.pt-cal-row-bars')).toBeNull();
    // three reports on file: too few for a usual move or its bars, the estimate says what is expected
    const few = co('ZZ', 'Few Inc.', '2026-10-29', 'amc', 1e9, { epsEst: 1, reports: past([0.01, null, -0.03], [0.02, -0.01, 0.03]) });
    const z = (await rowsOf({ ...OCT27, items: [few] })).rows[0]!;
    expect(z.querySelector('svg.pt-cal-row-bars')).toBeNull();
    expect(z.querySelector('.pt-cal-row-cue')!.textContent!.trim()).toBe('');
    expect(z.querySelector('.pt-cal-row-hint')!.textContent!.trim()).toBe('EPS est. $1.00');
  });
  it('after a report: the move it made against its usual size, and the verdict; until a session trades it, its usual move', async () => {
    const { of, line } = await rowsOf(OCT27);
    expect(line(of('KO'), 'pt-cal-row-cue')).toBe('+1.1%');
    expect(of('KO').querySelector('.pt-cal-row-cue')!.classList).toContain('pt-t-pos');
    expect(line(of('KO'), 'pt-cal-row-hint')).toBe('A beat (+4%) · 0.5× its usual');
    expect(line(of('Visa'), 'pt-cal-row-cue')).toBe('±3.2%');
    expect(line(of('Visa'), 'pt-cal-row-hint')).toBe('A beat (+2%)');
  });
  it('a market date: what is expected, the market\'s usual move on its releases; once out, the figure and the move', async () => {
    const { of, line } = await rowsOf(OCT27);
    // the label beside a title that does not repeat it (not "CPI CPI report"); the list by day names the report
    expect([line(of('Fed'), 'pt-cal-row-who'), line(of('CPI'), 'pt-cal-row-who')]).toEqual(['Rate decision', 'Consumer prices']);
    expect(line(of('Fed'), 'pt-cal-row-cue')).toBe('±1.2%');
    expect(line(of('Fed'), 'pt-cal-row-hint')).toBe('Expected: a cut to 3.50% (from 3.75%)');
    expect(line(of('CPI'), 'pt-cal-row-cue')).toBe('-1.2%');
    expect(line(of('CPI'), 'pt-cal-row-hint')).toBe('2.9% vs 2.8% expected');
    const held = { ...FED, meta: { ...FED.meta, headline: { ...FED.meta.headline, expected: 3.75, actual: 3.75 } }, date: '2026-10-21' };
    expect(line((await rowsOf({ ...OCT27, items: [held] })).rows[0]!, 'pt-cal-row-hint')).toBe('Held at 3.75%, as expected');
  });
  it('a row opens to the sentence, with the company as a link; the estimates; the news about the event', async () => {
    const { of } = await rowsOf(OCT27);
    const more = of('MSFT').querySelector('.pt-cal-row-more')!;
    const said = more.querySelector('.pt-cal-row-say')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(said).toBe('Microsoft MSFT reports Wed, Oct 28 (confirmed), after the close; the stock reacts Thu, Oct 29. ' +
      'In the session after each of its last 8 reports it moved ±4.7% on average. It beat the EPS estimate in 7 of its last 8 reports.');
    expect(more.querySelector('a.pt-mention')!.getAttribute('href')).toBe('/stocks/msft/');
    expect(more.textContent).toContain('EPS est. $3.68 · revenue est. $77.4B');
    const news = [...more.querySelectorAll('.pt-news-item')];
    expect(news.map((n) => [n.querySelector('.pt-cal-row-tag')?.textContent ?? null, n.querySelector('a')!.textContent, n.querySelector('.pt-meta')!.textContent]))
      .toEqual([['Preview', 'Microsoft earnings preview: Azure in focus', 'Reuters · Oct 26'], [null, 'Microsoft signs a cloud deal', 'Reuters · Oct 22']]);
    const a = news[0]!.querySelector('a')!;
    expect([a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]).toEqual(['https://example.com/2026-10-26', '_blank', 'nofollow noopener noreferrer']);
  });
  it('the sentences of the other cases: an unconfirmed date, a report traded and one not yet, the Fed, a release', async () => {
    const { of } = await rowsOf(OCT27);
    const said = (k: string) => of(k).querySelector('.pt-cal-row-say')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(said('CVX')).toBe('Chevron CVX is expected to report around Fri, Oct 30 (date not confirmed), before the open. The EPS estimate is $1.30.');
    expect(said('KO')).toBe('Coca-Cola KO reported Tue, Oct 27, before the open: EPS $0.81 vs $0.78 expected, a beat (+4%). ' +
      'The stock moved +1.1% in the session that traded it, 0.5× its usual ±2.1%.');
    expect(said('Visa')).toBe('Visa V reported Tue, Oct 27, after the close: EPS $3.04 vs $2.97 expected, a beat (+2%); the stock reacts Wed, Oct 28. ' +
      'Its usual move after a report: ±3.2%.');
    expect(said('Fed')).toBe('The Fed\'s rate decision is due Wed, Oct 28: expected a cut to 3.50% (from 3.75%). ' +
      'On its last 8 decisions the market (SPY) moved ±1.2% on average, 1.8× a normal day.');
    expect(said('CPI')).toBe('The CPI report came out Wed, Oct 14: 2.9% vs 2.8% expected (previous 2.9%). The market (SPY) moved -1.2% that session, 1.8× a normal day.');
  });
  it('www\'s calendar before the platform fills the outlook: rows with the date and the estimate, nothing made up', async () => {
    const bare = { asOf: '2026-10-27', items: [{ ...MSFT, meta: { time: 'amc', confirmed: true, epsEst: 3.68, epsActual: null, revEst: null, revActual: null } },
      { date: '2026-10-28', kind: 'macro', meta: { label: 'Fed', event: 'Fed Interest Rate Decision', impact: 'High' } }] };
    const { of, line } = await rowsOf(bare);
    expect(line(of('MSFT'), 'pt-cal-row-cue')).toBe('');
    expect(line(of('MSFT'), 'pt-cal-row-hint')).toBe('EPS est. $3.68');
    expect(line(of('Fed'), 'pt-cal-row-hint')).toBe('');
    expect(of('Fed').querySelector('.pt-cal-row-say')!.textContent!.trim()).toBe('The Fed\'s rate decision is due Wed, Oct 28.');
    expect((await rowsOf(bare)).r.el.querySelector('.pt-cal-rows-head .pt-meta')).toBeNull(); // no ± on any row: no legend for it
    expect((await rowsOf(OCT27)).r.el.querySelector('.pt-cal-rows-head .pt-meta')!.textContent).toContain('± is the usual move');
  });
  it('twenty rows at first on a month (ten on a week), then more; every report stays in the list by day', async () => {
    const lots = { asOf: '2026-10-02', items: Array.from({ length: 25 }, (_, i) => co(`T${String.fromCharCode(65 + i)}`, `Co ${i}`, '2026-10-15', 'amc', 1e12 - i * 1e10, { epsEst: 1 })) };
    const { r, rows } = await rowsOf(lots);
    expect(rows).toHaveLength(20);
    expect(r.el.querySelector('pt-more')!.textContent).toContain('Show 5 more');
    await click(r, r.el.querySelector('pt-more button'));
    expect(r.el.querySelectorAll('.pt-cal-row')).toHaveLength(25);
    expect(r.el.querySelector('pt-more')).toBeNull();
    expect(r.el.querySelectorAll('.pt-cal-list a.pt-mention')).toHaveLength(25);
    const week = await rowsOf(lots, { month: '2026-10', view: 'week', start: '2026-10-12' });
    expect(week.rows).toHaveLength(10);
    expect(week.r.el.querySelector('h4.pt-cal-rows-title')!.textContent).toBe('Important earnings and economic data, week of Oct 12');
  });
  it('a dividend calendar: the amount and when it is paid, the largest first, no market dates; holidays are no rows', async () => {
    const ko = { date: '2026-10-15', ticker: 'KO', name: 'Coca-Cola', logo: null, mcap: 3e11, kind: 'dividend' as const, meta: { amount: 0.51, payDate: '2026-10-30' } };
    const closed = { date: '2026-10-12', kind: 'macro' as const, meta: { label: 'Closed', event: 'Columbus Day', impact: null } };
    const { r, rows, line } = await rowsOf({ asOf: '2026-10-02', items: [ko, FED, closed] }, { month: '2026-10', kind: 'dividend' });
    expect(rows).toHaveLength(1);
    expect([line(rows[0]!, 'pt-cal-row-cue'), line(rows[0]!, 'pt-cal-row-when'), line(rows[0]!, 'pt-cal-row-hint')]).toEqual(['$0.51', 'Ex-dividend Thu, Oct 15', 'Paid Oct 30']);
    expect(r.el.querySelector('.pt-cal-rows-title')!.textContent).toBe('The largest ex-dividend dates in October 2026');
    expect((await rowsOf({ asOf: '2026-10-02', items: [closed, CVX] })).rows).toHaveLength(1);
  });
  it('opening a row counts as an interaction', async () => {
    const { of } = await rowsOf(OCT27);
    const seen: string[] = [];
    const d = of('MSFT') as HTMLDetailsElement;
    d.addEventListener('pt-interact', (e) => seen.push((e as CustomEvent<{ action: string }>).detail.action));
    const tick = () => new Promise((r) => setTimeout(r, 20));
    d.open = true; // the browser fires toggle
    await tick();
    expect(seen).toEqual(['open']);
    d.open = false; // closing it is not counted
    await tick();
    expect(seen).toEqual(['open']);
  });
});

describe('pt-calendar grid: the hint in the chip, a click opens the event', () => {
  const chipOf = (el: HTMLElement, key: string) => [...el.querySelectorAll<HTMLElement>('.pt-cal-grid .pt-cal-ev, .pt-cal-grid .pt-cal-macro')]
    .find((b) => b.textContent!.includes(key))!;
  const cueOf = (b: Element) => b.querySelector('.pt-cal-cue')?.textContent!.trim() ?? null;
  it('a chip carries the hint instead of the time: the usual move before a report, the move after it; a market date its usual move', async () => {
    const { el } = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': OCT27 }));
    const grid = el.querySelector('.pt-cal-grid')!;
    expect(grid.textContent).not.toMatch(/AMC|BMO/);
    expect(cueOf(chipOf(el, 'MSFT'))).toBe('±4.7%');
    expect(cueOf(chipOf(el, 'KO'))).toBe('+1.1%');
    expect(chipOf(el, 'KO').querySelector('.pt-cal-cue')!.classList).toContain('pt-t-pos');
    expect(cueOf(chipOf(el, 'Fed'))).toBe('±1.2%');
    expect(cueOf(chipOf(el, 'CVX'))).toBe(''); // nothing on file but its estimate: no number made up
    expect(chipOf(el, 'CVX').classList).toContain('pt-cal-ev-unconf');
    expect(chipOf(el, 'CVX').textContent).toContain('(date not confirmed)');
    // hovering the symbol opens the company's card, as everywhere (Romeo: "la card al passaggio del mouse deve rimanere")
    expect(chipOf(el, 'MSFT').getAttribute('data-card')).toBe('MSFT');
    expect(chipOf(el, 'Fed').hasAttribute('data-card')).toBe(false);
  });
  it('clicking a chip opens its event as its row opens, with the company\'s card under it (the page fills the slot); × and Escape close it', async () => {
    const r = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': OCT27 }));
    document.body.append(r.el);
    const chip = chipOf(r.el, 'MSFT');
    await click(r, chip);
    const pop = r.el.querySelector('.pt-cal-pop')!;
    expect(pop.getAttribute('role')).toBe('dialog');
    expect(pop.querySelector('.pt-cal-row-cue')!.textContent!.trim()).toBe('±4.7%');
    expect(pop.querySelector('.pt-cal-row-hint')!.textContent!.trim()).toBe('Beat 7 of 8 · rose after 5 of 8');
    expect(pop.querySelector('.pt-cal-row-say')!.textContent!.replace(/\s+/g, ' ').trim()).toMatch(/^Microsoft MSFT reports Wed, Oct 28 \(confirmed\)/);
    expect(pop.querySelectorAll('.pt-news-item')).toHaveLength(2);
    // the earnings summary card first (its row, with the bars), the company's usual card under it
    const sum = pop.querySelector('.pt-cal-sum')!;
    expect(sum.querySelectorAll('svg.pt-cal-row-bars rect')).toHaveLength(8);
    expect(sum.querySelector('.pt-cal-hist')).toBeNull();
    expect(pop.querySelector('[data-card-slot]')!.getAttribute('data-card-slot')).toBe('MSFT');
    expect(sum.compareDocumentPosition(pop.querySelector('[data-card-slot]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.activeElement).toBe(pop);
    await click(r, pop.querySelector('button.pt-cal-pop-x'));
    expect(r.el.querySelector('.pt-cal-pop')).toBeNull();
    expect(document.activeElement).toBe(chip);
    await click(r, chip);
    r.el.querySelector('.pt-cal-pop')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(r.f);
    expect(r.el.querySelector('.pt-cal-pop')).toBeNull();
    r.el.remove();
  });
  it('a market date opens too, with no company card; a holiday stays a label', async () => {
    const closed = { date: '2026-10-12', kind: 'macro' as const, meta: { label: 'Closed', event: 'Columbus Day', impact: null } };
    const r = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': { ...OCT27, items: [...OCT27.items, closed] } }));
    await click(r, chipOf(r.el, 'Fed'));
    const pop = r.el.querySelector('.pt-cal-pop')!;
    expect(pop.querySelector('.pt-cal-row-say')!.textContent!.trim()).toMatch(/^The Fed's rate decision is due Wed, Oct 28/);
    expect(pop.querySelector('[data-card-slot]')).toBeNull();
    expect(chipOf(r.el, 'Closed').tagName).toBe('DIV');
  });
  it('in a day\'s "+N more", a chip opens its event in the same box', async () => {
    const r = await render(PtCalendar, { month: '2026-10' }, withData({ 'events@1': { asOf: '2026-10-02', items: many } }));
    await click(r, r.el.querySelector('button.pt-cal-more'));
    const inDay = [...r.el.querySelectorAll<HTMLElement>('.pt-cal-pop .pt-cal-ev')].find((b) => b.textContent!.includes('T5'))!;
    await click(r, inDay);
    expect(r.el.querySelectorAll('.pt-cal-pop')).toHaveLength(1);
    expect(r.el.querySelector('.pt-cal-pop .pt-cal-row-say')!.textContent!.replace(/\s+/g, ' ')).toContain('Co 5 T5 ');
    expect(r.el.querySelector('.pt-cal-pop [data-card-slot]')!.getAttribute('data-card-slot')).toBe('T5');
  });
});

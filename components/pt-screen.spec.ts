import { tone, usd } from '../src/ds/format';
import { screenDemo } from '../src/typologies';
import { PtScreen } from './pt-screen';
import { basics, column, press, render, withData } from './_spec';

describe('pt-screen', () => {
  basics(PtScreen, { list: 'biggest_losers', limit: 10 });
  it('renders one linked row per company with a sparkline', async () => {
    const data = screenDemo({ scope: { list: 'biggest_losers' }, limit: 10 });
    const { el, html } = await render(PtScreen, { list: 'biggest_losers', limit: 10 }, withData({ 'screen@1': data }));
    const out = html();
    expect(el.querySelectorAll('tr.pt-scr-row')).toHaveLength(data.rows.length);
    expect(out).toContain('href="/stocks/brk.b/"');
    expect(out.match(/<polyline/g)).toHaveLength(data.rows.length);
  });
  it('shows each company\'s logo from the site (initials when there is none)', async () => {
    const data = screenDemo({ scope: { list: 'biggest_losers' }, limit: 3 });
    data.rows[0]!.logo = `/logos/${data.rows[0]!.ticker.toLowerCase()}`;
    const out = (await render(PtScreen, { list: 'biggest_losers', limit: 3 }, withData({ 'screen@1': data }))).html();
    expect(out).toContain(`src="/logos/${data.rows[0]!.ticker.toLowerCase()}"`);
    expect(out.match(/pt-logo-initials/g)).toHaveLength(2);
  });
  it('sorts by a column header: 1D high to low, then low to high; the rank stays the list\'s own', async () => {
    const r = await render(PtScreen, { list: 'biggest_losers', limit: 10 });
    const before = column(r.el, 2);
    await press(r.f, r.el, '1D↕');
    const pctOf = (s: string) => Number(s.replace('%', '').replace('−', '-'));
    const down = column(r.el, 4).map(pctOf);
    expect(down).toEqual([...down].sort((a, b) => b - a));
    expect(r.el.querySelector('th[aria-sort="descending"]')!.textContent).toMatch(/^1D/);
    expect(column(r.el, 1).map(Number).map((n) => before[n - 1])).toEqual(column(r.el, 2));
    await press(r.f, r.el, '1D↓');
    expect(column(r.el, 4).map(pctOf)).toEqual([...down].reverse());
  });
  it('highlights the subject of a peer list', async () => {
    const data = screenDemo({ scope: { peersOf: 'NVDA' }, limit: 5 });
    expect((await render(PtScreen, { peersOf: 'NVDA', limit: 5 }, withData({ 'screen@1': data }))).el.querySelectorAll('tr.pt-scr-row.pt-scr-self')).toHaveLength(1);
  });
  it('shows the list-specific column, sortable', async () => {
    const data = screenDemo({ scope: { list: 'insider_buying' }, limit: 5 });
    const r = await render(PtScreen, { list: 'insider_buying', limit: 5 }, withData({ 'screen@1': data }));
    expect(r.html()).toContain('Insiders 90d');
    const row = data.rows[0]!;
    expect(r.html()).toContain(`<span class="pt-t-${tone(row.insiderNet)}">${usd(row.insiderNet, { compact: true, signed: true })}</span>`);
    await press(r.f, r.el, 'Insiders 90d↕');
    expect(r.el.querySelector('th[aria-sort]')!.textContent).toMatch(/^Insiders 90d/);
  });
  it('explains an empty list; without a limit asks for 25 (the default)', async () => {
    expect((await render(PtScreen, { list: '52w_low' }, withData({ 'screen@1': { asOf: '2026-10-02', rows: [] } }))).html()).toContain('No companies match');
    const asked: unknown[] = [];
    await render(PtScreen, { list: '52w_low' }, async (t, p) => { asked.push(p); return withData({})(t, p); });
    expect(asked).toEqual([{ scope: { list: '52w_low' }, limit: 25 }]);
  });
});

describe('pt-screen: "Show 20 more"', () => {
  const template = screenDemo({ scope: { list: 'largest' }, limit: 1 }).rows[0]!;
  /** A list of `total` companies: every call answers the first `limit` of them, and is recorded. */
  const listOf = (total: number, asked: number[] = []) => async (_t: string, p: unknown) => {
    const { limit } = p as { limit: number };
    asked.push(limit);
    return { asOf: '2026-10-02', rows: Array.from({ length: Math.min(limit, total) }, (_, i) => ({ ...template, ticker: `T${i}`, name: `Company ${i}`, marketCap: 1e12 - i })) };
  };
  const rows = (el: HTMLElement) => el.querySelectorAll('tr.pt-scr-row').length;
  const more = (el: HTMLElement) => el.querySelector('pt-more button');

  it('starts at its limit and asks 20 more rows per press, until a call answers fewer rows than asked', async () => {
    const asked: number[] = [];
    const r = await render(PtScreen, { list: 'largest', limit: 20 }, listOf(45, asked));
    expect(rows(r.el)).toBe(20);
    await press(r.f, r.el, 'Show 20 more');
    expect([rows(r.el), asked]).toEqual([40, [20, 40]]);
    await press(r.f, r.el, 'Show 20 more');
    expect([rows(r.el), asked]).toEqual([45, [20, 40, 60]]);
    expect(more(r.el)).toBeNull();
  });
  it('a list whose length is a multiple of 20 ends after one press that finds nothing new; no request follows by itself', async () => {
    const asked: number[] = [];
    const r = await render(PtScreen, { list: 'largest', limit: 20 }, listOf(40, asked));
    await press(r.f, r.el, 'Show 20 more');
    expect(more(r.el)).not.toBeNull();
    await press(r.f, r.el, 'Show 20 more');
    expect(more(r.el)).toBeNull();
    await new Promise((ok) => setTimeout(ok, 20));
    expect(asked).toEqual([20, 40, 60]);
  });
  it('stops at the whole universe (600)', async () => {
    const r = await render(PtScreen, { list: 'largest', limit: 590 }, listOf(700));
    await press(r.f, r.el, 'Show 20 more');
    expect(rows(r.el)).toBe(600);
    expect(more(r.el)).toBeNull();
  });
  it('keeps the rows on screen while the next ones load', async () => {
    let release!: () => void;
    const gate = new Promise<void>((ok) => { release = ok; });
    const base = listOf(100);
    const r = await render(PtScreen, { list: 'largest', limit: 20 }, async (t, p) => ((p as { limit: number }).limit > 20 ? gate.then(() => base(t, p)) : base(t, p)), { browser: true });
    (more(r.el) as HTMLButtonElement).click();
    r.f.detectChanges();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    r.f.detectChanges();
    expect(rows(r.el)).toBe(20);
    expect(r.el.querySelector('.pt-table-wrap.pt-busy')).not.toBeNull();
    release();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    r.f.detectChanges();
    expect(rows(r.el)).toBe(40);
  });
  it('passes its sector into the list scope', async () => {
    const asked: unknown[] = [];
    await render(PtScreen, { list: 'largest', sector: 'Energy', limit: 5 }, async (t, p) => { asked.push(p); return withData({})(t, p); });
    expect(asked).toEqual([{ scope: { list: 'largest', sector: 'Energy' }, limit: 5 }]);
  });
});

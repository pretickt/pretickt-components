import { TestBed } from '@angular/core/testing';
import { DEMO_FACTS, DEMO_PORTFOLIOS } from '../../stories/fake-portfolio';
import { PtPortfolioEditor } from './editor';
import type { Stored } from './store';

const EMPTY: Stored = { v: 1, active: null, list: [] };

async function mount(stored: Stored = EMPTY, saving = true) {
  const f = TestBed.createComponent(PtPortfolioEditor);
  f.componentRef.setInput('stored', stored);
  f.componentRef.setInput('facts', DEMO_FACTS);
  f.componentRef.setInput('saving', saving);
  f.componentRef.setInput('today', '2026-11-08');
  const out: Stored[] = [];
  f.componentInstance.changed.subscribe((s) => { out.push(s); f.componentRef.setInput('stored', s); });
  const settle = async () => { for (let i = 0; i < 3; i++) { f.detectChanges(); TestBed.tick(); await new Promise((r) => setTimeout(r, 1)); } };
  await settle();
  const el = f.nativeElement as HTMLElement;
  const press = async (label: string) => { [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === label)!.click(); await settle(); };
  const type = async (sel: string, value: string) => { const i = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel)!; i.value = value; i.dispatchEvent(new Event('input')); await settle(); };
  return { el, out, press, type, text: () => el.textContent!.replace(/\s+/g, ' ') };
}

describe('pt-portfolio-editor: portfolios and watchlists kept in this browser', () => {
  it('creates a portfolio from a paste, after its preview', async () => {
    const m = await mount();
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 10 2026-01-05\nnvda 4\nZZZZ 3\nTotal 1,234.00');
    await m.press('Read');
    expect([...m.el.querySelectorAll('.pt-pf-preview tbody tr')].map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent!.trim()).filter(Boolean).join(' '))).toEqual(['AAPL Apple 10 Jan 5, 2026', 'NVDA Nvidia 4', 'ZZZZ not on pretickt 3']);
    expect(m.text()).toContain('Not on pretickt: ZZZZ. It counts in your total, not in the figures.');
    expect(m.text()).toContain('Not read: line 4 “Total 1,234.00”.');
    expect(m.out).toEqual([]); // nothing saved before Save
    await m.press('Save');
    expect(m.out[0]!.list).toEqual([expect.objectContaining({ name: 'Portfolio 1', kind: 'portfolio', unit: 'shares',
      rows: [{ t: 'AAPL', n: 10, d: '2026-01-05' }, { t: 'NVDA', n: 4, d: null }, { t: 'ZZZZ', n: 3, d: null }] })]);
    expect(m.out[0]!.active).toBe(m.out[0]!.list[0]!.id);
  });

  it('creates a watchlist only when asked, and says amounts and dates are not kept', async () => {
    const m = await mount();
    await m.press('New watchlist');
    await m.type('textarea.pt-pf-paste', 'AAPL 10\nAMD');
    await m.press('Read');
    expect(m.text()).toContain('A watchlist keeps the symbols: amounts and dates are not kept.');
    await m.press('Save');
    expect(m.out[0]!.list[0]).toMatchObject({ name: 'Watchlist 1', kind: 'watchlist', unit: 'equal', rows: [{ t: 'AAPL', n: null, d: null }, { t: 'AMD', n: null, d: null }] });
  });

  it('a refused paste saves nothing and names the lines', async () => {
    const m = await mount();
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 10\nNVDA 20%');
    await m.press('Read');
    expect(m.text()).toContain('Line 2 gives a percentage, line 1 shares: one kind of amount per portfolio.');
    expect([...m.el.querySelectorAll('button')].some((b) => b.textContent!.trim() === 'Save')).toBe(false);
    expect(m.out).toEqual([]);
  });

  it('adds a line by hand with a date', async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] });
    await m.type('input.pt-pf-find', 'micro');
    expect([...m.el.querySelectorAll('.pt-pf-matches button')].map((b) => b.textContent!.trim())).toEqual(['AMD · Advanced Micro Devices', 'MSFT · Microsoft']);
    await m.press('AMD · Advanced Micro Devices');
    await m.type('input.pt-pf-amount', '5');
    await m.type('input.pt-pf-date', '2026-02-02');
    await m.press('Add');
    expect(m.out.at(-1)!.list[0]!.rows.at(-1)).toEqual({ t: 'AMD', n: 5, d: '2026-02-02' });
  });

  it('switches, renames, copies as text, deletes after the in-page confirm', async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares, DEMO_PORTFOLIOS.watchlist] });
    expect([...m.el.querySelectorAll('.pt-pf-tab')].map((t) => t.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Long term Portfolio', 'Chips to watch Watchlist']);
    await m.press('Rename');
    await m.type('input.pt-pf-name', 'Core');
    await m.press('Save name');
    expect(m.out.at(-1)!.list[0]!.name).toBe('Core');
    await m.press('Copy as text');
    expect(m.el.querySelector<HTMLTextAreaElement>('textarea.pt-pf-copy')!.value.split('\n')[0]).toBe(`AAPL 40 ${DEMO_PORTFOLIOS.shares.rows[0]!.d}`);
    await m.press('Delete');
    expect(m.text()).toContain('Delete “Core”? This cannot be undone.');
    await m.press('Yes, delete');
    expect(m.out.at(-1)).toEqual({ v: 1, active: 'demo-watch', list: [DEMO_PORTFOLIOS.watchlist] });
  });

  it('private window: it works and says nothing is saved', async () => {
    expect((await mount(EMPTY, false)).text()).toContain('This browser does not keep data: nothing is saved after this visit.');
    expect((await mount(EMPTY, true)).text()).toContain("Saved only in this browser. Clearing the site's data removes it.");
  });
});

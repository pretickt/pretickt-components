import { TestBed } from '@angular/core/testing';
import { DEMO_FACTS } from '../../stories/fake-portfolio';
import { PtPortfolioDraft, type DraftSave } from './draft';
import type { PasteRow, Unit } from './parse';

const ROWS: PasteRow[] = [{ line: 1, t: 'AAPL', n: 10, d: '2026-01-05' }, { line: 2, t: 'NVDA', n: 4, d: null }, { line: 3, t: 'ZZZZ', n: 3, d: null }];

async function mount(o: { rows?: PasteRow[]; unit?: Unit | null; kind?: 'portfolio' | 'watchlist' } = {}) {
  const f = TestBed.createComponent(PtPortfolioDraft);
  f.componentRef.setInput('rows', o.rows ?? ROWS);
  f.componentRef.setInput('unit', o.unit === undefined ? 'shares' : o.unit);
  f.componentRef.setInput('kind', o.kind ?? 'portfolio');
  f.componentRef.setInput('facts', DEMO_FACTS);
  f.componentRef.setInput('today', '2026-11-08');
  const saved: DraftSave[] = [];
  f.componentInstance.save.subscribe((s) => saved.push(s));
  const settle = async () => { for (let i = 0; i < 3; i++) { f.detectChanges(); TestBed.tick(); await new Promise((r) => setTimeout(r, 1)); } };
  await settle();
  const el = f.nativeElement as HTMLElement;
  const rows = () => [...el.querySelectorAll<HTMLElement>('.pt-pf-dr')];
  const press = async (label: string, root: Element = el) => { [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === label)!.click(); await settle(); };
  const type = async (input: HTMLInputElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input')); await settle(); };
  const saveButton = () => [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Save')!;
  return { el, saved, rows, press, type, saveButton, settle };
}
const field = (row: Element, cls: string) => row.querySelector<HTMLInputElement>(`input.${cls}`)!;

describe('the preview, editable before it is saved', () => {
  it('shows each line with its company, amount and date; a symbol not on pretickt is marked', async () => {
    const m = await mount();
    expect(m.rows().map((r) => [field(r, 'pt-pf-sym').value, r.querySelector('.pt-pf-co')!.textContent!.trim(), field(r, 'pt-pf-n').value, field(r, 'pt-pf-d').value]))
      .toEqual([['AAPL', 'Apple', '10', '2026-01-05'], ['NVDA', 'Nvidia', '4', ''], ['ZZZZ', 'not on pretickt', '3', '']]);
  });

  it('changes an amount and a date, removes a line, adds one with the autocomplete, then saves what it shows', async () => {
    const m = await mount();
    await m.type(field(m.rows()[0]!, 'pt-pf-n'), '12');
    await m.type(field(m.rows()[1]!, 'pt-pf-d'), '2026-02-02');
    await m.press('Remove ZZZZ');
    await m.press('Add a line');
    const fresh = m.rows().at(-1)!;
    await m.type(field(fresh, 'pt-pf-sym'), 'micro');
    expect([...fresh.querySelectorAll('.pt-pf-sugg button')].map((b) => b.textContent!.trim())).toEqual(['AMD · Advanced Micro Devices', 'MSFT · Microsoft']);
    await m.press('AMD · Advanced Micro Devices', fresh);
    expect(field(m.rows().at(-1)!, 'pt-pf-sym').value).toBe('AMD');
    expect(m.rows().at(-1)!.querySelector('.pt-pf-co')!.textContent!.trim()).toBe('AMD');
    await m.type(field(m.rows().at(-1)!, 'pt-pf-n'), '3');
    await m.press('Save');
    expect(m.saved).toEqual([{ unit: 'shares', rows: [{ t: 'AAPL', n: 12, d: '2026-01-05' }, { t: 'NVDA', n: 4, d: '2026-02-02' }, { t: 'AMD', n: 3, d: null }] }]);
  });

  it('a symbol typed in full needs no pick; Enter takes the first suggestion', async () => {
    const m = await mount({ rows: [{ line: 1, t: 'AAPL', n: 1, d: null }] });
    await m.type(field(m.rows()[0]!, 'pt-pf-sym'), 'ko');
    expect(m.rows()[0]!.querySelector('.pt-pf-co')!.textContent!.trim()).toBe('Coca-Cola');
    await m.type(field(m.rows()[0]!, 'pt-pf-sym'), 'nvid');
    field(m.rows()[0]!, 'pt-pf-sym').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await m.settle();
    expect(field(m.rows()[0]!, 'pt-pf-sym').value).toBe('NVDA');
  });

  it('mixed amounts: the reader chooses the kind before saving; a line without an amount or a date after today blocks Save, said on its line', async () => {
    const m = await mount({ unit: null });
    expect(m.el.textContent).toContain('Choose what the amounts are');
    expect(m.saveButton().disabled).toBe(true);
    await m.press('Shares');
    expect(m.saveButton().disabled).toBe(false);
    await m.type(field(m.rows()[1]!, 'pt-pf-n'), '');
    expect(m.saveButton().disabled).toBe(true);
    expect(m.rows()[1]!.textContent).toContain('Give an amount');
    await m.type(field(m.rows()[1]!, 'pt-pf-n'), '4');
    await m.type(field(m.rows()[0]!, 'pt-pf-d'), '2027-01-01');
    expect(m.rows()[0]!.textContent).toContain('After today');
    expect(m.saveButton().disabled).toBe(true);
  });

  it('with no amounts, or on a watchlist, the lines are symbols only', async () => {
    const eq = await mount({ unit: 'equal' });
    expect(eq.el.querySelector('input.pt-pf-n')).toBeNull();
    const w = await mount({ kind: 'watchlist', unit: 'equal' });
    expect(w.el.querySelector('input.pt-pf-n')).toBeNull();
    expect(w.el.querySelector('input.pt-pf-d')).toBeNull();
    expect(w.el.textContent).not.toContain('Choose what the amounts are');
    await w.press('Save');
    expect(w.saved[0]!.rows).toEqual([{ t: 'AAPL', n: null, d: null }, { t: 'NVDA', n: null, d: null }, { t: 'ZZZZ', n: null, d: null }]);
  });

  it('"Add a line" puts the cursor in the new line\'s symbol: the reader types at once, and leaving it says what is missing', async () => {
    const m = await mount({ rows: [{ line: 1, t: 'AAPL', n: 1, d: null }] });
    await m.press('Add a line');
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await m.settle();
    expect(document.activeElement).toBe(field(m.rows().at(-1)!, 'pt-pf-sym'));
  });

  it("a new line's missing symbol is said once the reader leaves its field, not while they type it", async () => {
    const m = await mount({ rows: [{ line: 1, t: 'AAPL', n: 1, d: null }] });
    await m.press('Add a line');
    const sym = field(m.rows().at(-1)!, 'pt-pf-sym');
    sym.dispatchEvent(new Event('focus'));
    await m.settle();
    expect(m.rows().at(-1)!.textContent).not.toContain('Give a symbol');
    expect(m.saveButton().disabled).toBe(true);
    sym.dispatchEvent(new Event('blur'));
    await m.settle();
    expect(m.rows().at(-1)!.textContent).toContain('Give a symbol or pick a company');
  });
});

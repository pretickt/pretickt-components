import { TestBed } from '@angular/core/testing';
import { DEMO_FACTS, DEMO_PORTFOLIOS } from '../../stories/fake-portfolio';
import { PT_PORTFOLIO_AI, type AiAnswer, type AiReader } from './ai';
import { PtPortfolioEditor } from './editor';
import type { Stored } from './store';

const EMPTY: Stored = { v: 1, active: null, list: [] };

async function mount(stored: Stored = EMPTY, saving = true, ai?: AiReader) {
  if (ai) TestBed.configureTestingModule({ providers: [{ provide: PT_PORTFOLIO_AI, useValue: ai }] });
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
  // a paste, as the browser says it: the text in the box, then an input event that names how it came
  const paste = async (value: string) => { const i = el.querySelector<HTMLTextAreaElement>('textarea.pt-pf-paste')!; i.value = value; i.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste' })); await settle(); };
  return { el, out, press, type, paste, settle, text: () => el.textContent!.replace(/\s+/g, ' ') };
}

describe('pt-portfolio-editor: portfolios and watchlists kept in this browser', () => {
  it('creates a portfolio from a paste, after its preview', async () => {
    const m = await mount();
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 10 2026-01-05\nnvda 4\nZZZZ 3\nTotal 1,234.00');
    await m.press('Read');
    // the preview's lines, each editable: symbol, company, amount, date
    expect([...m.el.querySelectorAll('.pt-pf-dr')].map((r) => [r.querySelector<HTMLInputElement>('input.pt-pf-sym')!.value, r.querySelector('.pt-pf-cn')!.textContent!.trim(),
      r.querySelector<HTMLInputElement>('input.pt-pf-n')!.value, r.querySelector<HTMLInputElement>('input.pt-pf-d')!.value]))
      .toEqual([['AAPL', 'Apple', '10', '2026-01-05'], ['NVDA', 'Nvidia', '4', ''], ['ZZZZ', 'not on pretickt', '3', '']]);
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

  it('a paste of mixed amounts names the lines and saves nothing until the reader says what the amounts are', async () => {
    const m = await mount();
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 10\nNVDA 20%');
    await m.press('Read');
    expect(m.text()).toContain('Line 2 gives a percentage, line 1 shares: one kind of amount per portfolio.');
    const save = () => [...m.el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Save')!;
    expect(save().disabled).toBe(true);
    await m.press('Shares');
    await m.press('Save');
    expect(m.out[0]!.list[0]).toMatchObject({ unit: 'shares', rows: [{ t: 'AAPL', n: 10 }, { t: 'NVDA', n: 20 }] });
  });

  it("Edit lines opens a saved portfolio's lines, editable, dates included", async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] });
    await m.press('Edit lines');
    const first = m.el.querySelector('.pt-pf-dr')!;
    expect(first.querySelector<HTMLInputElement>('input.pt-pf-d')!.value).toBe(DEMO_PORTFOLIOS.shares.rows[0]!.d);
    const d = first.querySelector<HTMLInputElement>('input.pt-pf-d')!;
    d.value = '2026-03-02';
    d.dispatchEvent(new Event('input'));
    await m.press('Save');
    expect(m.out.at(-1)!.list[0]!.rows[0]).toEqual({ t: 'AAPL', n: 40, d: '2026-03-02' });
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
    // an amount typed as a broker writes it
    await m.type('input.pt-pf-find', 'coca');
    [...m.el.querySelectorAll<HTMLButtonElement>('.pt-pf-matches button')].find((x) => x.textContent!.trim().startsWith('KO ·'))!.click();
    await m.settle();
    await m.type('input.pt-pf-amount', '1,000');
    await m.press('Add');
    expect(m.out.at(-1)!.list[0]!.rows.at(-1)).toEqual({ t: 'KO', n: 1000, d: null });
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

describe("pt-portfolio-editor: Read asks the site's AI (Romeo, 2026-11-09: «Per il parsing dobbiamo usare sicuramente una LLM»)", () => {
  const asked: [string, string][] = [];
  const reader = (answer: AiAnswer | Promise<AiAnswer>): AiReader => ({ read: async (text, kind) => { asked.push([text, kind]); return answer; } });
  const rows = (el: HTMLElement) => [...el.querySelectorAll('.pt-pf-dr')].map((r) => [r.querySelector<HTMLInputElement>('input.pt-pf-sym')!.value, r.querySelector<HTMLInputElement>('input.pt-pf-n')!.value]);
  const PASTE = 'APPLE INC;US0378331005;12\nNVIDIA CORP;US67066G1040;30\nISHARES CORE S&P 500;IE00B5BMR087;20';
  beforeEach(() => { asked.length = 0; });

  it("sends the pasted text and its kind, shows the AI's lines, and how many AI readings are left today", async () => {
    const m = await mount(EMPTY, true, reader({ ok: true, left: 4, ignored: [], holdings: [
      { line: 1, symbol: 'AAPL', name: 'APPLE INC', amount: 12, unit: 'shares', date: null }, { line: 2, symbol: null, name: 'NVIDIA CORP', amount: 30, unit: 'shares', date: null },
      { line: 3, symbol: 'CSSPX', name: 'ISHARES CORE S&P 500', amount: 20, unit: 'shares', date: null }] }));
    await m.press('New portfolio');
    expect(m.text()).toContain('Read by AI as soon as you paste: the text is sent to pretickt and to an AI service to be turned into lines, and is not kept. 5 readings a day.');
    // said before the box, where the reader is before they paste
    const note = [...m.el.querySelectorAll('.pt-note')].find((n) => n.textContent!.startsWith('Read by AI as soon as you paste'))!;
    expect(note.compareDocumentPosition(m.el.querySelector('textarea.pt-pf-paste')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await m.type('textarea.pt-pf-paste', PASTE);
    await m.press('Read');
    expect(asked).toEqual([[PASTE, 'portfolio']]);
    expect(rows(m.el)).toEqual([['AAPL', '12'], ['NVDA', '30'], ['CSSPX', '20']]);
    expect(m.text()).toContain('Read by AI · 4 AI readings left today. Check the lines before you save.');
    expect(m.text()).toContain('Not on pretickt: CSSPX.');
  });
  it("the day's five used: read in the browser, and said", async () => {
    const m = await mount(EMPTY, true, reader({ ok: false, reason: 'limit' }));
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 10\nNVDA 4');
    await m.press('Read');
    expect(rows(m.el)).toEqual([['AAPL', '10'], ['NVDA', '4']]);
    expect(m.text()).toContain("Today's 5 AI readings are used: read without AI. Check the lines before you save.");
  });
  it('the AI not answering: read in the browser, and said', async () => {
    const m = await mount(EMPTY, true, reader({ ok: false, reason: 'network' }));
    await m.press('New watchlist');
    await m.type('textarea.pt-pf-paste', 'AAPL\nNVDA');
    await m.press('Read');
    expect(asked).toEqual([['AAPL\nNVDA', 'watchlist']]);
    expect([...m.el.querySelectorAll<HTMLInputElement>('input.pt-pf-sym')].map((i) => i.value)).toEqual(['AAPL', 'NVDA']);
    expect(m.text()).toContain('The AI reader did not answer: read without AI. Check the lines before you save.');
  });
  it('while it reads: Reading…, the button off; a second press asks nothing more', async () => {
    let done!: (a: AiAnswer) => void;
    const m = await mount(EMPTY, true, reader(new Promise<AiAnswer>((r) => { done = r; })));
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 10');
    await m.press('Read');
    const btn = [...m.el.querySelectorAll<HTMLButtonElement>('.pt-pf-form button')].find((b) => b.textContent!.trim() === 'Reading…')!;
    expect(btn.disabled).toBe(true);
    done({ ok: true, left: 2, ignored: [], holdings: [{ line: 1, symbol: 'AAPL', name: null, amount: 10, unit: 'shares', date: null }] });
    await m.settle();
    expect(asked).toHaveLength(1);
    expect(rows(m.el)).toEqual([['AAPL', '10']]);
  });
  it('Edit lines reads the saved lines in the browser: nothing is sent', async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] }, true, reader({ ok: false, reason: 'off' }));
    await m.press('Edit lines');
    expect(rows(m.el)[0]).toEqual(['AAPL', '40']);
    expect(asked).toEqual([]);
    expect(m.text()).not.toContain('Read by AI ·');
    expect(m.text()).not.toContain('without AI');
  });
  it("Edit lines, changed and read again, reads in the browser: the saved portfolio is never sent (the privacy policy: «nothing you saved»)", async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] }, true, reader({ ok: false, reason: 'off' }));
    await m.press('Edit lines');
    expect(m.text()).not.toContain('Read by AI as soon as you paste');
    await m.type('textarea.pt-pf-paste', 'AAPL 41\nNVDA 30');
    await m.press('Read');
    expect(asked).toEqual([]);
    expect(rows(m.el)).toEqual([['AAPL', '41'], ['NVDA', '30']]);
  });
  it('the AI finding no holding: read in the browser, and said', async () => {
    const m = await mount(EMPTY, true, reader({ ok: true, left: 3, ignored: [1, 2], holdings: [] }));
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 10\nNVDA 4');
    await m.press('Read');
    expect(rows(m.el)).toEqual([['AAPL', '10'], ['NVDA', '4']]);
    expect(m.text()).toContain('The AI reader found no holdings: read without AI. Check the lines before you save.');
  });
  it("a paste is read at once, with no Read to press (Romeo, 2026-11-09: «l'analisi parte appena si incolla il messaggio»)", async () => {
    const m = await mount(EMPTY, true, reader({ ok: true, left: 4, ignored: [], holdings: [{ line: 1, symbol: 'AAPL', name: null, amount: 12, unit: 'shares', date: null }] }));
    await m.press('New portfolio');
    await m.paste('AAPL 12');
    expect(asked).toEqual([['AAPL 12', 'portfolio']]);
    expect(rows(m.el)).toEqual([['AAPL', '12']]);
    expect(m.text()).toContain('Read by AI · 4 AI readings left today.');
  });
  it('text typed in the box waits for Read', async () => {
    const m = await mount(EMPTY, true, reader({ ok: true, left: 4, ignored: [], holdings: [{ line: 1, symbol: 'AAPL', name: null, amount: 12, unit: 'shares', date: null }] }));
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', 'AAPL 12');
    expect(asked).toEqual([]);
    expect(rows(m.el)).toEqual([]);
    await m.press('Read');
    expect(asked).toEqual([['AAPL 12', 'portfolio']]);
  });
  it('a second paste while the AI reads the first: the first answer is dropped, the box as it is now is read when it comes', async () => {
    const waits: ((a: AiAnswer) => void)[] = [];
    const m = await mount(EMPTY, true, { read: (text, kind) => { asked.push([text, kind]); return new Promise<AiAnswer>((r) => { waits.push(r); }); } });
    await m.press('New portfolio');
    await m.paste('AAPL 12');
    await m.paste('AAPL 12\nNVDA 3');
    expect(asked).toHaveLength(1);
    waits[0]!({ ok: true, left: 4, ignored: [], holdings: [{ line: 1, symbol: 'AAPL', name: null, amount: 12, unit: 'shares', date: null }] });
    await m.settle();
    expect(asked).toEqual([['AAPL 12', 'portfolio'], ['AAPL 12\nNVDA 3', 'portfolio']]);
    expect(rows(m.el)).toEqual([]);
    waits[1]!({ ok: true, left: 3, ignored: [], holdings: [{ line: 1, symbol: 'AAPL', name: null, amount: 12, unit: 'shares', date: null }, { line: 2, symbol: 'NVDA', name: null, amount: 3, unit: 'shares', date: null }] });
    await m.settle();
    expect(rows(m.el)).toEqual([['AAPL', '12'], ['NVDA', '3']]);
    expect(m.text()).toContain('Read by AI · 3 AI readings left today.');
  });
  it('a paste into a saved portfolio\'s lines is read in the browser: nothing is sent', async () => {
    const m = await mount({ v: 1, active: 'demo-shares', list: [DEMO_PORTFOLIOS.shares] }, true, reader({ ok: false, reason: 'off' }));
    await m.press('Edit lines');
    await m.paste('AAPL 41\nNVDA 30');
    expect(asked).toEqual([]);
    expect(rows(m.el)).toEqual([['AAPL', '41'], ['NVDA', '30']]);
  });
  it('a paste over 20,000 characters is read in the browser, and said', async () => {
    const m = await mount(EMPTY, true, reader({ ok: false, reason: 'off' }));
    await m.press('New portfolio');
    await m.type('textarea.pt-pf-paste', `AAPL 10\n${'#'.repeat(20_000)}`);
    await m.press('Read');
    expect(asked).toEqual([]);
    expect(m.text()).toContain('Over 20,000 characters: read without AI.');
  });
});

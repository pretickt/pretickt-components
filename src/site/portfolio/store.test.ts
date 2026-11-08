import { describe, expect, it } from 'vitest';
import { loadPortfolios, MAX_PORTFOLIOS, MAX_ROWS, PORTFOLIO_KEY, savePortfolios, withPortfolio, type Stored, type StoredPortfolio } from './store';

class Mem implements Storage {
  private m = new Map<string, string>();
  constructor(private readonly full = false) {}
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { if (this.full) throw new DOMException('quota', 'QuotaExceededError'); this.m.set(k, v); }
}
const pf = (id: string, o: Partial<StoredPortfolio> = {}): StoredPortfolio => ({ id, name: `P ${id}`, kind: 'portfolio', unit: 'shares', rows: [{ t: 'AAPL', n: 10, d: '2025-03-14' }], ...o });

describe('portfolios kept in the browser', () => {
  it('saves and loads a portfolio and a watchlist', () => {
    const s = new Mem(), stored: Stored = { v: 1, active: 'b', list: [pf('a'), pf('b', { kind: 'watchlist', unit: 'equal', rows: [{ t: 'NVDA', n: null, d: null }] })] };
    expect(savePortfolios(() => s, stored)).toBe(true);
    expect(loadPortfolios(() => s)).toEqual({ stored, saving: true, unread: false });
    expect(JSON.parse(s.getItem(PORTFOLIO_KEY)!).v).toBe(1);
  });

  it('a storage that throws: works for the visit, saving false', () => {
    expect(loadPortfolios(() => { throw new Error('denied'); })).toEqual({ stored: { v: 1, active: null, list: [] }, saving: false, unread: false });
    const full = new Mem(true);
    expect(loadPortfolios(() => full).saving).toBe(false);
    expect(savePortfolios(() => full, { v: 1, active: null, list: [pf('a')] })).toBe(false);
  });

  it('broken JSON or another version: empty, the old value kept aside once', () => {
    for (const raw of ['{not json', JSON.stringify({ v: 2, list: [] })]) {
      const s = new Mem();
      s.setItem(PORTFOLIO_KEY, raw);
      expect(loadPortfolios(() => s)).toEqual({ stored: { v: 1, active: null, list: [] }, saving: true, unread: true });
      expect(s.getItem(`${PORTFOLIO_KEY}-unread`)).toBe(raw);
      s.setItem(PORTFOLIO_KEY, '{again');
      loadPortfolios(() => s);
      expect(s.getItem(`${PORTFOLIO_KEY}-unread`)).toBe(raw); // the first one kept
    }
  });

  it('refuses an 11th portfolio and a 201st line, saying why', () => {
    const ten: Stored = { v: 1, active: null, list: Array.from({ length: MAX_PORTFOLIOS }, (_, i) => pf(String(i))) };
    expect(withPortfolio(ten, pf('new'))).toBe('You can keep 10 portfolios.');
    expect(withPortfolio(ten, pf('3', { name: 'Renamed' }))).toMatchObject({ active: '3', list: expect.arrayContaining([expect.objectContaining({ id: '3', name: 'Renamed' })]) });
    const many = Array.from({ length: MAX_ROWS + 1 }, () => ({ t: 'AAPL', n: 1, d: null }));
    expect(withPortfolio({ v: 1, active: null, list: [] }, pf('a', { rows: many }))).toBe('A portfolio holds up to 200 lines.');
    expect(withPortfolio({ v: 1, active: null, list: [] }, pf('a'))).toEqual({ v: 1, active: 'a', list: [pf('a')] });
  });
});

describe('what a stored value must hold to be read (2026-11-08)', () => {
  it('a value whose lines are not lines is set aside too, and the page is told', () => {
    const s = new Mem();
    const bad = JSON.stringify({ v: 1, active: 'a', list: [{ id: 'a', name: 'X', kind: 'portfolio', unit: 'shares', rows: [{ t: 7, n: 'ten' }] }] });
    s.setItem(PORTFOLIO_KEY, bad);
    expect(loadPortfolios(() => s)).toEqual({ stored: { v: 1, active: null, list: [] }, saving: true, unread: true });
    expect(s.getItem(`${PORTFOLIO_KEY}-unread`)).toBe(bad);
    const ok = new Mem();
    savePortfolios(() => ok, { v: 1, active: 'a', list: [pf('a')] });
    expect(loadPortfolios(() => ok).unread).toBe(false);
  });
});

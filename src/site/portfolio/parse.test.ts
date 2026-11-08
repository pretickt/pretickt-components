import { describe, expect, it } from 'vitest';
import { parsePaste, serialize } from './parse';

const SITE = new Set(['AAPL', 'MSFT', 'NVDA', 'BRK.B', 'VOO', 'SMH']);
const known = (s: string) => { const t = s.toUpperCase().replace(/[/-]/g, '.'); return SITE.has(t) ? t : null; };
const TODAY = '2026-11-06';
const rows = (text: string, kind: 'portfolio' | 'watchlist' = 'portfolio') => parsePaste(text, known, TODAY, kind);

describe('reading a paste', () => {
  it('reads one holding per line in each unit', () => {
    expect(rows('AAPL 10\nmsft 2.5\nBRK/B 4')).toMatchObject({ unit: 'shares', refused: null, rows: [{ line: 1, t: 'AAPL', n: 10, d: null }, { line: 2, t: 'MSFT', n: 2.5 }, { line: 3, t: 'BRK.B', n: 4 }] });
    expect(rows('AAPL 25%\nNVDA 75 %')).toMatchObject({ unit: 'pct', rows: [{ t: 'AAPL', n: 25 }, { t: 'NVDA', n: 75 }] });
    expect(rows('AAPL $5,000\nVOO, $12,500.50')).toMatchObject({ unit: 'usd', rows: [{ t: 'AAPL', n: 5000 }, { t: 'VOO', n: 12500.5 }] });
    expect(rows('AAPL\nNVDA\n\n# my list')).toMatchObject({ unit: 'equal', rows: [{ t: 'AAPL', n: null }, { t: 'NVDA', n: null }] });
  });

  it('reads a date, ISO or US; a date after today is refused on its line', () => {
    expect(rows('AAPL 10 2025-03-14\nNVDA 3 3/7/2024').rows.map((r) => r.d)).toEqual(['2025-03-14', '2024-03-07']);
    const late = rows('AAPL 10 2025-03-14\nNVDA 3 2027-01-04');
    expect(late.refused).toBe('Line 2: the date 2027-01-04 is after today.');
  });

  it("reads a broker's CSV export", () => {
    const csv = [
      'Account Summary for ****1234',
      'Positions as of 11/06/2026',
      'Symbol,Description,Quantity,Last Price,Current Value,Acquired',
      'AAPL,APPLE INC,"1,250",$215.20,"$269,000.00",03/14/2025',
      'BRK/B,BERKSHIRE HATHAWAY INC CL B,12,$480.00,"$5,760.00",',
      'SPAXX**,FIDELITY GOVERNMENT MONEY MARKET,,,"$1,200.00",',
      'Cash & Cash Investments,,,,"$310.00",',
      'Pending activity,,,,"-$20.00",',
      'Account Total,,,,"$276,250.00",',
    ].join('\n');
    expect(rows(csv)).toEqual({ unit: 'shares', refused: null, notOnSite: [], dropped: false, rows: [
      { line: 4, t: 'AAPL', n: 1250, d: '2025-03-14' }, { line: 5, t: 'BRK.B', n: 12, d: null },
    ] });
  });

  it('refuses mixed units, naming the lines', () => {
    expect(rows('AAPL 10\nMSFT 20%\nNVDA 5\nVOO 3\nSMH 30%').refused).toBe('Lines 2 and 5 give a percentage, lines 1, 3 and 4 shares: one kind of amount per portfolio.');
    expect(rows('AAPL 10\nMSFT').refused).toBe('Line 2 gives no amount, line 1 shares: one kind of amount per portfolio.');
  });

  it('names the symbols not on pretickt', () => {
    expect(rows('AAPL 10\nTSLAX 4\nnvda 2')).toMatchObject({ notOnSite: ['TSLAX'], rows: [{ t: 'AAPL' }, { t: 'NVDA' }] });
  });

  it('a watchlist keeps the symbols and says it dropped the rest', () => {
    expect(rows('AAPL 10 2025-03-14\nNVDA 20%', 'watchlist')).toEqual({ unit: 'equal', refused: null, notOnSite: [], dropped: true,
      rows: [{ line: 1, t: 'AAPL', n: null, d: null }, { line: 2, t: 'NVDA', n: null, d: null }] });
    expect(rows('AAPL\nNVDA', 'watchlist').dropped).toBe(false);
  });

  it('serialize and parse round-trip', () => {
    for (const text of ['AAPL 10 2025-03-14\nBRK.B 4', 'AAPL 25%\nNVDA 75%', 'AAPL $5,000\nVOO $12,500.5', 'AAPL\nNVDA']) {
      const p = rows(text);
      expect(rows(serialize(p.rows, p.unit)).rows.map(({ t, n, d }) => ({ t, n, d }))).toEqual(p.rows.map(({ t, n, d }) => ({ t, n, d })));
    }
  });
});

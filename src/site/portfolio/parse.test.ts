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
    expect(rows(csv)).toEqual({ unit: 'shares', refused: null, notOnSite: [], dropped: false, note: null, rows: [
      { line: 4, t: 'AAPL', n: 1250, d: '2025-03-14' }, { line: 5, t: 'BRK.B', n: 12, d: null },
    ] });
  });

  it("reads a broker's headers by what they hold (Schwab's \"Qty (Quantity)\", \"Mkt Val (Market Value)\"); a file with no amount column says so", () => {
    const schwab = ['"Positions for account ...123"', '"Symbol","Description","Qty (Quantity)","Price","Mkt Val (Market Value)","% of Acct (% of Account)"',
      '"AAPL","APPLE INC","100","$215.20","$21,520.00","40%"', '"NVDA","NVIDIA CORP","5","$180.00","$900.00","2%"'].join('\n');
    expect(rows(schwab)).toMatchObject({ unit: 'shares', note: null, rows: [{ t: 'AAPL', n: 100 }, { t: 'NVDA', n: 5 }] });
    const bare = rows('Symbol,Description\nAAPL,APPLE INC\nNVDA,NVIDIA CORP');
    expect(bare).toMatchObject({ unit: 'equal', rows: [{ t: 'AAPL', n: null }, { t: 'NVDA', n: null }] });
    expect(bare.note).toBe('This file has no column of shares, values or percentages: each line weighs the same.');
  });

  it('refuses mixed units, naming the lines', () => {
    expect(rows('AAPL 10\nMSFT 20%\nNVDA 5\nVOO 3\nSMH 30%').refused).toBe('Lines 2 and 5 give a percentage, lines 1, 3 and 4 shares: one kind of amount per portfolio.');
    expect(rows('AAPL 10\nMSFT').refused).toBe('Line 2 gives no amount, line 1 shares: one kind of amount per portfolio.');
  });

  it('names the symbols not on pretickt and keeps them as lines: they count in the total, never in the figures', () => {
    expect(rows('AAPL 10\nTSLAX 4\nnvda 2')).toMatchObject({ notOnSite: ['TSLAX'], rows: [{ t: 'AAPL', n: 10 }, { t: 'TSLAX', n: 4 }, { t: 'NVDA', n: 2 }] });
  });

  it('a watchlist keeps the symbols and says it dropped the rest', () => {
    expect(rows('AAPL 10 2025-03-14\nNVDA 20%', 'watchlist')).toEqual({ unit: 'equal', refused: null, notOnSite: [], dropped: true, note: null,
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

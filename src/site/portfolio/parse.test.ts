import { describe, expect, it } from 'vitest';
import type { FactsCompany, FactsFile } from '../../typologies';
import { lookupOf, parsePaste, serialize, type Parsed } from './parse';

// made-up facts: real tickers and names, made-up closes
const co = (ticker: string, name: string, close: number): FactsCompany => ({ ticker, name, logo: null, sector: null, close, ret: 0, upside: null, firms: 0,
  consensus: null, pe: null, nextEarnings: null, sections: null, headline: null, news: [] });
const FACTS: FactsFile = {
  v: 1, asOf: '2026-11-06',
  companies: Object.fromEntries([
    co('AAPL', 'Apple Inc.', 215), co('MSFT', 'Microsoft Corporation', 410), co('NVDA', 'NVIDIA Corporation', 180), co('BRK.B', 'Berkshire Hathaway Inc.', 480),
    co('KO', 'The Coca-Cola Company', 70), co('GOOGL', 'Alphabet Inc.', 170), co('GOOG', 'Alphabet Inc.', 171), co('NOW', 'ServiceNow, Inc.', 900), co('T', 'AT&T Inc.', 25),
  ].map((c) => [c.ticker, c])),
  funds: { VOO: { name: 'Vanguard S&P 500 ETF', logo: null, close: 520, ret: 0, coverage: 0.99, weights: [] }, SMH: { name: 'VanEck Semiconductor ETF', logo: null, close: 300, ret: 0, coverage: 0.98, weights: [] } },
};
const LOOKUP = lookupOf(FACTS);
const TODAY = '2026-11-06';
const read = (text: string, kind: 'portfolio' | 'watchlist' = 'portfolio') => parsePaste(text, LOOKUP, TODAY, kind);
/** What a reader cares about: symbol, amount, date per line. */
const got = (p: Parsed) => p.rows.map((r) => [r.t, r.n, r.d]);

describe('reading a paste, whatever its format', () => {
  it('one holding per line in each unit', () => {
    expect(read('AAPL 10\nmsft 2.5\nBRK/B 4')).toMatchObject({ unit: 'shares', refused: null, rows: [{ line: 1, t: 'AAPL', n: 10, d: null }, { line: 2, t: 'MSFT', n: 2.5 }, { line: 3, t: 'BRK.B', n: 4 }] });
    expect(read('AAPL 25%\nNVDA 75 %')).toMatchObject({ unit: 'pct', rows: [{ t: 'AAPL', n: 25 }, { t: 'NVDA', n: 75 }] });
    expect(read('AAPL $5,000\nVOO, $12,500.50\nMSFT 4,920 USD')).toMatchObject({ unit: 'usd', rows: [{ t: 'AAPL', n: 5000 }, { t: 'VOO', n: 12500.5 }, { t: 'MSFT', n: 4920 }] });
    expect(read('AAPL\nNVDA\n\n# my list')).toMatchObject({ unit: 'equal', rows: [{ t: 'AAPL', n: null }, { t: 'NVDA', n: null }] });
  });

  it('symbols however they are written: $AAPL, NASDAQ:MSFT, NVDA.US, BRK-B, lower case at the start of a line', () => {
    expect(got(read('$AAPL 10\nNASDAQ:MSFT 5\nNVDA.US 2\nBRK-B 4\nko 8'))).toEqual([['AAPL', 10, null], ['MSFT', 5, null], ['NVDA', 2, null], ['BRK.B', 4, null], ['KO', 8, null]]);
  });

  it('the amount before the symbol, with or without "shares of"', () => {
    expect(got(read('10 AAPL\n5 shares of MSFT\n3 sh NVDA\nKO x 8'))).toEqual([['AAPL', 10, null], ['MSFT', 5, null], ['NVDA', 3, null], ['KO', 8, null]]);
  });

  it('company names instead of symbols', () => {
    expect(got(read('Apple 10\nMicrosoft Corp 5 shares\nCoca-Cola 20\nBerkshire Hathaway 3\nAlphabet 2'))).toEqual([['AAPL', 10, null], ['MSFT', 5, null], ['KO', 20, null], ['BRK.B', 3, null], ['GOOG', 2, null]]);
  });

  it('bullets and numbering', () => {
    expect(got(read('- AAPL 10\n• MSFT 5\n1. NVDA 2\n2) KO 8\n* VOO 1'))).toEqual([['AAPL', 10, null], ['MSFT', 5, null], ['NVDA', 2, null], ['KO', 8, null], ['VOO', 1, null]]);
  });

  it('a list on one line, by commas or spaces', () => {
    expect(got(read('AAPL, MSFT, NVDA'))).toEqual([['AAPL', null, null], ['MSFT', null, null], ['NVDA', null, null]]);
    expect(got(read('AAPL MSFT NVDA KO'))).toEqual([['AAPL', null, null], ['MSFT', null, null], ['NVDA', null, null], ['KO', null, null]]);
  });

  it('a sentence: "I own 10 shares of Apple, 5 Microsoft and 20 KO"', () => {
    expect(got(read('I own 10 shares of Apple, 5 Microsoft and 20 KO'))).toEqual([['AAPL', 10, null], ['MSFT', 5, null], ['KO', 20, null]]);
  });

  it('a row of numbers with no header: the close tells the price from the shares, and a signed change is no amount', () => {
    expect(got(read('AAPL 100 215.20 21,520.00\nMSFT Microsoft Corp 410.00 12 4,920.00\nNVDA 180.10 +2.15 +1.21% 25'))).toEqual([['AAPL', 100, null], ['MSFT', 12, null], ['NVDA', 25, null]]);
  });

  it('dates in many forms, none after today', () => {
    const p = read('AAPL 10 Mar 14, 2025\nMSFT 5 14 Mar 2025\nNVDA 2 2025/03/14\nKO 8 3/14/2025\nVOO 1 March 14 2025\nT 3 2025-03-14');
    expect(p.rows.map((r) => r.d)).toEqual(Array(6).fill('2025-03-14'));
    expect(read('AAPL 10 2025-03-14\nNVDA 3 2027-01-04').refused).toBe('Line 2: the date 2027-01-04 is after today.');
  });

  it('a table from a spreadsheet or a web page: tabs, semicolons, pipes', () => {
    expect(got(read('Ticker\tShares\tBought\nAAPL\t10\t2025-03-14\nMSFT\t5\t'))).toEqual([['AAPL', 10, '2025-03-14'], ['MSFT', 5, null]]);
    expect(got(read('Symbol;Quantity\nAAPL;10\nNVDA;4'))).toEqual([['AAPL', 10, null], ['NVDA', 4, null]]);
    expect(got(read('| Ticker | Shares |\n|---|---|\n| AAPL | 10 |\n| KO | 8 |'))).toEqual([['AAPL', 10, null], ['KO', 8, null]]);
  });

  it("brokers' exports: their headers, cash and pending rows, totals and disclaimers", () => {
    const fidelity = [
      'Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Percent Of Account,Cost Basis Total',
      'X12345678,Individual,SPAXX**,HELD IN MONEY MARKET,,,,$1,200.00,2.1%,',
      'X12345678,Individual,AAPL,APPLE INC,"1,250",$215.20,+$1.05,"$269,000.00",80.1%,"$190,000.00"',
      'X12345678,Individual,BRK/B,BERKSHIRE HATHAWAY INC CL B,12,$480.00,-$2.10,"$5,760.00",1.7%,',
      'X12345678,Individual,Pending Activity,,,,,"-$20.00",,',
      '', '"The data and information in this spreadsheet is provided to you solely for your use."',
    ].join('\n');
    expect(got(read(fidelity))).toEqual([['AAPL', 1250, null], ['BRK.B', 12, null]]);
    const schwab = ['"Positions for account ...123"', '"Symbol","Description","Qty (Quantity)","Price","Mkt Val (Market Value)","% of Acct (% of Account)"',
      '"AAPL","APPLE INC","100","$215.20","$21,520.00","40%"', '"NVDA","NVIDIA CORP","5","$180.00","$900.00","2%"', '"Cash & Cash Investments","--","--","--","$310.00","1%"', '"Account Total","--","--","--","$22,730.00","100%"'].join('\n');
    expect(got(read(schwab))).toEqual([['AAPL', 100, null], ['NVDA', 5, null]]);
    const vanguard = 'Account Number,Investment Name,Symbol,Shares,Share Price,Total Value\n12345678,Vanguard S&P 500 ETF,VOO,14.5,520.00,7540.00\n12345678,APPLE INC,AAPL,3,215.00,645.00';
    expect(got(read(vanguard))).toEqual([['VOO', 14.5, null], ['AAPL', 3, null]]);
    const ibkr = 'Symbol,Position,Mark Price,Position Value\nAAPL,20,215.20,4304.00\nMSFT,7,410.00,2870.00';
    expect(got(read(ibkr))).toEqual([['AAPL', 20, null], ['MSFT', 7, null]]);
  });

  it('a table with names and no symbol column', () => {
    expect(got(read('Name,Shares\nApple Inc.,10\nNVIDIA Corp,5'))).toEqual([['AAPL', 10, null], ['NVDA', 5, null]]);
  });

  it("an app's cards copied as lines: the symbol, its name, its shares, its value", () => {
    expect(got(read('AAPL\nApple Inc\n10 shares\n$2,150.00\nMSFT\nMicrosoft Corporation\n5 shares\n$2,050.00'))).toEqual([['AAPL', 10, null], ['MSFT', 5, null]]);
  });

  it('rows copied from finance sites: an unsigned change and its percent, a price paid, a symbol in brackets, a class after a space, an exchange list', () => {
    expect(got(read('Apple Inc AAPL 215.20 1.05 0.49% 10 2,152.00'))).toEqual([['AAPL', 10, null]]);
    expect(got(read('AAPL 215.20 +1.05 +0.49% 100 $180.00 $21,520.00'))).toEqual([['AAPL', 100, null]]);
    // a price far from tonight's close (an old export): with no fit, the whole number is the shares, the one with cents the price
    expect(got(read('NVDA 280.10 +2.15 +1.21% 25'))).toEqual([['NVDA', 25, null]]);
    expect(got(read('Apple (AAPL): 10 shares\nBRK B 4'))).toEqual([['AAPL', 10, null], ['BRK.B', 4, null]]);
    expect(got(read('NASDAQ:AAPL,NYSE:KO,NASDAQ:NVDA'))).toEqual([['AAPL', null, null], ['KO', null, null], ['NVDA', null, null]]);
  });

  it('short symbols that are words count only where a symbol stands, never inside a sentence', () => {
    expect(got(read('NOW 3\nT 10'))).toEqual([['NOW', 3, null], ['T', 10, null]]);
    expect(read('I will buy it now').rows).toEqual([]);
  });

  it('a symbol not on pretickt is kept as a line and named; what was not read is listed', () => {
    const p = read('AAPL 10\nVTSAX 4\nnvda 2\nTotal 12,345.00\nCash & Sweep 300');
    expect(p).toMatchObject({ notOnSite: ['VTSAX'], rows: [{ t: 'AAPL', n: 10 }, { t: 'VTSAX', n: 4 }, { t: 'NVDA', n: 2 }] });
    expect(p.ignored).toEqual([{ line: 4, text: 'Total 12,345.00' }, { line: 5, text: 'Cash & Sweep 300' }]);
  });

  it('refuses mixed units, naming the lines', () => {
    expect(read('AAPL 10\nMSFT 20%\nNVDA 5\nVOO 3\nSMH 30%').refused).toBe('Lines 2 and 5 give a percentage, lines 1, 3 and 4 shares: one kind of amount per portfolio.');
    expect(read('AAPL 10\nMSFT').refused).toBe('Line 2 gives no amount, line 1 shares: one kind of amount per portfolio.');
  });

  it('a file with no amount column says each line weighs the same', () => {
    const bare = read('Symbol,Description\nAAPL,APPLE INC\nNVDA,NVIDIA CORP');
    expect(bare).toMatchObject({ unit: 'equal', rows: [{ t: 'AAPL', n: null }, { t: 'NVDA', n: null }] });
    expect(bare.note).toBe('This file has no column of shares, values or percentages: each line weighs the same.');
  });

  it('a watchlist keeps the symbols and says it dropped the rest', () => {
    expect(read('AAPL 10 2025-03-14\nNVDA 20%', 'watchlist')).toMatchObject({ unit: 'equal', refused: null, dropped: true, rows: [{ t: 'AAPL', n: null, d: null }, { t: 'NVDA', n: null, d: null }] });
    expect(read('AAPL\nNVDA', 'watchlist').dropped).toBe(false);
  });

  it('serialize and parse round-trip', () => {
    for (const text of ['AAPL 10 2025-03-14\nBRK.B 4', 'AAPL 25%\nNVDA 75%', 'AAPL $5,000\nVOO $12,500.5', 'AAPL\nNVDA']) {
      const p = read(text);
      expect(got(read(serialize(p.rows, p.unit)))).toEqual(got(p));
    }
  });
});

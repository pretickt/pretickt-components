import { describe, expect, it } from 'vitest';
import { FactsFile } from './portfolio';

const facts = (sprite: unknown) => ({ v: 1, asOf: '2026-11-06', companies: {}, funds: {}, sprite });

describe("the portfolio page's facts file", () => {
  it('names one sheet of every logo, the same file for every reader, with its cells in ticker order', () => {
    expect(FactsFile.safeParse(facts({ file: '/logos/sprite.1a2b3c4d.webp', px: 40, cols: 25, tickers: ['AAPL', 'VOO'] })).success).toBe(true);
    expect(FactsFile.safeParse(facts(undefined)).success).toBe(true);
  });

  it('says which logos are white (drawn dark) and which are pale with a colour (outlined), by ticker', () => {
    const sheet = { file: '/logos/sprite.1a2b3c4d.webp', px: 40, cols: 25, tickers: ['AAPL', 'MCD', 'NKE'] };
    expect(FactsFile.safeParse(facts({ ...sheet, light: ['MCD'], white: ['NKE'] })).success).toBe(true);
    expect(FactsFile.safeParse(facts({ ...sheet, light: ['not a ticker!'] })).success).toBe(false);
    expect(FactsFile.safeParse(facts({ ...sheet, white: ['not a ticker!'] })).success).toBe(false);
  });

  it("never a company's own logo file: its name would tell the server what the reader holds", () => {
    expect(FactsFile.safeParse(facts({ file: '/logos/aapl.1a2b3c4d.webp', px: 40, cols: 25, tickers: ['AAPL'] })).success).toBe(false);
    expect(FactsFile.safeParse(facts({ file: 'https://example.com/logos/sprite.1a2b3c4d.webp', px: 40, cols: 25, tickers: ['AAPL'] })).success).toBe(false);
  });
});

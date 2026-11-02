import { describe, expect, it } from 'vitest';
import { searchCompanies } from './search';

const rows = [
  { ticker: 'AVGO', name: 'Broadcom Inc.', marketCap: 1.4e12 }, { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', marketCap: 310e9 },
  { ticker: 'A', name: 'Agilent Technologies, Inc.', marketCap: 40e9 }, { ticker: 'AAPL', name: 'Apple Inc.', marketCap: 3.5e12 },
  { ticker: 'APH', name: 'Amphenol Corporation', marketCap: 120e9 }, { ticker: 'NVDA', name: 'NVIDIA Corporation', marketCap: 4e12 },
  { ticker: 'MA', name: 'Mastercard Incorporated', marketCap: 500e9 }, { ticker: 'MAR', name: 'Marriott International', marketCap: 70e9 },
];
const tickers = (q: string, exclude?: string[]) => searchCompanies(rows, q, exclude).map((r) => r.ticker);

describe('searchCompanies: a company by symbol or name (the alert editor\'s searches)', () => {
  it('the symbol itself first, then the symbols starting with it, then the names holding it, the largest first; six at most', () => {
    expect(tickers('avg')).toEqual(['AVGO']);
    expect(tickers('a')).toEqual(['A', 'AAPL', 'AVGO', 'AMD', 'APH', 'NVDA']);
    expect(tickers('MA')).toEqual(['MA', 'MAR']);
    expect(tickers('broad')).toEqual(['AVGO']);
  });

  it('never one already taken; nothing for an empty search', () => {
    expect(tickers('a', ['A', 'AAPL'])).toEqual(['AVGO', 'AMD', 'APH', 'NVDA', 'MA', 'MAR']);
    expect(tickers('  ')).toEqual([]);
  });
});

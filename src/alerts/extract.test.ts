import { describe, expect, it } from 'vitest';
import { companiesIn } from './extract';

const rows = [
  { ticker: 'AAPL', name: 'Apple Inc.' }, { ticker: 'MSFT', name: 'Microsoft Corporation' }, { ticker: 'NVDA', name: 'NVIDIA Corporation' },
  { ticker: 'META', name: 'Meta Platforms, Inc.' }, { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc. Class B' },
  { ticker: 'GM', name: 'General Motors Company' }, { ticker: 'GIS', name: 'General Mills, Inc.' },
  { ticker: 'KO', name: 'The Coca-Cola Company' }, { ticker: 'A', name: 'Agilent Technologies, Inc.' },
  { ticker: 'T', name: 'AT&T Inc.' }, { ticker: 'GOOGL', name: 'Alphabet Inc. Class A' }, { ticker: 'GOOG', name: 'Alphabet Inc. Class C' },
];

describe('companiesIn: the companies a pasted text names (My portfolio, Romeo 2026-11-02)', () => {
  it('symbols as a broker export or a post writes them, in the order they come, each once', () => {
    expect(companiesIn('Symbol Qty Price\nNVDA 10 140.20\nAAPL 5 230.00\n$MSFT x2\nNVDA again', rows)).toEqual(['NVDA', 'AAPL', 'MSFT']);
  });

  it('BRK-B and BRK/B are BRK.B; a one-letter symbol counts only with its $ (a lone "A" or "I" is a word)', () => {
    expect(companiesIn('BRK-B, A, $A, I like BRK/B', rows)).toEqual(['BRK.B', 'A']);
  });

  it('names: the whole name without Inc., Corporation or Class, or its first word when no other company starts with it', () => {
    expect(companiesIn('I hold Apple, nvidia and some Coca-Cola. Also Meta and AT&T.', rows)).toEqual(['AAPL', 'NVDA', 'KO', 'META', 'T']);
    expect(companiesIn('General Motors, and General', rows)).toEqual(['GM']);       // "General" alone is two companies: neither
    expect(companiesIn('Alphabet', rows)).toEqual(['GOOGL']);                       // one name, two classes: the first listed
    expect(companiesIn('Microsoft and MSFT', rows)).toEqual(['MSFT']);
  });

  const wordy = [...rows, { ticker: 'NET', name: 'Cloudflare, Inc.' }, { ticker: 'LOW', name: "Lowe's Companies, Inc." }, { ticker: 'CHKP', name: 'Check Point Software Technologies Ltd.' },
    { ticker: 'CRCL', name: 'Circle Internet Group, Inc.' }, { ticker: 'UEC', name: 'Uranium Energy Corp.' }, { ticker: 'BBY', name: 'Best Buy Co., Inc.' },
    { ticker: 'TGT', name: 'Target Corporation' }, { ticker: 'NWS', name: 'News Corporation' }, { ticker: 'DAL', name: 'Delta Air Lines, Inc.' }];

  it('a symbol that is also a word counts only with its $, or opening a row with a number after it', () => {
    expect(companiesIn('SYMBOL QTY HIGH LOW NET\nAAPL 5 230.00\nNET TOTAL 1,200', wordy)).toEqual(['AAPL']);
    expect(companiesIn('$NET looks good, and $LOW', wordy)).toEqual(['NET', 'LOW']);
    expect(companiesIn('AAPL 5 230.00\nNET 10 300.50\nLOW,3,210.10', wordy)).toEqual(['AAPL', 'NET', 'LOW']);
    expect(companiesIn('Cloudflare', wordy)).toEqual(['NET']);
  });

  it('a name that is an everyday word counts only with its capital, and not as the word that opens a sentence', () => {
    expect(companiesIn('check the price target on a circle of uranium miners, the best news in delta', wordy)).toEqual([]);
    expect(companiesIn('Check out this list. Best of all, it is free.\nNews came late.', wordy)).toEqual([]);
    expect(companiesIn('I hold Target, Check Point and Delta', wordy)).toEqual(['TGT', 'CHKP', 'DAL']);
    expect(companiesIn('Target, Apple, Circle', wordy)).toEqual(['TGT', 'AAPL', 'CRCL']);
    expect(companiesIn('the price target is up, and I hold Target', wordy)).toEqual(['TGT']);       // the second time is the name
  });

  it('the whole name counts in any case, an everyday word in it or not', () => {
    expect(companiesIn('best buy, uranium energy, check point software technologies', wordy)).toEqual(['BBY', 'UEC', 'CHKP']);
  });

  it('nothing it does not know', () => {
    expect(companiesIn('TSLA USD CASH total 12,000', rows)).toEqual([]);
    expect(companiesIn('', rows)).toEqual([]);
  });
});

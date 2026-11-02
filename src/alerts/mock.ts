// Made-up numbers for stories and specs: never real data. Real tickers and the site's logos, invented prices and metrics.
import { prng, round } from '../typologies/common';
import type { AlertUniverse, AlertUniverseRow } from './rows';

const ASOF = '2026-10-30';
const L = (f: string) => `/logos/${f}.webp`;
/** ticker, name, sector, logo file on the site (or none) */
const MEGA: [string, string, string, string?][] = [
  ['NVDA', 'NVIDIA Corporation', 'Technology', 'nvda.55199575'], ['MSFT', 'Microsoft Corporation', 'Technology', 'msft.5ee163f1'],
  ['AAPL', 'Apple Inc.', 'Technology', 'aapl.756e8d66'], ['GOOGL', 'Alphabet Inc.', 'Communication Services', 'googl.bea58546'],
  ['AMZN', 'Amazon.com, Inc.', 'Consumer Cyclical', 'amzn.6953eef3'], ['META', 'Meta Platforms, Inc.', 'Communication Services', 'meta.fbe2aff0'],
  ['AVGO', 'Broadcom Inc.', 'Technology', 'avgo.39190370'], ['TSLA', 'Tesla, Inc.', 'Consumer Cyclical', 'tsla.a6b461d6'],
  ['BRK.B', 'Berkshire Hathaway Inc.', 'Financial Services', 'brk.b.e835fff0'], ['LLY', 'Eli Lilly and Company', 'Healthcare', 'lly.cff27d4c'],
  ['JPM', 'JPMorgan Chase & Co.', 'Financial Services', 'jpm.1e414925'], ['WMT', 'Walmart Inc.', 'Consumer Defensive', 'wmt.f236f0e0'],
  ['V', 'Visa Inc.', 'Financial Services', 'v.795de32d'], ['ORCL', 'Oracle Corporation', 'Technology'],
  ['MA', 'Mastercard Incorporated', 'Financial Services', 'ma.d8bbe9e8'], ['NFLX', 'Netflix, Inc.', 'Communication Services'],
  ['XOM', 'Exxon Mobil Corporation', 'Energy', 'xom.b9f59cfb'], ['COST', 'Costco Wholesale Corporation', 'Consumer Defensive', 'cost.8bef2939'],
  ['JNJ', 'Johnson & Johnson', 'Healthcare', 'jnj.8fb93afc'], ['HD', 'The Home Depot, Inc.', 'Consumer Cyclical', 'hd.a764f1fc'],
  ['PG', 'The Procter & Gamble Company', 'Consumer Defensive', 'pg.63af38a1'], ['ABBV', 'AbbVie Inc.', 'Healthcare', 'abbv.29d274f8'],
  ['BAC', 'Bank of America Corporation', 'Financial Services', 'bac.2069ed50'], ['KO', 'The Coca-Cola Company', 'Consumer Defensive', 'ko.c9c7e1b0'],
  ['UNH', 'UnitedHealth Group Incorporated', 'Healthcare', 'unh.b9e96117'], ['CVX', 'Chevron Corporation', 'Energy', 'cvx.f1af60bc'],
  ['PLTR', 'Palantir Technologies Inc.', 'Technology', 'pltr.8f448528'], ['AMD', 'Advanced Micro Devices, Inc.', 'Technology', 'amd.a8e17428'],
  ['MU', 'Micron Technology, Inc.', 'Technology', 'mu.516495fd'], ['CRM', 'Salesforce, Inc.', 'Technology'],
  ['CSCO', 'Cisco Systems, Inc.', 'Technology'], ['IBM', 'International Business Machines Corporation', 'Technology'],
  ['WFC', 'Wells Fargo & Company', 'Financial Services'], ['MRK', 'Merck & Co., Inc.', 'Healthcare', 'mrk.5a1bde4c'],
  ['PM', 'Philip Morris International Inc.', 'Consumer Defensive', 'pm.086269a9'], ['GE', 'GE Aerospace', 'Industrials', 'ge.1f27a2e3'],
  ['TMUS', 'T-Mobile US, Inc.', 'Communication Services', 'tmus.c4d4fa0e'], ['MS', 'Morgan Stanley', 'Financial Services', 'ms.747d7472'],
  ['GS', 'The Goldman Sachs Group, Inc.', 'Financial Services'], ['AXP', 'American Express Company', 'Financial Services'],
  ['LIN', 'Linde plc', 'Basic Materials', 'lin.19d3cd56'], ['PEP', 'PepsiCo, Inc.', 'Consumer Defensive', 'pep.f4e08e98'],
  ['ABT', 'Abbott Laboratories', 'Healthcare'], ['MCD', "McDonald's Corporation", 'Consumer Cyclical'],
  ['NOW', 'ServiceNow, Inc.', 'Technology', 'now.6f5b62e4'], ['CAT', 'Caterpillar Inc.', 'Industrials', 'cat.56a114e1'],
  ['INTU', 'Intuit Inc.', 'Technology'], ['TXN', 'Texas Instruments Incorporated', 'Technology'], ['QCOM', 'QUALCOMM Incorporated', 'Technology'],
  ['ISRG', 'Intuitive Surgical, Inc.', 'Healthcare'], ['RTX', 'RTX Corporation', 'Industrials', 'rtx.fb379448'],
  ['DIS', 'The Walt Disney Company', 'Communication Services'], ['VZ', 'Verizon Communications Inc.', 'Communication Services'],
  ['AMGN', 'Amgen Inc.', 'Healthcare', 'amgn.a6bc8743'], ['T', 'AT&T Inc.', 'Communication Services'],
  ['BKNG', 'Booking Holdings Inc.', 'Consumer Cyclical'], ['ADBE', 'Adobe Inc.', 'Technology'],
  ['SPGI', 'S&P Global Inc.', 'Financial Services'], ['UBER', 'Uber Technologies, Inc.', 'Technology'],
  ['BLK', 'BlackRock, Inc.', 'Financial Services'], ['PFE', 'Pfizer Inc.', 'Healthcare'],
];
const OTHER: [string, string, string, string?][] = [
  ['F', 'Ford Motor Company', 'Consumer Cyclical'], ['GM', 'General Motors Company', 'Consumer Cyclical'], ['DAL', 'Delta Air Lines, Inc.', 'Industrials'],
  ['UAL', 'United Airlines Holdings, Inc.', 'Industrials'], ['NKE', 'NIKE, Inc.', 'Consumer Cyclical'], ['SBUX', 'Starbucks Corporation', 'Consumer Cyclical', 'sbux.d7d22b5d'],
  ['TGT', 'Target Corporation', 'Consumer Defensive'], ['LOW', "Lowe's Companies, Inc.", 'Consumer Cyclical'], ['DE', 'Deere & Company', 'Industrials', 'de.1acb3df5'],
  ['MMM', '3M Company', 'Industrials'], ['HON', 'Honeywell International Inc.', 'Industrials'], ['UPS', 'United Parcel Service, Inc.', 'Industrials'],
  ['FDX', 'FedEx Corporation', 'Industrials'], ['ADP', 'Automatic Data Processing, Inc.', 'Industrials'], ['CL', 'Colgate-Palmolive Company', 'Consumer Defensive', 'cl.541ffe5b'],
  ['KMB', 'Kimberly-Clark Corporation', 'Consumer Defensive', 'kmb.101a9ab3'], ['GIS', 'General Mills, Inc.', 'Consumer Defensive'],
  ['KHC', 'The Kraft Heinz Company', 'Consumer Defensive'], ['MDLZ', 'Mondelez International, Inc.', 'Consumer Defensive'], ['MO', 'Altria Group, Inc.', 'Consumer Defensive'],
  ['DUK', 'Duke Energy Corporation', 'Utilities', 'duk.8fe58e4a'], ['SO', 'The Southern Company', 'Utilities', 'so.701069d2'], ['NEE', 'NextEra Energy, Inc.', 'Utilities', 'nee.0b211d77'],
  ['D', 'Dominion Energy, Inc.', 'Utilities', 'd.5a84ae71'], ['AEP', 'American Electric Power Company, Inc.', 'Utilities', 'aep.bb82b177'],
  ['EXC', 'Exelon Corporation', 'Utilities'], ['SRE', 'Sempra', 'Utilities'], ['PLD', 'Prologis, Inc.', 'Real Estate', 'pld.e47cd127'],
  ['AMT', 'American Tower Corporation', 'Real Estate', 'amt.df6c06f9'], ['EQIX', 'Equinix, Inc.', 'Real Estate', 'eqix.ffcfc90c'], ['SPG', 'Simon Property Group, Inc.', 'Real Estate', 'spg.8f8ce35b'],
  ['O', 'Realty Income Corporation', 'Real Estate', 'o.8630fba5'], ['PSA', 'Public Storage', 'Real Estate', 'psa.7c866c6e'], ['WELL', 'Welltower Inc.', 'Real Estate', 'well.602a6d02'],
  ['DLR', 'Digital Realty Trust, Inc.', 'Real Estate', 'dlr.fb289368'], ['CCI', 'Crown Castle Inc.', 'Real Estate'], ['SHW', 'The Sherwin-Williams Company', 'Basic Materials', 'shw.53232d19'],
  ['ECL', 'Ecolab Inc.', 'Basic Materials', 'ecl.609db481'], ['APD', 'Air Products and Chemicals, Inc.', 'Basic Materials', 'apd.283ba8dc'],
];
/** the largest market values, then the rest of the mega caps between $201B and $420B */
const TOP_CAPS: Record<string, number> = { NVDA: 5000, MSFT: 4000, AAPL: 3900, GOOGL: 3000, AMZN: 2400, META: 1800, AVGO: 1600, TSLA: 1400,
  'BRK.B': 1050, LLY: 900, JPM: 800, WMT: 800, V: 680, ORCL: 650, MA: 520, NFLX: 500, XOM: 480, COST: 430, AMD: 310 };
/** Romeo's example (2026-11-01): in a session a mega cap falls more than 5% and trades far under its 50-day average — AMD does both */
const SESSION: Record<string, number> = { AMD: -0.079, TSLA: -0.063, MU: -0.057, PLTR: -0.054 };
const UNDER_MA50: Record<string, number> = { AMD: -0.24, UNH: -0.192, MRK: -0.161, TSLA: -0.094, PLTR: -0.123, MU: -0.062 };

function build(): AlertUniverse {
  const r = prng('alerts-mock');
  const between = (a: number, b: number) => a + (b - a) * r();
  // the logo is optional in the lists: name the fields, so a missing one cannot shift the others
  const all = [...MEGA.map(([t, n, s, l]) => ({ t, n, s, l, mega: true })), ...OTHER.map(([t, n, s, l]) => ({ t, n, s, l, mega: false }))];
  const rows: AlertUniverseRow[] = all.map(({ t: ticker, n: name, s: sector, l: logo, mega }) => {
      const close = ticker === 'AMD' ? 151 : round(between(20, 600));
      const move = SESSION[ticker] ?? between(-0.046, 0.048);
      const d50 = UNDER_MA50[ticker] ?? between(-0.142, 0.21);
      const piotroski = Math.floor(between(2, 10));
      const usualNews = round(between(1, 4), 1), usualSocial = round(between(5, 60), 1);
      return {
        ticker, name, logo: logo ? L(logo) : null, sector,
        marketCap: (TOP_CAPS[ticker] ?? (mega ? between(201, 420) : between(20, 195))) * 1e9,
        close, prevClose: round(close / (1 + move), 4),
        ma20: round(close / (1 + d50 * 0.6), 2), ma50: round(close / (1 + d50), 4), ma100: round(close / (1 + d50 * 1.2), 2),
        ma200: round(close / (1 + d50 * 0.8 + 0.05), 2),
        low52: round(close * between(0.62, 0.95), 2), high52: round(close * between(1.05, 1.6), 2),
        volumeRatio: ticker === 'AMD' ? 3.4 : round(between(0.6, 2.5), 2),
        peVsSector: round(between(-0.4, 0.6), 3), undervalued: r() < 0.15, ptUpside: round(between(-0.1, 0.45), 3),
        piotroski, checks: Array.from({ length: 9 }, (_, i) => i < piotroski),
        surprises: Array.from({ length: 4 }, () => round(between(-0.05, 0.12), 3)), lastReport: '2026-08-04',
        insiderNet90: round(between(-5e6, 3e6), -3), earningsDate: r() < 0.3 ? `2026-11-${String(Math.floor(between(2, 28))).padStart(2, '0')}` : null,
        grade: r() < 0.08 ? { dir: r() < 0.5 ? 'down' : 'up', date: ASOF, firm: 'A made-up firm' } : null,
        news: ticker === 'AMD' ? 12 : Math.floor(between(0, 6)), newsUsual: usualNews,
        social: Math.floor(between(0, 120)), socialUsual: usualSocial,
      } satisfies AlertUniverseRow;
    });
  return { asOf: ASOF, rows };
}

export const MOCK_UNIVERSE: AlertUniverse = build();

/** 5-minute closes of the session from the open (78 bars, 9:35 to 4:00 PM ET), ending at the row's price. */
function bars(ticker: string): number[] {
  const row = MOCK_UNIVERSE.rows.find((x) => x.ticker === ticker)!;
  const r = prng(`bars-${ticker}`), from = row.prevClose ?? row.close, to = row.close;
  return Array.from({ length: 78 }, (_, i) => {
    const f = (i + 1) / 78;
    return i === 77 ? to : round(from + (to - from) * f ** 1.4 + from * (r() - 0.5) * 0.008, 2);
  });
}
export const MOCK_BARS: Record<string, number[]> = Object.fromEntries(['AMD', 'NVDA', 'TSLA'].map((t) => [t, bars(t)]));

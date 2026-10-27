/**
 * Made-up data for the home drafts (H1, H2, H4, H5 of the summary), in the shapes their typologies will have once the data has a
 * pipeline: real tickers and the site's own logo files, invented numbers. Logo files carry a content hash: refresh LOGO from
 * www's `screen@1` when one stops loading.
 */
import type { Asked } from './pt-asked';
import type { Hot } from './pt-hot';
import type { Odds } from './pt-odds';
import type { Board } from './pt-quality-strip';

export const LOGO: Record<string, string> = {
  NVDA: '/logos/nvda.55199575.webp', AAPL: '/logos/aapl.756e8d66.webp', MSFT: '/logos/msft.5ee163f1.webp', GOOGL: '/logos/googl.bea58546.webp',
  AMZN: '/logos/amzn.6953eef3.webp', SPCX: '/logos/spcx.2fb232b1.webp', META: '/logos/meta.fbe2aff0.webp', TSLA: '/logos/tsla.a6b461d6.webp',
  LLY: '/logos/lly.cff27d4c.webp', MU: '/logos/mu.516495fd.webp', JPM: '/logos/jpm.1e414925.webp', AMD: '/logos/amd.a8e17428.webp',
  XOM: '/logos/xom.b9f59cfb.webp', V: '/logos/v.795de32d.webp', INTC: '/logos/intc.17a3f7db.webp', CVX: '/logos/cvx.f1af60bc.webp',
  PLTR: '/logos/pltr.8f448528.webp', KO: '/logos/ko.c9c7e1b0.webp', MRK: '/logos/mrk.5a1bde4c.webp', CAT: '/logos/cat.56a114e1.webp',
  GE: '/logos/ge.1f27a2e3.webp', RTX: '/logos/rtx.fb379448.webp', NFLX: '/logos/nflx.f17daaff.webp', AMGN: '/logos/amgn.a6bc8743.webp',
  TXN: '/logos/txn.de1c253b.webp', PG: '/logos/pg.63af38a1.webp', AXP: '/logos/axp.976c0bbe.webp', VZ: '/logos/vz.28a7b201.webp',
  RCL: '/logos/rcl.473b0746.webp', UPS: '/logos/ups.f9146c96.webp', BA: '/logos/ba.7c6c0cf3.webp', NKE: '/logos/nke.70e2412d.webp',
  SCHW: '/logos/schw.92aca459.webp', SPGI: '/logos/spgi.733b73c0.webp',
};
const NAMES: Record<string, string> = {
  NVDA: 'NVIDIA', AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet', AMZN: 'Amazon', SPCX: 'SpaceX', META: 'Meta Platforms', TSLA: 'Tesla',
  LLY: 'Eli Lilly', MU: 'Micron', JPM: 'JPMorgan Chase', AMD: 'AMD', XOM: 'Exxon Mobil', V: 'Visa', INTC: 'Intel', CVX: 'Chevron', PLTR: 'Palantir',
  KO: 'Coca-Cola', MRK: 'Merck', CAT: 'Caterpillar', GE: 'GE Aerospace', RTX: 'RTX', NFLX: 'Netflix', AMGN: 'Amgen', TXN: 'Texas Instruments',
  PG: 'Procter & Gamble', AXP: 'American Express', UPS: 'UPS', VZ: 'Verizon', BA: 'Boeing', RCL: 'Royal Caribbean', SPGI: 'S&P Global', SCHW: 'Charles Schwab',
  NKE: 'Nike',
};
export const co = (ticker: string) => ({ ticker, name: NAMES[ticker] ?? ticker, logo: LOGO[ticker] ?? null });

// H1 · Hot right now: posts naming the company on Reddit and X in the last 24 hours, against its usual day
export const HOT: Hot = { asOf: '2026-10-26', window: '24h', rows: ([
  ['SPCX', 220, 70, 0.019, 'portfolio risk'], ['GOOGL', 170, 65, -0.012, 'is it a buy?'], ['AMZN', 150, 40, -0.01, 'is it a buy?'],
  ['NVDA', 150, 140, -0.006, 'is it a buy?'], ['META', 140, 92, -0.01, 'why is it moving?'], ['TSLA', 90, 80, -0.006, 'is it a buy?'],
  ['NKE', 70, 14, -0.027, 'is it a buy?'], ['MSFT', 60, 50, 0.007, 'earnings'], ['AAPL', 60, 70, -0.001, 'macro'], ['NFLX', 50, 38, -0.018, 'why is it moving?'],
  ['AMGN', 40, 6, -0.018, 'earnings'], ['INTC', 40, 46, 0.017, 'earnings'], ['PLTR', 35, 60, 0.003, 'is it a buy?'], ['MU', 30, 22, 0.025, 'is it cheap?'],
] as const).map(([t, mentions, usual, move, theme]) => ({ ...co(t), mentions, usual, move, theme })) };

// H2 · Questions people are asking, each with the number that answers it and the page that explains it
export const ASKED: Asked = { asOf: '2026-10-26', items: [
  { ...co('META'), question: 'Why is META down this week?', asks: 6, answer: '−9.4%', tone: 'neg', sub: 'in 5 days · 8.7 points its own',
    href: '/stocks/meta/why-moving/', viz: { kind: 'split', market: -0.004, sector: -0.003, own: -0.087 } },
  { ...co('GOOGL'), question: 'Is GOOGL a buy after the drop?', asks: 9, answer: '+31.5%', tone: 'pos', sub: 'to the analysts’ average target · P/E 16.1×',
    href: '/stocks/googl/price-target/', viz: { kind: 'rail', price: 164, high: 209, target: 216 } },
  { ...co('AMZN'), question: 'Is AMZN spending too much on AI?', asks: 7, answer: '−$8.8B', tone: 'neg', sub: 'free cash flow last quarter, a second one below zero',
    href: '/stocks/amzn/financials/', viz: { kind: 'bars', values: [5.1, 3.2, -2.4, -8.8], labels: ['Q3', 'Q4', 'Q1', 'Q2'] } },
  { ...co('NKE'), question: 'Can NKE recover?', asks: 4, answer: '−47%', tone: 'neg', sub: 'from its high · P/E 40% below its average',
    href: '/stocks/nke/', viz: { kind: 'off', off: -0.47 } },
  { ...co('MU'), question: 'Is MU cheap?', asks: 3, answer: '11.8×', tone: 'pos', sub: 'its earnings · its sector trades at 33.1×',
    href: '/stocks/mu/peers/', viz: { kind: 'pe', pe: 11.8, sector: 33.1 } },
] };

// H4 · Earnings next week and the crowd's odds of clearing the EPS bar (Polymarket markets, volume in dollars)
export const ODDS: Odds = { asOf: '2026-10-23', from: '2026-10-26', to: '2026-10-30', items: ([
  ['VZ', '2026-10-26', 'bmo', 'EPS above $1.31 (adjusted)', 0.18, 2857], ['V', '2026-10-27', 'amc', 'EPS above $3.50 (adjusted)', 0.77, 8298],
  ['UPS', '2026-10-27', 'bmo', 'EPS above $1.64 (adjusted)', 0.82, 2870], ['BA', '2026-10-27', 'bmo', 'EPS above −$0.20 (adjusted)', 0.33, 2613],
  ['RCL', '2026-10-27', 'bmo', 'EPS above $6.44 (adjusted)', 0.6, 3300], ['KO', '2026-10-27', 'bmo', 'EPS above $0.91 (adjusted)', 0.6, 816],
  ['MSFT', '2026-10-28', 'amc', 'EPS above $4.82 (GAAP)', 0.76, 3949], ['GOOGL', '2026-10-28', 'amc', 'EPS above $3.10 (GAAP)', 0.2, 6551],
  ['META', '2026-10-28', 'amc', 'EPS above $7.25 (GAAP)', 0.55, 7120], ['AMZN', '2026-10-29', 'amc', 'EPS above $2.00 (GAAP)', 0.58, 3230],
  ['LLY', '2026-10-29', 'bmo', 'EPS above $7.49 (adjusted)', 0.6, 4944], ['MRK', '2026-10-29', 'bmo', 'EPS above $2.12 (adjusted)', 0.86, 2092],
  ['CAT', '2026-10-29', 'bmo', 'EPS above $7.15 (adjusted)', 0.9, 1316], ['XOM', '2026-10-30', 'bmo', 'EPS above $4.11 (adjusted)', 0.46, 3083],
  ['CVX', '2026-10-30', 'bmo', 'EPS above $4.88 (adjusted)', 0.71, 2837],
] as const).map(([t, date, time, question, prob, volume]) => ({ ...co(t), date, time, question, prob, volume,
  url: `https://polymarket.com/event/${t.toLowerCase()}-earnings` })) };

// H5 · This week across the six questions: each company's new quality facts, by pillar
export const BOARD: Board = { asOf: '2026-10-23', from: '2026-10-19', to: '2026-10-23', items: ([
  ['META', 'demand', 'pos', 'Revenue +24% from a year earlier, a third quarter above 20%', '2026-10-21'],
  ['META', 'economics', 'neg', 'Operating margin 31%, down from 39% a year earlier', '2026-10-21'],
  ['META', 'fragility', 'neg', 'A one-off charge of several billion dollars', '2026-10-21'],
  ['SPCX', 'execution', 'pos', 'EPS $0.35 vs $0.13 expected', '2026-10-20'], ['RTX', 'execution', 'pos', 'EPS 27% above the estimate', '2026-10-20'],
  ['GE', 'execution', 'pos', 'EPS 12% above the estimate', '2026-10-20'], ['NFLX', 'execution', 'pos', 'EPS 6% above the estimate', '2026-10-20'],
  ['NFLX', 'price', 'neg', 'Two downgrades the same week', '2026-10-20'], ['TSLA', 'execution', 'pos', 'EPS 5% above the estimate', '2026-10-21'],
  ['TXN', 'execution', 'pos', 'EPS 7% above the estimate', '2026-10-21'], ['PG', 'execution', 'pos', 'EPS 6% above the estimate', '2026-10-22'],
  ['AXP', 'execution', 'pos', 'EPS 4% above the estimate', '2026-10-23'], ['MU', 'advantage', 'pos', 'Gross margin up 6 points from a year earlier', '2026-10-22'],
  ['NKE', 'execution', 'flat', 'An investor day set for November', '2026-10-23'], ['GOOGL', 'fragility', 'flat', 'A large multi-year compute contract', '2026-10-22'],
  ['INTC', 'price', 'pos', 'P/E below its 3-year median after the fall', '2026-10-23'],
] as const).map(([t, pillar, tone, fact, date]) => ({ ...co(t), pillar, tone, fact, date, href: `/stocks/${t.toLowerCase()}/#quality` })) };

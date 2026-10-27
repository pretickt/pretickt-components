/**
 * Made-up data for pt-value, three companies with different answers: real tickers, invented numbers. Each card's `source` is the
 * FMP endpoint that will feed it, from Romeo's coverage analysis of 2026-10-27 (Demand medium, Advantage low, Economics, Execution and
 * Price high, Fragility medium); "missing" cards are the facts FMP does not have. Cards with `via` are pretickt's own analysis across
 * other companies — its customers' spending, its rivals' numbers, its holders, the banks' analysts — the value beyond the direct data.
 */
import { LOGO } from './mock';
import type { Value, ValueCard, ValueCompany } from './pt-value';

const card = (tone: ValueCard['tone'], big: string, line: string, why: string, source: string, viz: ValueCard['viz'], via?: string): ValueCard =>
  ({ tone, big, line, why, source, viz, ...(via ? { via } : {}) });
/** A row of a companies card: `[ticker, value, label]`, the page's own company marked `self`. */
const cos = (self: string, rows: [string, number | null, string, ValueCard['tone']?][], bars = true): ValueCard['viz'] =>
  ({ kind: 'companies', bars, rows: rows.map(([ticker, value, label, tone]): ValueCompany => ({ ticker, logo: LOGO[ticker] ?? null, value, label,
    ...(tone ? { tone } : {}), ...(ticker === self ? { self: true } : {}) })) });
const head = (ticker: string, name: string) => ({ asOf: '2026-10-26', ticker, name, logo: LOGO[ticker] ?? null });
const MISSING_ADV = card('na', '?', 'customers, market share, patents', 'Who its biggest customers are and its share of the market are written in the annual report, not in a data feed.', 'SEC EDGAR 10-K text + an LLM (not in FMP)', { kind: 'missing' });
const MISSING_RISK = card('na', '?', 'risk factors, short sellers', 'The risks the company itself lists, and how many investors bet against it.', '10-K Risk Factors (EDGAR); short interest (not in FMP)', { kind: 'missing' });

export const VALUE_NVDA: Value = { ...head('NVDA', 'NVIDIA'), sections: [
  { key: 'demand', tone: 'pos', verdict: 'growing fast', cards: [
    card('pos', '+61%/yr', 'sales growth, last 3 years', 'Sales more than quadrupled in three years.', 'FMP income-statement (annual)', { kind: 'bars', values: [27, 61, 130, 182] }),
    card('pos', '+45%', 'what its biggest customers spend on data centers', 'The four companies that buy most of its chips raised their capital spending: the demand behind its sales.',
      'FMP cash-flow-statement (capex) of MSFT, GOOGL, AMZN, META', cos('NVDA', [['MSFT', 52, '+52%'], ['GOOGL', 48, '+48%'], ['AMZN', 41, '+41%'], ['META', 39, '+39%']]), 'its 4 biggest customers'),
    card('pos', '+21%', 'more spending its customers plan next year', 'The analysts covering its customers expect them to keep raising capital spending.',
      'FMP analyst-estimates of MSFT, GOOGL, AMZN, META', cos('NVDA', [['MSFT', 24, '+24%'], ['META', 22, '+22%'], ['GOOGL', 20, '+20%'], ['AMZN', 18, '+18%']]), 'its customers\' outlook'),
    card('pos', '+61%', 'growing faster than its rivals', 'It grows faster than the other chip makers: a sign it is winning share of the market.',
      'FMP income-statement of NVDA, AVGO, AMD, QCOM, INTC', cos('NVDA', [['NVDA', 61, '+61%'], ['AVGO', 28, '+28%'], ['AMD', 14, '+14%'], ['QCOM', 9, '+9%'], ['INTC', 0, '0%', 'flat']]), '4 rivals'),
    card('pos', '88%', 'of sales from data centers', 'Most of the growth comes from its biggest and fastest segment.', 'FMP revenue-product-segmentation', { kind: 'split', parts: [{ label: 'data center 88%', share: 0.88 }, { label: 'gaming', share: 0.08 }, { label: 'other', share: 0.04 }] }),
  ] },
  { key: 'advantage', tone: 'pos', verdict: 'hard to copy', cards: [
    card('pos', '78%', 'return on the money it invests', 'Several times what its rivals earn on their capital: what a moat looks like in the numbers.',
      'FMP key-metrics (ROIC) of NVDA and rivals chosen by hand', cos('NVDA', [['NVDA', 78, '78%'], ['AVGO', 31, '31%'], ['QCOM', 25, '25%'], ['AMD', 6, '6%'], ['INTC', -2, '−2%']]), 'its rivals'),
    card('pos', '71%', 'gross margin', 'Customers pay far more than its chips cost to make.', 'FMP ratios vs stock-peers', { kind: 'vs', value: 71, peers: 48, unit: '%' }),
    MISSING_ADV,
  ] },
  { key: 'economics', tone: 'pos', verdict: 'very profitable', cards: [
    card('pos', '62%', 'operating margin', 'Of every $100 of sales, $62 is left after running the business.', 'FMP income-statement / ratios', { kind: 'bars', values: [21, 54, 62, 62] }),
    card('pos', '$77B', 'free cash flow, last 12 months', 'Real cash, about as much as its reported profit.', 'FMP cash-flow-statement / owner-earnings', { kind: 'bars', values: [4, 27, 61, 77] }),
    card('pos', '+52%', 'profit per share, last year', 'Profit grew a little less than sales after two huge years.', 'FMP financial-growth', { kind: 'bars', values: [110, 250, 147, 52] }),
  ] },
  { key: 'execution', tone: 'pos', verdict: 'delivers', cards: [
    card('pos', '8 of 8', 'quarters above estimates', 'It beat the analysts\' profit estimate in each of the last eight quarters.', 'FMP earnings (EPS estimated vs actual)', { kind: 'dots', hits: 8, total: 8 }),
    card('pos', '8 of 8', 'quarters it met its own sales forecast', 'What management promised on each call, against what it then reported.',
      'earning-call-transcript (guidance, read by an LLM) + FMP income-statement', { kind: 'dots', hits: 8, total: 8 }, 'its earnings calls'),
    card('flat', '−$1.9B', 'insiders sold, net, in 12 months', 'Mostly planned sales by executives; nobody bought.', 'FMP insider-trading/statistics', { kind: 'vs', value: 1.9, peers: 0.4, unit: '%' }),
    card('pos', '+21%', 'more employees in a year', 'The team grows with the business.', 'FMP historical-employee-count', { kind: 'bars', values: [22.5, 26.2, 29.6, 36] }),
    card('pos', '93%', 'of the CEO\'s pay in stock', 'Pay mostly tied to what shareholders get.', 'FMP governance-executive-compensation', { kind: 'split', parts: [{ label: 'stock 93%', share: 0.93 }, { label: 'cash', share: 0.07 }] }),
  ] },
  { key: 'fragility', tone: 'flat', verdict: 'some risks', cards: [
    card('pos', '58', 'financial health score', 'Altman Z-score far in the safe zone (above 3): no sign of financial stress.', 'FMP financial-scores', { kind: 'gauge', value: 58, min: 0, max: 60, zones: [1.8, 3] }),
    card('pos', '7 of 9', 'quality checks passed', 'Piotroski score: profits, cash, debt and efficiency all improving.', 'FMP financial-scores', { kind: 'dots', hits: 7, total: 9 }),
    card('neg', '−16%', 'sales in its worst downturn', 'Its sales in the four past downturns (2001, 2008, 2020, 2023): a cyclical business.',
      'FMP income-statement, history since 2001', { kind: 'bars', values: [-12, -16, 7, -7] }, '4 past downturns'),
    card('pos', '2,980', 'funds hold it; the largest added shares', 'The biggest holders kept buying last quarter.',
      'FMP institutional-ownership/symbol-positions-summary', cos('NVDA', [['VANGUARD', 8.9, '8.9% +0.2'], ['BLK', 7.8, '7.8% +0.1'], ['STT', 3.9, '3.9% −0.1', 'flat']]), 'its biggest holders'),
    MISSING_RISK,
  ] },
  { key: 'price', tone: 'neg', verdict: 'expensive', cards: [
    card('neg', '41×', 'price for each $1 of profit', 'Above the middle of its own 5-year range.', 'FMP key-metrics (historical P/E)', { kind: 'range', low: 25, high: 70, value: 41, mark: 38, labels: ['25×', '70×'] }),
    card('neg', '41×', 'against its rivals', 'Investors pay more for each dollar of its profit than for most other chip makers.',
      'FMP key-metrics (P/E) of NVDA and its rivals', cos('NVDA', [['NVDA', 41, '41×', 'neg'], ['AMD', 38, '38×', 'flat'], ['AVGO', 33, '33×', 'flat'], ['QCOM', 15, '15×', 'flat'], ['INTC', null, 'no profit']]), '4 rivals'),
    card('pos', '+18%', 'to the analysts\' average target', 'Analysts\' targets go from $160 to $360; the price is $216.', 'FMP price-target-consensus', { kind: 'range', low: 160, high: 360, value: 216, mark: 255, labels: ['$160', '$360'] }),
    card('pos', '3 up, 1 down', 'what the banks did in 90 days', 'Upgrades and downgrades by the banks\' analysts.', 'FMP grades',
      cos('NVDA', [['GS', 1, 'upgrade', 'pos'], ['MS', 1, 'upgrade', 'pos'], ['JPM', 1, 'target up', 'pos'], ['C', -1, 'downgrade', 'neg']], false), 'the banks\' analysts'),
    card('flat', '+22%/yr', 'growth the price assumes', 'To be worth today\'s price, profits must grow about 22% a year for ten years.', 'reverse DCF from FMP treasury-rates and market-risk-premium', { kind: 'bars', values: [61, 22] }),
  ] },
] };

export const VALUE_NKE: Value = { ...head('NKE', 'Nike'), sections: [
  { key: 'demand', tone: 'neg', verdict: 'shrinking', cards: [
    card('neg', '−9%', 'sales, last year', 'Sales fell for the first time in years.', 'FMP income-statement (annual)', { kind: 'bars', values: [46.7, 51.2, 51.4, 46.8] }),
    card('neg', '−9%', 'while its rivals grow', 'Two younger rivals grow while it shrinks: it is losing share.',
      'FMP income-statement of NKE, DECK, LULU', cos('NKE', [['DECK', 16, '+16%'], ['LULU', 8, '+8%'], ['NKE', -9, '−9%']]), '2 rivals'),
    card('flat', '+2%', 'sales analysts expect next year', 'A small recovery at best.', 'FMP analyst-estimates', { kind: 'bars', values: [46.8, 47.7] }),
    card('neg', '−12%', 'its biggest region, China', 'The segment that used to grow fastest now shrinks.', 'FMP revenue-geographic-segmentation', { kind: 'split', parts: [{ label: 'N. America 43%', share: 0.43 }, { label: 'Europe', share: 0.27 }, { label: 'China', share: 0.15 }, { label: 'other', share: 0.15 }] }),
  ] },
  { key: 'advantage', tone: 'flat', verdict: 'fading', cards: [
    card('flat', '14%', 'return on the money it invests', 'Still above one rival, below the other: the gap that made it special is gone.',
      'FMP key-metrics (ROIC) of NKE and its rivals', cos('NKE', [['DECK', 31, '31%'], ['NKE', 14, '14%'], ['LULU', 11, '11%']]), 'its rivals'),
    card('flat', '43%', 'gross margin', 'Discounts to clear stock pushed it down.', 'FMP ratios vs stock-peers', { kind: 'bars', values: [46, 45, 44.6, 43] }),
    MISSING_ADV,
  ] },
  { key: 'economics', tone: 'neg', verdict: 'thinner', cards: [
    card('neg', '8%', 'operating margin', 'From 13% two years ago.', 'FMP income-statement / ratios', { kind: 'bars', values: [13, 12, 11, 8] }),
    card('flat', '$3.3B', 'free cash flow, last 12 months', 'Still positive, less than before.', 'FMP cash-flow-statement', { kind: 'bars', values: [5.6, 6.6, 7.4, 3.3] }),
  ] },
  { key: 'execution', tone: 'flat', verdict: 'mixed', cards: [
    card('flat', '5 of 8', 'quarters above estimates', 'It beat lowered estimates more often than not.', 'FMP earnings', { kind: 'dots', hits: 5, total: 8 }),
    card('neg', '3 of 8', 'quarters it met its own sales forecast', 'Management promised more than it delivered.', 'earning-call-transcript (guidance, read by an LLM) + FMP income-statement', { kind: 'dots', hits: 3, total: 8 }, 'its earnings calls'),
    card('pos', '+$1.2M', 'insiders bought, net', 'The new CEO and a director bought shares.', 'FMP insider-trading/statistics', { kind: 'vs', value: 1.2, peers: 0.2, unit: '%' }),
  ] },
  { key: 'fragility', tone: 'pos', verdict: 'sturdy', cards: [
    card('pos', '5.1', 'financial health score', 'Altman Z-score in the safe zone.', 'FMP financial-scores', { kind: 'gauge', value: 5.1, min: 0, max: 8, zones: [1.8, 3] }),
    card('flat', '5 of 9', 'quality checks passed', 'Piotroski score: average.', 'FMP financial-scores', { kind: 'dots', hits: 5, total: 9 }),
    MISSING_RISK,
  ] },
  { key: 'price', tone: 'pos', verdict: 'below its usual', cards: [
    card('pos', '19×', 'price for each $1 of profit', 'Near the bottom of its 5-year range.', 'FMP key-metrics (historical P/E)', { kind: 'range', low: 17, high: 45, value: 19, mark: 30, labels: ['17×', '45×'] }),
    card('flat', '19×', 'against its rivals', 'Between its two rivals.', 'FMP key-metrics (P/E) of NKE and its rivals', cos('NKE', [['DECK', 22, '22×', 'flat'], ['NKE', 19, '19×', 'pos'], ['LULU', 14, '14×', 'flat']]), '2 rivals'),
    card('pos', '+29%', 'to the analysts\' average target', 'Targets from $52 to $110; the price is $58.', 'FMP price-target-consensus', { kind: 'range', low: 52, high: 110, value: 58, mark: 75, labels: ['$52', '$110'] }),
    card('flat', '1 up, 1 down', 'what the banks did in 90 days', 'The banks\' analysts disagree.', 'FMP grades',
      cos('NKE', [['GS', 1, 'upgrade', 'pos'], ['JPM', -1, 'downgrade', 'neg'], ['WFC', 0, 'reiterated', 'flat']], false), 'the banks\' analysts'),
  ] },
] };

export const VALUE_INTC: Value = { ...head('INTC', 'Intel'), sections: [
  { key: 'demand', tone: 'flat', verdict: 'flat', cards: [
    card('flat', '0%/yr', 'sales growth, last 3 years', 'Sales about where they were three years ago.', 'FMP income-statement (annual)', { kind: 'bars', values: [63, 54, 53, 54] }),
    card('flat', '+2%', 'what its PC customers sell', 'The two largest PC makers in its market barely grow: the demand for its main chips.',
      'FMP income-statement of DELL, HPQ', cos('INTC', [['DELL', 6, '+6%'], ['HPQ', -2, '−2%']]), 'its 2 biggest PC customers'),
  ] },
  { key: 'advantage', tone: 'neg', verdict: 'eroded', cards: [
    card('neg', '−2%', 'return on the money it invests', 'Below zero, while its rivals earn plenty: it earns less than its capital costs.',
      'FMP key-metrics (ROIC) of INTC and its rivals', cos('INTC', [['NVDA', 78, '78%'], ['AVGO', 31, '31%'], ['TXN', 18, '18%'], ['AMD', 6, '6%'], ['INTC', -2, '−2%']]), 'its rivals'),
    MISSING_ADV,
  ] },
  { key: 'economics', tone: 'neg', verdict: 'losing money', cards: [
    card('neg', '−4%', 'operating margin', 'A loss from operations, after big write-downs.', 'FMP income-statement / ratios', { kind: 'bars', values: [24, 4, -1, -4] }),
    card('neg', '−$12B', 'free cash flow, last 12 months', 'It spends far more on factories than it earns.', 'FMP cash-flow-statement', { kind: 'bars', values: [9, -4, -15, -12] }),
  ] },
  { key: 'execution', tone: 'neg', verdict: 'misses', cards: [
    card('neg', '3 of 8', 'quarters above estimates', 'More misses than beats.', 'FMP earnings', { kind: 'dots', hits: 3, total: 8 }),
    card('neg', '−15%', 'fewer employees in a year', 'Deep cuts to save costs.', 'FMP historical-employee-count', { kind: 'bars', values: [131, 125, 108, 92] }),
  ] },
  { key: 'fragility', tone: 'neg', verdict: 'fragile', cards: [
    card('neg', '1.4', 'financial health score', 'Altman Z-score in the stress zone (below 1.8).', 'FMP financial-scores', { kind: 'gauge', value: 1.4, min: 0, max: 8, zones: [1.8, 3] }),
    card('neg', '2 of 9', 'quality checks passed', 'Piotroski score: most checks fail.', 'FMP financial-scores', { kind: 'dots', hits: 2, total: 9 }),
    MISSING_RISK,
  ] },
  { key: 'price', tone: 'flat', verdict: 'hard to judge', cards: [
    card('na', '—', 'price for each $1 of profit', 'No profit in the last 12 months: the usual measure does not work.', 'FMP key-metrics', { kind: 'missing' }),
    card('flat', '1.1×', 'price for each $1 of assets', 'About what its factories and cash are worth on paper.', 'FMP key-metrics (price to book)', { kind: 'range', low: 0.8, high: 3.5, value: 1.1, mark: 2, labels: ['0.8×', '3.5×'] }),
    card('neg', '0 up, 2 down', 'what the banks did in 90 days', 'Two downgrades, no upgrade.', 'FMP grades',
      cos('INTC', [['MS', -1, 'downgrade', 'neg'], ['BAC', -1, 'downgrade', 'neg'], ['C', 0, 'reiterated', 'flat']], false), 'the banks\' analysts'),
  ] },
] };

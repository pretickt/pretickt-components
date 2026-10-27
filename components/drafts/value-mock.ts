/**
 * Made-up data for pt-value, three companies with different answers: real tickers, invented numbers. Each card's `source` is the
 * FMP endpoint that will feed it, from Romeo's coverage analysis of 2026-10-27 (Demand medium, Advantage low, Economics, Execution and
 * Price high, Fragility medium); "missing" cards are the facts FMP does not have.
 */
import { co } from './mock';
import type { Value, ValueCard } from './pt-value';

const card = (tone: ValueCard['tone'], big: string, line: string, why: string, source: string, viz: ValueCard['viz']): ValueCard => ({ tone, big, line, why, source, viz });
const MISSING_ADV = card('na', '?', 'customers, market share, patents', 'Who its biggest customers are and its share of the market are written in the annual report, not in a data feed.', 'SEC EDGAR 10-K text + an LLM (not in FMP)', { kind: 'missing' });
const MISSING_RISK = card('na', '?', 'risk factors, short sellers', 'The risks the company itself lists, and how many investors bet against it.', '10-K Risk Factors (EDGAR); short interest (not in FMP)', { kind: 'missing' });

export const VALUE_NVDA: Value = { asOf: '2026-10-26', ...co('NVDA'), sections: [
  { key: 'demand', tone: 'pos', verdict: 'growing fast', cards: [
    card('pos', '+61%/yr', 'sales growth, last 3 years', 'Sales more than quadrupled in three years.', 'FMP income-statement (annual)', { kind: 'bars', values: [27, 61, 130, 182], labels: ['2023', '2024', '2025', '2026'] }),
    card('pos', '+38%', 'sales analysts expect next year', 'The analysts\' average estimate for next year\'s sales.', 'FMP analyst-estimates', { kind: 'bars', values: [182, 251] }),
    card('pos', '88%', 'of sales from data centers', 'Most of the growth comes from its biggest and fastest segment.', 'FMP revenue-product-segmentation', { kind: 'split', parts: [{ label: 'data center 88%', share: 0.88 }, { label: 'gaming', share: 0.08 }, { label: 'other', share: 0.04 }] }),
    card('pos', '+45%', 'its big customers\' spending', 'Google, Microsoft, Meta and Amazon raised their capital spending: demand upstream.', 'FMP cash-flow-statement of its customers (capex)', { kind: 'bars', values: [150, 230, 335] }),
  ] },
  { key: 'advantage', tone: 'pos', verdict: 'hard to copy', cards: [
    card('pos', '78%', 'return on the money it invests', 'Far above its peers: what a moat looks like in the numbers.', 'FMP key-metrics (ROIC) + stock-peers', { kind: 'vs', value: 78, peers: 14, unit: '%' }),
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
    card('flat', '−$1.9B', 'insiders sold, net, in 12 months', 'Mostly planned sales by executives; nobody bought.', 'FMP insider-trading/statistics', { kind: 'vs', value: 1.9, peers: 0.4, unit: '%' }),
    card('pos', '+21%', 'more employees in a year', 'The team grows with the business.', 'FMP historical-employee-count', { kind: 'bars', values: [22.5, 26.2, 29.6, 36] }),
    card('pos', '93%', 'of the CEO\'s pay in stock', 'Pay mostly tied to what shareholders get.', 'FMP governance-executive-compensation', { kind: 'split', parts: [{ label: 'stock 93%', share: 0.93 }, { label: 'cash', share: 0.07 }] }),
  ] },
  { key: 'fragility', tone: 'flat', verdict: 'some risks', cards: [
    card('pos', '58', 'financial health score', 'Altman Z-score far in the safe zone (above 3): no sign of financial stress.', 'FMP financial-scores', { kind: 'gauge', value: 58, min: 0, max: 60, zones: [1.8, 3] }),
    card('pos', '7 of 9', 'quality checks passed', 'Piotroski score: profits, cash, debt and efficiency all improving.', 'FMP financial-scores', { kind: 'dots', hits: 7, total: 9 }),
    card('neg', '−7%', 'sales in its worst year', 'In the 2023 chip downturn sales fell 7%: a cyclical business.', 'FMP income-statement (history since 2001)', { kind: 'bars', values: [16, 4, 27, -7] }),
    MISSING_RISK,
  ] },
  { key: 'price', tone: 'neg', verdict: 'expensive', cards: [
    card('neg', '41×', 'price for each $1 of profit', 'Above the middle of its own 5-year range.', 'FMP key-metrics (historical P/E)', { kind: 'range', low: 25, high: 70, value: 41, mark: 38, labels: ['25×', '70×'] }),
    card('neg', '41× vs 28×', 'against its industry', 'Investors pay more for it than for chip makers in general.', 'FMP historical-industry-pe', { kind: 'vs', value: 41, peers: 28, unit: '×' }),
    card('pos', '+18%', 'to the analysts\' average target', 'Analysts\' targets go from $160 to $360; the price is $216.', 'FMP price-target-consensus', { kind: 'range', low: 160, high: 360, value: 216, mark: 255, labels: ['$160', '$360'] }),
    card('flat', '+22%/yr', 'growth the price assumes', 'To be worth today\'s price, profits must grow about 22% a year for ten years.', 'reverse DCF from FMP treasury-rates and market-risk-premium', { kind: 'bars', values: [61, 22] }),
  ] },
] };

export const VALUE_NKE: Value = { asOf: '2026-10-26', ...co('NKE'), sections: [
  { key: 'demand', tone: 'neg', verdict: 'shrinking', cards: [
    card('neg', '−9%', 'sales, last year', 'Sales fell for the first time in years.', 'FMP income-statement (annual)', { kind: 'bars', values: [46.7, 51.2, 51.4, 46.8] }),
    card('flat', '+2%', 'sales analysts expect next year', 'A small recovery at best.', 'FMP analyst-estimates', { kind: 'bars', values: [46.8, 47.7] }),
    card('neg', '−12%', 'its biggest region, China', 'The segment that used to grow fastest now shrinks.', 'FMP revenue-geographic-segmentation', { kind: 'split', parts: [{ label: 'N. America 43%', share: 0.43 }, { label: 'Europe', share: 0.27 }, { label: 'China', share: 0.15 }, { label: 'other', share: 0.15 }] }),
  ] },
  { key: 'advantage', tone: 'flat', verdict: 'fading', cards: [
    card('flat', '14%', 'return on the money it invests', 'Still above its peers, but half of what it was.', 'FMP key-metrics (ROIC) + stock-peers', { kind: 'vs', value: 14, peers: 11, unit: '%' }),
    card('flat', '43%', 'gross margin', 'Discounts to clear stock pushed it down.', 'FMP ratios vs stock-peers', { kind: 'bars', values: [46, 45, 44.6, 43] }),
    MISSING_ADV,
  ] },
  { key: 'economics', tone: 'neg', verdict: 'thinner', cards: [
    card('neg', '8%', 'operating margin', 'From 13% two years ago.', 'FMP income-statement / ratios', { kind: 'bars', values: [13, 12, 11, 8] }),
    card('flat', '$3.3B', 'free cash flow, last 12 months', 'Still positive, less than before.', 'FMP cash-flow-statement', { kind: 'bars', values: [5.6, 6.6, 7.4, 3.3] }),
  ] },
  { key: 'execution', tone: 'flat', verdict: 'mixed', cards: [
    card('flat', '5 of 8', 'quarters above estimates', 'It beat lowered estimates more often than not.', 'FMP earnings', { kind: 'dots', hits: 5, total: 8 }),
    card('pos', '+$1.2M', 'insiders bought, net', 'The new CEO and a director bought shares.', 'FMP insider-trading/statistics', { kind: 'vs', value: 1.2, peers: 0.2, unit: '%' }),
  ] },
  { key: 'fragility', tone: 'pos', verdict: 'sturdy', cards: [
    card('pos', '5.1', 'financial health score', 'Altman Z-score in the safe zone.', 'FMP financial-scores', { kind: 'gauge', value: 5.1, min: 0, max: 8, zones: [1.8, 3] }),
    card('flat', '5 of 9', 'quality checks passed', 'Piotroski score: average.', 'FMP financial-scores', { kind: 'dots', hits: 5, total: 9 }),
    MISSING_RISK,
  ] },
  { key: 'price', tone: 'pos', verdict: 'below its usual', cards: [
    card('pos', '19×', 'price for each $1 of profit', 'Near the bottom of its 5-year range.', 'FMP key-metrics (historical P/E)', { kind: 'range', low: 17, high: 45, value: 19, mark: 30, labels: ['17×', '45×'] }),
    card('pos', '+29%', 'to the analysts\' average target', 'Targets from $52 to $110; the price is $58.', 'FMP price-target-consensus', { kind: 'range', low: 52, high: 110, value: 58, mark: 75, labels: ['$52', '$110'] }),
  ] },
] };

export const VALUE_INTC: Value = { asOf: '2026-10-26', ...co('INTC'), sections: [
  { key: 'demand', tone: 'flat', verdict: 'flat', cards: [
    card('flat', '0%/yr', 'sales growth, last 3 years', 'Sales about where they were three years ago.', 'FMP income-statement (annual)', { kind: 'bars', values: [63, 54, 53, 54] }),
  ] },
  { key: 'advantage', tone: 'neg', verdict: 'eroded', cards: [
    card('neg', '−2%', 'return on the money it invests', 'Below zero: it earns less than its capital costs.', 'FMP key-metrics (ROIC) + stock-peers', { kind: 'vs', value: 1, peers: 15, unit: '%' }),
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
  ] },
] };

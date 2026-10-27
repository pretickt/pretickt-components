/**
 * Made-up data for pt-value, three companies with different answers: real tickers, invented numbers. Each card's `source` is what
 * will feed it, checked against the FMP API on the Display key (2026-10-27): every card here can be built, 26 kinds from FMP's
 * numbers and two from the earnings calls read by an LLM. Facts FMP does not have — customers' names, market share, patents, the
 * risk factors' text, short interest — get no card. Cards with `via` are pretickt's own analysis across other companies — its
 * customers' spending, its rivals' numbers, its holders, the banks' analysts — the value beyond the direct data.
 */
import { LOGO } from './mock';
import type { Value, ValueCard, ValueCompany } from './pt-value';

const card = (tone: ValueCard['tone'], title: string, big: string, line: string, why: string, source: string, viz: ValueCard['viz'], via?: string): ValueCard =>
  ({ tone, title, big, line, why, source, viz, ...(via ? { via } : {}) });
/** A row of a companies card: `[ticker, value, label]`, the page's own company marked `self`. */
const cos = (self: string, rows: [string, number | null, string, ValueCard['tone']?][], bars = true): ValueCard['viz'] =>
  ({ kind: 'companies', bars, rows: rows.map(([ticker, value, label, tone]): ValueCompany => ({ ticker, logo: LOGO[ticker] ?? null, value, label,
    ...(tone ? { tone } : {}), ...(ticker === self ? { self: true } : {}) })) });
const head = (ticker: string, name: string) => ({ asOf: '2026-10-26', ticker, name, logo: LOGO[ticker] ?? null });
/** How much its biggest customers weigh: the 10-K's table of revenue by major customer (they stay unnamed there). */
const customers = (tone: ValueCard['tone'], share: number | null, why: string): ValueCard => share === null
  ? card(tone, 'Biggest customers', 'under 10%', 'of sales from any one customer', why, 'FMP financial-reports-json (10-K: no customer at 10% of sales)',
    { kind: 'split', parts: [{ label: 'no customer at 10%', share: 1 }] })
  : card(tone, 'Biggest customers', `${share}%`, 'of sales from its 3 biggest customers', why, 'FMP financial-reports-json (10-K table: revenue by major customer)',
    { kind: 'split', parts: [{ label: `top 3 customers ${share}%`, share: share / 100 }, { label: 'everyone else', share: 1 - share / 100 }] });

export const VALUE_NVDA: Value = { ...head('NVDA', 'NVIDIA'), sections: [
  { key: 'demand', tone: 'pos', verdict: 'growing fast', cards: [
    card('pos', 'Sales growth', '+61%', 'a year, for the last 3 years', 'Sales more than quadrupled in three years.', 'FMP income-statement (annual)', { kind: 'bars', values: [27, 61, 130, 182] }),
    card('pos', 'Customers\' spending', '+45%', 'what its 4 biggest customers invest, on a year before',
      'Its annual report does not name its biggest buyers; these four are pretickt\'s pick. Each raised its capital spending in its latest quarter against a year before: the demand behind its sales.',
      'FMP cash-flow-statement (capex), each one\'s latest quarter against a year before; the customer list is pretickt\'s',
      cos('NVDA', [['MSFT', 52, '+52%'], ['GOOGL', 48, '+48%'], ['AMZN', 41, '+41%'], ['META', 39, '+39%']]), 'its 4 biggest customers'),
    card('pos', 'Customers\' plans', '+59%', 'more its customers plan to invest this year',
      'What each said on its latest earnings call about this year\'s capital spending, against last year\'s. Next year\'s plans come with the January calls.',
      'earning-call-transcript of MSFT, GOOGL, AMZN, META (the plan stated on the call, read by an LLM) + FMP cash-flow-statement',
      cos('NVDA', [['META', 80, '+80%'], ['AMZN', 60, '+60%'], ['GOOGL', 55, '+55%'], ['MSFT', 40, '+40%']]), 'its customers\' calls'),
    card('pos', 'Growth vs rivals', '+61%', 'its sales in 12 months, on a year before', 'It grows faster than the other chip makers: a sign it is winning share of the market.',
      'FMP income-statement-ttm of NVDA, AVGO, AMD, QCOM, INTC (rivals chosen by pretickt)',
      cos('NVDA', [['NVDA', 61, '+61%'], ['AVGO', 28, '+28%'], ['AMD', 14, '+14%'], ['QCOM', 9, '+9%'], ['INTC', 0, '0%', 'flat']]), '4 rivals'),
    card('pos', 'Where sales come from', '88%', 'from data centers', 'Most of the growth comes from its biggest and fastest segment.', 'FMP revenue-product-segmentation',
      { kind: 'split', parts: [{ label: 'data center 88%', share: 0.88 }, { label: 'gaming', share: 0.08 }, { label: 'other', share: 0.04 }] }),
  ] },
  { key: 'advantage', tone: 'pos', verdict: 'hard to copy', cards: [
    card('pos', 'Return on capital', '78%', 'what it earns on the money it invests', 'Several times what its rivals earn on their capital: what a moat looks like in the numbers.',
      'FMP key-metrics-ttm (ROIC) of NVDA and rivals chosen by pretickt', cos('NVDA', [['NVDA', 78, '78%'], ['AVGO', 31, '31%'], ['QCOM', 25, '25%'], ['AMD', 6, '6%'], ['INTC', -2, '−2%']]), 'its rivals'),
    card('pos', 'Margin on each sale', '71%', 'left after making the product (gross margin)', 'Customers pay far more than its chips cost to make; its rivals keep 48%.',
      'FMP ratios-ttm, against its rivals\' median', { kind: 'vs', value: 71, peers: 48, unit: '%' }),
  ] },
  { key: 'economics', tone: 'pos', verdict: 'very profitable', cards: [
    card('pos', 'Margin after costs', '62%', 'of sales left after running the business', 'Of every $100 of sales, $62 is left after making, selling and research.', 'FMP income-statement / ratios', { kind: 'bars', values: [21, 54, 62, 62] }),
    card('pos', 'Cash it generates', '$77B', 'free cash flow, last 12 months', 'Real cash, about as much as its reported profit.', 'FMP cash-flow-statement-ttm', { kind: 'bars', values: [4, 27, 61, 77] }),
    card('pos', 'Profit per share', '+52%', 'in the last year', 'Profit grew a little less than sales after two huge years.', 'FMP financial-growth', { kind: 'bars', values: [110, 250, 147, 52] }),
  ] },
  { key: 'execution', tone: 'pos', verdict: 'delivers', cards: [
    card('pos', 'Beats estimates', '8 of 8', 'quarters above the analysts\' estimate', 'It beat the analysts\' profit estimate in each of the last eight quarters.', 'FMP earnings (EPS estimated vs actual)', { kind: 'dots', hits: 8, total: 8 }),
    card('pos', 'Meets its forecast', '8 of 8', 'quarters it reached the sales it forecast', 'On each call management gives next quarter\'s sales; pretickt checks them against what it then reported.',
      'earning-call-transcript (the forecast, read by an LLM) + FMP income-statement', { kind: 'dots', hits: 8, total: 8 }, 'its earnings calls'),
    card('flat', 'Insiders\' trades', '−$1.9B', 'sold, net, by its executives in 12 months', 'Mostly planned sales by executives; nobody bought.',
      'FMP insider-trading/search (sales and buys at their price; awards and gifts left out)', { kind: 'bars', values: [-0.3, -0.6, -0.4, -0.6] }),
    card('pos', 'Employees', '+21%', 'more people in a year', 'The team grows with the business.', 'FMP historical-employee-count', { kind: 'bars', values: [22.5, 26.2, 29.6, 36] }),
    card('pos', 'CEO pay', '93%', 'paid in stock', 'Pay mostly tied to what shareholders get.', 'FMP governance-executive-compensation', { kind: 'split', parts: [{ label: 'stock 93%', share: 0.93 }, { label: 'cash', share: 0.07 }] }),
  ] },
  { key: 'fragility', tone: 'flat', verdict: 'some risks', cards: [
    card('pos', 'Financial health', '58', 'Altman Z-score, safe above 3', 'Far in the safe zone: no sign of financial stress.', 'FMP financial-scores', { kind: 'gauge', value: 58, min: 0, max: 60, zones: [1.8, 3] }),
    card('pos', 'Quality checks', '7 of 9', 'passed (Piotroski score)', 'Profits, cash, debt and efficiency all improving.', 'FMP financial-scores', { kind: 'dots', hits: 7, total: 9 }),
    customers('flat', 34, 'Three buyers, unnamed in its annual report, take a third of its sales: losing one would hurt.'),
    card('neg', 'Past downturns', '−16%', 'its sales in the worst one', 'Its sales in the four past downturns (2001, 2008, 2020, 2023): a cyclical business.',
      'FMP income-statement (quarterly, since 1999)', { kind: 'bars', values: [-12, -16, 7, -7] }, '4 past downturns'),
    card('pos', 'Big funds', '2,980', 'funds hold it; the largest added shares', 'The biggest holders kept buying last quarter.',
      'FMP institutional-ownership (13F: summary and holders)', cos('NVDA', [['VANGUARD', 8.9, '8.9% +0.2'], ['BLK', 7.8, '7.8% +0.1'], ['STT', 3.9, '3.9% −0.1', 'flat']]), 'its biggest holders'),
  ] },
  { key: 'price', tone: 'neg', verdict: 'expensive', cards: [
    card('neg', 'Price vs profit', '41×', 'a year\'s profit (P/E)', 'Above the middle of its own 5-year range.', 'price over the last 12 months\' EPS, from FMP prices and income-statement (as pt-quality)',
      { kind: 'range', low: 25, high: 70, value: 41, mark: 38, labels: ['25×', '70×'] }),
    card('neg', 'Price vs rivals', '41×', 'a year\'s profit, against other chip makers', 'Investors pay more for each dollar of its profit than for most other chip makers.',
      'FMP ratios-ttm (P/E) of NVDA and its rivals', cos('NVDA', [['NVDA', 41, '41×', 'neg'], ['AMD', 38, '38×', 'flat'], ['AVGO', 33, '33×', 'flat'], ['QCOM', 15, '15×', 'flat'], ['INTC', null, 'no profit']]), '4 rivals'),
    card('pos', 'Analysts\' target', '+18%', 'to their average target', 'Analysts\' targets go from $160 to $360; the price is $216.', 'FMP price-target-consensus', { kind: 'range', low: 160, high: 360, value: 216, mark: 255, labels: ['$160', '$360'] }),
    card('pos', 'Banks, last 90 days', '3 up, 1 down', 'targets raised and cut; no rating changed', 'No bank changed its rating in 90 days; most raised the price they expect.', 'FMP grades (ratings) + price-target-news (targets)',
      cos('NVDA', [['GS', 1, 'target up', 'pos'], ['MS', 1, 'target up', 'pos'], ['JPM', 1, 'target up', 'pos'], ['C', -1, 'target cut', 'neg']], false), 'the banks\' analysts'),
    card('flat', 'Growth the price assumes', '+22%', 'a year, for ten years', 'To be worth today\'s price, profits must grow about 22% a year for ten years.', 'reverse DCF from FMP treasury-rates and market-risk-premium', { kind: 'bars', values: [61, 22] }),
  ] },
] };

export const VALUE_NKE: Value = { ...head('NKE', 'Nike'), sections: [
  { key: 'demand', tone: 'neg', verdict: 'shrinking', cards: [
    card('neg', 'Sales growth', '−9%', 'in the last year', 'Sales fell for the first time in years.', 'FMP income-statement (annual)', { kind: 'bars', values: [46.7, 51.2, 51.4, 46.8] }),
    card('neg', 'Growth vs rivals', '−9%', 'while two rivals grow', 'Two younger rivals grow while it shrinks: it is losing share.',
      'FMP income-statement-ttm of NKE, DECK, LULU (rivals chosen by pretickt)', cos('NKE', [['DECK', 16, '+16%'], ['LULU', 8, '+8%'], ['NKE', -9, '−9%']]), '2 rivals'),
    card('flat', 'Analysts\' forecast', '+2%', 'sales growth expected next year', 'A small recovery at best.', 'FMP analyst-estimates (revenue)', { kind: 'bars', values: [46.8, 47.7] }),
    card('neg', 'Where sales come from', '−12%', 'in China, once its fastest region', 'The region that used to grow fastest now shrinks.', 'FMP revenue-geographic-segmentation',
      { kind: 'split', parts: [{ label: 'China 15% of sales', share: 0.15 }, { label: 'N. America', share: 0.43 }, { label: 'Europe', share: 0.27 }, { label: 'other', share: 0.15 }] }),
  ] },
  { key: 'advantage', tone: 'flat', verdict: 'fading', cards: [
    card('flat', 'Return on capital', '14%', 'what it earns on the money it invests', 'Still above one rival, below the other: the gap that made it special is gone.',
      'FMP key-metrics-ttm (ROIC) of NKE and its rivals', cos('NKE', [['DECK', 31, '31%'], ['NKE', 14, '14%'], ['LULU', 11, '11%']]), 'its rivals'),
    card('flat', 'Margin on each sale', '43%', 'left after making the product (gross margin)', 'Discounts to clear stock pushed it down.', 'FMP ratios', { kind: 'bars', values: [46, 45, 44.6, 43] }),
  ] },
  { key: 'economics', tone: 'neg', verdict: 'thinner', cards: [
    card('neg', 'Margin after costs', '8%', 'of sales left after running the business', 'From 13% two years ago.', 'FMP income-statement / ratios', { kind: 'bars', values: [13, 12, 11, 8] }),
    card('flat', 'Cash it generates', '$3.3B', 'free cash flow, last 12 months', 'Still positive, less than before.', 'FMP cash-flow-statement-ttm', { kind: 'bars', values: [5.6, 6.6, 7.4, 3.3] }),
  ] },
  { key: 'execution', tone: 'flat', verdict: 'mixed', cards: [
    card('flat', 'Beats estimates', '5 of 8', 'quarters above the analysts\' estimate', 'It beat lowered estimates more often than not.', 'FMP earnings', { kind: 'dots', hits: 5, total: 8 }),
    card('neg', 'Meets its forecast', '3 of 8', 'quarters it reached the sales it forecast', 'Management promised more than it delivered.',
      'earning-call-transcript (the forecast, read by an LLM) + FMP income-statement', { kind: 'dots', hits: 3, total: 8 }, 'its earnings calls'),
    card('pos', 'Insiders\' trades', '+$1.2M', 'bought, net, by its executives in 12 months', 'The new CEO and a director bought shares.',
      'FMP insider-trading/search (sales and buys at their price; awards and gifts left out)', { kind: 'bars', values: [0, 0.2, 0, 1] }),
  ] },
  { key: 'fragility', tone: 'pos', verdict: 'sturdy', cards: [
    card('pos', 'Financial health', '5.1', 'Altman Z-score, safe above 3', 'In the safe zone.', 'FMP financial-scores', { kind: 'gauge', value: 5.1, min: 0, max: 8, zones: [1.8, 3] }),
    card('flat', 'Quality checks', '5 of 9', 'passed (Piotroski score)', 'Average.', 'FMP financial-scores', { kind: 'dots', hits: 5, total: 9 }),
    customers('pos', null, 'No customer buys a tenth of what it sells: no single buyer can break it.'),
  ] },
  { key: 'price', tone: 'pos', verdict: 'below its usual', cards: [
    card('pos', 'Price vs profit', '19×', 'a year\'s profit (P/E)', 'Near the bottom of its 5-year range.', 'price over the last 12 months\' EPS, from FMP prices and income-statement (as pt-quality)',
      { kind: 'range', low: 17, high: 45, value: 19, mark: 30, labels: ['17×', '45×'] }),
    card('flat', 'Price vs rivals', '19×', 'a year\'s profit, against its rivals', 'Between its two rivals.', 'FMP ratios-ttm (P/E) of NKE and its rivals',
      cos('NKE', [['DECK', 22, '22×', 'flat'], ['NKE', 19, '19×', 'pos'], ['LULU', 14, '14×', 'flat']]), '2 rivals'),
    card('pos', 'Analysts\' target', '+29%', 'to their average target', 'Targets from $52 to $110; the price is $58.', 'FMP price-target-consensus', { kind: 'range', low: 52, high: 110, value: 58, mark: 75, labels: ['$52', '$110'] }),
    card('neg', 'Banks, last 90 days', '1 up, 3 down', 'ratings and targets raised or cut', 'One bank upgraded it, three cut their rating or their target.', 'FMP grades (ratings) + price-target-news (targets)',
      cos('NKE', [['GS', 1, 'upgrade', 'pos'], ['JPM', -1, 'downgrade', 'neg'], ['BAC', -1, 'downgrade', 'neg'], ['WFC', -1, 'target cut', 'neg']], false), 'the banks\' analysts'),
  ] },
] };

export const VALUE_INTC: Value = { ...head('INTC', 'Intel'), sections: [
  { key: 'demand', tone: 'flat', verdict: 'flat', cards: [
    card('flat', 'Sales growth', '0%', 'a year, for the last 3 years', 'Sales about where they were three years ago.', 'FMP income-statement (annual)', { kind: 'bars', values: [63, 54, 53, 54] }),
    card('flat', 'PC customers', '+2%', 'what the PC makers it sells to sell', 'Its report does not name them; Dell and HP are pretickt\'s pick. They barely grow: the demand for its main chips.',
      'FMP income-statement-ttm of DELL, HPQ (the customer list is pretickt\'s)', cos('INTC', [['DELL', 6, '+6%'], ['HPQ', -2, '−2%']]), 'its 2 biggest PC customers'),
  ] },
  { key: 'advantage', tone: 'neg', verdict: 'eroded', cards: [
    card('neg', 'Return on capital', '−2%', 'what it earns on the money it invests', 'Below zero, while its rivals earn plenty: it earns less than its capital costs.',
      'FMP key-metrics-ttm (ROIC) of INTC and its rivals', cos('INTC', [['NVDA', 78, '78%'], ['AVGO', 31, '31%'], ['TXN', 18, '18%'], ['AMD', 6, '6%'], ['INTC', -2, '−2%']]), 'its rivals'),
  ] },
  { key: 'economics', tone: 'neg', verdict: 'losing money', cards: [
    card('neg', 'Margin after costs', '−4%', 'of sales: a loss from running the business', 'A loss from operations, after big write-downs.', 'FMP income-statement / ratios', { kind: 'bars', values: [24, 4, -1, -4] }),
    card('neg', 'Cash it generates', '−$12B', 'free cash flow, last 12 months', 'It spends far more on factories than it earns.', 'FMP cash-flow-statement-ttm', { kind: 'bars', values: [9, -4, -15, -12] }),
  ] },
  { key: 'execution', tone: 'neg', verdict: 'misses', cards: [
    card('neg', 'Beats estimates', '3 of 8', 'quarters above the analysts\' estimate', 'More misses than beats.', 'FMP earnings', { kind: 'dots', hits: 3, total: 8 }),
    card('neg', 'Employees', '−15%', 'fewer people in a year', 'Deep cuts to save costs.', 'FMP historical-employee-count', { kind: 'bars', values: [131, 125, 108, 92] }),
  ] },
  { key: 'fragility', tone: 'neg', verdict: 'fragile', cards: [
    card('neg', 'Financial health', '1.4', 'Altman Z-score, stress below 1.8', 'In the stress zone.', 'FMP financial-scores', { kind: 'gauge', value: 1.4, min: 0, max: 8, zones: [1.8, 3] }),
    card('neg', 'Quality checks', '2 of 9', 'passed (Piotroski score)', 'Most checks fail.', 'FMP financial-scores', { kind: 'dots', hits: 2, total: 9 }),
    customers('neg', 42, 'Three PC makers, unnamed in its annual report, buy over two fifths of what it sells: losing one would hurt.'),
  ] },
  { key: 'price', tone: 'flat', verdict: 'hard to judge', cards: [
    card('na', 'Price vs profit', '—', 'it lost money in 12 months: no P/E', 'With a loss there is no price for each $1 of profit; the price against its assets is the measure that works.',
      'FMP income-statement (EPS, last 4 quarters)', { kind: 'bars', values: [-0.38, 0.02, -0.19, -0.08] }),
    card('flat', 'Price vs assets', '1.1×', 'what its assets are worth on paper', 'About what its factories and cash are worth: the measure to read when there is no profit.', 'FMP ratios (price to book)',
      { kind: 'range', low: 0.8, high: 3.5, value: 1.1, mark: 2, labels: ['0.8×', '3.5×'] }),
    card('neg', 'Banks, last 90 days', '0 up, 2 down', 'ratings raised and cut', 'Two downgrades, no upgrade.', 'FMP grades (ratings) + price-target-news (targets)',
      cos('INTC', [['MS', -1, 'downgrade', 'neg'], ['BAC', -1, 'downgrade', 'neg'], ['C', 0, 'reiterated', 'flat']], false), 'the banks\' analysts'),
  ] },
] };

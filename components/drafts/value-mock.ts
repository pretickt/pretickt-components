/**
 * Made-up data for pt-value, three companies with different answers: real tickers, invented numbers. Each card's `source` is what
 * will feed it, checked against the FMP API on the Display key (2026-10-27): every card here can be built, 26 kinds from FMP's
 * numbers and two from the earnings calls read by an LLM. Facts FMP does not have — customers' names, market share, patents, the
 * risk factors' text, short interest — get no card. Cards with `via` are pretickt's own analysis across other companies — its
 * customers' spending, its competitors' numbers, its holders, the banks' analysts — the value beyond the direct data.
 * Each card's sentence (`say`) and the questions under the columns are what the resolver will template: the company's common name,
 * the number, the date or period. The questions are the ones people search (DataForSEO, 2026-10-28: Google's "People also ask"
 * and the searched phrases), the titles' `term` the words they search the card's fact with.
 */
import { LOGO } from './mock';
import { CHECKS, type CheckKey, type Value, type ValueCard, type ValueCompany } from './pt-value';

const card = (tone: ValueCard['tone'], title: string, big: string, line: string, say: string, why: string, source: string, viz: ValueCard['viz'],
  o: { via?: string; term?: string } = {}): ValueCard => ({ tone, title, ...(o.term ? { term: o.term } : {}), big, line, say, why, source, viz, ...(o.via ? { via: o.via } : {}) });
/** A row of a companies card: `[ticker, value, label]`, the page's own company marked `self`. */
const cos = (self: string, rows: [string, number | null, string, ValueCard['tone']?][], bars = true): ValueCard['viz'] =>
  ({ kind: 'companies', bars, rows: rows.map(([ticker, value, label, tone]): ValueCompany => ({ ticker, logo: LOGO[ticker] ?? null, value, label,
    ...(tone ? { tone } : {}), ...(ticker === self ? { self: true } : {}) })) });
const head = (ticker: string, name: string) => ({ asOf: '2026-10-26', ticker, name, logo: LOGO[ticker] ?? null });
/** How much its biggest customers weigh: the 10-K's table of revenue by major customer (they stay unnamed there). */
const customers = (tone: ValueCard['tone'], share: number | null, say: string, why: string): ValueCard => share === null
  ? card(tone, 'biggest customers', 'under 10%', 'of sales from any one customer', say, why, 'FMP financial-reports-json (10-K: no customer at 10% of sales)',
    { kind: 'split', parts: [{ label: 'no customer at 10%', share: 1 }] })
  : card(tone, 'biggest customers', `${share}%`, 'of sales from its 3 biggest customers', say, why, 'FMP financial-reports-json (10-K table: revenue by major customer)',
    { kind: 'split', parts: [{ label: `top 3 customers ${share}%`, share: share / 100 }, { label: 'everyone else', share: 1 - share / 100 }] });
/** A record over time: quarters from fiscal `Q{q} FY{fy}` on, oldest first, each by how much it beat what was expected (`vs`). */
const record = (vs: string, q: number, fy: number, by: number[]): ValueCard['viz'] => ({ kind: 'quarters', vs,
  quarters: by.map((b, i) => ({ q: `Q${((q - 1 + i) % 4) + 1}`, fy: `FY${fy + Math.floor((q - 1 + i) / 4)}`, by: b })) });
const ESTIMATE = 'the analysts\' estimate', FORECAST = 'its forecast';
/** The nine Piotroski checks, all passed but the `missed` ones. */
const piotroski = (...missed: CheckKey[]): ValueCard['viz'] =>
  ({ kind: 'checks', ok: Object.fromEntries((Object.keys(CHECKS) as CheckKey[]).map((k) => [k, !missed.includes(k)])) as Record<CheckKey, boolean> });
const PE_SOURCE = 'price over the last 12 months\' EPS, from FMP prices and income-statement (as pt-quality)';
const BANKS_SOURCE = 'FMP grades (ratings) + price-target-news (targets)';
const INSIDERS_SOURCE = 'FMP insider-trading/search (sales and buys at their price; awards and gifts left out)';

export const VALUE_NVDA: Value = { ...head('NVDA', 'Nvidia'), pe: { now: 41.2, median: 33.4 }, sections: [
  { key: 'demand', tone: 'pos', verdict: 'growing fast', cards: [
    card('pos', 'sales growth', '+89%', 'a year, for the last 3 years', 'Nvidia\'s sales grew 89% a year for 3 years, to $182B in fiscal 2026.',
      'Sales grew almost sevenfold in three years.', 'FMP income-statement (annual)', { kind: 'bars', values: [27, 61, 130, 182] }, { term: 'revenue growth' }),
    card('pos', 'customers\' spending', '+45%', 'what its 4 biggest customers invest, on a year before',
      'Nvidia\'s 4 biggest customers spent 45% more on capital in their latest quarter than a year before.',
      'Its annual report does not name its biggest buyers; these four are pretickt\'s pick. Each raised its capital spending in its latest quarter against a year before: the demand behind its sales.',
      'FMP cash-flow-statement (capex), each one\'s latest quarter against a year before; the customer list is pretickt\'s',
      cos('NVDA', [['MSFT', 52, '+52%'], ['GOOGL', 48, '+48%'], ['AMZN', 41, '+41%'], ['META', 39, '+39%']]), { via: 'its 4 biggest customers' }),
    card('pos', 'customers\' plans', '+59%', 'more its customers plan to invest this year',
      'On their latest calls, Nvidia\'s 4 biggest customers planned 59% more capital spending for 2026 than for 2025.',
      'What each said on its latest earnings call about this year\'s capital spending, against last year\'s. Next year\'s plans come with the January calls.',
      'earning-call-transcript of MSFT, GOOGL, AMZN, META (the plan stated on the call, read by an LLM) + FMP cash-flow-statement',
      cos('NVDA', [['META', 80, '+80%'], ['AMZN', 60, '+60%'], ['GOOGL', 55, '+55%'], ['MSFT', 40, '+40%']]), { via: 'its customers\' calls' }),
    card('pos', 'competitors', '+40%', 'its sales in 12 months, on a year before',
      'Nvidia\'s sales grew 40% in the last 12 months, faster than Broadcom (+28%), AMD (+14%), Qualcomm (+9%) and Intel (0%).',
      'It grows faster than the other chip makers: a sign it is winning share of the market.',
      'FMP income-statement-ttm of NVDA, AVGO, AMD, QCOM, INTC (competitors chosen by pretickt)',
      cos('NVDA', [['NVDA', 40, '+40%'], ['AVGO', 28, '+28%'], ['AMD', 14, '+14%'], ['QCOM', 9, '+9%'], ['INTC', 0, '0%', 'flat']]), { via: '4 competitors' }),
    card('pos', 'sales by business', '88%', 'from data centers', 'Data centers brought Nvidia 88% of its sales in fiscal 2026, gaming 8%.',
      'Most of the growth comes from its biggest and fastest segment.', 'FMP revenue-product-segmentation',
      { kind: 'split', parts: [{ label: 'data center 88%', share: 0.88 }, { label: 'gaming', share: 0.08 }, { label: 'other', share: 0.04 }] }, { term: 'revenue by segment' }),
  ] },
  { key: 'advantage', tone: 'pos', verdict: 'hard to copy', cards: [
    card('pos', 'return on capital', '78%', 'what it earns on the money it invests', 'Nvidia earned 78% on its invested capital in the last 12 months; Broadcom 31%, AMD 6%.',
      'Several times what its competitors earn on their capital: what a moat looks like in the numbers.',
      'FMP key-metrics-ttm (ROIC) of NVDA and competitors chosen by pretickt', cos('NVDA', [['NVDA', 78, '78%'], ['AVGO', 31, '31%'], ['QCOM', 25, '25%'], ['AMD', 6, '6%'], ['INTC', -2, '−2%']]),
      { via: 'its competitors', term: 'ROIC' }),
    card('pos', 'margin on each sale', '71%', 'left after making the product', 'Nvidia kept 71% of each sale after making the product in the last 12 months; its competitors\' median is 48%.',
      'Customers pay far more than its chips cost to make.', 'FMP ratios-ttm, against its competitors\' median', { kind: 'vs', value: 71, peers: 48, unit: '%' }, { term: 'gross margin' }),
  ] },
  { key: 'economics', tone: 'pos', verdict: 'very profitable', cards: [
    card('pos', 'margin after costs', '62%', 'of sales left after running the business', 'Nvidia\'s operating profit margin was 62% in fiscal 2026, against 21% three years before.',
      'Of every $100 of sales, $62 is left after making, selling and research.', 'FMP income-statement / ratios', { kind: 'bars', values: [21, 54, 62, 62] }, { term: 'profit margin' }),
    card('pos', 'cash generated', '$77B', 'cash left after investing, last 12 months', 'Nvidia generated $77B of free cash flow in the last 12 months, about as much as its reported profit.',
      'Real cash, not only profit on paper.', 'FMP cash-flow-statement-ttm', { kind: 'bars', values: [4, 27, 61, 77] }, { term: 'free cash flow' }),
    card('pos', 'profit per share', '+52%', 'in the last year', 'Nvidia\'s earnings per share grew 52% in fiscal 2026, after two years above 100%.',
      'Profit grew faster than sales: costs grew slower than revenue.', 'FMP financial-growth', { kind: 'bars', values: [110, 250, 147, 52] }),
  ] },
  { key: 'execution', tone: 'pos', verdict: 'delivers', cards: [
    card('pos', 'earnings vs estimates', '8 of 8', 'quarters above the analysts\' estimate', 'Nvidia beat the analysts\' profit estimate in each of its last 8 quarters, the latest on Aug 26, 2026.',
      'A record of earning more than analysts expect.', 'FMP earnings (EPS estimated vs actual)',
      record(ESTIMATE, 3, 25, [0.091, 0.062, 0.048, 0.036, 0.042, 0.039, 0.031, 0.044])),
    card('pos', 'sales vs forecast', '8 of 8', 'quarters it reached the sales it forecast', 'In each of the last 8 quarters Nvidia reached the sales it had forecast on its earnings call.',
      'On each call management gives next quarter\'s sales; pretickt checks them against what it then reported.',
      'earning-call-transcript (the forecast, read by an LLM) + FMP income-statement',
      record(FORECAST, 3, 25, [0.052, 0.045, 0.038, 0.029, 0.031, 0.027, 0.022, 0.025]), { via: 'its earnings calls', term: 'guidance' }),
    card('flat', 'insider selling', '−$1.9B', 'sold, net, by its executives in 12 months',
      'Nvidia\'s executives sold a net $1.9B of shares in the 12 months to Oct 26, 2026, mostly in planned sales; none bought.',
      'Planned sales are set months ahead: they say little about the outlook.', INSIDERS_SOURCE, { kind: 'bars', values: [-0.3, -0.6, -0.4, -0.6] }),
    card('pos', 'number of employees', '+21%', 'more people in a year', 'Nvidia had 36,000 employees at the end of fiscal 2026, 21% more than a year before.',
      'The team grows with the business.', 'FMP historical-employee-count', { kind: 'bars', values: [22.5, 26.2, 29.6, 36] }),
    card('pos', 'CEO pay', '$34M', 'for 2025, 93% of it in stock', 'Nvidia paid its CEO $34M for 2025, 93% of it in stock.',
      'Pay mostly tied to what shareholders get.', 'FMP governance-executive-compensation', { kind: 'split', parts: [{ label: 'stock 93%', share: 0.93 }, { label: 'cash', share: 0.07 }] }),
  ] },
  { key: 'fragility', tone: 'flat', verdict: 'some risks', cards: [
    card('pos', 'financial health', '58', 'Altman Z-score, safe above 3', 'Nvidia\'s Altman Z-score is 58 (Oct 26, 2026), far above 3, where the safe zone starts.',
      'No sign of financial stress.', 'FMP financial-scores', { kind: 'gauge', value: 58, min: 0, max: 60, zones: [1.8, 3] }),
    card('pos', 'quality checks', '7 of 9', 'checks passed', 'Nvidia passes 7 of the 9 Piotroski checks on profit, cash, debt and efficiency; it misses on new shares and on sales for its assets.',
      'Strong on profit, cash and debt.', 'FMP financial-scores', piotroski('shares', 'turnover'), { term: 'Piotroski score' }),
    customers('flat', 34, 'Three customers, unnamed in Nvidia\'s 10-K, made 34% of its sales in fiscal 2026.', 'Losing one of them would hurt.'),
    card('neg', 'in past downturns', '−16%', 'its sales in the worst one', 'Nvidia\'s sales fell in 3 of the 4 past downturns, by as much as 16% in 2008.',
      'Its sales in the four past downturns (2001, 2008, 2020, 2023): a cyclical business.', 'FMP income-statement (quarterly, since 1999)',
      { kind: 'bars', values: [-12, -16, 7, -7] }, { via: '4 past downturns' }),
    card('pos', 'shareholders', '2,980', 'funds hold it; the largest added shares',
      '2,980 funds hold Nvidia; Vanguard (8.9%) and BlackRock (7.8%) added shares last quarter, State Street (3.9%) sold some.',
      'The biggest holders kept buying last quarter.', 'FMP institutional-ownership (13F: summary and holders)',
      cos('NVDA', [['VANGUARD', 8.9, '8.9% +0.2'], ['BLK', 7.8, '7.8% +0.1'], ['STT', 3.9, '3.9% −0.1', 'flat']]), { via: 'its biggest holders', term: 'institutional ownership' }),
  ] },
  { key: 'price', tone: 'neg', verdict: 'expensive', cards: [
    card('neg', 'price vs profit', '41.2×', 'a year\'s earnings', 'Nvidia\'s P/E ratio is 41.2 (Oct 26, 2026), above its 3-year median of 33.4.',
      'More of its future is in the price than usual.', PE_SOURCE, { kind: 'range', low: 25, high: 70, value: 41.2, mark: 33.4, labels: ['25×', '70×'] }, { term: 'P/E ratio' }),
    card('neg', 'price vs competitors', '41.2×', 'a year\'s earnings, against other chip makers',
      'Investors pay 41.2 times Nvidia\'s earnings, more than for AMD (38), Broadcom (33) or Qualcomm (15).',
      'Each dollar of its profit costs more than at most other chip makers.', 'FMP ratios-ttm (P/E) of NVDA and its competitors',
      cos('NVDA', [['NVDA', 41.2, '41.2×', 'neg'], ['AMD', 38, '38×', 'flat'], ['AVGO', 33, '33×', 'flat'], ['QCOM', 15, '15×', 'flat'], ['INTC', null, 'no profit']]), { via: '4 competitors' }),
    card('pos', 'analysts\' target', '+18%', 'to their average target', 'Analysts\' average price target for Nvidia is $255, 18% above the Oct 26, 2026 close of $216.',
      'Analysts\' targets go from $160 to $360.', 'FMP price-target-consensus', { kind: 'range', low: 160, high: 360, value: 216, mark: 255, labels: ['$160', '$360'] }, { term: 'price target' }),
    card('pos', 'analyst ratings, 90 days', '3 up, 1 down', 'targets raised and cut; no rating changed',
      'In the 90 days to Oct 26, 2026, Goldman Sachs, Morgan Stanley and JPMorgan raised their targets for Nvidia, Citi cut its; no bank changed its rating.',
      'Most banks raised the price they expect.', BANKS_SOURCE,
      cos('NVDA', [['GS', 1, 'target up', 'pos'], ['MS', 1, 'target up', 'pos'], ['JPM', 1, 'target up', 'pos'], ['C', -1, 'target cut', 'neg']], false), { via: 'the banks\' analysts' }),
    card('flat', 'growth priced in', '+22%', 'a year, for ten years', 'At $216 a share, Nvidia\'s profits must grow about 22% a year for ten years to be worth the price (Oct 26, 2026).',
      'A reverse DCF: the growth today\'s price already counts on.', 'reverse DCF from FMP treasury-rates and market-risk-premium', { kind: 'bars', values: [40, 22] }, { term: 'fair value' }),
  ] },
], faq: [
  { q: 'Who is dumping Nvidia stock?', a: 'Nvidia\'s executives sold a net $1.9B of shares in the 12 months to Oct 26, 2026, mostly in planned sales. Of its three largest holders, Vanguard and BlackRock added shares last quarter and State Street sold some.' },
  { q: 'What is Nvidia\'s P/E ratio?', a: 'Nvidia\'s P/E ratio is 41.2 (Oct 26, 2026): the price is 41.2 times its earnings over the last 12 months, above its 3-year median of 33.4.' },
  { q: 'Who are Nvidia\'s biggest competitors?', a: 'pretickt compares Nvidia with Broadcom, AMD, Qualcomm and Intel. Its sales grew 40% in the last 12 months, faster than all four.' },
  { q: 'How does Nvidia make money?', a: 'Mostly from data centers: 88% of Nvidia\'s sales in fiscal 2026, then gaming with 8%.' },
] };

export const VALUE_NKE: Value = { ...head('NKE', 'Nike'), pe: { now: 19.4, median: 30.2 }, sections: [
  { key: 'demand', tone: 'neg', verdict: 'shrinking', cards: [
    card('neg', 'sales growth', '−9%', 'in the last year', 'Nike\'s sales fell 9% in fiscal 2026, to $46.8B.', 'Sales fell for the first time in years.',
      'FMP income-statement (annual)', { kind: 'bars', values: [46.7, 51.2, 51.4, 46.8] }, { term: 'revenue growth' }),
    card('neg', 'competitors', '−9%', 'while two competitors grow', 'Nike\'s sales fell 9% in the last 12 months while Deckers grew 16% and Lululemon 8%.',
      'Two younger competitors grow while it shrinks: it is losing share.', 'FMP income-statement-ttm of NKE, DECK, LULU (competitors chosen by pretickt)',
      cos('NKE', [['DECK', 16, '+16%'], ['LULU', 8, '+8%'], ['NKE', -9, '−9%']]), { via: '2 competitors' }),
    card('flat', 'analysts\' forecast', '+2%', 'sales growth expected next year', 'Analysts expect Nike\'s sales to grow 2% in fiscal 2027.', 'A small recovery at best.',
      'FMP analyst-estimates (revenue)', { kind: 'bars', values: [46.8, 47.7] }),
    card('neg', 'sales by region', '−12%', 'in China, once its fastest region', 'Nike\'s sales in China fell 12% in fiscal 2026; China is 15% of its sales.',
      'The region that used to grow fastest now shrinks.', 'FMP revenue-geographic-segmentation',
      { kind: 'split', parts: [{ label: 'China 15% of sales', share: 0.15 }, { label: 'N. America', share: 0.43 }, { label: 'Europe', share: 0.27 }, { label: 'other', share: 0.15 }] },
      { term: 'revenue by region' }),
  ] },
  { key: 'advantage', tone: 'flat', verdict: 'fading', cards: [
    card('flat', 'return on capital', '14%', 'what it earns on the money it invests', 'Nike earned 14% on its invested capital in the last 12 months; Deckers 31%, Lululemon 11%.',
      'Still above one competitor, below the other: the gap that made it special is gone.', 'FMP key-metrics-ttm (ROIC) of NKE and its competitors',
      cos('NKE', [['DECK', 31, '31%'], ['NKE', 14, '14%'], ['LULU', 11, '11%']]), { via: 'its competitors', term: 'ROIC' }),
    card('flat', 'margin on each sale', '43%', 'left after making the product', 'Nike kept 43% of each sale after making the product in fiscal 2026, down from 46% three years before.',
      'Discounts to clear stock pushed it down.', 'FMP ratios', { kind: 'bars', values: [46, 45, 44.6, 43] }, { term: 'gross margin' }),
  ] },
  { key: 'economics', tone: 'neg', verdict: 'thinner', cards: [
    card('neg', 'margin after costs', '8%', 'of sales left after running the business', 'Nike\'s operating profit margin was 8% in fiscal 2026, down from 13% three years before.',
      'Less of each dollar of sales is left as profit.', 'FMP income-statement / ratios', { kind: 'bars', values: [13, 12, 11, 8] }, { term: 'profit margin' }),
    card('flat', 'cash generated', '$3.3B', 'cash left after investing, last 12 months', 'Nike generated $3.3B of free cash flow in the last 12 months, against $7.4B a year before.',
      'Still positive, less than before.', 'FMP cash-flow-statement-ttm', { kind: 'bars', values: [5.6, 6.6, 7.4, 3.3] }, { term: 'free cash flow' }),
  ] },
  { key: 'execution', tone: 'flat', verdict: 'mixed', cards: [
    card('flat', 'earnings vs estimates', '5 of 8', 'quarters above the analysts\' estimate', 'Nike beat the analysts\' profit estimate in 5 of its last 8 quarters, the latest on Sep 30, 2026.',
      'It beat lowered estimates more often than not.', 'FMP earnings', record(ESTIMATE, 2, 25, [0.21, -0.12, 0.35, -0.05, 0.18, 0.09, -0.08, 0.14])),
    card('neg', 'sales vs forecast', '3 of 8', 'quarters it reached the sales it forecast', 'Nike reached the sales it had forecast in 3 of the last 8 quarters.',
      'Management promised more than it delivered.', 'earning-call-transcript (the forecast, read by an LLM) + FMP income-statement',
      record(FORECAST, 2, 25, [-0.02, -0.031, 0.004, -0.018, 0.012, -0.009, -0.024, 0.006]),
      { via: 'its earnings calls', term: 'guidance' }),
    card('pos', 'insider buying', '+$1.2M', 'bought, net, by its executives in 12 months',
      'Nike\'s executives bought a net $1.2M of shares in the 12 months to Oct 26, 2026, the new CEO among them.',
      'Executives buying with their own money is a vote of confidence.', INSIDERS_SOURCE, { kind: 'bars', values: [0, 0.2, 0, 1] }),
  ] },
  { key: 'fragility', tone: 'pos', verdict: 'sturdy', cards: [
    card('pos', 'financial health', '5.1', 'Altman Z-score, safe above 3', 'Nike\'s Altman Z-score is 5.1 (Oct 26, 2026), above 3, in the safe zone.',
      'No sign of financial stress.', 'FMP financial-scores', { kind: 'gauge', value: 5.1, min: 0, max: 8, zones: [1.8, 3] }),
    card('flat', 'quality checks', '5 of 9', 'checks passed', 'Nike passes 5 of the 9 Piotroski checks; it misses on return on assets, debt, gross margin and sales for its assets.',
      'Average: its profit and cash hold, its efficiency slips.', 'FMP financial-scores', piotroski('droa', 'leverage', 'margin', 'turnover'), { term: 'Piotroski score' }),
    customers('pos', null, 'No customer makes 10% of Nike\'s sales, by its fiscal 2026 10-K.', 'No single buyer can break it.'),
  ] },
  { key: 'price', tone: 'pos', verdict: 'below its usual', cards: [
    card('pos', 'price vs profit', '19.4×', 'a year\'s earnings', 'Nike\'s P/E ratio is 19.4 (Oct 26, 2026), below its 3-year median of 30.2.',
      'Less of its future is in the price than usual.', PE_SOURCE, { kind: 'range', low: 17, high: 45, value: 19.4, mark: 30.2, labels: ['17×', '45×'] }, { term: 'P/E ratio' }),
    card('flat', 'price vs competitors', '19.4×', 'a year\'s earnings, against its competitors', 'Investors pay 19.4 times Nike\'s earnings, against 22 for Deckers and 14 for Lululemon.',
      'Between its two competitors.', 'FMP ratios-ttm (P/E) of NKE and its competitors',
      cos('NKE', [['DECK', 22, '22×', 'flat'], ['NKE', 19.4, '19.4×', 'pos'], ['LULU', 14, '14×', 'flat']]), { via: '2 competitors' }),
    card('pos', 'analysts\' target', '+29%', 'to their average target', 'Analysts\' average price target for Nike is $75, 29% above the Oct 26, 2026 close of $58.',
      'Targets go from $52 to $110.', 'FMP price-target-consensus', { kind: 'range', low: 52, high: 110, value: 58, mark: 75, labels: ['$52', '$110'] }, { term: 'price target' }),
    card('neg', 'analyst ratings, 90 days', '1 up, 3 down', 'ratings and targets raised or cut',
      'In the 90 days to Oct 26, 2026, Goldman Sachs upgraded Nike, JPMorgan and Bank of America downgraded it and Wells Fargo cut its target.',
      'More banks cut than raised.', BANKS_SOURCE,
      cos('NKE', [['GS', 1, 'upgrade', 'pos'], ['JPM', -1, 'downgrade', 'neg'], ['BAC', -1, 'downgrade', 'neg'], ['WFC', -1, 'target cut', 'neg']], false), { via: 'the banks\' analysts' }),
  ] },
], faq: [
  { q: 'Is Nike ever going to recover?', a: 'Analysts expect Nike\'s sales to grow 2% in fiscal 2027, after a 9% fall in fiscal 2026. Its executives bought a net $1.2M of shares in the 12 months to Oct 26, 2026.' },
  { q: 'What is Nike\'s P/E ratio?', a: 'Nike\'s P/E ratio is 19.4 (Oct 26, 2026): the price is 19.4 times its earnings over the last 12 months, below its 3-year median of 30.2.' },
  { q: 'Who are Nike\'s competitors?', a: 'pretickt compares Nike with Deckers and Lululemon. In the last 12 months their sales grew 16% and 8%, while Nike\'s fell 9%.' },
] };

export const VALUE_INTC: Value = { ...head('INTC', 'Intel'), pe: { now: null, median: null }, sections: [
  { key: 'demand', tone: 'flat', verdict: 'flat', cards: [
    card('flat', 'sales growth', '0%', 'a year, for the last 3 years', 'Intel\'s sales were $54B in 2025, about where they were three years before.',
      'Sales about where they were three years ago.', 'FMP income-statement (annual)', { kind: 'bars', values: [53, 54, 53, 54] }, { term: 'revenue growth' }),
    card('flat', 'PC customers', '+2%', 'what the PC makers it sells to sell', 'Dell and HP, the PC makers Intel sells most to by pretickt\'s pick, grew their sales 2% on average in the last 12 months.',
      'Its report does not name them; Dell and HP are pretickt\'s pick. They barely grow: the demand for its main chips.',
      'FMP income-statement-ttm of DELL, HPQ (the customer list is pretickt\'s)', cos('INTC', [['DELL', 6, '+6%'], ['HPQ', -2, '−2%']]), { via: 'its 2 biggest PC customers' }),
  ] },
  { key: 'advantage', tone: 'neg', verdict: 'eroded', cards: [
    card('neg', 'return on capital', '−2%', 'what it earns on the money it invests', 'Intel earned −2% on its invested capital in the last 12 months, while Nvidia earned 78% and AMD 6%.',
      'Below zero, while its competitors earn plenty: it earns less than its capital costs.', 'FMP key-metrics-ttm (ROIC) of INTC and its competitors',
      cos('INTC', [['NVDA', 78, '78%'], ['AVGO', 31, '31%'], ['TXN', 18, '18%'], ['AMD', 6, '6%'], ['INTC', -2, '−2%']]), { via: 'its competitors', term: 'ROIC' }),
  ] },
  { key: 'economics', tone: 'neg', verdict: 'losing money', cards: [
    card('neg', 'margin after costs', '−4%', 'of sales: a loss from running the business', 'Intel\'s operating margin was −4% in 2025: a loss, against a 24% profit three years before.',
      'A loss from operations, after big write-downs.', 'FMP income-statement / ratios', { kind: 'bars', values: [24, 4, -1, -4] }, { term: 'profit margin' }),
    card('neg', 'cash generated', '−$12B', 'cash burned after investing, last 12 months', 'Intel spent $12B more than it generated in the last 12 months, mostly on factories.',
      'It spends far more on factories than it earns.', 'FMP cash-flow-statement-ttm', { kind: 'bars', values: [9, -4, -15, -12] }, { term: 'free cash flow' }),
  ] },
  { key: 'execution', tone: 'neg', verdict: 'misses', cards: [
    card('neg', 'earnings vs estimates', '3 of 8', 'quarters above the analysts\' estimate', 'Intel beat the analysts\' profit estimate in 3 of its last 8 quarters, the latest on Oct 23, 2026.',
      'More misses than beats.', 'FMP earnings', record(ESTIMATE, 4, 24, [-0.4, 0.15, -0.6, -0.25, 0.3, -0.1, -0.35, 0.08])),
    card('neg', 'number of employees', '−15%', 'fewer people in a year', 'Intel had 92,000 employees at the end of 2025, 15% fewer than a year before.',
      'Deep cuts to save costs.', 'FMP historical-employee-count', { kind: 'bars', values: [131, 125, 108, 92] }),
  ] },
  { key: 'fragility', tone: 'neg', verdict: 'fragile', cards: [
    card('neg', 'financial health', '1.4', 'Altman Z-score, stress below 1.8', 'Intel\'s Altman Z-score is 1.4 (Oct 26, 2026), below 1.8, in the stress zone.',
      'A sign of financial stress.', 'FMP financial-scores', { kind: 'gauge', value: 1.4, min: 0, max: 8, zones: [1.8, 3] }),
    card('neg', 'quality checks', '2 of 9', 'checks passed', 'Intel passes only 2 of the 9 Piotroski checks: cash from operations and liquidity.',
      'Most checks fail.', 'FMP financial-scores', piotroski('roa', 'droa', 'accruals', 'leverage', 'shares', 'margin', 'turnover'), { term: 'Piotroski score' }),
    customers('neg', 42, 'Three customers, PC makers unnamed in Intel\'s 10-K, made 42% of its sales in 2025.', 'Losing one of them would hurt.'),
  ] },
  { key: 'price', tone: 'flat', verdict: 'hard to judge', cards: [
    card('na', 'price vs profit', '—', 'it lost money in 12 months: no P/E', 'Intel has no P/E ratio: it lost money over the last 12 months (Oct 26, 2026).',
      'With a loss there is no price for each $1 of profit; the price against its assets is the measure that works.',
      'FMP income-statement (EPS, last 4 quarters)', { kind: 'bars', values: [-0.38, 0.02, -0.19, -0.08] }, { term: 'P/E ratio' }),
    card('flat', 'price vs assets', '1.1×', 'what its assets are worth on paper', 'Intel trades at 1.1 times its book value (Oct 26, 2026), near the bottom of its range.',
      'About what its factories and cash are worth: the measure to read when there is no profit.', 'FMP ratios (price to book)',
      { kind: 'range', low: 0.8, high: 3.5, value: 1.1, mark: 2, labels: ['0.8×', '3.5×'] }, { term: 'price to book' }),
    card('neg', 'analyst ratings, 90 days', '0 up, 2 down', 'ratings raised and cut',
      'In the 90 days to Oct 26, 2026, Morgan Stanley and Bank of America downgraded Intel; Citi kept its rating.',
      'Two downgrades, no upgrade.', BANKS_SOURCE,
      cos('INTC', [['MS', -1, 'downgrade', 'neg'], ['BAC', -1, 'downgrade', 'neg'], ['C', 0, 'reiterated', 'flat']], false), { via: 'the banks\' analysts' }),
  ] },
], faq: [
  { q: 'What is Intel\'s P/E ratio?', a: 'Intel has no P/E ratio: it lost money over the last 12 months (Oct 26, 2026). It trades at 1.1 times its book value.' },
  { q: 'Who are Intel\'s biggest customers?', a: 'Intel\'s 10-K does not name them: three customers, PC makers, made 42% of its sales in 2025.' },
] };

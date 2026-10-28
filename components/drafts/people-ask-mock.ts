/**
 * Made-up data for the pt-people-ask draft, in the shape its typology will have: real tickers and the site's own logo files,
 * invented but consistent numbers (a move adds up to its parts, a target's distance to the close it names, KO's earnings date is
 * the one the H4 draft uses). Five companies for five situations: a busy week (NVDA), the day of a drop (MRNA), a quiet week (KO),
 * nobody talking about it (ODFL), and every kind of question at once (NVDA, nine). The questions are worded the way people search
 * them (DataForSEO, 2026-10-28), each answer a sentence with the company's common name, the number and the date.
 */
import { co } from './mock';
import type { PeopleAsk, PeopleAskItem } from './pt-people-ask';

const NVDA_ITEMS: PeopleAskItem[] = [
  { need: 'why_moving', asked: 41, question: 'Why is Nvidia stock down today?', big: '−4.1%', tone: 'neg',
    answer: 'Nvidia fell 4.1% on Oct 23, 2026, and is 11.8% below its Oct 6 high of $243.37. Of the day’s fall, 3.2 points were its own: ' +
      'the market fell 0.6% and chip stocks 0.3% more. There was no spike in company news.',
    href: '/stocks/nvda/why-moving/', link: 'Why Nvidia moved', viz: { kind: 'split', market: -0.006, sector: -0.003, own: -0.032 } },
  { need: 'earnings_events', asked: 30, question: 'When does Nvidia report earnings?', big: 'Nov 18', tone: 'flat',
    answer: 'Nvidia reports on Wed, Nov 18, 2026, after the close (confirmed date); the stock reacts Thu, Nov 19. After its last 4 reports it moved 6.0% on average in that session.',
    href: '/stocks/nvda/#price', link: 'Nvidia earnings history', viz: { kind: 'bars', values: [8.1, -3.4, 5.6, -6.9], labels: ['Nov', 'Feb', 'May', 'Aug'] } },
  { need: 'buy_or_not', asked: 23, question: 'Is Nvidia a good stock to buy?', big: '+22.1%', tone: 'pos',
    answer: 'The analysts’ average price target for Nvidia is $262.00, 22.1% above the Oct 23, 2026 close of $214.60; 48 of 57 analysts rate it a buy. ' +
      'pretickt does not say whether to buy or sell.',
    href: '/stocks/nvda/price-target/', link: 'Nvidia price target', viz: { kind: 'rail', price: 214.6, high: 243.37, target: 262 } },
  { need: 'when_sell', asked: 11, question: 'Should I sell Nvidia stock?', big: '−11.8%', tone: 'flat',
    answer: 'Nvidia closed at $214.60 on Oct 23, 2026, 11.8% below its 52-week high of $243.37 and above its 200-day average of $196.40: the long-term trend is still up.',
    href: '/stocks/nvda/#technicals', link: 'Nvidia technicals', viz: { kind: 'off', off: -0.118 } },
  { need: 'who_sells', asked: 8, question: 'Who is dumping Nvidia stock?', big: '−$1.9B', tone: 'flat',
    answer: 'Nvidia’s executives sold a net $1.9B of shares in the 12 months to Oct 23, 2026, mostly in planned sales. Of its three largest holders, ' +
      'Vanguard and BlackRock added shares last quarter and State Street sold some.',
    href: '/stocks/nvda/insiders/', link: 'Nvidia insider trading', viz: null },
];

export const PA_NVDA: PeopleAsk = { ...co('NVDA'), asOf: '2026-10-23',
  chatter: { posts: 264, usual: 85, days: [22, 25, 31, 28, 61, 58, 39], bySource: { reddit: 201, x: 63 } },
  needs: [{ need: 'why_moving', share: 0.38 }, { need: 'earnings_events', share: 0.24 }, { need: 'buy_or_not', share: 0.18 },
    { need: 'when_sell', share: 0.09 }, { need: 'who_sells', share: 0.06 }],
  items: NVDA_ITEMS };

/** Every kind of question at once: the five of the busy week, then the usual ones Google keeps asking that pretickt's data answers. */
export const PA_NVDA_ALL: PeopleAsk = { ...PA_NVDA, items: [...NVDA_ITEMS,
  { need: 'past_return', asked: null, question: 'What if I invested $10,000 in Nvidia 5 years ago?', big: '$97,500', tone: 'pos',
    answer: '$10,000 in Nvidia at the Oct 22, 2021 close would have been worth $97,500 at the Oct 23, 2026 close, a gain of 875% (dividends left out).',
    href: '/stocks/nvda/#price', link: 'Nvidia price history', viz: null },
  { need: 'business', asked: null, question: 'How does Nvidia make money?', big: '88%', tone: 'flat',
    answer: 'Mostly from data centers: 88% of Nvidia’s sales in fiscal 2026, then gaming with 8%.',
    href: '/stocks/nvda/financials/', link: 'Nvidia revenue and margins', viz: null },
  { need: 'ownership', asked: null, question: 'Who owns Nvidia?', big: '8.9%', tone: 'flat',
    answer: 'Nvidia is a listed company with no parent: its shares are held by the public. The largest holders are Vanguard (8.9%), BlackRock (7.8%) ' +
      'and State Street (3.9%), by their filings of Jun 30, 2026.',
    href: '/stocks/nvda/#value', link: 'Nvidia’s largest holders', viz: null },
  { need: 'dividends_income', asked: 2, question: 'Does Nvidia pay dividends?', big: '$0.01', tone: 'flat',
    answer: 'Yes: Nvidia pays $0.01 a share each quarter, 0.02% a year at the Oct 23, 2026 close of $214.60.',
    href: '/dividend-calendar/', link: 'Dividend calendar', viz: null },
] };

export const PA_MRNA: PeopleAsk = { ticker: 'MRNA', name: 'Moderna', logo: null, asOf: '2026-10-22',
  chatter: { posts: 143, usual: 12, days: [1, 2, 3, 2, 1, 6, 128], bySource: { reddit: 118, x: 25 } },
  needs: [{ need: 'why_moving', share: 0.61 }, { need: 'dip_pullback', share: 0.17 }, { need: 'buy_or_not', share: 0.14 }],
  items: [
    { need: 'why_moving', asked: 87, question: 'Why is Moderna stock down today?', big: '−17.6%', tone: 'neg',
      answer: 'Moderna fell 17.6% on Oct 22, 2026, and 19.2 points of it were its own: the market fell 1.2% while healthcare rose 2.8%. ' +
        '15 news stories came out that day, a spike against its 30-day average.',
      href: '/stocks/mrna/why-moving/', link: 'Why Moderna moved', viz: { kind: 'split', market: -0.012, sector: 0.028, own: -0.192 } },
    { need: 'dip_pullback', asked: 24, question: 'Should I buy Moderna stock after the drop?', big: '−58%', tone: 'neg',
      answer: 'After the drop Moderna closed at $24.10 on Oct 22, 2026, 58% below its 52-week high of $57.40. It lost money over the last four quarters, so it has no P/E ratio.',
      href: '/stocks/mrna/#technicals', link: 'Moderna technicals', viz: { kind: 'off', off: -0.58 } },
    { need: 'buy_or_not', asked: 20, question: 'Is Moderna a good stock to buy?', big: '+45.2%', tone: 'pos',
      answer: 'The analysts’ average price target for Moderna is $35.00, 45.2% above the Oct 22, 2026 close of $24.10; 6 of 22 analysts rate it a buy. ' +
        'pretickt does not say whether to buy or sell.',
      href: '/stocks/mrna/price-target/', link: 'Moderna price target', viz: { kind: 'rail', price: 24.1, high: 57.4, target: 35 } },
  ] };

export const PA_KO: PeopleAsk = { ...co('KO'), asOf: '2026-10-23',
  chatter: { posts: 9, usual: 11, days: [1, 2, 0, 1, 3, 1, 1], bySource: { reddit: 7, x: 2 } },
  needs: [{ need: 'dividends_income', share: 0.44 }, { need: 'earnings_events', share: 0.33 }, { need: 'buy_or_not', share: 0.22 }],
  items: [
    { need: 'dividends_income', asked: 4, question: 'Does Coca-Cola pay dividends?', big: '$0.53', tone: 'pos',
      answer: 'Yes: Coca-Cola pays $0.53 a share on Dec 15, 2026, to holders on the ex-dividend date of Nov 30: 2.3% a year at the Oct 23, 2026 close of $92.85.',
      href: '/dividend-calendar/', link: 'Dividend calendar', viz: null },
    { need: 'earnings_events', asked: 3, question: 'When does Coca-Cola report earnings?', big: 'Oct 27', tone: 'flat',
      answer: 'Coca-Cola reports on Tue, Oct 27, 2026, before the open (confirmed date), and the stock reacts the same day; analysts expect EPS of $0.91. ' +
        'After its last 4 reports it moved 2.1% on average in that session.',
      href: '/stocks/ko/#price', link: 'Coca-Cola earnings history', viz: { kind: 'bars', values: [1.8, -2.6, 1.4, -2.6], labels: ['Oct', 'Feb', 'Apr', 'Jul'] } },
    { need: 'buy_or_not', asked: 2, question: 'Is Coca-Cola a good stock to buy?', big: '+4.5%', tone: 'pos',
      answer: 'The analysts’ average price target for Coca-Cola is $97.00, 4.5% above the Oct 23, 2026 close of $92.85, which is 1.3% below its 52-week high. ' +
        'pretickt does not say whether to buy or sell.',
      href: '/stocks/ko/price-target/', link: 'Coca-Cola price target', viz: { kind: 'rail', price: 92.85, high: 94.1, target: 97 } },
    { need: 'why_moving', asked: null, question: 'Why is Coca-Cola stock up today?', big: '+0.4%', tone: 'flat',
      answer: 'Coca-Cola rose 0.4% on Oct 23, 2026, in line with the market (+0.3%) and consumer staples (+0.2% more).',
      href: '/stocks/ko/why-moving/', link: 'Why Coca-Cola moved', viz: { kind: 'split', market: 0.003, sector: 0.002, own: -0.001 } },
  ] };

export const PA_ODFL: PeopleAsk = { ticker: 'ODFL', name: 'Old Dominion Freight Line', logo: null, asOf: '2026-10-23', chatter: null, needs: [],
  items: [
    { need: 'why_moving', asked: null, question: 'Why is Old Dominion Freight Line stock down today?', big: '−1.2%', tone: 'neg',
      answer: 'Old Dominion Freight Line fell 1.2% on Oct 23, 2026: 0.6 points from the market, 0.4 from industrials and 0.2 its own.',
      href: '/stocks/odfl/why-moving/', link: 'Why Old Dominion Freight Line moved', viz: { kind: 'split', market: -0.006, sector: -0.004, own: -0.002 } },
    { need: 'buy_or_not', asked: null, question: 'What is Old Dominion Freight Line’s price target?', big: '+8.7%', tone: 'pos',
      answer: 'The analysts’ average price target for Old Dominion Freight Line is $212.00, 8.7% above the Oct 23, 2026 close of $195.10.',
      href: '/stocks/odfl/price-target/', link: 'Old Dominion Freight Line price target', viz: { kind: 'rail', price: 195.1, high: 233.9, target: 212 } },
    { need: 'earnings_events', asked: null, question: 'When does Old Dominion Freight Line report earnings?', big: 'Feb 4', tone: 'flat',
      answer: 'Old Dominion Freight Line is expected to report around Thu, Feb 4, 2027, before the open (date not confirmed); its last report was on Oct 22, 2026.',
      href: '/stocks/odfl/#price', link: 'Old Dominion Freight Line earnings history', viz: null },
  ] };

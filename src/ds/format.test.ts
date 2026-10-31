import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { amount, badgeValue, cash, COMMON_NAMES, compact, currencyName, date, dayMonth, faqId, href, level, money, month, named, num, pct, plainName, stockHref, tip, tone, usd, withoutSuffixes } from './format';

describe('company names as people, the press and the AI answers write them (plainName)', () => {
  it('drops the legal suffixes and share classes, whatever their case', () => {
    expect(['Apple Inc.', 'Eli Lilly and Company', 'The Coca-Cola Company', 'Merck & Co., Inc.', 'Alphabet Inc. Class A', 'Medtronic Plc',
      'Carnival Corporation & plc', 'Arm Holdings plc American Depositary Shares'].map(plainName))
      .toEqual(['Apple', 'Eli Lilly', 'Coca-Cola', 'Merck', 'Alphabet', 'Medtronic', 'Carnival', 'Arm']);
  });
  it('the suffix rule alone is what the site printed before the common names (the generator\'s shortName)', () => {
    expect(['NVIDIA Corporation', 'Meta Platforms, Inc.', 'Carnival Corporation & plc'].map(withoutSuffixes)).toEqual(['NVIDIA', 'Meta Platforms', 'Carnival']);
  });
  it('then the common name where the provider\'s is not it: the case, the brand, the short form', () => {
    expect(['NVIDIA Corporation', 'Meta Platforms, Inc.', 'Amazon.com, Inc.', 'Advanced Micro Devices, Inc.', 'QUALCOMM Incorporated', 'NIKE, Inc.',
      'International Business Machines Corporation', 'The Walt Disney Company', 'Space Exploration Technologies Corp.', 'News Corporation',
      'The Southern Company', 'Becton, Dickinson and Company', 'Vertiv Holdings Co', 'Slb N.V.'].map(plainName))
      .toEqual(['Nvidia', 'Meta', 'Amazon', 'AMD', 'Qualcomm', 'Nike', 'IBM', 'Disney', 'SpaceX', 'News Corp', 'Southern Company',
        'Becton Dickinson', 'Vertiv', 'SLB']);
  });
  it('leaves the names already common as they are, and a name it does not know to the suffix rule', () => {
    expect(['Microsoft Corporation', 'JPMorgan Chase & Co.', 'Johnson & Johnson', 'AT&T Inc.', '3M Company', 'Alphabet Inc.', 'Acme Widgets Holdings, Inc.']
      .map(plainName)).toEqual(['Microsoft', 'JPMorgan Chase', 'Johnson & Johnson', 'AT&T', '3M', 'Alphabet', 'Acme Widgets Holdings']);
  });
  it('names a company with its ticker beside it, or the ticker alone when the name is the ticker (same case)', () => {
    expect([named('NVIDIA Corporation', 'NVDA'), named('Meta Platforms, Inc.', 'META'), named('RTX Corporation', 'RTX'), named('Advanced Micro Devices, Inc.', 'AMD'),
      named('Dow Inc.', 'DOW'), named(null, 'XYZ'), named('', 'XYZ')]).toEqual(['Nvidia (NVDA)', 'Meta (META)', 'RTX', 'AMD', 'Dow (DOW)', 'XYZ', 'XYZ']);
  });
  it('maps a suffix-free name to another one, which stays itself: no chain, no name that changes twice', () => {
    for (const [from, to] of Object.entries(COMMON_NAMES)) {
      expect(to, from).not.toBe(from);
      expect(plainName(from), from).toBe(to);
      expect(Object.hasOwn(COMMON_NAMES, to), to).toBe(false);
      expect(plainName(to), to).toBe(to);
    }
  });
});

describe('format (the design system\'s numbers and dates; Angular escapes what it prints, so nothing here escapes)', () => {
  it('numbers', () => {
    expect([num(1234.567), pct(0.123), pct(-0.0004), level(0.123), usd(-2e8, { compact: true }), usd(2e8, { compact: true, signed: true }),
      money(12.5), amount(0.2625), amount(0.5), compact(999_999), num(null)])
      .toEqual(['1,234.57', '+12.3%', '0.0%', '12.3%', '-$200M', '+$200M', '$12.50', '$0.2625', '$0.50', '1M', '—']);
  });
  it('dates come back as text, unescaped (Angular escapes on output)', () => {
    expect([date('2026-09-30'), month('2026-03'), date('<b>'), month('a&b')]).toEqual(['Sep 30, 2026', 'Mar 26', '<b>', 'a&b']);
    expect([dayMonth('2026-10-30'), dayMonth('2027-01-02'), dayMonth('junk')]).toEqual(['Oct 30', 'Jan 2', 'junk']);
  });
  it('tone', () => expect([tone(0.01), tone(-0.01), tone(0.0001, 0.0005), tone(null)]).toEqual(['pos', 'neg', 'flat', 'na']));
  it('href keeps http(s) and site paths as they are, anything else becomes #', () => {
    expect([href('https://x.com/a?b=1&c=2'), href('/stocks/nvda/'), href('javascript:alert(1)'), href('//evil.com'), href(null), href('/\\evil.com'), href('https://x.com/a\\b')])
      .toEqual(['https://x.com/a?b=1&c=2', '/stocks/nvda/', '#', '#', '#', '#', '#']); // a backslash reads as a slash
    expect(stockHref('BRK.B')).toBe('/stocks/brk.b/');
  });
  it('faqId: a question\'s address on the page, from its words', () => {
    expect([faqId('Who is dumping Nvidia stock?'), faqId('What is Nvidia\u2019s P/E ratio?'), faqId('What if I invested $10,000 in Nvidia 5 years ago?')])
      .toEqual(['who-is-dumping-nvidia-stock', 'what-is-nvidias-p-e-ratio', 'what-if-i-invested-10-000-in-nvidia-5-years-ago']);
    expect(faqId("Is Moderna's stock a buy after the drop? ".repeat(4)).length).toBeLessThanOrEqual(60);
  });
  it('tip is the JSON a data-tip attribute carries', () => expect(JSON.parse(tip({ Sentiment: 'positive', N: 3 }))).toEqual({ Sentiment: 'positive', N: 3 }));
  it('badgeValue', () => expect([badgeValue({ text: null, value: 21.5, unit: 'x' }), badgeValue({ text: 'Strong buy', value: null, unit: '' })]).toEqual(['21.5x', 'Strong buy']));
});

describe('amounts in the currency a company reports in', () => {
  it('uses its symbol where dollars use $, and dollars when the currency is unknown', () => {
    expect([cash(112.36e9, 'CNY', { compact: true }), cash(-2.5e8, 'EUR', { compact: true }), cash(12.93, 'EUR', { digits: 2 }), cash(1e9, 'CHF', { compact: true }),
      cash(46.8e9, 'USD', { compact: true }), cash(46.8e9, undefined, { compact: true }), cash(null, 'EUR')])
      .toEqual(['CN¥112B', '-€250M', '€12.93', 'CHF 1B', '$46.8B', '$46.8B', '—']);
  });
  it('names the currency in words', () => {
    expect([currencyName('EUR'), currencyName('CNY'), currencyName('XYZ')]).toEqual(['Euro', 'Chinese Yuan', 'XYZ']);
  });
  it('a currency it does not know prints its code', () => {
    expect(cash(2e9, 'XYZ', { compact: true })).toBe('XYZ 2B');
  });
  it('stays deterministic: no Intl, no toLocale (the build and the browser must print the same text)', () => {
    expect(readFileSync(new URL('./format.ts', import.meta.url), 'utf8')).not.toMatch(/\bIntl\.|toLocale/);
  });
});

import { describe, expect, it } from 'vitest';
import { amount, badgeValue, compact, date, href, level, logoHref, money, month, num, pct, stockHref, tip, tone, usd } from './format';

describe('format (the design system\'s numbers and dates; Vue escapes what it prints, so nothing here escapes)', () => {
  it('numbers', () => {
    expect([num(1234.567), pct(0.123), pct(-0.0004), level(0.123), usd(-2e8, { compact: true }), usd(2e8, { compact: true, signed: true }),
      money(12.5), amount(0.2625), amount(0.5), compact(999_999), num(null)])
      .toEqual(['1,234.57', '+12.3%', '0.0%', '12.3%', '-$200M', '+$200M', '$12.50', '$0.2625', '$0.50', '1M', '—']);
  });
  it('dates come back as text, unescaped (Vue escapes on output)', () => {
    expect([date('2026-09-30'), month('2026-03'), date('<b>'), month('a&b')]).toEqual(['Sep 30, 2026', 'Mar 26', '<b>', 'a&b']);
  });
  it('tone', () => expect([tone(0.01), tone(-0.01), tone(0.0001, 0.0005), tone(null)]).toEqual(['pos', 'neg', 'flat', 'na']));
  it('logoHref: the site path of a company logo (served by the platform, same origin)', () => {
    expect([logoHref('NVDA'), logoHref('BRK.B')]).toEqual(['/logos/nvda', '/logos/brk.b']);
  });
  it('href keeps http(s) and site paths as they are, anything else becomes #', () => {
    expect([href('https://x.com/a?b=1&c=2'), href('/stocks/nvda/'), href('javascript:alert(1)'), href('//evil.com'), href(null), href('/\\evil.com'), href('https://x.com/a\\b')])
      .toEqual(['https://x.com/a?b=1&c=2', '/stocks/nvda/', '#', '#', '#', '#', '#']); // a backslash reads as a slash
    expect(stockHref('BRK.B')).toBe('/stocks/brk.b/');
  });
  it('tip is the JSON a data-tip attribute carries', () => expect(JSON.parse(tip({ Sentiment: 'positive', N: 3 }))).toEqual({ Sentiment: 'positive', N: 3 }));
  it('badgeValue', () => expect([badgeValue({ text: null, value: 21.5, unit: 'x' }), badgeValue({ text: 'Strong buy', value: null, unit: '' })]).toEqual(['21.5x', 'Strong buy']));
});

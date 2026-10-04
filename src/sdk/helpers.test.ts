import { describe, expect, it } from 'vitest';
import { helpers as h } from './helpers';

describe('helpers', () => {
  it('escapes every HTML-significant character', () => {
    expect(h.esc(`AT&T <b>"x"</b> 'y'`)).toBe('AT&amp;T &lt;b&gt;&quot;x&quot;&lt;/b&gt; &#39;y&#39;');
    expect(h.esc(null)).toBe('');
  });
  it('formats numbers deterministically without Intl', () => {
    expect(h.num(1234567.891)).toBe('1,234,567.89');
    expect(h.num(-0.001)).toBe('0.00');
    expect(h.num(null)).toBe('—');
    expect(h.pct(0.1234)).toBe('+12.3%');
    expect(h.pct(-0.05)).toBe('-5.0%');
    expect(h.money(233.95)).toBe('$233.95');
    expect(h.compact(5_649_000_000_000)).toBe('5.65T');
    expect(h.compact(950_000)).toBe('950K');
    expect(h.date('2026-10-02')).toBe('Oct 2, 2026');
  });
  it('maps values to tones', () => {
    expect(h.toneOf(0.02)).toBe('pos');
    expect(h.toneOf(-0.02)).toBe('neg');
    expect(h.toneOf(0.001, 0.005)).toBe('flat');
    expect(h.toneOf(null)).toBe('na');
  });
  it('builds a tooltip attribute that survives hostile text', () => {
    const a = h.tip({ Firm: 'A"&<B>', Target: 300 });
    expect(a.startsWith('data-tip="')).toBe(true);
    expect(a).not.toMatch(/<B>/);
    const json = a.slice('data-tip="'.length, -1).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    expect(JSON.parse(json)).toEqual({ Firm: 'A"&<B>', Target: 300 });
  });
  it('renders the not-available block', () => {
    expect(h.na()).toBe('<p class="pt-na">Data not available</p>');
  });
  it('returns an inline svg for known icons and nothing for unknown', () => {
    expect(h.icon('calendar')).toMatch(/^<svg class="pt-icon"/);
    expect(h.icon('nope')).toBe('');
  });
  it('href keeps http(s) and site-relative links and neutralises every other scheme', () => {
    expect(h.href('https://x.com/a?b=1&c=2')).toBe('https://x.com/a?b=1&amp;c=2');
    expect(h.href('/stocks/nvda/')).toBe('/stocks/nvda/');
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', '//evil.com', 'vbscript:x', '"><img onerror=x>'])
      expect(h.href(bad), bad).toBe('#');
  });
  it('formats edge values honestly', () => {
    expect(h.compact(999_999)).toBe('1M');
    expect(h.compact(999_499)).toBe('999K');
    expect(h.compact(-999_999_999)).toBe('-1B');
    expect(h.money(-0.001)).toBe('$0.00');
    expect(h.money(-1.5)).toBe('-$1.50');
    expect(h.icon('constructor')).toBe('');
    expect(h.icon('toString')).toBe('');
    expect(h.date('2026-1-x')).toBe('2026-1-x');
    expect(h.date('<b>')).toBe('&lt;b&gt;');
  });
});

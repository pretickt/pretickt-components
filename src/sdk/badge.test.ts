import { describe, expect, it } from 'vitest';
import { helpers as h, type Badge } from './helpers';

const b = (o: Partial<Badge>): Badge => ({ key: 'pe', label: 'P/E', value: 29.17, text: null, unit: 'x', delta: null, tone: 'flat',
  range: null, icon: null, hint: 'h', asOf: '2026-10-02', dots: null, ...o });

describe('badge', () => {
  it('renders label, formatted value, tone and tooltip', () => {
    const out = h.badge(b({ tone: 'pos' }));
    expect(out).toMatch(/^<li class="pt-badge pt-tone-pos"/);
    expect(out).toContain('<span class="pt-badge-k">P/E</span><span class="pt-badge-v">29.2x</span>');
    expect(out).toContain('data-tip=');
  });
  it('formats every unit, including compact dollars', () => {
    expect(h.badge(b({ unit: '$c', value: 5_649_000_000_000 }))).toContain('>$5.65T<');
    expect(h.badge(b({ unit: '$c', value: -1_052_600_000 }))).toContain('>-$1.05B<');
    expect(h.badge(b({ unit: '%', value: 0.374 }))).toContain('>+37.4%<');
    expect(h.badge(b({ unit: 'd', value: 47 }))).toContain('>47d<');
    expect(h.badge(b({ unit: '$', value: 233.95 }))).toContain('>$233.95<');
    expect(h.badge(b({ unit: '' as Badge['unit'], value: 31.1 }))).toContain('>31.10<');
  });
  it('prefers categorical text and shows a dash for missing values', () => {
    expect(h.badge(b({ text: 'Strong Buy' }))).toContain('>Strong Buy<');
    expect(h.badge(b({ value: null, tone: 'na' }))).toContain('>—<');
  });
  it('renders dots instead of a value', () => {
    const out = h.badge(b({ key: 'news', label: 'News', unit: '', value: 3, dots: ['pos', 'neg', 'pos'] }));
    expect(out.match(/class="pt-dot-pos"/g)).toHaveLength(2);
    expect(out.match(/class="pt-dot-neg"/g)).toHaveLength(1);
    expect(out).not.toContain('pt-badge-v');
  });
  it('escapes everything that comes from data', () => {
    const out = h.badge(b({ label: '<img src=x onerror=1>', text: '<b>x</b>', hint: '"><script>' }));
    expect(out).not.toMatch(/<img|<b>|<script/);
  });
  it('draws the range dot clamped to the track', () => {
    expect(h.badge(b({ unit: '$', value: 150, range: { lo: 100, hi: 200, marks: [] } }))).toContain('left:50.0%');
    expect(h.badge(b({ unit: '$', value: 500, range: { lo: 100, hi: 200, marks: [] } }))).toContain('left:100.0%');
  });
});

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { helpers as h } from '../src/sdk';
import { newsDemo } from '../src/typologies';
import * as mod from './pt-news';
import { standardSuite } from './_harness';

describe('pt-news', () => {
  standardSuite(mod);
  it('lists headlines as external, nofollow links with a sentiment dot', () => {
    const n = newsDemo({ ticker: 'NVDA', limit: 5 });
    const out = mod.renderStatic({ news: n }, { ticker: 'NVDA', limit: 5 }, h);
    expect(out.match(/<li class="pt-news-item"/g)).toHaveLength(5);
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('Sentiment classified by AI');
    expect(out).toContain('<div class="pt-meta">');
  });
  it('escapes titles and handles unscored stories', () => {
    const out = mod.renderStatic({ news: { asOf: '2026-10-02', items: [{ publishedAt: '2026-10-02T10:00:00Z', title: '<b>x</b>', site: 's', url: 'https://x', sentiment: null }] } }, { ticker: 'NVDA', limit: 5 }, h);
    expect(out).not.toContain('<b>x</b>');
    expect(out).toContain('pt-dot-na');
  });
  it('explains an empty feed', () => {
    expect(mod.renderStatic({ news: { asOf: '2026-10-02', items: [] } }, { ticker: 'NVDA', limit: 5 }, h)).toContain('No recent stories');
  });
});

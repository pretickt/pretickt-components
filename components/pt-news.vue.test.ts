// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import PtNews from './pt-news.vue';
import { render, standardSuite, withData } from './_suite';

describe('pt-news', () => {
  standardSuite('pt-news.vue', PtNews);
  it('lists headlines as external, nofollow links with a sentiment dot', async () => {
    const { html } = await render(PtNews, { ticker: 'NVDA', limit: 5 });
    expect(html.match(/<li class="pt-news-item"/g)).toHaveLength(5);
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).toContain('Sentiment classified by AI');
    expect(html).toContain('<div class="pt-meta">');
  });
  it('escapes titles, neutralises hostile links and handles unscored stories', async () => {
    const { html, markup } = await render(PtNews, { ticker: 'NVDA' }, withData({ 'news@1': { asOf: '2026-10-02', items: [
      { publishedAt: '2026-10-02T10:00:00Z', title: '<b>x</b>', site: 's', url: 'javascript:alert(1)', sentiment: null }] } }));
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('href="#"');
    expect(html).toContain('pt-dot-na');
    expect(markup).toEqual([]);
  });
  it('explains an empty feed', async () => {
    expect((await render(PtNews, { ticker: 'NVDA' }, withData({ 'news@1': { asOf: '2026-10-02', items: [] } }))).html).toContain('No recent stories about NVDA');
  });
});

import { PtNews } from './pt-news';
import { basics, render, withData } from './_spec';

describe('pt-news', () => {
  basics(PtNews, { ticker: 'NVDA', limit: 5 });
  it('lists headlines as external, nofollow links with a sentiment dot', async () => {
    const out = (await render(PtNews, { ticker: 'NVDA', limit: 5 })).html();
    expect(out.match(/<li class="pt-news-item"/g)).toHaveLength(5);
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('Sentiment classified by AI');
    expect(out).toContain('<div class="pt-meta">');
  });
  it('escapes titles, neutralises hostile links and handles unscored stories', async () => {
    const out = (await render(PtNews, { ticker: 'NVDA' }, withData({ 'news@1': { asOf: '2026-10-02', items: [
      { publishedAt: '2026-10-02T10:00:00Z', title: '<b>x</b>', site: 's', url: 'javascript:alert(1)', sentiment: null }] } }))).html();
    expect(out).not.toContain('<b>x</b>');
    expect(out).toContain('href="#"');
    expect(out).toContain('pt-dot-na');
  });
  it('explains an empty feed', async () => {
    expect((await render(PtNews, { ticker: 'NVDA' }, withData({ 'news@1': { asOf: '2026-10-02', items: [] } }))).html()).toContain('No recent stories about NVDA');
  });
  it('asks for 20 stories when no limit is given (the default)', async () => {
    const asked: unknown[] = [];
    await render(PtNews, { ticker: 'NVDA' }, async (t, p) => { asked.push(p); return withData({})(t, p); });
    expect(asked).toEqual([{ ticker: 'NVDA', limit: 20 }]);
  });
});

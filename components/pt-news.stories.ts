/** pt-news: headlines with their AI sentiment, www's real ones, unscored stories and a provider's markup, an empty feed. */
import type { News } from '@pretickt/components/typologies';
import { demo, story } from '../src/stories/story';
import { PtNews } from './pt-news';

const five = demo<News>('news@1', { ticker: 'NVDA', limit: 5 });

export const stories = [
  story(PtNews, { name: 'Twenty headlines (demo)', inputs: { ticker: 'NVDA' } }),
  story(PtNews, { name: 'Five headlines (demo)', inputs: { ticker: 'NVDA', limit: 5 } }),
  story(PtNews, { name: 'A sector: its 10 largest companies (demo)', inputs: { sector: 'Technology', limit: 10 } }),
  story(PtNews, { name: 'www: NVDA', inputs: { ticker: 'NVDA', limit: 10 }, live: true }),
  story(PtNews, { name: 'www: TSLA', inputs: { ticker: 'TSLA', limit: 10 }, live: true }),
  story(PtNews, { name: 'Unscored stories, a provider\'s markup in a title', inputs: { ticker: 'NVDA', limit: 5 }, data: { 'news@1': { ...five, items: [
    { publishedAt: '2026-09-30T13:00:00Z', title: 'Nvidia <b>soars</b> on record orders', site: 'Example Wire', url: 'https://example.com/b', sentiment: null },
    { publishedAt: '2026-09-30T12:00:00Z', title: 'Chip stocks mixed before the Fed', site: 'Example Daily', url: 'https://example.com/a', sentiment: null },
    ...five.items.slice(0, 2)] } } }),
  story(PtNews, { name: 'No news', inputs: { ticker: 'NVDA' }, data: { 'news@1': { ...five, items: [] } } }),
  story(PtNews, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];

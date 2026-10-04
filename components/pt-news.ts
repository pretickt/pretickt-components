import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { Ticker, type News } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-news',
  version: '1.0.1',
  need: {
    question: 'What is being said about this company right now, and is the tone positive or negative?',
    evidence: ['"<ticker> news" long tail (marketing/ per-ticker SEO)', 'beta: news list + attention chart on the company page'],
  },
  params: z.object({ ticker: Ticker, limit: z._default(z.int().check(z.minimum(1), z.maximum(50)), 20) }),
  user: [],
  uses: [],
  needs: (p) => ({ news: { t: 'news@1', params: { ticker: p.ticker, limit: p.limit } } }),
});

export const samples = [{ ticker: 'NVDA' }, { ticker: 'KO', limit: 5 }];

type Data = DataFor<{ news: News }>;
const dot = (s: number | null) => (s == null ? 'pt-dot-na' : s > 0.15 ? 'pt-dot-pos' : s < -0.15 ? 'pt-dot-neg' : 'pt-dot-flat');
const mood = (s: number | null) => (s == null ? 'not scored' : s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral');

export function renderStatic(data: Data, params: { ticker: string; limit: number }, h: Helpers): string {
  if (!data.news) return h.na();
  if (!data.news.items.length) return h.na(`No recent stories about ${params.ticker}.`);
  const items = data.news.items.map((s) => `<li class="pt-news-item"><span class="${dot(s.sentiment)}" ${h.tip({ Sentiment: mood(s.sentiment) })}></span>` +
    `<div><a href="${h.href(s.url)}" target="_blank" rel="nofollow noopener noreferrer">${h.esc(s.title)}</a>` +
    `<div class="pt-news-meta">${h.esc(s.site)} · ${h.date(s.publishedAt)}</div></div></li>`).join('');
  return `<section><ul class="pt-news">${items}</ul><p class="pt-note">Sentiment classified by AI from the headline (green positive, red negative). Links open the publisher.</p></section>`;
}

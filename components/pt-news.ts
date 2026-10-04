import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { NewsParams, SENTIMENT_FLAT, type News } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-news',
  version: '1.0.2',
  need: {
    question: 'What is being said about this company right now, and is the tone positive or negative?',
    evidence: ['"<ticker> news" long tail (marketing/ per-ticker SEO)', 'beta: news list + attention chart on the company page'],
  },
  params: NewsParams,
  user: [],
  uses: [],
  needs: (p) => ({ news: { t: 'news@1', params: { ticker: p.ticker, limit: p.limit } } }),
});

export const samples = [{ ticker: 'NVDA' }, { ticker: 'KO', limit: 5 }];

type Data = DataFor<{ news: News }>;
const MOOD = { pos: 'positive', neg: 'negative', flat: 'neutral', na: 'not scored' } as const;

export function renderStatic(data: Data, params: NewsParams, h: Helpers): string {
  if (!data.news) return h.na();
  if (!data.news.items.length) return h.na(`No recent stories about ${params.ticker}.`);
  const items = data.news.items.map((s) => {
    const tone = h.toneOf(s.sentiment, SENTIMENT_FLAT);
    return `<li class="pt-news-item"><span class="pt-dot-${tone}" ${h.tip({ Sentiment: MOOD[tone] })}></span>` +
      `<div><a href="${h.href(s.url)}" target="_blank" rel="nofollow noopener noreferrer">${h.esc(s.title)}</a>` +
      `<div class="pt-meta">${h.esc(s.site)} · ${h.date(s.publishedAt)}</div></div></li>`;
  }).join('');
  return `<section><ul class="pt-news">${items}</ul><p class="pt-note">Sentiment classified by AI from the headline (green positive, red negative). Links open the publisher.</p></section>`;
}

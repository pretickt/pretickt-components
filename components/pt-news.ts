/**
 * What is being said about this company right now, and is the tone positive or negative?
 * @version 2.1.0
 * @evidence "<ticker> news" long tail (marketing/ per-ticker SEO)
 * @evidence beta: news list + attention chart on the company page
 */
import { Component, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { date, href, tip, tone } from '@pretickt/components/format';
import { SENTIMENT_FLAT } from '@pretickt/components/typologies';

const MOOD = { pos: 'positive', neg: 'negative', flat: 'neutral', na: 'not scored' } as const;
const DOT = { pos: 'pt-dot-pos', neg: 'pt-dot-neg', flat: 'pt-dot-flat', na: 'pt-dot-na' } as const;

@Component({
  selector: 'pt-news',
  template: `
    @let n = news.value();
    @if (n === null) {<p class="pt-na">Data not available</p>}
    @else if (n && !n.items.length) {<p class="pt-na">No recent stories about {{ ticker() }}.</p>}
    @else if (n) {
      <section>
        <ul class="pt-news">
          @for (s of n.items; track s.url) {
            <li class="pt-news-item">
              <span [class]="dot(s.sentiment)" [attr.data-tip]="mood(s.sentiment)"></span>
              <div>
                <a [href]="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a>
                <div class="pt-meta">{{ s.site }} · {{ date(s.publishedAt) }}</div>
              </div>
            </li>
          }
        </ul>
        <p class="pt-note">Sentiment classified by AI from the headline (green positive, red negative). Links open the publisher.</p>
      </section>
    }`,
})
export class PtNews {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly limit = input(20);
  protected readonly news = this.pt.news(() => ({ ticker: this.ticker(), limit: this.limit() }));
  protected readonly href = href;
  protected readonly date = date;
  protected dot = (s: number | null) => DOT[tone(s, SENTIMENT_FLAT)];
  protected mood = (s: number | null) => tip({ Sentiment: MOOD[tone(s, SENTIMENT_FLAT)] });
}

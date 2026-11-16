/**
 * What is being said about this company right now, and is the tone positive or negative?
 * @version 2.4.0
 * @evidence Romeo, 2026-11-16: «in base a "da dove arrivi" ti mostro un riquadro in alto» — a story's company link answers the click's ask with the story
 * @evidence design of the fund pages, 2026-11-05: asked for a fund, the stories of its largest holdings, each naming its company
 * @evidence design of the sector pages, 2026-11-07: `sector`, the stories of its 10 largest companies
 * @evidence "<ticker> news" long tail (marketing/ per-ticker SEO)
 * @evidence beta: news list + attention chart on the company page
 */
import { Component, inject, input } from '@angular/core';
import { answer, Pt } from '@pretickt/components/context';
import { date, href, plainName, stockHref, tip, tone } from '@pretickt/components/format';
import { possessive, SENTIMENT_FLAT, type Sector } from '@pretickt/components/typologies';

const MOOD = { pos: 'positive', neg: 'negative', flat: 'neutral', na: 'not scored' } as const;
const DOT = { pos: 'pt-dot-pos', neg: 'pt-dot-neg', flat: 'pt-dot-flat', na: 'pt-dot-na' } as const;

@Component({
  selector: 'pt-news',
  host: { '(pt-ctx-ask)': 'ask($event)' },
  template: `
    @let n = sector() || ticker() ? news.value() : null;
    @if (n === null) {<p class="pt-na">Data not available</p>}
    @else if (n && !n.items.length) {<p class="pt-na">No recent stories about {{ sector() ? possessive(sector()!) + ' largest companies' : ticker() }}.</p>}
    @else if (n) {
      <section>
        <ul class="pt-news">
          @for (s of n.items; track s.url) {
            <li class="pt-news-item" [attr.data-k]="s.url">
              <span [class]="dot(s.sentiment)" [attr.data-tip]="mood(s.sentiment)"></span>
              <div>
                <a [href]="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a>
                <div class="pt-meta">@if (s.ticker; as t) {<a [href]="stock(t)">{{ plainName(s.name ?? t) }}</a> · }{{ s.site }} · {{ date(s.publishedAt) }}</div>
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
  /** A company's or a fund's ticker; or `sector`, for its 10 largest companies' stories. */
  readonly ticker = input<string | null>(null);
  readonly sector = input<Sector | null>(null);
  readonly limit = input(20);
  protected readonly news = this.pt.news(() => {
    const s = this.sector(), t = this.ticker();
    return s ? { sector: s, limit: this.limit() } : t ? { ticker: t, limit: this.limit() } : null;
  });
  protected readonly href = href;
  protected readonly possessive = possessive;
  protected readonly plainName = plainName;
  protected readonly stock = stockHref;
  protected readonly date = date;
  protected dot = (s: number | null) => DOT[tone(s, SENTIMENT_FLAT)];
  /** The click's ask on a story's company (pt-ctx-ask): the story the reader was reading. */
  protected ask(e: Event) {
    const url = (e.target as Element).closest?.('[data-k]')?.getAttribute('data-k'), s = this.news.value()?.items.find((x) => x.url === url);
    if (s) answer(e, { kind: 'news', d: { title: s.title, url: s.url, site: s.site, publishedAt: s.publishedAt } });
  }
  protected mood = (s: number | null) => tip({ Sentiment: MOOD[tone(s, SENTIMENT_FLAT)] });
}

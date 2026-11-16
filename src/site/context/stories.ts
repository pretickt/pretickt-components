import { Component, computed, input } from '@angular/core';
import type { FeedCtx, NewsCtx } from '@pretickt/components/context';
import { date, href, stockHref } from '../../ds/format';

/** A feed card (pt-feed) as the reader saw it: label, day, its number in its tone, its text; its own target when it is another page. */
@Component({
  selector: 'pt-ctx-feed',
  template: `
    @let c = d();
    <p class="pt-ctx-lead">{{ head() }}@if (c.pill; as p) { <span [class]="p.cls">{{ p.text }}</span>}</p>
    <div class="pt-ctx-more">
      <p>{{ c.text }}</p>
      @if (c.href !== land()) {<p class="pt-ctx-go"><a [href]="c.href">See it →</a></p>}
    </div>`,
})
export class PtCtxFeed {
  readonly d = input.required<FeedCtx>();
  readonly land = input('');
  protected readonly head = computed(() => { const c = this.d(); return [c.label, c.sub, c.day].filter(Boolean).join(' · '); });
}

/** A story (pt-news) whose company the reader clicked: the story, linked to its publisher, then the company's news. */
@Component({
  selector: 'pt-ctx-news',
  template: `
    @let s = d();
    <p class="pt-ctx-lead">You were reading: <a [href]="href(s.url)" target="_blank" rel="nofollow noopener noreferrer">{{ s.title }}</a></p>
    <div class="pt-ctx-more">
      <p class="pt-meta">{{ s.site }} · {{ date(s.publishedAt) }}</p>
      @if (news() !== land()) {<p class="pt-ctx-go"><a [href]="news()">Latest news →</a></p>}
    </div>`,
})
export class PtCtxNews {
  readonly d = input.required<NewsCtx>();
  readonly to = input.required<string>();
  readonly land = input('');
  protected readonly href = href;
  protected readonly date = date;
  protected readonly news = computed(() => `${stockHref(this.to())}news/`);
}

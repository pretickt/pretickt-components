import { TestBed } from '@angular/core/testing';
import type { ClickNote } from '../../context/click';
import { PtClickBox } from './box';
import { CTX_FEED, CTX_FEED_SUB, CTX_NEWS } from './mock';

function box(note: ClickNote) {
  const f = TestBed.createComponent(PtClickBox);
  f.componentRef.setInput('note', note);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const link = (text: string) => [...el.querySelectorAll('a')].find((a) => a.textContent!.trim() === text) ?? null;
  return { el, text: el.textContent!.replace(/\s+/g, ' '), kicker: el.querySelector('.pt-ctx-k')!.textContent!.trim(), link };
}

describe('pt-click-box: the feed and the news', () => {
  it('feed: the card as the reader saw it (label, day, pill in its tone, text); its own target when the landing is another page', () => {
    const b = box(CTX_FEED);
    expect(b.kicker).toBe('From the feed · Technology stocks');
    expect(b.text).toContain('Big move · 3× usual · Nov 13');
    expect(b.el.querySelector('.pt-feed-pill.pt-feed-pill-neg')!.textContent).toBe('-5.1%');
    expect(b.text).toContain('Nvidia fell 5.1% on Nov 13, three times its usual day.');
    expect(b.link('See it →')!.getAttribute('href')).toBe('/stocks/nvda/#price');
  });
  it('feed: no «See it» when the card led to the page the reader is on', () => {
    const b = box(CTX_FEED_SUB);
    expect(b.kicker).toBe('From the feed on the home page');
    expect(b.link('See it →')).toBeNull();
    expect(b.el.querySelector('.pt-feed-pill')).toBeNull();
  });
  it('news: the story the reader was reading, linked to the publisher, its site and day; the company\'s news', () => {
    const b = box(CTX_NEWS);
    expect(b.kicker).toBe('From the news · SMH: VanEck Semiconductor ETF');
    const story = b.link('Nvidia supplier warns on demand')!;
    expect(story.getAttribute('href')).toBe('https://example.com/a');
    expect(story.getAttribute('rel')).toBe('nofollow noopener noreferrer');
    expect(story.getAttribute('target')).toBe('_blank');
    expect(b.text).toContain('You were reading: Nvidia supplier warns on demand');
    expect(b.text).toContain('Reuters · Nov 16, 2026');
    expect(b.link('Latest news →')!.getAttribute('href')).toBe('/stocks/nvda/news/');
  });
});

import { TestBed } from '@angular/core/testing';
import type { ClickNote } from '../../context/click';
import { PtClickBox } from './box';
import { CTX_HEAT_MAP, CTX_MOVER, CTX_MOVER_PLAIN, CTX_NEWS_MAP, CTX_SOCIAL_MAP } from './mock';

function box(note: ClickNote) {
  const f = TestBed.createComponent(PtClickBox);
  f.componentRef.setInput('note', note);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const link = (text: string) => [...el.querySelectorAll('a')].find((a) => a.textContent!.trim() === text) ?? null;
  return { el, text: el.textContent!.replace(/\s+/g, ' '), kicker: el.querySelector('.pt-ctx-k')!.textContent!.trim(), link };
}

describe('pt-click-box: ongoing moves and the maps', () => {
  it('mover: the move since its start, the three windows, today\'s line, the industry with its peers, and why it moved', () => {
    const b = box(CTX_MOVER);
    expect(b.kicker).toBe('From ongoing moves on the home page');
    expect(b.text).toContain('In a drawdown: -14.2% since Nov 3 (10 days)');
    expect(b.text).toContain('This week -9.1% · 30 days -12.0% · 90 days -4.0%');
    expect(b.text).toContain('Today -5.2% (11:30 AM ET, 15-min delayed)');
    expect(b.text).toContain('Its industry is moving too: median -3.8% (AMD -6.0%, AVGO -4.1%)');
    expect(b.link('Why it moved →')!.getAttribute('href')).toBe('/stocks/nvda/why-moving/');
  });
  it('mover without today\'s line or an industry: neither line', () => {
    const b = box(CTX_MOVER_PLAIN);
    expect(b.text).toContain('In a rally: +21.0% since Nov 3 (10 days)');
    expect(b.text).not.toContain('Today');
    expect(b.text).not.toContain('industry');
  });
  it('heat map: the day\'s move, its place in its sector on the map, the sector\'s move, the market value', () => {
    const b = box(CTX_HEAT_MAP);
    expect(b.kicker).toBe('From the heat map · Stock market heat map today');
    expect(b.text).toContain('-3.1% today · 2nd of 12 in Technology (the sector -1.2%) · $4.3T market value');
    expect(b.link('Why it moved →')!.getAttribute('href')).toBe('/stocks/nvda/why-moving/');
  });
  it('news and social maps: how much it was talked about that day, and its news', () => {
    const n = box(CTX_NEWS_MAP), s = box(CTX_SOCIAL_MAP);
    expect(n.kicker).toBe('From the news map on the home page');
    expect(n.text).toContain('Stories that day: 46, 5× its usual day');
    expect(n.link('Latest news →')!.getAttribute('href')).toBe('/stocks/nvda/news/');
    expect(s.kicker).toBe('From the social map on the home page');
    expect(s.text).toContain('Posts on Reddit and X that day: 120');
  });
});

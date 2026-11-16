import { TestBed } from '@angular/core/testing';
import type { ClickNote } from '../../context/click';
import { PtClickBox } from './box';
import { CTX_HOLDING, CTX_HOLDING_SECTOR, CTX_PORTFOLIO, CTX_PORTFOLIO_EARNINGS, CTX_PORTFOLIO_NEWS } from './mock';

function box(note: ClickNote) {
  const f = TestBed.createComponent(PtClickBox);
  f.componentRef.setInput('note', note);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const link = (text: string) => [...el.querySelectorAll('a')].find((a) => a.textContent!.trim() === text) ?? null;
  return { el, text: el.textContent!.replace(/\s+/g, ' '), kicker: el.querySelector('.pt-ctx-k')!.textContent!.trim(), link };
}

describe('pt-click-box: funds, sectors and your portfolio', () => {
  it('a fund: its weight, its move and its points of the fund, back to the fund', () => {
    const b = box(CTX_HOLDING);
    expect(b.kicker).toBe('From XLK');
    expect(b.text).toContain('14.2% of XLK · moved -3.1% today, -0.44 points of the fund');
    expect(b.link('Back to XLK →')!.getAttribute('href')).toBe('/etfs/xlk/');
  });
  it('a sector without a move: the weight alone, back to the sector page the reader was on', () => {
    const b = box(CTX_HOLDING_SECTOR);
    expect(b.kicker).toBe('From Technology');
    expect(b.text).toContain('8.1% of Technology');
    expect(b.text).not.toContain('moved');
    expect(b.link('Back to Technology →')!.getAttribute('href')).toBe('/sectors/technology/');
  });
  it('your portfolio: the line\'s weight, move and points; the earnings date; the headline; back to your portfolio', () => {
    const p = box(CTX_PORTFOLIO);
    expect(p.kicker).toBe('From your portfolio');
    expect(p.text).toContain('In your portfolio: 8.0% · -3.1% today, -0.25 points');
    expect(p.link('Back to your portfolio →')!.getAttribute('href')).toBe('/portfolio/');
    expect(box(CTX_PORTFOLIO_EARNINGS).text).toContain('In your portfolio: 8.0% · Reports Nov 18');
    const n = box(CTX_PORTFOLIO_NEWS);
    expect(n.text).toContain('In your portfolio · Nvidia supplier warns on demand');
    expect(n.link('Nvidia supplier warns on demand')!.getAttribute('rel')).toBe('nofollow noopener noreferrer');
  });
});

import { TestBed } from '@angular/core/testing';
import type { ClickNote } from '../../context/click';
import { PtClickBox } from './box';
import { CTX_FOLLOWING, CTX_FOLLOWING_NONE, CTX_HOLDER, CTX_MENTION } from './mock';

function box(note: ClickNote) {
  const f = TestBed.createComponent(PtClickBox);
  f.componentRef.setInput('note', note);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const link = (text: string) => [...el.querySelectorAll('a')].find((a) => a.textContent!.trim() === text) ?? null;
  return { el, text: el.textContent!.replace(/\s+/g, ' '), kicker: el.querySelector('.pt-ctx-k')!.textContent!.trim(), link };
}

describe('pt-click-box: value cards, sentences, followed companies', () => {
  it('holder: the value as the card printed it, the card, back to it', () => {
    const b = box(CTX_HOLDER);
    expect(b.kicker).toBe('From Nvidia\'s value checks');
    expect(b.text).toContain('7.8% +0.1 in Nvidia\'s “biggest holders”');
    expect(b.link('Back to the card →')!.getAttribute('href')).toBe('/stocks/nvda/value/#value-owners-biggest-holders');
  });
  it('mention: the sentence itself, this company in bold, the others as links', () => {
    const b = box(CTX_MENTION);
    expect(b.kicker).toBe('From Why Nvidia moved today');
    expect(b.text).toContain('Nvidia NVDA fell 5.1% as AMD gained 2.0% on the same report.');
    expect(b.el.querySelector('.pt-ctx-lead b')!.textContent).toBe('AMD');
    expect(b.el.querySelector('.pt-ctx-lead a.pt-mention')!.getAttribute('href')).toBe('/stocks/nvda/');
  });
  it('following: you follow it, its alerts of the last 5 sessions, your alerts', () => {
    const b = box(CTX_FOLLOWING);
    expect(b.kicker).toBe('From the companies you follow');
    expect(b.text).toContain('You follow Nvidia · 2 alerts in the last 5 sessions');
    expect(b.link('Your alerts →')!.getAttribute('href')).toBe('/alerts/');
    expect(box(CTX_FOLLOWING_NONE).text).toContain('You follow Nvidia · no alerts in the last 5 sessions');
  });
});

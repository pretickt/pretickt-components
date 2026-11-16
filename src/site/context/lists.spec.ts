import { TestBed } from '@angular/core/testing';
import type { ClickNote } from '../../context/click';
import { PtClickBox } from './box';
import { CTX_LIST, CTX_LIST_OWN, CTX_PEERS } from './mock';

function box(note: ClickNote) {
  const f = TestBed.createComponent(PtClickBox);
  f.componentRef.setInput('note', note);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const link = (text: string) => [...el.querySelectorAll('a')].find((a) => a.textContent!.trim() === text) ?? null;
  return { el, text: el.textContent!.replace(/\s+/g, ' '), kicker: el.querySelector('.pt-ctx-k')!.textContent!.trim(), link };
}

describe('pt-click-box: the market lists and the peers', () => {
  it('list: its rank in the list, the row\'s columns in their tones, back to the list', () => {
    const b = box(CTX_LIST);
    expect(b.kicker).toBe('From biggest stock losers today on the home page');
    expect(b.text).toContain('#3 of 20 in Biggest stock losers today');
    expect(b.text).toContain('Today -5.1% · Off 52w high -22.0%');
    expect(b.el.querySelectorAll('.pt-ctx-cols .pt-t-neg')).toHaveLength(2);
    expect(b.link('Back to the list →')!.getAttribute('href')).toBe('/markets/biggest-losers/');
  });
  it('list on its own page: the kicker says it once; back to the list\'s section on that page', () => {
    const b = box(CTX_LIST_OWN);
    expect(b.kicker).toBe('From the biggest stock losers today');
    expect(b.link('Back to the list →')!.getAttribute('href')).toBe('/markets/biggest-losers/#list');
  });
  it('peers: a peer of the company, the row\'s columns, back to its peers', () => {
    const b = box(CTX_PEERS);
    expect(b.kicker).toBe('From Nvidia\'s peers');
    expect(b.text).toContain('A peer of Nvidia');
    expect(b.text).toContain('Today -3.0% · Off 52w high -12.4% · Target upside +18.0%');
    expect(b.link('Back to Nvidia\'s peers →')!.getAttribute('href')).toBe('/stocks/nvda/#peers');
  });
});

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mention, saidText, say } from './format';
import { PtMention, PtSay } from './index';

const nvda = mention('NVDA', 'NVIDIA Corporation', '/logos/nvda-1.png'), meta = mention('META', 'Meta Platforms, Inc.'), odd = mention('XYZ', 'Xylo Zen Corp.', 'https://evil.example/x.png');

@Component({ imports: [PtSay], template: `<p><pt-say [parts]="parts" /></p>` })
class Host { parts = say`The target for ${nvda} is up; ${meta} and ${odd} too.`; }

@Component({ imports: [PtMention], template: `<a ptMention ticker="NVDA" name="NVIDIA Corporation" section="people-ask"></a>` })
class Section {}

@Component({ imports: [PtSay], template: `<pt-say [parts]="parts" [logos]="false" />` })
class Bare { parts = say`${nvda} reports today.`; }

describe('PtSay and PtMention: a sentence with the companies it names', () => {
  it('draws each company as a link to its page: the logo (the site\'s file only), the common name, the ticker', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const p = (f.nativeElement as HTMLElement).querySelector('p')!;
    const links = [...p.querySelectorAll('a.pt-mention')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/stocks/nvda/', '/stocks/meta/', '/stocks/xyz/']);
    expect(links[0]!.querySelector('img')!.getAttribute('src')).toBe('/logos/nvda-1.png');
    expect(links[0]!.querySelector('.pt-mention-t')!.textContent).toBe('NVDA');
    // the name alone when it is the ticker in other letters; no logo but the site's own, and never initials in the text
    expect(links[1]!.querySelector('.pt-mention-t')).toBeNull();
    expect(links[2]!.querySelector('img, .pt-logo-initials')).toBeNull();
    expect(p.textContent).toBe(saidText(f.componentInstance.parts));
    expect(p.textContent).toBe('The target for Nvidia NVDA is up; Meta and Xylo Zen XYZ too.');
  });
  it('leaves the logos out where the company is already shown with its own beside the sentence', () => {
    const f = TestBed.createComponent(Bare);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('a.pt-mention img')).toBeNull();
    expect((f.nativeElement as HTMLElement).textContent).toBe('Nvidia NVDA reports today.');
  });
  it('can point at a section of the company\'s page (what people ask about it)', () => {
    const f = TestBed.createComponent(Section);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('a.pt-mention')!.getAttribute('href')).toBe('/stocks/nvda/#people-ask');
  });
});

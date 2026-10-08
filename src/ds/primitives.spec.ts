import { Component, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Badge } from './format';
import { PtBadge, PtCompany, PtLogo, PtSortTh, PtToggles, useSort } from './index.ng';

const badge: Badge = { key: 'pe', label: 'P/E', value: 21.5, text: null, unit: 'x', delta: null, tone: 'pos', range: null, icon: 'target', hint: 'Price over earnings', asOf: '2026-10-02' };
const render = <C>(c: Type<C>) => {
  const f = TestBed.createComponent(c);
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement };
};
const interactions: string[] = [];
document.addEventListener('pt-interact', (e) => interactions.push((e as CustomEvent<{ action: string }>).detail.action));
beforeEach(() => { interactions.length = 0; });

@Component({
  imports: [PtToggles],
  template: `<div ptToggles [value]="v()" [options]="opts" label="Window" (choose)="seen.push($event); v.set($event)"></div>`,
})
class TogglesHost { v = signal<'1d' | '5d'>('1d'); opts = [['1d', '1D'], ['5d', '5D']] as const; seen: string[] = []; }

describe('PtToggles', () => {
  it('a button group for one value: the current one pressed; a press emits (every time) and a change is a "set" interaction', () => {
    const { f, el } = render(TogglesHost);
    const group = el.querySelector('div')!;
    expect(group.className).toBe('pt-toggles');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Window');
    const buttons = () => [...el.querySelectorAll('button')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`);
    expect(buttons()).toEqual(['1D:true', '5D:false']);
    el.querySelectorAll('button')[1]!.click();
    f.detectChanges();
    expect(buttons()).toEqual(['1D:false', '5D:true']);
    el.querySelectorAll('button')[1]!.click(); // the pressed one again: a retry, emitted but not a new choice
    expect(f.componentInstance.seen).toEqual(['5d', '5d']);
    expect(interactions).toEqual(['set']);
  });
});

@Component({
  imports: [PtBadge],
  template: `<ul>
    <li [ptBadge]="b"></li>
    <li [ptBadge]="dots"></li>
    <li [ptBadge]="ranged"></li>
    <li [ptBadge]="odd"></li>
    <li [ptBadge]="b" size="mini"></li>
  </ul>`,
})
class BadgeHost {
  b = badge;
  dots: Badge = { ...badge, dots: ['pos', 'neg'], icon: null };
  ranged: Badge = { ...badge, key: 'r', unit: '$', value: 150, range: { lo: 100, hi: 200, marks: [] }, icon: null };
  odd: Badge = { ...badge, icon: 'constructor' };
}

describe('PtBadge', () => {
  it('renders a catalogue item: label, value by unit, tone class, icon, tooltip (hint + as-of); dots, range, mini', () => {
    const { el } = render(BadgeHost);
    const [plain, dots, ranged, odd, mini] = [...el.querySelectorAll('li')];
    expect(plain!.className).toBe('pt-badge pt-tone-pos');
    expect(plain!.getAttribute('tabindex')).toBe('0');
    expect(plain!.querySelector('.pt-badge-k')!.textContent).toBe('P/E');
    expect(plain!.querySelector('.pt-badge-v')!.textContent).toBe('21.5x');
    expect(plain!.querySelector('svg.pt-icon path')).not.toBeNull();
    expect(JSON.parse(plain!.getAttribute('data-tip')!)).toEqual({ 'P/E': 'Price over earnings', 'As of': 'Oct 2, 2026' });
    expect([...dots!.querySelectorAll('.pt-dots span')].map((s) => s.className)).toEqual(['pt-dot-pos', 'pt-dot-neg']);
    expect(dots!.querySelector('.pt-badge-v')).toBeNull();
    expect((ranged!.querySelector('.pt-range-dot') as HTMLElement).style.left).toBe('50.0%');
    expect(JSON.parse(ranged!.getAttribute('data-tip')!).Low).toBe('$100.00');
    expect(odd!.querySelector('svg')).toBeNull(); // an unknown icon name renders nothing (never prototype keys)
    expect(mini!.className).toBe('pt-badge pt-badge-mini pt-tone-pos');
  });
});

@Component({
  imports: [PtLogo, PtCompany],
  template: `
    <pt-logo ticker="NVDA" src="/logos/nvda" [size]="24" />
    <pt-logo ticker="BRK.B" [src]="null" />
    <pt-logo ticker="NVDA" src="https://evil.example/x.png" />
    <pt-logo ticker="BRK.B" src="/logos/brk.b.1a2b3c4d.webp" />
    <a ptCompany ticker="NVDA" name="NVIDIA Corporation" logo="/logos/nvda"></a>
    <a ptCompany ticker="AMD" [logo]="null"></a>`,
})
class LogoHost {}

describe('PtLogo / PtCompany', () => {
  it('a logo is a fixed-size lazy image from the site; otherwise the initials (no request); a company links its page', () => {
    const { el } = render(LogoHost);
    const logos = [...el.querySelectorAll('pt-logo')];
    const img = logos[0]!.querySelector('img')!;
    expect([img.className, img.getAttribute('src'), img.getAttribute('alt'), img.getAttribute('width'), img.getAttribute('height'), img.getAttribute('loading')])
      .toEqual(['pt-logo', '/logos/nvda', '', '24', '24', 'lazy']);
    const initials = logos[1]!.querySelector('span')!;
    expect([initials.className, initials.textContent, initials.style.width, initials.getAttribute('aria-hidden')]).toEqual(['pt-logo pt-logo-initials', 'BR', '20px', 'true']);
    expect(logos[2]!.querySelector('img')).toBeNull(); // only the site's own logo paths
    expect(logos[3]!.querySelector('img')!.getAttribute('src')).toBe('/logos/brk.b.1a2b3c4d.webp');
    const [nvda, amd] = [...el.querySelectorAll('a')];
    expect([nvda!.className, nvda!.getAttribute('href'), nvda!.querySelector('.pt-co-t')!.textContent, nvda!.querySelector('.pt-co-n')!.textContent])
      .toEqual(['pt-co', '/stocks/nvda/', 'NVDA', 'NVIDIA Corporation']);
    expect(amd!.querySelector('.pt-co-n')).toBeNull();
  });
});

const ROWS = [{ t: 'B', v: 2 }, { t: 'a', v: null }, { t: 'C', v: 10 }, { t: 'A', v: 2 }];
@Component({
  imports: [PtSortTh],
  template: `<table><thead><tr>
      <th ptSortTh label="Name" [state]="s.state('t')" (sort)="s.toggle('t')"></th>
      <th ptSortTh label="Value" [state]="s.state('v')" (sort)="s.toggle('v')"></th>
    </tr></thead>
    <tbody>@for (r of s.sorted(); track r.t) {<tr><td>{{ r.t }}</td><td>{{ r.v }}</td></tr>}</tbody></table>`,
})
class TableHost { s = useSort(() => ROWS, { t: (r) => r.t, v: (r) => r.v }); }

describe('sortable tables', () => {
  it('a header click sorts: numbers high first, text A→Z first; again reverses; a third time restores; aria-sort on the sorted column only', () => {
    const { f, el } = render(TableHost);
    const order = () => [...el.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')!.textContent);
    const th = () => [...el.querySelectorAll('th')];
    const click = (i: number) => { th()[i]!.querySelector('button')!.click(); f.detectChanges(); };
    expect(order()).toEqual(['B', 'a', 'C', 'A']);
    expect(th()[0]!.querySelector('button')!.outerHTML).toBe('<button type="button" class="pt-sort">Name<span aria-hidden="true" class="pt-sort-i">↕</span></button>');
    click(1);
    expect(order()).toEqual(['C', 'B', 'A', 'a']);
    expect(th()[1]!.getAttribute('aria-sort')).toBe('descending');
    click(1);
    expect(order()).toEqual(['B', 'A', 'C', 'a']);
    click(1);
    expect(order()).toEqual(['B', 'a', 'C', 'A']);
    expect(th()[1]!.hasAttribute('aria-sort')).toBe(false);
    click(0);
    expect(order()).toEqual(['a', 'A', 'B', 'C']);
    expect(interactions).toEqual(['sort', 'sort', 'sort', 'sort']);
  });
  it('dates newest first; rows already in the first order start reversed', () => {
    const s = TestBed.runInInjectionContext(() => useSort(() => [{ d: '2026-09-15' }, { d: '2026-06-30' }, { d: '2026-03-01' }], { d: (r) => r.d }));
    s.toggle('d');
    expect(s.state('d')).toBe('asc');
    expect(s.sorted().map((r) => r.d)).toEqual(['2026-03-01', '2026-06-30', '2026-09-15']);
    const t = TestBed.runInInjectionContext(() => useSort(() => [{ d: '2026-03-01' }, { d: '2026-09-15' }, { d: '2026-06-30' }], { d: (r) => r.d }));
    t.toggle('d');
    expect(t.sorted().map((r) => r.d)).toEqual(['2026-09-15', '2026-06-30', '2026-03-01']);
  });
});

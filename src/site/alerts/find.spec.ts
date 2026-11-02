import { TestBed } from '@angular/core/testing';
import { PtAlertFind } from './find';

const rows = [
  { ticker: 'AVGO', name: 'Broadcom Inc.', logo: null, marketCap: 1.4e12 }, { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', logo: null, marketCap: 310e9 },
  { ticker: 'A', name: 'Agilent Technologies, Inc.', logo: null, marketCap: 40e9 }, { ticker: 'AAPL', name: 'Apple Inc.', logo: null, marketCap: 3.5e12 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', logo: null, marketCap: 4e12 },
];

function mount(o: { exclude?: string[]; closeOnEscape?: boolean } = {}) {
  const f = TestBed.createComponent(PtAlertFind);
  f.componentRef.setInput('rows', rows);
  if (o.exclude) f.componentRef.setInput('exclude', o.exclude);
  if (o.closeOnEscape) f.componentRef.setInput('closeOnEscape', true);
  const picked: string[] = [];
  let cancelled = 0;
  f.componentInstance.picked.subscribe((t) => picked.push(t));
  f.componentInstance.cancel.subscribe(() => { cancelled++; });
  f.detectChanges();
  const el = f.nativeElement as HTMLElement, input = el.querySelector('input')!;
  let reached = 0;
  el.addEventListener('keydown', () => { reached++; });               // what would reach the editor (its Escape closes it)
  const type = (v: string) => { input.value = v; input.dispatchEvent(new Event('input')); f.detectChanges(); };
  const key = (k: string) => { input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); f.detectChanges(); };
  const options = () => [...el.querySelectorAll('[role="option"]')].map((x) => x.querySelector('b')!.textContent!.trim());
  const marked = () => el.querySelector('[role="option"][aria-selected="true"] b')?.textContent?.trim();
  return { f, el, input, type, key, options, marked, picked, cancelled: () => cancelled, reached: () => reached };
}

describe('PtAlertFind: a company by symbol or name, by keyboard too (Romeo, 2026-11-02)', () => {
  it('↓ and ↑ move through what was found (round the ends), Enter takes the one marked; the field is then empty again', () => {
    const m = mount();
    m.type('a');
    expect(m.options()).toEqual(['A', 'AAPL', 'AVGO', 'AMD', 'NVDA']);
    expect(m.marked()).toBe('A');
    m.key('ArrowDown');
    expect(m.marked()).toBe('AAPL');
    expect(m.input.getAttribute('aria-activedescendant')).toBe(m.el.querySelector('[role="option"][aria-selected="true"]')!.id);
    m.key('ArrowUp');
    m.key('ArrowUp');
    expect(m.marked()).toBe('NVDA');
    m.key('Enter');
    expect(m.picked).toEqual(['NVDA']);
    expect(m.input.value).toBe('');
    expect(m.options()).toEqual([]);
  });

  it('a click takes one; typing again starts from the first; one already taken is not offered', () => {
    const m = mount({ exclude: ['A'] });
    m.type('a');
    expect(m.options()).toEqual(['AAPL', 'AVGO', 'AMD', 'NVDA']);
    m.key('ArrowDown');
    m.type('am');
    expect(m.marked()).toBe('AMD');
    m.el.querySelector<HTMLElement>('[role="option"]')!.click();
    expect(m.picked).toEqual(['AMD']);
  });

  it('Escape empties the field and goes no further; on an empty field it closes it when asked to (One stock), else it reaches the editor', () => {
    const m = mount({ closeOnEscape: true });
    m.type('nv');
    m.key('Escape');
    expect(m.input.value).toBe('');
    expect(m.cancelled()).toBe(0);
    m.key('Escape');
    expect(m.cancelled()).toBe(1);
    expect(m.reached()).toBe(0);
    const n = mount();
    n.key('Escape');
    expect(n.reached()).toBe(1);
  });
});

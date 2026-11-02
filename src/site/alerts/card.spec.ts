import { TestBed } from '@angular/core/testing';
import { MOCK_UNIVERSE } from '../../alerts/mock';
import { condition, type RuleCondition } from '../../alerts/rule';
import { rowsOf, type AlertRow } from '../../alerts/rows';
import type { ChartData } from '../../alerts/charts';
import { PtAlertCard } from './card';

const rows = rowsOf(MOCK_UNIVERSE, null);
const amd: AlertRow = { ...rows.find((r) => r.ticker === 'AMD')!, prevClose: 100, price: 92.1, move: -0.079 };

function mount(rc: RuleCondition, data: ChartData, o: { count?: { pass: number; of: number }; ofLabel?: string } = {}) {
  const f = TestBed.createComponent(PtAlertCard);
  f.componentRef.setInput('rc', rc);
  f.componentRef.setInput('data', data);
  if (o.count) f.componentRef.setInput('count', o.count);
  if (o.ofLabel) f.componentRef.setInput('ofLabel', o.ofLabel);
  const changes: { key: string; value: string | number }[] = [];
  f.componentInstance.change.subscribe((c) => changes.push(c));
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const text = () => el.textContent!.replace(/\s+/g, ' ');
  const pill = (t: string) => [...el.querySelectorAll<HTMLButtonElement>('.pt-al-pill')].find((b) => b.textContent!.trim() === t)!;
  return { f, el, text, changes, pill };
}

describe('PtAlertCard (version A)', () => {
  it('renders the version-A session chart with its three levels', () => {
    const { el, text } = mount(condition('session-move'), { row: amd, rows, bars: [100, 97, 94.5, 92.1] });
    for (const s of ['0%', 'PREV CLOSE', '-5%', 'ALERT', '-7.9%', 'NOW', 'fires here']) expect(text()).toContain(s);
    expect(text()).toContain('Session move · example: AMD');
    expect(el.querySelector('svg.pt-al-viz')).not.toBeNull();
  });

  it('the − and + of a count (days, times, a score) stay within its limits', () => {
    const { f, el, changes, pill } = mount(condition('earnings-soon', { days: 1 }), { row: amd, rows });
    pill('1 day').click();
    f.detectChanges();
    const [minus, plus] = [...el.querySelectorAll<HTMLButtonElement>('.pt-al-step button')];
    expect(minus!.disabled).toBe(true);
    plus!.click();
    expect(changes).toEqual([{ key: 'days', value: 2 }]);
  });

  it('a percentage: the pill becomes its own field, with round values above and below to pick at once (Romeo, 2026-11-02)', () => {
    const { f, el, changes, pill } = mount(condition('session-move', { pct: 5 }), { row: amd, rows });
    pill('5%').click();
    f.detectChanges();
    expect(el.querySelector('.pt-al-step')).toBeNull();                 // no − and + under the sentence any more
    const input = el.querySelector<HTMLInputElement>('.pt-al-edit input')!;
    expect(input.value).toBe('5');
    // as wide as its number, growing as it is typed
    expect(input.style.width).toBe('1.4ch');
    input.value = '12.5';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(input.style.width).toBe('4.4ch');
    const shown = (sel: string) => [...el.querySelectorAll('.pt-al-edit ' + sel + ' button')].map((b) => b.textContent!.trim());
    expect(shown('.pt-al-pre-up')).toEqual(['10%', '7.5%']);           // the farther on top
    expect(shown('.pt-al-pre-down')).toEqual(['4%', '3%']);
    // a press picks before the field can lose its focus
    el.querySelectorAll('.pt-al-pre-up button')[1]!.dispatchEvent(new Event('pointerdown', { cancelable: true }));
    expect(changes).toEqual([{ key: 'pct', value: 7.5 }]);
    f.detectChanges();
    expect(el.querySelector('.pt-al-edit')).toBeNull();
    expect(pill('5%')).toBeDefined();
  });

  it('a typed percentage goes to its step; out of its limits it stays open; leaving keeps what was typed; Escape changes nothing', () => {
    const { f, el, changes, pill } = mount(condition('session-move', { pct: 5 }), { row: amd, rows });
    const open = () => { pill('5%').click(); f.detectChanges(); return el.querySelector<HTMLInputElement>('.pt-al-edit input')!; };
    const key = (field: HTMLInputElement, k: string) => field.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    let field = open();
    field.value = '6.3';
    key(field, 'Enter');
    expect(changes).toEqual([{ key: 'pct', value: 6.5 }]);
    f.detectChanges();
    field = open();
    field.value = '45';                                                  // its most is 20
    key(field, 'Enter');
    f.detectChanges();
    expect(el.querySelector('.pt-al-edit')).not.toBeNull();
    field.value = '8';
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(changes).toEqual([{ key: 'pct', value: 6.5 }, { key: 'pct', value: 8 }]);
    f.detectChanges();
    field = open();
    let reached = false;
    el.addEventListener('keydown', () => { reached = true; });           // the editor closes on an Escape that reaches the page
    field.value = '12';
    key(field, 'Escape');
    f.detectChanges();
    expect(el.querySelector('.pt-al-edit')).toBeNull();
    expect(reached).toBe(false);
    expect(changes).toHaveLength(2);
  });

  it('a price: the pill becomes its field, about ±5% and ±10% above and below; a typed one is kept to the cent; the chart follows', () => {
    const { f, el, changes, pill } = mount(condition('price-crosses', { dir: 'below', price: 150 }), { row: amd, rows, bars: [100, 97, 94.5, 92.1] });
    pill('$150').click();
    f.detectChanges();
    expect(el.querySelector('.pt-al-step')).toBeNull();
    const field = el.querySelector<HTMLInputElement>('.pt-al-edit input')!;
    expect(field.value).toBe('150');
    const shown = (sel: string) => [...el.querySelectorAll('.pt-al-edit ' + sel + ' button')].map((b) => b.textContent!.trim());
    expect(shown('.pt-al-pre-up')).toEqual(['$170', '$160']);
    expect(shown('.pt-al-pre-down')).toEqual(['$140', '$130']);
    for (const v of ['0', '-3', 'abc', '']) {                          // outside its limits, or not a number: nothing
      field.value = v;
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }
    expect(changes).toEqual([]);
    field.value = '$93.456';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(changes).toEqual([{ key: 'price', value: 93.46 }]);
    f.componentRef.setInput('rc', condition('price-crosses', { dir: 'below', price: 93.5 }));
    f.detectChanges();
    expect(pill('$93.50')).toBeDefined();
    expect([...el.querySelectorAll('.pt-lvl-t')].map((t) => t.textContent!.trim())).toContain('$93.50');
  });

  it('a choice pill moves to the next option', () => {
    const { changes, pill } = mount(condition('session-move'), { row: amd, rows });
    pill('Falls').click();
    expect(changes).toEqual([{ key: 'dir', value: 'up' }]);
  });

  it('a sector pill opens the sectors and picks one', () => {
    const { f, el, changes, pill } = mount(condition('sector'), { row: null, rows });
    pill('Technology').click();
    f.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('.pt-al-choices button')].find((b) => b.textContent!.trim() === 'Energy')!.click();
    expect(changes).toEqual([{ key: 'sector', value: 'Energy' }]);
  });

  it('no example shows "No data" instead of a chart', () => {
    const { el, text } = mount(condition('session-move'), { row: null, rows });
    expect(el.querySelector('svg.pt-al-viz')).toBeNull();
    expect(text()).toContain('No data');
  });

  it('the count reads "Today: 4 of 61 mega caps"', () => {
    const { text } = mount(condition('session-move'), { row: amd, rows }, { count: { pass: 4, of: 61 }, ofLabel: 'mega caps' });
    expect(text()).toContain('Today: 4 of 61 mega caps');
  });

  it('every condition draws a card without throwing', () => {
    for (const rc of [condition('piotroski'), condition('earnings-soon'), condition('grade-change'), condition('undervalued'),
      condition('near-52w'), condition('news-spike'), condition('pe-vs-sector'), condition('analyst-upside'), condition('earnings-surprise'),
      condition('insider-buying'), condition('mega-caps'), condition('one-stock', { ticker: 'AMD' })]) {
      const { el } = mount(rc, { row: amd, rows });
      expect(el.querySelector('.pt-al-card'), rc.c).not.toBeNull();
    }
  });
});

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

  it('the − and + of a number pill stay within its limits', () => {
    const { f, el, changes, pill } = mount(condition('session-move', { pct: 1 }), { row: amd, rows });
    pill('1%').click();
    f.detectChanges();
    const [minus, plus] = [...el.querySelectorAll<HTMLButtonElement>('.pt-al-step button')];
    expect(minus!.disabled).toBe(true);
    plus!.click();
    expect(changes).toEqual([{ key: 'pct', value: 1.5 }]);
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

import { TestBed } from '@angular/core/testing';
import { MEGA_CAP } from '../../typologies/values';
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
  const replaced: RuleCondition[] = [];
  f.componentInstance.replace.subscribe((r) => replaced.push(r));
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const text = () => el.textContent!.replace(/\s+/g, ' ');
  const pill = (t: string) => [...el.querySelectorAll<HTMLButtonElement>('.pt-al-pill')].find((b) => b.textContent!.trim() === t)!;
  return { f, el, text, changes, replaced, pill };
}
/** the symbols of the list's chips, in their order */
const chips = (el: HTMLElement) => [...el.querySelectorAll('.pt-al-chip b')].map((b) => b.textContent!.trim());
/** tickers, the largest company first */
const byCap = (ts: string[]) => rows.filter((r) => ts.includes(r.ticker)).sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).map((r) => r.ticker);
const openList = (f: { detectChanges(): void }, el: HTMLElement) => { el.querySelector<HTMLButtonElement>('.pt-al-logos')!.click(); f.detectChanges(); };
/** after a field's close: its pieces' fade-out (120 ms), then the pill */
const shut = async (f: { detectChanges(): void }) => { await new Promise((r) => setTimeout(r, 200)); f.detectChanges(); };

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

  it('a percentage: the pill becomes its own field, with round values above and below to pick at once (Romeo, 2026-11-02)', async () => {
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
    // its pieces fade out first (a quick animation), then the pill is back
    expect(el.querySelector('.pt-al-edit')!.classList).toContain('pt-al-closing');
    await shut(f);
    expect(el.querySelector('.pt-al-edit')).toBeNull();
    expect(pill('5%')).toBeDefined();
  });

  it('− on the left and + on the right of the field move it finely and keep it open; a press counts once (Romeo, 2026-11-02)', () => {
    const { f, el, changes, pill } = mount(condition('session-move', { pct: 5 }), { row: amd, rows });
    const follow = () => { f.componentRef.setInput('rc', condition('session-move', { pct: changes.at(-1)!.value as number })); f.detectChanges(); };
    pill('5%').click();
    f.detectChanges();
    const nudges = () => [...el.querySelectorAll<HTMLButtonElement>('.pt-al-edit .pt-al-nudge')];
    expect(nudges().map((b) => b.getAttribute('aria-label'))).toEqual(['Less', 'More']);
    nudges()[1]!.click();
    expect(changes).toEqual([{ key: 'pct', value: 5.5 }]);
    follow();
    expect(el.querySelector<HTMLInputElement>('.pt-al-edit input')!.value).toBe('5.5');
    nudges()[0]!.dispatchEvent(new Event('pointerdown', { cancelable: true }));
    nudges()[0]!.click();
    expect(changes).toEqual([{ key: 'pct', value: 5.5 }, { key: 'pct', value: 5 }]);
    expect(el.querySelector('.pt-al-edit')).not.toBeNull();
  });

  it('a price moves by about a thousandth of it, at a round step; − and + stop at the limits', () => {
    for (const [price, label, want] of [[143, 'More', 144], [92.1, 'Less', 92], [3.47, 'More', 3.48]] as const) {
      const { f, el, changes } = mount(condition('price-crosses', { dir: 'below', price }), { row: amd, rows });
      [...el.querySelectorAll<HTMLButtonElement>('.pt-al-pill')].find((b) => b.textContent!.trim().startsWith('$'))!.click();
      f.detectChanges();
      el.querySelector<HTMLButtonElement>(`.pt-al-edit .pt-al-nudge[aria-label="${label}"]`)!.click();
      expect(changes, String(price)).toEqual([{ key: 'price', value: want }]);
    }
    for (const [pct, label] of [[20, 'More'], [1, 'Less']] as const) {
      const { f, el, pill } = mount(condition('session-move', { pct }), { row: amd, rows });
      pill(`${pct}%`).click();
      f.detectChanges();
      expect(el.querySelector<HTMLButtonElement>(`.pt-al-edit .pt-al-nudge[aria-label="${label}"]`)!.disabled, String(pct)).toBe(true);
    }
  });

  it('a typed percentage goes to its step; out of its limits it stays open; leaving keeps what was typed; Escape changes nothing', async () => {
    const { f, el, changes, pill } = mount(condition('session-move', { pct: 5 }), { row: amd, rows });
    const open = () => { pill('5%').click(); f.detectChanges(); return el.querySelector<HTMLInputElement>('.pt-al-edit input')!; };
    const key = (field: HTMLInputElement, k: string) => field.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    let field = open();
    field.value = '6.3';
    key(field, 'Enter');
    expect(changes).toEqual([{ key: 'pct', value: 6.5 }]);
    await shut(f);
    field = open();
    field.value = '45';                                                  // its most is 20
    key(field, 'Enter');
    f.detectChanges();
    expect(el.querySelector('.pt-al-edit')).not.toBeNull();
    field.value = '8';
    field.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(changes).toEqual([{ key: 'pct', value: 6.5 }, { key: 'pct', value: 8 }]);
    await shut(f);
    field = open();
    let reached = false;
    el.addEventListener('keydown', () => { reached = true; });           // the editor closes on an Escape that reaches the page
    field.value = '12';
    key(field, 'Escape');
    await shut(f);
    expect(el.querySelector('.pt-al-edit')).toBeNull();
    expect(reached).toBe(false);
    expect(changes).toHaveLength(2);
  });

  it('a price: the pill becomes its field, about ±5% and ±10% above and below; a typed one is kept to the cent; the chart follows', async () => {
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
    await shut(f);
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

  it("a universe card opens its companies, by logo and symbol, the largest first; a portfolio's go one by one (Romeo, 2026-11-02)", () => {
    const { f, el, changes } = mount(condition('companies', { tickers: 'AMD,NVDA' }), { row: amd, rows });
    expect(el.querySelector('.pt-al-list')).toBeNull();
    openList(f, el);
    expect(chips(el)).toEqual(['NVDA', 'AMD']);
    el.querySelector<HTMLButtonElement>('[aria-label="Remove AMD"]')!.click();
    expect(changes).toEqual([{ key: 'tickers', value: 'NVDA' }]);
  });

  it('a symbol or a name finds a company to add; Enter adds the first found', () => {
    const { f, el, changes } = mount(condition('companies', { tickers: 'AMD' }), { row: amd, rows });
    openList(f, el);
    const find = el.querySelector<HTMLInputElement>('.pt-al-find')!;
    find.value = 'nvid';
    find.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect([...el.querySelectorAll('.pt-al-found b')].map((b) => b.textContent!.trim())).toEqual(['NVDA']);
    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(changes).toEqual([{ key: 'tickers', value: 'AMD,NVDA' }]);
  });

  it("editing a mega caps card makes it the reader's own list, from the day's mega caps", () => {
    const { f, el, replaced } = mount(condition('mega-caps'), { row: amd, rows });
    openList(f, el);
    const mega = byCap(rows.filter((r) => (r.marketCap ?? 0) >= MEGA_CAP).map((r) => r.ticker));
    expect(chips(el)).toEqual(mega);
    el.querySelector<HTMLButtonElement>('[aria-label="Remove AMD"]')!.click();
    expect(replaced).toEqual([{ c: 'companies', p: { tickers: mega.filter((t) => t !== 'AMD').join(',') } }]);
  });

  it('a group adds all its companies, and takes them all away once all are in; partly in, it says how many', () => {
    const tech = byCap(rows.filter((r) => r.sector === 'Technology').map((r) => r.ticker));
    const { f, el, changes } = mount(condition('companies', { tickers: 'AMD' }), { row: amd, rows });
    openList(f, el);
    const group = (name: string) => [...el.querySelectorAll<HTMLButtonElement>('.pt-al-grp')].find((b) => b.textContent!.trim().startsWith(name))!;
    expect(group('Mega caps')).toBeDefined();                              // by size too
    expect(group('Technology').textContent).toContain(`1/${tech.length}`);
    expect(group('Technology').classList).toContain('pt-al-grp-some');
    group('Technology').click();
    const all = ['AMD', ...tech.filter((t) => t !== 'AMD')].join(',');
    expect(changes.at(-1)).toEqual({ key: 'tickers', value: all });
    f.componentRef.setInput('rc', condition('companies', { tickers: all }));
    f.detectChanges();
    expect(group('Technology').classList).toContain('pt-al-grp-all');
    group('Technology').click();
    expect(changes.at(-1)).toEqual({ key: 'tickers', value: '' });
  });

  it('an empty portfolio opens on the paste box; a pasted text adds the companies it names', () => {
    const { f, el, changes, text } = mount(condition('companies'), { row: amd, rows });
    const box = el.querySelector<HTMLTextAreaElement>('.pt-al-paste')!;   // open without a click
    box.value = 'Symbol Qty\nNVDA 10\nI also hold Apple and some Coca-Cola';
    box.dispatchEvent(new Event('input'));
    f.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('.pt-al-list button')].find((b) => b.textContent!.trim() === 'Add from text')!.click();
    f.detectChanges();
    expect(changes).toEqual([{ key: 'tickers', value: 'NVDA,AAPL,KO' }]);
    expect(text()).toContain('3 companies added');
    // a second paste says what it did, not what the first did
    const again = el.querySelector<HTMLTextAreaElement>('.pt-al-paste')!;
    again.value = 'and MSFT';
    again.dispatchEvent(new Event('input'));
    f.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('.pt-al-list button')].find((b) => b.textContent!.trim() === 'Add from text')!.click();
    f.detectChanges();
    expect(text()).toContain('1 company added');
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

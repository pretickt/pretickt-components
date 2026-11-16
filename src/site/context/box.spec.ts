import { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ClickNote } from '../../context/click';
import { PtClickBox } from './box';
import { startContext } from './start';
import { askAt } from './leave';
import { CTX_ASK } from '../../context/click';
import { CTX_DIVIDEND, CTX_EARNINGS_AHEAD, CTX_EARNINGS_OUT } from './mock';
import { NOTE_KEY, type NoteStore } from './note';

function render(note: ClickNote, compact = false) {
  const f = TestBed.createComponent(PtClickBox);
  f.componentRef.setInput('note', note);
  f.componentRef.setInput('compact', compact);
  let closed = 0;
  f.componentInstance.closed.subscribe(() => closed++);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { el, text: () => el.textContent!.replace(/\s+/g, ' '), closed: () => closed };
}
const memory = () => {
  const data = new Map<string, string>();
  const store: NoteStore = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  return { data, store };
};

describe('pt-click-box: what the reader clicked, at the top of the company page', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('the frame: where the click came from (a link back), when, and ×', () => {
    const { el, closed } = render(CTX_EARNINGS_AHEAD);
    const aside = el.querySelector('aside.pt-ctx')!;
    expect(aside.getAttribute('aria-label')).toBe('Where you came from');
    const k = aside.querySelector<HTMLAnchorElement>('a.pt-ctx-k')!;
    expect(k.textContent!.trim()).toBe('From the earnings calendar November 2026');
    expect(k.getAttribute('href')).toBe('/earnings-calendar/');
    expect(aside.querySelector('.pt-ctx-at')!.textContent!.trim()).toBe('Seen Nov 16, 3:40 PM');
    const x = aside.querySelector<HTMLButtonElement>('button.pt-ctx-x')!;
    expect(x.getAttribute('aria-label')).toBe('Close');
    x.click();
    expect(closed()).toBe(1);
  });

  it('earnings ahead: when, the usual move, the last 8 bars, the hint, the sentence, the estimates and the earnings page', () => {
    const { el, text } = render(CTX_EARNINGS_AHEAD);
    const t = text();
    expect(t).toContain('Wed, Nov 18 · after the close · reacts Thu');
    expect(t).toContain('±7.0%');
    expect(t).toContain('Beat 7 of 8 · rose after 5 of 8');
    expect(el.querySelectorAll('svg.pt-cal-row-bars rect')).toHaveLength(8);
    expect(t).toContain('EPS est. $1.25 · revenue est. $54.9B');
    expect(t).toContain('It beat the EPS estimate in 7 of its last 8 reports.');
    const page = [...el.querySelectorAll('a')].find((a) => a.textContent!.includes('earnings date'))!;
    expect(page.textContent!.trim()).toBe('Nvidia earnings date, estimates and record →');
    expect(page.getAttribute('href')).toBe('/stocks/nvda/earnings/');
  });

  it('the kicker names the page when it adds something: the home page, another page by its title', () => {
    const at = (path: string, title: string) => render({ ...CTX_EARNINGS_AHEAD, from: { path, title } }).el.querySelector('a.pt-ctx-k')!.textContent!.trim();
    expect(at('/', 'pretickt: stock prices and what moves them')).toBe('From the earnings calendar on the home page');
    expect(at('/earnings-this-week/', 'Earnings this week')).toBe('From the earnings calendar · Earnings this week');
  });

  it('earnings out: the move in its tone, the sentence of the result', () => {
    const { el, text } = render(CTX_EARNINGS_OUT);
    expect(el.querySelector('.pt-cal-row-cue')!.className).toContain('pt-t-neg');
    expect(text()).toContain('EPS $1.33 vs $1.25 expected, beat by 6%');
  });

  it('a page link to the page the reader landed on is not drawn', () => {
    const { el } = render({ ...CTX_EARNINGS_AHEAD, land: '/stocks/nvda/earnings/' });
    expect([...el.querySelectorAll('a')].some((a) => a.textContent!.includes('earnings date'))).toBe(false);
  });

  it('dividend: the amount, the ex-date, the pay date and the dividend page', () => {
    const { el, text } = render(CTX_DIVIDEND);
    const t = text();
    expect(el.querySelector('a.pt-ctx-k')!.textContent).toContain('From the dividend calendar');
    expect(t).toContain('$0.51');
    expect(t).toContain('Ex-dividend Fri, Nov 28');
    expect(t).toContain('Payable Dec 12');
    expect(t).toContain('Coca-Cola dividend history →');
    expect(el.querySelector('svg.pt-cal-row-bars')).toBeNull();
  });

  it('compact (the hover card): the body alone, no frame', () => {
    const { el, text } = render(CTX_EARNINGS_AHEAD, true);
    expect(el.querySelector('.pt-ctx-k')).toBeNull();
    expect(el.querySelector('.pt-ctx-x')).toBeNull();
    expect(text()).toContain('±7.0%');
  });

  describe('startContext: the landing', () => {
    function page() {
      document.body.innerHTML = '<main><pt-page></pt-page></main>';
      return { appRef: TestBed.inject(ApplicationRef), env: TestBed.inject(EnvironmentInjector) };
    }
    const here = { path: '/stocks/nvda/', subject: 'NVDA', search: '' };
    const actions: string[] = [];
    const count = (e: Event) => actions.push((e as CustomEvent<{ action: string }>).detail.action);
    beforeEach(() => { actions.length = 0; document.addEventListener('pt-interact', count); });
    afterEach(() => document.removeEventListener('pt-interact', count));

    it('a valid note: the box above the page, counted; a link in it counted; × removes it and the note', async () => {
      const { appRef, env } = page();
      const { data, store } = memory();
      data.set(NOTE_KEY, JSON.stringify({ ...CTX_EARNINGS_AHEAD, at: Date.now() - 60_000 }));
      await startContext(document, appRef, env, 'NVDA', () => import('./box'), store, here);
      TestBed.tick();
      const host = document.querySelector('pt-click-box')!;
      expect(host.getAttribute('data-island')).toBe('pt-click-box@1.0.0');
      expect(host.nextElementSibling!.tagName).toBe('PT-PAGE');
      expect(host.querySelector('.pt-ctx')).not.toBeNull();
      const link = [...host.querySelectorAll('a')].find((a) => a.textContent!.includes('earnings date'))!;
      link.addEventListener('click', (e) => e.preventDefault());
      link.click();
      host.querySelector<HTMLButtonElement>('.pt-ctx-x')!.click();
      expect(document.querySelector('pt-click-box')).toBeNull();
      expect(data.has(NOTE_KEY)).toBe(false);
      expect(actions).toEqual(['show-earnings', 'go-earnings', 'close-earnings']);
    });

    it('a company named in the box leaves no note of its own: the ask stops at the box', async () => {
      const { appRef, env } = page();
      const { data, store } = memory();
      data.set(NOTE_KEY, JSON.stringify({ ...CTX_EARNINGS_AHEAD, at: Date.now() - 60_000 }));
      await startContext(document, appRef, env, 'NVDA', () => import('./box'), store, here);
      TestBed.tick();
      let outside = 0;
      document.body.addEventListener(CTX_ASK, () => outside++);
      const mention = document.querySelector('pt-click-box a[href="/stocks/nvda/"]')!;
      expect(askAt(mention)).toBeNull();
      expect(outside).toBe(0);
    });

    it('no note, or an alert in the address: nothing', async () => {
      const { appRef, env } = page();
      const { data, store } = memory();
      await startContext(document, appRef, env, 'NVDA', () => import('./box'), store, here);
      data.set(NOTE_KEY, JSON.stringify({ ...CTX_EARNINGS_AHEAD, at: Date.now() }));
      await startContext(document, appRef, env, 'NVDA', () => import('./box'), store, { ...here, search: '?alert=AbCdEf0123456789_-xy' });
      expect(document.querySelector('pt-click-box')).toBeNull();
    });
  });
});

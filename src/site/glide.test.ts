// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { attachGlide, glide, type Animate } from './glide';

/** A row `width` px wide showing `client` px of it; its links at the given left offsets (happy-dom lays nothing out). */
function row(html: string, width: number, client: number, lefts: number[] = []): HTMLElement {
  document.body.innerHTML = html;
  const r = document.body.firstElementChild as HTMLElement;
  Object.defineProperty(r, 'scrollWidth', { value: width });
  Object.defineProperty(r, 'clientWidth', { value: client });
  [...r.querySelectorAll('a')].forEach((a, i) => Object.defineProperty(a, 'offsetLeft', { value: lefts[i] ?? 0 }));
  return r;
}
/** Records each leg (where to, how long) and lands there at once. */
function recorder() {
  const legs: [number, number][] = [];
  const animate: Animate = async (el, to, ms) => { legs.push([to, ms]); el.scrollLeft = to; return true; };
  return { legs, animate };
}
const SUBNAV = '<nav class="pt-subnav"><a href="/a/">Overview</a><a href="/b/">Value</a><a href="/c/" aria-current="page">Earnings</a><a href="/d/">News</a></nav>';
const HEAD = '<div class="pt-section-head"><h2 class="pt-section-title">Analyst price targets and predictions</h2><a class="pt-section-more" href="/x/">Every target →</a></div>';

describe('glide: a row wider than the phone shows once, slowly, that it scrolls (Romeo, 2026-11-15: «scrolla lentamente in automatico una volta»)', () => {
  it('a row that fits does not move', async () => {
    const r = row(HEAD, 300, 300), { legs, animate } = recorder();
    await glide(r, { animate });
    expect(legs).toEqual([]);
  });
  it('a section head goes slowly to its end, then back to its start', async () => {
    const r = row(HEAD, 520, 328), { legs, animate } = recorder();
    await glide(r, { animate });
    expect(legs.map(([to]) => to)).toEqual([192, 0]);
    expect(legs[0]![1]).toBeGreaterThanOrEqual(1500); // slowly: 192 px in no less than 1.5 s
    expect(legs[0]![1]).toBeGreaterThan(legs[1]![1]); // the way back quicker
  });
  it('the company tabs come back to the current page\'s tab, a little room before it', async () => {
    const r = row(SUBNAV, 900, 328, [0, 90, 400, 520]), { legs, animate } = recorder();
    await glide(r, { animate });
    expect(legs.map(([to]) => to)).toEqual([572, 384]);
    expect(legs[0]![1]).toBe(4000); // a long row no slower than 4 s
  });
  it('with reduced motion nothing slides: the row only shows the current tab', async () => {
    const r = row(SUBNAV, 900, 328, [0, 90, 400, 520]), { legs, animate } = recorder();
    await glide(r, { animate, reduced: true });
    expect([legs, r.scrollLeft]).toEqual([[], 384]);
  });
  it('a touch on the row stops it where it is: the way back is not taken', async () => {
    const r = row(HEAD, 520, 328), legs: number[] = [];
    let stopped = false;
    const animate: Animate = async (_el, to) => { legs.push(to); r.dispatchEvent(new Event('pointerdown')); return !stopped; };
    r.addEventListener('pointerdown', () => { stopped = true; });
    await glide(r, { animate });
    expect(legs).toEqual([192]);
  });
});

describe('the home\'s tabs', () => {
  it('go about half their way, enough to show they scroll, then back (Romeo, 2026-11-15: «nella home l\'animazione non deve arrivare alla fine… basta circa metà»)', async () => {
    const r = row(SUBNAV.replace(' aria-current="page"', ''), 2480, 328), { legs, animate } = recorder();
    await glide(r, { animate, part: 0.5 });
    expect(legs.map(([to]) => to)).toEqual([1076, 0]);
  });
  it('attachGlide sends the home\'s tabs half way, a company\'s all the way', async () => {
    for (const [path, to] of [['/', 286], ['/stocks/nvda/', 572]] as const) {
      history.replaceState(null, '', path);
      document.body.innerHTML = SUBNAV;
      const nav = document.querySelector<HTMLElement>('.pt-subnav')!;
      Object.defineProperty(nav, 'scrollWidth', { value: 900 }); Object.defineProperty(nav, 'clientWidth', { value: 328 });
      const { legs, animate } = recorder();
      attachGlide(document, { animate, observe: () => undefined });
      await new Promise((r) => setTimeout(r, 0));
      expect(legs[0]![0]).toBe(to);
    }
  });
});

describe('attachGlide', () => {
  it('the tabs glide when the page opens, each section head when it comes into view, each once', async () => {
    document.body.innerHTML = SUBNAV + HEAD;
    const [nav, head] = [document.querySelector<HTMLElement>('.pt-subnav')!, document.querySelector<HTMLElement>('.pt-section-head')!];
    for (const [e, w] of [[nav, 900], [head, 520]] as const) { Object.defineProperty(e, 'scrollWidth', { value: w }); Object.defineProperty(e, 'clientWidth', { value: 328 }); }
    const { legs, animate } = recorder(), seen: [Element, () => void][] = [];
    attachGlide(document, { animate, observe: (e, on) => seen.push([e, on]) });
    await new Promise((r) => setTimeout(r, 0));
    expect(legs).toHaveLength(2); // the tabs: there and back
    expect(seen.map(([e]) => e)).toEqual([head]);
    seen[0]![1](); seen[0]![1]();
    await new Promise((r) => setTimeout(r, 0));
    expect(legs).toHaveLength(4); // the head once, however often it is seen
  });
});

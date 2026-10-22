import { PtCompanyCard } from '../../components/pt-company-card';
import { render, withData } from '../../components/_spec';
import { demoFor } from '../typologies';
import { attachCompanyBar, pastOf } from './cobar';

const HEADER = `<header class="pt-header"><div class="pt-header-in"><a class="pt-brand" href="/">pretickt</a>
  <nav class="pt-sectors" aria-label="Sectors"><details class="pt-menu"><summary>Sectors</summary></details></nav>
  <form class="pt-search" role="search" action="/stocks/" method="get"><input id="pt-q" name="q" type="search"></form></div></header>`;
const LOGO = '/logos/aapl.1a2b3c4d.png';

/** A company page as the build writes it: the header, then the page app with the wide company card first. */
async function companyPage(company: Record<string, unknown> = {}) {
  const co = { ...(demoFor({ t: 'company@1', params: { ticker: 'AAPL' } }) as object), ...company };
  const card = await render(PtCompanyCard, { ticker: 'AAPL' }, withData({ 'company@1': co }));
  const doc = document.implementation.createHTMLDocument('page');
  doc.body.innerHTML = `${HEADER}<main><pt-page><section class="pt-section" id="card">${card.html()}</section></pt-page></main>`;
  return { doc, card: card.el };
}
/** The watcher the page would install, captured: the test says when the card is past. */
function watcher() {
  const w = { card: null as Element | null, inset: -1, past: (_on: boolean) => {} };
  return { w, observe: (card: Element, inset: number, past: (on: boolean) => void) => Object.assign(w, { card, inset, past }) };
}
const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? null;

describe('the company strip in the header', () => {
  it('adds a hidden strip before the search with the card\'s logo, name, ticker and cap, last close and analyst target', async () => {
    const { doc, card } = await companyPage({ logo: LOGO });
    const { observe } = watcher();
    const bar = attachCompanyBar(doc, { observe })!;
    expect(bar.parentElement!.className).toBe('pt-header-in');
    expect(bar.nextElementSibling!.matches('form.pt-search')).toBe(true);
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(bar.querySelector('img.pt-logo')!.getAttribute('src')).toBe(LOGO);
    expect(text(bar.querySelector('.pt-cobar-name'))).toBe(text(card.querySelector('.pt-card-name')));
    const [ticker, cap] = text(card.querySelector('.pt-card-who .pt-meta'))!.split(' · ');
    expect([text(bar.querySelector('.pt-cobar-tk')), text(bar.querySelector('.pt-cobar-cap'))]).toEqual(['AAPL', cap]);
    expect(ticker).toBe('AAPL');
    expect(cap).toMatch(/^\$[\d.]+[KMBT]$/);
    expect(text(bar.querySelector('.pt-cobar-close'))).toBe(text(card.querySelector('.pt-card-close')));
    const pt = card.querySelector('.pt-card-pt')!;
    expect(text(bar.querySelector('.pt-cobar-pt'))).toBe(text(pt));
    expect(bar.querySelector('.pt-cobar-pt')!.classList.contains([...pt.classList].find((c) => c.startsWith('pt-tone-'))!)).toBe(true);
    expect(doc.querySelector('.pt-header')!.classList.contains('pt-cobar-on')).toBe(false);
  });
  it('without a logo file, the initials, as on the card', async () => {
    const { doc } = await companyPage({ logo: null });
    const bar = attachCompanyBar(doc, watcher())!;
    expect(bar.querySelector('img')).toBeNull();
    expect(text(bar.querySelector('.pt-logo-initials'))).toBe('AA');
  });
  it('fades in once the card is entirely under the header, and out when it comes back', async () => {
    const { doc } = await companyPage();
    const { w, observe } = watcher();
    attachCompanyBar(doc, { observe });
    const header = doc.querySelector('.pt-header')!;
    expect(w.card).toBe(doc.querySelector('pt-page .pt-card-wide'));
    expect(w.inset).toBeGreaterThanOrEqual(0);
    w.past(true);
    expect(header.classList.contains('pt-cobar-on')).toBe(true);
    w.past(false);
    expect(header.classList.contains('pt-cobar-on')).toBe(false);
  });
  it('copies the card\'s text, never its markup', async () => {
    const { doc } = await companyPage({ name: 'Evil <img src=x onerror=alert(1)> Inc.' });
    const bar = attachCompanyBar(doc, watcher())!;
    expect(text(bar.querySelector('.pt-cobar-name'))).toBe('Evil <img src=x onerror=alert(1)> Inc.');
    expect(bar.querySelectorAll('img')).toHaveLength(0);
    expect(bar.querySelector('[ngh], [jsaction], [id]')).toBeNull();
  });
  it('no company card (a list page, or the card had no data): the header stays as it is', () => {
    const doc = document.implementation.createHTMLDocument('page');
    doc.body.innerHTML = `${HEADER}<main><pt-page><section class="pt-section" id="list"><p class="pt-na">Data not available</p></section></pt-page></main>`;
    const before = doc.querySelector('.pt-header')!.outerHTML;
    expect(attachCompanyBar(doc, watcher())).toBeNull();
    expect(doc.querySelector('.pt-header')!.outerHTML).toBe(before);
  });
});

describe('pastOf (the default watcher\'s rule)', () => {
  const at = (isIntersecting: boolean, bottom: number, rootTop: number | null = 56) =>
    ({ isIntersecting, boundingClientRect: { bottom }, rootBounds: rootTop === null ? null : { top: rootTop } });
  it('past only when the card is out of view above the header — not while a pixel shows, not when it is below the page', () => {
    expect(pastOf(at(false, 40), 56)).toBe(true);
    expect(pastOf(at(false, 56), 56)).toBe(true);
    expect(pastOf(at(true, 57), 56)).toBe(false);
    expect(pastOf(at(false, 900), 56)).toBe(false);
  });
  it('falls back on the header\'s height when the browser gives no root bounds', () => {
    expect(pastOf(at(false, 40, null), 56)).toBe(true);
    expect(pastOf(at(false, 80, null), 56)).toBe(false);
  });
  it('shows the card\'s price as it is when the strip appears (today\'s delayed price lands after the first render)', async () => {
    const { doc, card } = await companyPage();
    const { w, observe } = watcher();
    const bar = attachCompanyBar(doc, { observe })!;
    doc.querySelector('pt-page .pt-card-close')!.textContent = '$1.00';
    w.past(true);
    expect(text(bar.querySelector('.pt-cobar-close'))).toBe('$1.00');
    expect(card).toBeTruthy();
  });
});

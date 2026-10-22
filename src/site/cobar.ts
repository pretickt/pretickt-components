/**
 * The company strip in the header (company pages): once the page's company card has scrolled entirely under the header, the header
 * shows the company — logo, name, ticker and market cap, last close, analyst target — fading in (`.pt-cobar-on` on the header,
 * styles/ds.css), and fades it out when the card comes back. The strip copies the card's text, never its markup, so the two cannot
 * disagree and nothing of Angular's leaves the page app. No card (a list page, a card without data): no strip.
 */
const CARD = 'pt-page .pt-card-wide';
const ON = 'pt-cobar-on';
const LOGO = 24;

/** What an IntersectionObserver entry tells the default watcher. */
export interface Seen { isIntersecting: boolean; boundingClientRect: { bottom: number }; rootBounds: { top: number } | null }

/** Past = out of view above the header (`inset` px tall): not while a pixel of the card shows, not when it is below the page. */
export const pastOf = (e: Seen, inset: number): boolean => !e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds?.top ?? inset);

export interface CompanyBarOptions {
  /** Watches `card` under a header `inset` px tall and reports whether it is past; the default uses an IntersectionObserver. */
  observe?: (card: Element, inset: number, past: (on: boolean) => void) => void;
}

function observePast(card: Element, inset: number, past: (on: boolean) => void): void {
  const IO = card.ownerDocument.defaultView?.IntersectionObserver;
  if (!IO) return; // an old browser keeps the plain header
  new IO((entries) => { const e = entries.at(-1); if (e) past(pastOf(e, inset)); }, { rootMargin: `${-Math.round(inset)}px 0px 0px 0px`, threshold: 0 })
    .observe(card);
}

/** A new element with a class and, when given, its text (never HTML). */
function el(doc: Document, tag: string, cls: string, text?: string | null): HTMLElement {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const textOf = (card: Element, sel: string) => card.querySelector(sel)?.textContent?.trim() || null;

/** The strip's content, read from the card: what the card does not show, the strip does not either. */
function build(doc: Document, card: Element): HTMLElement {
  const bar = el(doc, 'div', 'pt-cobar');
  bar.setAttribute('aria-hidden', 'true'); // the card above says it all; the strip is a reminder for the eye
  const logo = card.querySelector('.pt-card-id .pt-logo');
  const src = logo?.tagName === 'IMG' ? logo.getAttribute('src') : null;
  if (src) {
    const img = el(doc, 'img', 'pt-logo') as HTMLImageElement;
    Object.assign(img, { src, alt: '', width: LOGO, height: LOGO, decoding: 'async' });
    bar.append(img);
  } else if (logo) bar.append(el(doc, 'span', 'pt-logo pt-logo-initials', logo.textContent?.trim()));
  // the card's "AAPL · $3.9T" as two parts: on a narrow header the market cap gives way, the ticker stays
  const [ticker, cap] = (textOf(card, '.pt-card-who .pt-meta') ?? '').split(' · ');
  const parts: [string, string | null | undefined][] = [['pt-cobar-name', textOf(card, '.pt-card-name')], ['pt-cobar-tk', ticker], ['pt-cobar-cap', cap],
    ['pt-cobar-close', textOf(card, '.pt-card-close')]];
  for (const [cls, t] of parts) if (t) bar.append(el(doc, 'span', cls, t));
  const pt = card.querySelector('.pt-card-pt');
  const target = textOf(card, '.pt-card-pt');
  if (pt && target) bar.append(el(doc, 'span', ['pt-cobar-pt', ...[...pt.classList].filter((c) => c.startsWith('pt-tone-'))].join(' '), target));
  return bar;
}

/** Puts the strip in the header of a company page and lets it follow the card. Returns the strip, or null when the page has no card. */
export function attachCompanyBar(doc: Document, o: CompanyBarOptions = {}): HTMLElement | null {
  const header = doc.querySelector<HTMLElement>('header.pt-header');
  const row = header?.querySelector('.pt-header-in');
  const card = doc.querySelector(CARD);
  if (!header || !row || !card) return null;
  const bar = build(doc, card);
  row.insertBefore(bar, row.querySelector('form.pt-search'));
  (o.observe ?? observePast)(card, header.getBoundingClientRect().height, (on) => {
    // the card's price and its distance to the target change after the strip was built (today's delayed price arrives later)
    if (on) for (const [mine, theirs] of [['.pt-cobar-close', '.pt-card-close'], ['.pt-cobar-pt', '.pt-card-pt']]) {
      const e = bar.querySelector(mine!), t = textOf(card, theirs!);
      if (e && t) e.textContent = t;
    }
    header.classList.toggle(ON, on);
  });
  return bar;
}

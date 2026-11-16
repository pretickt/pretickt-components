import { type ApplicationRef, Component, computed, createComponent, type EnvironmentInjector, input, output } from '@angular/core';
import { type ClickNote, CTX_ASK, type CtxAsk } from '@pretickt/components/context';
import { dayMonth } from '../../ds/format';
import { PtCtxCalendar } from './calendar';
import { PtCtxMap, PtCtxMover, PtCtxTalk } from './moves';
import { PtCtxFeed, PtCtxNews } from './stories';
import { PtCtxList, PtCtxPeers } from './lists';
import { PtCtxHolding, PtCtxPortfolio } from './baskets';
import { PtCtxFollowing, PtCtxHolder, PtCtxMention } from './words';
import { possessive } from '../../typologies/basket-words';

const ISLAND = 'pt-click-box@1.0.0';

/** The time of the click in the reader's own time: "Nov 16, 3:40 PM" (the box is drawn in the browser only). */
export function seenAt(at: number): string {
  const d = new Date(at), h = d.getHours() % 12 || 12, m = String(d.getMinutes()).padStart(2, '0'), two = (n: number) => String(n).padStart(2, '0');
  return `${dayMonth(`${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`)}, ${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

const ORIGIN: Partial<Record<ClickNote['kind'], string>> = {
  earnings: 'the earnings calendar', dividend: 'the dividend calendar', mover: 'ongoing moves', 'heat-map': 'the heat map', feed: 'the feed',
  news: 'the news',
};
/** The origin's name: the kind's, or what its snapshot says (the news or the social map). */
const originOf = (note: ClickNote): string => {
  if (note.kind === 'talk-map') return `the ${note.d.lens} map`;
  if (note.kind === 'list' && note.d.title) return `${note.d.title.charAt(0).toLowerCase()}${note.d.title.slice(1)}`;
  return ORIGIN[note.kind] ?? 'the page you were on';
};

/**
 * Where the click came from, as the kicker says it: the origin, then the page when it adds something ("on the home page", its title);
 * a page titled after the origin itself says it once ("From the earnings calendar November 2026").
 */
export function kicker(note: ClickNote): string {
  // a company's peers are on that company's page: the page's title would only say it again
  if (note.kind === 'peers') return `From ${possessive(note.d.of.name)} peers`;
  // a fund's or a sector's page is titled after it; the portfolio is the reader's own
  if (note.kind === 'holding') return `From ${note.d.basket.name}`;
  if (note.kind === 'portfolio') return 'From your portfolio';
  if (note.kind === 'holder') return `From ${possessive(note.d.of.name)} value checks`;
  if (note.kind === 'following') return 'From the companies you follow';
  // a sentence's origin is its page
  if (note.kind === 'mention') return note.from.path === '/' ? 'From the home page' : note.from.title.trim() ? `From ${note.from.title.trim()}` : 'From the page you were on';
  const origin = originOf(note), title = note.from.title.trim();
  if (note.from.path === '/') return `From ${origin} on the home page`;
  if (!title) return `From ${origin}`;
  if (title.toLowerCase().startsWith(origin.replace(/^the /, ''))) return `From the ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
  return `From ${origin} · ${title}`;
}

/** The body written for each kind (one `@case` per kind). */
@Component({
  selector: 'pt-ctx-body',
  imports: [PtCtxCalendar, PtCtxFeed, PtCtxFollowing, PtCtxHolder, PtCtxHolding, PtCtxList, PtCtxMap, PtCtxMention, PtCtxMover, PtCtxNews, PtCtxPeers,
    PtCtxPortfolio, PtCtxTalk],
  host: { class: 'pt-ctx-body' },
  template: `
    @let n = note();
    @switch (n.kind) {
      @case ('earnings') {<pt-ctx-calendar [d]="n.d" [land]="n.land" />}
      @case ('dividend') {<pt-ctx-calendar [d]="n.d" [land]="n.land" />}
      @case ('mover') {<pt-ctx-mover [d]="n.d" [to]="n.to" />}
      @case ('heat-map') {<pt-ctx-map [d]="n.d" [to]="n.to" />}
      @case ('talk-map') {<pt-ctx-talk [d]="n.d" [to]="n.to" />}
      @case ('feed') {<pt-ctx-feed [d]="n.d" [land]="n.land" />}
      @case ('news') {<pt-ctx-news [d]="n.d" [to]="n.to" [land]="n.land" />}
      @case ('list') {<pt-ctx-list [d]="n.d" [from]="n.from.path" />}
      @case ('peers') {<pt-ctx-peers [d]="n.d" [from]="n.from.path" />}
      @case ('holding') {<pt-ctx-holding [d]="n.d" [from]="n.from.path" />}
      @case ('portfolio') {<pt-ctx-portfolio [d]="n.d" />}
      @case ('holder') {<pt-ctx-holder [d]="n.d" [from]="n.from.path" />}
      @case ('mention') {<pt-ctx-mention [d]="n.d" [to]="n.to" />}
      @case ('following') {<pt-ctx-following [d]="n.d" />}
    }`,
})
export class PtCtxBody {
  readonly note = input.required<ClickNote>();
}

/**
 * What the reader clicked to land here, at the top of the company page (Romeo, 2026-11-16: «in base a "da dove arrivi" ti mostro un
 * riquadro in alto relativo a quello che hai cliccato prima di atterrare qui»): where it came from (a link back) and when, then the
 * box written for that origin, as the reader saw it. `compact`: the body alone (the hover card over a calendar chip).
 */
@Component({
  selector: 'pt-click-box',
  imports: [PtCtxBody],
  template: `
    @if (compact()) {<pt-ctx-body [note]="note()" />}
    @else {
      <aside class="pt-ctx" aria-label="Where you came from">
        <p class="pt-ctx-head">
          <a class="pt-ctx-k" [href]="note().from.path">{{ kick() }}</a>
          <span class="pt-ctx-at">Seen {{ seen() }}</span>
          <button type="button" class="pt-ctx-x" aria-label="Close" (click)="closed.emit()">×</button>
        </p>
        <pt-ctx-body [note]="note()" />
      </aside>
    }`,
})
export class PtClickBox {
  readonly note = input.required<ClickNote>();
  readonly compact = input(false);
  readonly closed = output<void>();
  protected readonly kick = computed(() => kicker(this.note()));
  protected readonly seen = computed(() => seenAt(this.note().at));
}

const count = (el: Element, action: string) => el.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action } }));

/**
 * A company page's landing: the click's note for this page (`start.ts` read it) as a box above the page (where an alert's box goes;
 * never with one). Counted by the page's beacon with its kind: shown, a link in it followed, closed (`drop` deletes the note).
 */
export function showContext(doc: Document, appRef: ApplicationRef, env: EnvironmentInjector, note: ClickNote, drop: () => void): void {
  const root = doc.querySelector('pt-page');
  if (!root || doc.querySelector('pt-click-box, pt-alert-event')) return;
  const host = doc.createElement('pt-click-box');
  host.setAttribute('data-island', ISLAND);
  root.before(host);
  const ref = createComponent(PtClickBox, { environmentInjector: env, hostElement: host });
  ref.setInput('note', note);
  appRef.attachView(ref.hostView);
  ref.changeDetectorRef.detectChanges();
  // a company named in the box leaves no note of its own: the box is about the click before (and importing the context from its
  // package keeps this chunk on main's Angular: importing it otherwise split Angular out of main, one more script before every page)
  host.addEventListener(CTX_ASK, (e) => { (e as CustomEvent<CtxAsk>).detail.data = null; e.stopPropagation(); });
  count(host, `show-${note.kind}`);
  host.addEventListener('click', (e) => { if ((e.target as Element).closest('a[href]')) count(host, `go-${note.kind}`); });
  ref.instance.closed.subscribe(() => {
    count(host, `close-${note.kind}`);
    drop();
    appRef.detachView(ref.hostView);
    ref.destroy();
    host.remove();
  });
}

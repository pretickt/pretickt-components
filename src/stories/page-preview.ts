/**
 * A page as the generator will publish it, assembled in the stories app from the components, to look at before anything ships
 * (Romeo, 2026-10-31: "in modo che veda tutto prima di pubblicare"). Its parts mirror pretickt-platform's plant/src/generate:
 * pages.ts (the sections and their placements), layout.ts (crumbs, h1, lede, the sub-navigation) and seo.ts (title, description,
 * JSON-LD). Above the page, what search engines and AI answers read first: the address, the title, the description and the JSON-LD,
 * with the FAQPage read from the questions the page shows, as the build will read them (`readFaq`, renderPage). Sections marked new
 * are not on www yet. Stories only: no page ships this.
 */
import { NgComponentOutlet } from '@angular/common';
import { afterNextRender, ApplicationRef, Component, computed, DestroyRef, ElementRef, EnvironmentInjector, inject, Injector, input, reflectComponentType, signal, type Type } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { date, plainName, withoutSuffixes } from '@pretickt/components/format';
import { alertSourceOf } from '../alerts/sources';
import { ICON_PATHS } from '../ds/icons';
import { faqLd, readFaq, type FaqPair } from '../site/faq';
import { bellOf } from '../site/alerts/attach';
import { openEditor } from '../site/alerts/editor';
import { PtAlertEvent, type AlertEventPayload } from '../../components/drafts/pt-alert-event';

export interface PreviewItem { c: Type<unknown>; inputs?: Record<string, unknown> }
export interface PreviewSection {
  id: string; title?: string; more?: { href: string; label: string }; items: PreviewItem[]; strip?: boolean;
  /** Not on www yet; `note` says what is still made up. */
  isNew?: boolean; note?: string;
}
/**
 * `{date}` anywhere in the text: the date of www's last build (the page's data), as the generator writes `date(asOf)`. The description is
 * clipped once the date is in, as the generator clips it.
 */
export interface PreviewPage {
  path: string; title: string; description: string; h1: string; lede: string;
  crumbs?: { label: string; href?: string }[];
  nav?: { href: string; label: string; isNew?: boolean }[];
  /** The generator's own markup before and after the page app (trusted, static): explanations, questions it answers itself. */
  intro?: string; outro?: string;
  sections: PreviewSection[];
  /** The home: the site's WebSite and Organization JSON-LD. */
  site?: boolean;
  /** A page with alerts (plan 2): a bell under every placement that has a badge, the editor on a press (the story's made-up backend). */
  alerts?: true;
  /** The alert an email opened (`?alert=`): its card on top (the pt-alert-event draft). */
  alertEvent?: AlertEventPayload;
}

export const BASE = 'https://www.pretickt.com';
const BRAND = ' | pretickt';

/** seo.ts `fitTitle`: the first candidate within 60 characters, with " | pretickt" when that still fits. */
export function fitTitle(...candidates: string[]): string {
  for (const c of candidates) {
    if (c.length + BRAND.length <= 60) return c + BRAND;
    if (c.length <= 60) return c;
  }
  return candidates.at(-1)!.slice(0, 60);
}
/** seo.ts `clip`: within 155 characters, cut at a word with an ellipsis. */
export function clip(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1), at = cut.lastIndexOf(' ');
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:·—-]+$/, '')}…`;
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

@Component({
  selector: 'pt-page-preview',
  imports: [NgComponentOutlet, PtAlertEvent],
  template: `
    @let p = view();
    <div class="pv">
      <aside class="pv-head" aria-label="What search engines read first">
        <p class="pv-h">What search engines and AI answers read first</p>
        <dl class="pv-meta">
          <dt>Address</dt><dd><code>{{ base }}{{ p.path }}</code></dd>
          <dt>Title · {{ p.title.length }} characters</dt><dd class="pv-title">{{ p.title }}</dd>
          <dt>Description · {{ p.description.length }} characters</dt><dd>{{ p.description }}</dd>
          <dt>h1</dt><dd>{{ p.h1 }}</dd>
        </dl>
        <p class="pv-h">JSON-LD · {{ faq().length }} {{ faq().length === 1 ? 'question' : 'questions' }} answered on the page, read from what it shows</p>
        @if (repeated().length) {<p class="pv-warn">Answered twice on this page (only the first answer is kept): {{ repeated().join(' · ') }}</p>}
        @for (b of ld(); track $index) {<pre class="pv-ld">{{ b }}</pre>}
      </aside>
      <div class="pv-page pt-page">
        <main class="pt-main">
          @if (p.crumbs?.length) {
            <nav class="pt-crumbs" aria-label="Breadcrumb"><ol>
              @for (c of p.crumbs; track $index) {<li>@if (c.href) {<a [href]="c.href">{{ c.label }}</a>} @else {<span aria-current="page">{{ c.label }}</span>}</li>}
            </ol></nav>
          }
          <h1 class="pt-h1">{{ p.h1 }}</h1>
          <p class="pt-lede">{{ p.lede }}</p>
          @if (p.nav?.length) {
            <nav class="pt-subnav">@for (l of p.nav; track l.href) {<a [href]="l.href" [attr.aria-current]="l.href === p.path ? 'page' : null" [class.pv-new-link]="l.isNew">{{ l.label }}</a>}</nav>
          }
          @if (p.alertEvent; as ev) {<pt-alert-event [event]="ev" />}
          @if (p.intro) {<div [innerHTML]="trusted(p.intro)"></div>}
          @for (s of p.sections; track s.id) {
            <section class="pt-section" [id]="s.id" [class.pv-new]="s.isNew" [class.pt-strip]="s.strip">
              @if (s.isNew) {<p class="pv-badge">New on this page{{ s.note ? ' · ' + s.note : '' }}</p>}
              @if (s.more; as more) {
                <div class="pt-section-head">
                  @if (s.title) {<h2 class="pt-section-title">{{ s.title }}</h2>}
                  <a class="pt-section-more" [href]="more.href">{{ more.label }} →</a>
                </div>
              } @else if (s.title) {<h2 class="pt-section-title">{{ s.title }}</h2>}
              @if (s.strip) {
                <div class="pt-strip-row" tabindex="0" role="group" [attr.aria-label]="s.title ?? null">
                  @for (it of s.items; track $index) {<div class="pt-island" [attr.data-island]="tagOf(it) + '@preview'"><ng-container [ngComponentOutlet]="it.c" [ngComponentOutletInputs]="it.inputs ?? {}" />@if (p.alerts && bell(it); as a) {<div class="pt-island-foot"><button type="button" class="pt-alert-bell" [attr.data-alert]="a" aria-haspopup="dialog" aria-label="Create an alert"><svg class="pt-icon" viewBox="0 0 16 16" aria-hidden="true"><path [attr.d]="BELL" /></svg>Alert</button></div>}</div>}
                </div>
              } @else {
                @for (it of s.items; track $index) {<div class="pt-island" [attr.data-island]="tagOf(it) + '@preview'"><ng-container [ngComponentOutlet]="it.c" [ngComponentOutletInputs]="it.inputs ?? {}" />@if (p.alerts && bell(it); as a) {<div class="pt-island-foot"><button type="button" class="pt-alert-bell" [attr.data-alert]="a" aria-haspopup="dialog" aria-label="Create an alert"><svg class="pt-icon" viewBox="0 0 16 16" aria-hidden="true"><path [attr.d]="BELL" /></svg>Alert</button></div>}</div>}
              }
            </section>
          }
          @if (p.outro) {<div [innerHTML]="trusted(p.outro)"></div>}
        </main>
      </div>
    </div>`,
})
export class PtPagePreview {
  readonly page = input.required<PreviewPage>();
  protected readonly base = BASE;
  private readonly asOf = signal<string | null>(null);
  protected readonly faq = signal<FaqPair[]>([]);
  protected readonly repeated = signal<string[]>([]);
  private readonly san = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The page with `{date}` filled in. */
  protected readonly view = computed(() => {
    const p = this.page(), d = this.asOf() ? date(this.asOf()!) : '—', fill = (s: string) => s.replaceAll('{date}', d);
    return { ...p, title: fill(p.title), description: clip(fill(p.description)), h1: fill(p.h1), lede: fill(p.lede) };
  });
  /** The JSON-LD the layout writes: the site on the home, the breadcrumbs, and the FAQPage of the questions the page answers. */
  protected readonly ld = computed(() => {
    const p = this.view();
    const crumbs = p.crumbs?.length ? { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: p.crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: `${BASE}${c.href ?? p.path}` })) } : null;
    const site = p.site ? { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'pretickt', url: `${BASE}/` },
      { '@type': 'Organization', name: 'pretickt', url: `${BASE}/`, logo: `${BASE}/favicon.svg` }] } : null;
    return [site, crumbs, faqLd(this.faq())].filter((x) => x !== null).map(json);
  });
  protected readonly trusted = (html: string): SafeHtml => this.san.bypassSecurityTrustHtml(html);
  protected readonly BELL = ICON_PATHS['bell'];
  /** A placement's tag (its component's selector) and the badge its bell adds, as renderPage computes them on the site. */
  protected tagOf(it: PreviewItem): string { return reflectComponentType(it.c)?.selector ?? ''; }
  protected bell(it: PreviewItem): string | null {
    const src = alertSourceOf(this.tagOf(it), it.inputs ?? {});
    return src ? JSON.stringify(src) : null;
  }

  constructor() {
    // a bell's press opens the editor on the story's made-up backend (the story's providers, through this injector)
    const appRef = inject(ApplicationRef), env = inject(EnvironmentInjector), near = inject(Injector);
    afterNextRender(() => {
      this.host.nativeElement.addEventListener('click', (e) => {
        const btn = (e.target as Element | null)?.closest?.('[data-alert]');
        const b = btn ? bellOf(btn, document) : null;
        if (b) openEditor(appRef, env, b.src, b.from, near);
      });
    });
    fetch('/build.json').then((r) => (r.ok ? r.json() as Promise<{ asOf: string }> : Promise.reject(new Error(String(r.status)))))
      .then((b) => this.asOf.set(b.asOf), () => this.asOf.set(new Date().toISOString().slice(0, 10)));
    // the page fills in as each component's answers arrive: read its questions again whenever it changes
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const root = this.host.nativeElement.querySelector('.pv-page') ?? this.host.nativeElement;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const read = () => { const r = readFaq(root); this.faq.set(r.pairs); this.repeated.set(r.repeated); };
      const watch = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(read, 250); });
      watch.observe(root, { subtree: true, childList: true, characterData: true });
      read();
      destroy.onDestroy(() => { watch.disconnect(); clearTimeout(timer); });
    });
  }
}

/** Every company's name as the site prints it today and with the common names (`plainName`), from www's search list. */
@Component({
  selector: 'pt-preview-names',
  template: `
    @let r = rows();
    @if (r === null) {<p class="pt-meta">Reading the list of companies from www…</p>}
    @else if (r.length === 0) {<p class="pt-na">Data not available</p>}
    @else {
      <p class="pt-lede">{{ changed().length }} of {{ r.length }} companies get a new name. Today the company page's h1 prints the provider's
        name, the title and the sentences its name without the legal suffix; with the common names every page, title and sentence prints the
        last column.</p>
      <label class="pv-toggle"><input type="checkbox" [checked]="only()" (change)="only.set(!only())"> only the names that change</label>
      <table class="pv-names">
        <thead><tr><th>Ticker</th><th>The provider's name (h1 today)</th><th>Without suffix (title today)</th><th>Common name</th></tr></thead>
        <tbody>
          @for (x of shown(); track x.ticker) {<tr [class.pv-changed]="x.common !== x.short"><td>{{ x.ticker }}</td><td>{{ x.legal }}</td><td>{{ x.short }}</td><td><b>{{ x.common }}</b></td></tr>}
        </tbody>
      </table>
    }`,
})
export class PtPreviewNames {
  protected readonly rows = signal<{ ticker: string; legal: string; short: string; common: string }[] | null>(null);
  protected readonly only = signal(true);
  protected readonly changed = computed(() => (this.rows() ?? []).filter((x) => x.common !== x.short));
  protected readonly shown = computed(() => (this.only() ? this.changed() : this.rows() ?? []));
  constructor() {
    fetch('/search.json').then((r) => (r.ok ? r.json() as Promise<{ rows: [string, string][] }> : Promise.reject(new Error(String(r.status)))))
      .then((d) => this.rows.set(d.rows.map(([ticker, legal]) => ({ ticker, legal, short: withoutSuffixes(legal), common: plainName(legal) }))),
        () => this.rows.set([]));
  }
}

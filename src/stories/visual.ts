/**
 * The stories page (browserbot's VisualComponent): `/` lists the components that have stories, `/visual/<tag>` shows each of its
 * scenarios under its name, `/visual/<tag>/<n>` one alone — what the phone frames load. `?phone` shows the scenarios in frames
 * 390 px wide, so the phone media queries apply. Plain links, no router: a dev page can reload.
 */
import { afterNextRender, Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { REGISTRY } from '../site/registry.generated';
import { attachTips } from '../site/tips';
import { stories as experiments } from './experiments';
import { STORIES } from './index';
import { PtStory, type StoryConfiguration } from './story';

export const PHONE = 390;

export interface Route { tag: string | null; n: number | null; phone: boolean }
export function routeOf(path: string, search: string): Route {
  const m = /^\/visual\/([a-z0-9-]+)(?:\/(\d+))?\/?$/.exec(path);
  return { tag: m?.[1] ?? null, n: m?.[2] === undefined ? null : Number(m[2]), phone: new URLSearchParams(search).has('phone') };
}

/** The index: groups in the order they first appear, each component with its version, how many scenarios and their names. */
export function indexOf(all: StoryConfiguration[]) {
  const groups = new Map<string, Map<string, StoryConfiguration[]>>();
  for (const s of all) {
    const g = groups.get(s.group ?? 'Components') ?? new Map<string, StoryConfiguration[]>();
    groups.set(s.group ?? 'Components', g.set(s.tag, [...(g.get(s.tag) ?? []), s]));
  }
  return [...groups].map(([name, tags]) => ({ name, tags: [...tags].map(([tag, list]) => ({
    tag, version: REGISTRY[tag]?.version ?? null, count: list.length, names: list.map((s, i) => s.name ?? `Story ${i + 1}`).join(' · ') })) }));
}

@Component({
  selector: 'pt-visual',
  imports: [PtStory],
  template: `
    @let r = route;
    @if (r.tag && r.n !== null) {
      @if (list()[r.n]; as s) {<pt-story [configuration]="s" />}
      @else {<p class="pt-na">No story {{ r.n }} for {{ r.tag }}</p>}
    } @else if (r.tag) {
      <nav class="sb-bar">
        <a href="/">Stories</a><span aria-hidden="true">/</span><b>{{ r.tag }}</b>
        @if (version(); as v) {<span class="pt-meta">{{ v }}</span>}
        <span class="sb-grow"></span>
        <a [href]="'/visual/' + r.tag" [class.sb-on]="!r.phone">Wide</a>
        <a [href]="'/visual/' + r.tag + '?phone'" [class.sb-on]="r.phone">Phone {{ PHONE }}</a>
      </nav>
      @for (s of list(); track $index) {
        <section class="pt-section sb-story">
          <h2 class="sb-name"><a [href]="'/visual/' + r.tag + '/' + $index">{{ s.name ?? 'Story ' + ($index + 1) }}</a>
            @if (s.live) {<span class="sb-live">live</span>}</h2>
          @if (r.phone) {<iframe class="sb-frame" [src]="frames()[$index]" [width]="PHONE" [title]="s.name ?? r.tag" (load)="fit($event)"></iframe>}
          @else {<div class="pt-island"><pt-story [configuration]="s" /></div>}
        </section>
      } @empty {<p class="pt-na">No stories for {{ r.tag }}</p>}
    } @else {
      <h1 class="pt-h1">Stories</h1>
      <p class="pt-lede">Every component in the scenarios a reader can meet: demo data, fixed answers for the edge cases, and live
        stories with www's real data.</p>
      @for (g of index; track g.name) {
        <section class="pt-section">
          <h2 class="pt-section-title">{{ g.name }}</h2>
          <ul class="sb-index">
            @for (c of g.tags; track c.tag) {
              <li><a [href]="'/visual/' + c.tag">{{ c.tag }}</a>
                <span class="pt-meta">@if (c.version) { {{ c.version }} · }{{ c.count }} scenarios</span>
                <span class="sb-names">{{ c.names }}</span></li>
            }
          </ul>
        </section>
      }
    }`,
})
export class PtVisual {
  protected readonly PHONE = PHONE;
  protected readonly route = routeOf(location.pathname, location.search);
  private readonly all = [...STORIES, ...experiments];
  protected readonly index = indexOf(this.all);
  protected readonly list = computed(() => this.all.filter((s) => s.tag === this.route.tag));
  protected readonly version = computed(() => (this.route.tag ? REGISTRY[this.route.tag]?.version ?? null : null));
  // made once: a new SafeResourceUrl on every check would reload the frame
  private readonly san = inject(DomSanitizer);
  protected readonly frames = computed(() => this.list().map((_, i) => this.san.bypassSecurityTrustResourceUrl(`/visual/${this.route.tag}/${i}`)));

  constructor() {
    // a story in a phone frame never scrolls: the frame grows to it (fit), and a scrollbar would change the width it is shown at
    if (this.route.n !== null && window.parent !== window) document.documentElement.style.overflow = 'hidden';
    afterNextRender(() => { const main = document.querySelector('main'); if (main) attachTips(main); });
  }

  /**
   * A phone frame as tall as its story, as the story grows (data arriving, a strip opening). It measures the frame's `main`: the
   * page around it is at least as tall as the frame (`min-h-screen`), so measuring the page would chase its own change.
   */
  protected fit(e: Event) {
    const f = e.target as HTMLIFrameElement;
    const main = f.contentDocument?.querySelector('main');
    if (!main) return;
    new ResizeObserver(() => requestAnimationFrame(() => { f.style.height = `${Math.ceil(main.getBoundingClientRect().height)}px`; })).observe(main);
  }
}

/**
 * Stories: each component in the scenarios a reader can meet, side by side on a page of their own (`npm run stories` →
 * http://localhost:4300/visual/<tag>). Ported from browserbot's `story()` (browserbot-frontend/src/shared/story.component.ts):
 * `story(Component, inputs | options)` describes one scenario and `<pt-story>` mounts it. A pretickt component asks `Pt` for its
 * data instead of taking it as inputs, so a scenario also says what its calls answer: the typology's demo by default, its own
 * answers (`data`), or www's API (`live`, the last build's real data).
 *
 * A component file never imports this (the lint allows only the platform's entries, and no page ships it): its stories live
 * beside it in `components/pt-x.stories.ts`, exported as `stories` and listed in `src/stories/index.ts` — the package declares
 * `sideEffects: false`, so a module imported only for what it registers would be dropped from the bundle.
 */
import { ChangeDetectionStrategy, Component, ElementRef, inject, Injector, input, reflectComponentType, ViewChild, ViewContainerRef,
  type ComponentRef, type OnInit, type Provider, type Type } from '@angular/core';
import { needPath, type TypologyId } from '@pretickt/components/api';
import { Pt, PT_LIVE, PT_PICKS, PT_STORE, PtLive, PtPicks, PtStore, validateParams, type LiveBars, type LiveDay, type LiveSource,
  type PickStore } from '@pretickt/components/context';
import { demoFor } from '../typologies';

export interface StoryOptions<T> {
  /** The scenario in a few words: the heading over it. */
  name?: string;
  /** The component's inputs; a function is called for its value (as in browserbot). */
  inputs?: Partial<Record<keyof T, unknown>>;
  /**
   * Answers by typology id (`'analysts@1'`): a payload, `null` (not available) or a function of the call's params (a component
   * that asks again — a toggle, a month — gets its own answer). The calls it does not name get the base: the typology's demo, or
   * www with `live`. `data: null` answers every call with null.
   */
  data?: Record<string, unknown> | null;
  /** The base is www's API, through the dev server's proxy. Real data stays there: fixtures are made up (this repo is public). */
  live?: boolean;
  /** The reader's picks already in this browser (a "Your call" made on an earlier visit). */
  picks?: Record<string, string>;
  /** More providers for the component: today's delayed prices (`liveDay`). */
  providers?: Provider[];
  /** Classes added to the component's element. */
  classes?: string[];
  /** Called with what an output emits (every output is logged anyway). */
  outputs?: Partial<Record<keyof T, (value: unknown) => void>>;
  /** Called a second after mounting to play an interaction: `refresh` renders again, `el` is the component's element. */
  run?: (refresh: () => void, el: HTMLElement) => void;
  /** The heading this component is listed under on the index (default "Components"). */
  group?: string;
}
export interface StoryConfiguration<T = any> extends StoryOptions<T> {
  component: Type<T>;
  /** The component's tag (its selector): the stories page's address, `/visual/<tag>`. */
  tag: string;
}

const OPTIONS = new Set(['name', 'inputs', 'data', 'live', 'picks', 'providers', 'classes', 'outputs', 'run', 'group']);

/** One scenario: `story(PtNews, { ticker: 'NVDA' })` (inputs only, as in browserbot) or `story(PtNews, { name, inputs, data, … })`. */
export function story<T extends object>(component: Type<T>, config: Partial<Record<keyof T, unknown>> | StoryOptions<T> = {},
  outputs?: StoryOptions<T>['outputs'], run?: StoryOptions<T>['run']): StoryConfiguration<T> {
  const o = Object.keys(config).some((k) => OPTIONS.has(k)) ? (config as StoryOptions<T>) : { inputs: config as StoryOptions<T>['inputs'] };
  const tag = reflectComponentType(component)?.selector;
  if (!tag) throw new Error(`${component.name} is not a component`);
  return { outputs, run, ...o, component, tag };
}

/** A scenario preset of the admin bench (an experiment's `pt-*.scenarios.json`). */
export interface BenchScenario { name: string; props?: Record<string, unknown>; base?: 'demo' | 'live'; overrides?: Record<string, unknown>; picks?: Record<string, string> }

/** The bench presets of an experiment as stories: `base: 'live'` is www, `overrides` its own answers. */
export const scenarioStories = <T extends object>(component: Type<T>, group: string, list: BenchScenario[]): StoryConfiguration<T>[] =>
  list.map((s) => story(component, { name: s.name, group, inputs: s.props as StoryOptions<T>['inputs'], live: s.base === 'live', data: s.overrides, picks: s.picks }));

let build: Promise<string> | undefined;
/** www's answer to one call: the dev server proxies `/v1` and `/build.json` to www.pretickt.com, which sends no CORS headers. */
async function fromWww(t: string, params: unknown): Promise<unknown> {
  build ??= fetch('/build.json').then((r) => (r.ok ? r.json() as Promise<{ buildId: string }> : Promise.reject(new Error(`build.json ${r.status}`))))
    .then((b) => b.buildId, (e: unknown) => { build = undefined; throw e; });
  const r = await fetch(needPath({ t: t as TypologyId, params }, await build));
  if (!r.ok) throw new Error(`www ${t} ${r.status}`);
  return r.json();
}

/** How a story's calls are answered: its own answers first, then null, www or the demo. */
export function answerer(s: Pick<StoryOptions<unknown>, 'data' | 'live'>) {
  return async (t: string, params: unknown): Promise<unknown> => {
    if (s.data === null) return null;
    if (s.data && Object.hasOwn(s.data, t)) {
      const a = s.data[t];
      return typeof a === 'function' ? (a as (p: unknown) => unknown)(params) : a;
    }
    return s.live ? fromWww(t, params) : demoFor({ t, params });
  };
}

/** A typology's demo for these params, to build a fixture on: `{ ...demo<Analysts>('analysts@1', { ticker: 'NVDA' }), targets: [] }`. */
export const demo = <P>(t: string, params: unknown): P => demoFor({ t, params }) as P;

/** Picks kept in memory (the site keeps them in localStorage), one store per story so scenarios never share a pick. */
function memoryPicks(initial: Record<string, string> = {}): PickStore {
  const all = { ...initial };
  return { read: () => ({ ...all }), write: (k, v) => { if (v === null) delete all[k]; else all[k] = v; } };
}

/** What the page app provides on the site, for one story: its own data store (recording what it answers), picks, today's prices. */
export function storyProviders(s: StoryOptions<unknown>, record: Record<string, unknown> = {}): Provider[] {
  return [
    { provide: PT_STORE, useValue: new PtStore({ server: false, resolve: answerer(s), validate: validateParams, record }) }, Pt,
    { provide: PT_PICKS, useValue: memoryPicks(s.picks) }, PtPicks,
    PtLive, ...(s.providers ?? []),
  ];
}

/** Today's intraday file as the page app gives it (PtLive), for `providers: liveDay({ q: { NVDA: … } })`. */
export const liveDay = (d: Partial<LiveDay> = {}, lines?: { bars: () => LiveBars | null; poll?: LiveSource['poll'] }): Provider[] => [{ provide: PT_LIVE, useValue: { load: async () => ({
  session: '2026-10-01', prev: '2026-09-30', asOf: '2026-10-01T15:30:00.000Z', time: '11:30 AM ET', delayMin: 15, closed: false,
  q: {}, news: {}, earnings: {}, ...d }), ...(lines ? { bars: async () => lines.bars(), poll: lines.poll ?? { everyMs: 3_600_000, anyTime: false } } : {}) } satisfies LiveSource }];

const mounted = new WeakMap<Element, PtStory>();

/** One story mounted (browserbot's `<story>`): its component, created with the story's inputs in an injector of its own. */
@Component({
  selector: 'pt-story',
  template: '<ng-container #vcr />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PtStory implements OnInit {
  readonly configuration = input.required<StoryConfiguration>();
  @ViewChild('vcr', { static: true, read: ViewContainerRef }) private readonly vcr!: ViewContainerRef;
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Every answer the component got, by need key: what `storyOf` copies. */
  readonly record: Record<string, unknown> = {};
  ref?: ComponentRef<object>;

  ngOnInit() {
    const s = this.configuration();
    const injector = Injector.create({ parent: this.injector, providers: storyProviders(s, this.record) });
    const ref = this.ref = this.vcr.createComponent<object>(s.component, { injector });
    for (const [k, v] of Object.entries(s.inputs ?? {})) ref.setInput(k, typeof v === 'function' ? (v as () => unknown)() : v);
    const handlers = (s.outputs ?? {}) as Record<string, ((v: unknown) => void) | undefined>;
    for (const o of reflectComponentType(s.component)!.outputs) {
      const out = (ref.instance as Record<string, { subscribe?: (fn: (v: unknown) => void) => unknown } | undefined>)[o.propName];
      out?.subscribe?.((v) => {
        console.log(`${s.tag} (${o.templateName})`, v);
        handlers[o.propName]?.call(ref.instance, v);
        ref.changeDetectorRef.markForCheck();
      });
    }
    const el = ref.location.nativeElement as HTMLElement;
    if (s.classes?.length) el.classList.add(...s.classes);
    // what the page counts as interactions (analytics), logged instead of sent
    this.host.nativeElement.addEventListener('pt-interact', (e) => console.log(`${s.tag} pt-interact`, (e as CustomEvent).detail));
    if (s.run) setTimeout(() => s.run!(() => ref.changeDetectorRef.detectChanges(), el), 1000);
    mounted.set(this.host.nativeElement, this);
  }
}

/** `pt-price-target` → `PtPriceTarget` (a component's class is its tag in PascalCase). */
const classOf = (tag: string) => tag.replace(/(?:^|-)(\w)/g, (_, c: string) => c.toUpperCase());

/**
 * What a mounted story shows now, as code for its stories file (browserbot's `copyStory`): the inputs it has and the answers it
 * got, the latest per typology. In the browser console, with an element of the story selected: `copy(storyOf($0))`. A live story
 * copied this way holds real data: keep it out of this public repo, or make the numbers up before committing.
 */
export function storyOf(el: Element): string {
  const host = el.closest('pt-story');
  const st = host ? mounted.get(host) : undefined;
  if (!st?.ref) throw new Error('not inside a story');
  const s = st.configuration();
  const instance = st.ref.instance as Record<string, unknown>;
  const inputs = Object.fromEntries(reflectComponentType(s.component)!.inputs
    .map((i) => [i.propName, typeof instance[i.propName] === 'function' ? (instance[i.propName] as () => unknown)() : instance[i.propName]])
    .filter(([, v]) => v !== undefined));
  const data: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(st.record)) data[key.slice(0, key.indexOf('|'))] = v;
  return `story(${classOf(s.tag)}, ${JSON.stringify({ name: s.name, inputs, data }, null, 2)})`;
}

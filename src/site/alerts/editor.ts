import { type ApplicationRef, Component, computed, createComponent, effect, type ComponentRef, type EnvironmentInjector, inject, type Injector, signal } from '@angular/core';
import { Pt, PtLive } from '@pretickt/components/context';
import { PtAlerts } from '../../alerts/service';
import type { AlertFrom, SaveResult } from '../../alerts/token';
import { dayMonth } from '@pretickt/components/format';
import { CONDITION_IDS, CONDITIONS, GROUPS, type ConditionId, type Group } from '../../alerts/catalog';
import type { ChartData } from '../../alerts/charts';
import { GLYPHS } from '../../alerts/glyphs';
import { condition, exampleOf, nameOf, passCount, ruleProblem, type Rule } from '../../alerts/rule';
import { rowsOf } from '../../alerts/rows';
import type { AlertSource } from '../../alerts/sources';
import { bellOf } from './attach';
import { PtAlertCard } from './card';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PROBLEM: Record<string, string> = {
  'universe-only': 'Add a condition beyond the universe: a move, a level, news…',
  'too-many': 'Six conditions at most',
};
const FAILED: Record<'invalid' | 'limit' | 'network', string> = {
  invalid: 'This alert cannot be saved: check its values',
  limit: 'You have 10 alerts already: pause or delete one first',
  network: 'Could not save — try again',
};

/**
 * The alert editor (Romeo, 2026-11-01; mockups `editor-desktop.png`, `editor-telefono.png`): every badge by group on the left —
 * a click, or a drag onto the rule, opens it into its card (version A) — the cards joined by "and", the name, when the email
 * comes, the email and the weekly email's own box, Save. A dialog of the page app, mounted on the first bell press (its own chunk).
 */
@Component({
  selector: 'pt-alert-editor',
  imports: [PtAlertCard],
  providers: [Pt],
  host: { '(keydown.escape)': 'close()' },
  template: `
    @if (alerts.opened()) {
      <div class="pt-al-backdrop" (click)="close()"></div>
      <div class="pt-al-editor" role="dialog" aria-modal="true" aria-labelledby="pt-al-h">
        <header class="pt-al-ed-h">
          <h2 id="pt-al-h">{{ editing() ? 'Edit your alert' : 'Create an alert' }}</h2>
          <button type="button" class="pt-al-x" aria-label="Close" (click)="close()">×</button>
        </header>
        @if (saved(); as to) {
          <div class="pt-al-done">
            <p>@if (to) {Check your inbox to confirm: we sent a link to <b>{{ to }}</b>.} @else {Your alert is saved.}</p>
            <p class="pt-al-when">You will get an email when a stock starts meeting all of its conditions, at most once a day per stock.</p>
            <button type="button" class="pt-al-save" (click)="close()">Done</button>
          </div>
        } @else {
          <div class="pt-al-ed">
            <div class="pt-al-palette" role="group" aria-label="Conditions">
              @for (g of GROUPS; track g[0]) {
                <div class="pt-al-group" [attr.data-group]="g[0]">
                  <p class="pt-al-group-t">{{ g[1] }}</p>
                  <div class="pt-al-badges">
                    @for (id of idsOf(g[0]); track id) {
                      <button type="button" class="pt-al-badge" [class.pt-al-badge-used]="used().has(id)" draggable="true"
                        (dragstart)="drag($event, id)" (click)="pick(id)">
                        <svg viewBox="0 0 22 14" aria-hidden="true">
                          @for (gp of GLYPHS[id]; track $index) {
                            <path [attr.d]="gp.d" [class.pt-al-g-fill]="gp.fill" [class.pt-al-g-dash]="gp.dash" [class.pt-al-g-faint]="gp.faint" [class.pt-al-g-thick]="gp.thick" />
                          }
                        </svg>
                        {{ nameOfId(id) }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
            <section class="pt-al-rule" (dragover)="$event.preventDefault()" (drop)="drop($event)">
              <p class="pt-al-rule-t">Alert me when <u>all</u> of these happen
                @if (session(); as s) {<span class="pt-al-last">{{ s }}</span>}</p>
              @for (rc of rule().all; track $index; let i = $index) {
                @if (i) {<p class="pt-al-and">and</p>}
                <pt-alert-card [rc]="rc" [data]="data()" [count]="count(i)" [ofLabel]="ofLabel()"
                  (change)="alerts.setParam(i, $event.key, $event.value)" (remove)="alerts.remove(i)" />
              } @empty {<p class="pt-al-empty">Tap a badge to add a condition</p>}
              @if (problem(); as p) {<p class="pt-al-hint">{{ p }}</p>}
            </section>
          </div>
          <footer class="pt-al-foot">
            <input class="pt-al-name" aria-label="Name of the alert" [value]="alerts.draft()?.name ?? ''" [placeholder]="nameOf(rule())"
              (input)="alerts.rename(text($event))" />
            <p class="pt-al-when">Email me when a stock starts meeting all of these · at most once a day per stock</p>
            @if (!editing()) {
              <input class="pt-al-email" type="email" autocomplete="email" placeholder="you@example.com" aria-label="Your email"
                [value]="email()" (input)="email.set(text($event))" />
              <label class="pt-al-weekly"><input type="checkbox" [checked]="weekly()" (change)="weekly.set(ticked($event))" />
                Also send me pretickt's weekly email</label>
            }
            @if (failed(); as f) {<p class="pt-al-error" role="alert">{{ f }}</p>}
            <button type="button" class="pt-al-save" [disabled]="!canSave()" (click)="save()">{{ alerts.saving() ? 'Saving…' : 'Save alert' }}</button>
          </footer>
        }
      </div>
    }`,
})
export class PtAlertEditor {
  protected readonly alerts = inject(PtAlerts);
  private readonly pt = inject(Pt);
  private readonly live = inject(PtLive);
  protected readonly GROUPS = GROUPS;
  protected readonly GLYPHS = GLYPHS;
  protected readonly nameOf = nameOf;
  protected readonly email = signal('');
  protected readonly weekly = signal(false);
  /** the address a confirmation went to ('' after an edit); null while editing */
  protected readonly saved = signal<string | null>(null);
  protected readonly failed = signal<string | null>(null);

  private readonly liveDay = this.live.after(() => this.alerts.universe()?.asOf);
  private readonly rows = computed(() => {
    const u = this.alerts.universe();
    return u ? rowsOf(u, this.liveDay()) : [];
  });
  protected readonly rule = computed<Rule>(() => this.alerts.draft()?.rule ?? { v: 1, all: [] });
  protected readonly editing = computed(() => !!this.alerts.draft()?.editing);
  protected readonly used = computed(() => new Set(this.rule().all.map((rc) => rc.c)));
  private readonly example = computed(() => exampleOf(this.rule(), this.rows(), this.alerts.draft()?.prefer));
  private readonly bars = signal<{ t: string; b: number[] | null } | null>(null);
  private readonly closes = this.pt.priceSeries(() => {
    const ex = this.example();
    const long = this.rule().all.some((rc) => rc.c === 'below-average' && String(rc.p['days']) === '200');
    return ex ? { tickers: [ex.ticker], range: long ? '2y' : '1y', interval: '1d', rebase: false } : null;
  });
  protected readonly data = computed<ChartData>(() => {
    const ex = this.example(), b = this.bars(), series = this.closes.value();
    return { row: ex, rows: this.rows(), bars: ex && b?.t === ex.ticker ? b.b : null,
      closes: series?.[0]?.points.map((p) => ({ t: p.t, c: p.c })) ?? null };
  });
  protected readonly ofLabel = computed(() => (this.rule().all.some((rc) => rc.c === 'mega-caps') ? 'mega caps' : 'stocks'));
  protected readonly problem = computed(() => {
    const p = ruleProblem(this.rule());
    return p ? PROBLEM[p] ?? null : null;
  });
  /** "Last session, Oct 30" when today's prices are not newer than the universe's (out of hours, the weekend) */
  protected readonly session = computed(() => {
    const u = this.alerts.universe(), day = this.liveDay();
    if (!u) return null;
    return day ? `Live · ${day.time} · 15-min delayed` : `Last session, ${dayMonth(u.asOf)}`;
  });
  protected readonly canSave = computed(() => !this.alerts.saving() && !ruleProblem(this.rule()) && (this.editing() || EMAIL.test(this.email().trim())));

  constructor() {
    effect(() => {
      const t = this.example()?.ticker;
      if (!t || this.bars()?.t === t) return;
      void this.alerts.bars(t).then((b) => this.bars.set({ t, b }));
    });
    // a price level added before the universe arrived starts near the example's price
    effect(() => {
      const ex = this.example(), def = CONDITIONS['price-crosses'];
      if (!ex || !def.seed) return;
      this.rule().all.forEach((rc, i) => {
        if (rc.c === 'price-crosses' && rc.p['price'] === def.defaults['price']) this.alerts.setParam(i, 'price', def.seed!(ex)['price']!);
      });
    });
  }

  protected idsOf(g: Group): ConditionId[] { return CONDITION_IDS.filter((id) => CONDITIONS[id].group === g); }
  protected nameOfId(id: ConditionId): string { return CONDITIONS[id].name; }
  protected count(i: number): { pass: number; of: number } | null { return this.rows().length ? passCount(this.rule(), i, this.rows()) : null; }
  protected text(e: Event): string { return (e.target as HTMLInputElement).value; }
  protected ticked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }

  protected pick(id: ConditionId): void { this.alerts.addCondition(condition(id, undefined, this.example())); }
  protected drag(e: DragEvent, id: ConditionId): void { e.dataTransfer?.setData('text/plain', id); }
  protected drop(e: DragEvent): void {
    e.preventDefault();
    const id = e.dataTransfer?.getData('text/plain') as ConditionId | undefined;
    if (id && Object.hasOwn(CONDITIONS, id)) this.pick(id);
  }

  protected save(): void {
    this.failed.set(null);
    const to = this.editing() ? '' : this.email().trim();
    void this.alerts.save(to, this.weekly()).then((r: SaveResult) => {
      if (r.ok) this.saved.set(to);
      else this.failed.set(FAILED[r.reason]);
    });
  }

  protected close(): void {
    this.alerts.close();
    this.saved.set(null);
    this.failed.set(null);
  }
}

let mounted: ComponentRef<PtAlertEditor> | null = null;
/**
 * A bell's press: mounts the editor once on the page, then adds the bell's badge to the draft (which opens it). `near`: an injector
 * whose providers the editor should see first (the stories' page previews provide their made-up backend in one).
 */
export function openEditor(appRef: ApplicationRef, env: EnvironmentInjector, src: AlertSource, from: AlertFrom, near?: Injector): void {
  if (!mounted) {
    const host = document.createElement('div');
    document.body.append(host);
    mounted = createComponent(PtAlertEditor, { environmentInjector: env, hostElement: host, ...(near ? { elementInjector: near } : {}) });
    appRef.attachView(mounted.hostView);
  }
  (near ?? env).get(PtAlerts).add(src, from);
}

/** The page's listener hands over a pressed bell: its badge joins the draft and the editor opens. */
export function pressBell(bell: Element, appRef: ApplicationRef, env: EnvironmentInjector): void {
  const b = bellOf(bell, bell.ownerDocument);
  if (b) openEditor(appRef, env, b.src, b.from);
}

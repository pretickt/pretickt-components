import { inject, Injectable, signal } from '@angular/core';
import { CONDITIONS } from './catalog';
import { condition, exampleOf, nameOf, RULE_MAX, sourceConditions, type Rule, type RuleCondition } from './rule';
import { rowsOf } from './rows';
import type { AlertRow, AlertUniverse } from './rows';
import type { AlertSource } from './sources';
import { PT_ALERTS, type AlertDraft, type AlertFrom, type AlertsLanding, type HumanCheck, type ManagedRule, type ManageOp, type ManageState, type SaveResult } from './token';

const NONE: AlertsLanding = { alert: null, token: null, action: null };
const same = (a: RuleCondition, b: RuleCondition) => a.c === b.c && JSON.stringify(a.p) === JSON.stringify(b.p);

/**
 * The alert being built (Romeo, 2026-11-01): every bell on the page adds its badge to the same draft and opens the editor; the
 * draft stays when the editor closes. Saving is one call at a time; a saved draft is cleared. Nothing works without the page's
 * backend: on the server, in the checks and on pages without alerts `enabled` is false and the bells are not drawn.
 */
@Injectable({ providedIn: 'root' })
export class PtAlerts {
  private readonly backend = inject(PT_ALERTS, { optional: true });
  readonly enabled = !!this.backend;
  private readonly draftSig = signal<AlertDraft | null>(null);
  private readonly openedSig = signal(false);
  private readonly savingSig = signal(false);
  private readonly universeSig = signal<AlertUniverse | null | undefined>(undefined);
  private readonly managedSig = signal<ManageState | null>(null);
  readonly draft = this.draftSig.asReadonly();
  readonly opened = this.openedSig.asReadonly();
  readonly saving = this.savingSig.asReadonly();
  /** undefined until asked and answered, null when the page could not get it */
  readonly universe = this.universeSig.asReadonly();
  /** the newest answer of the alerts' page calls, the editor's update included: the manage page shows it */
  readonly managed = this.managedSig.asReadonly();
  private asked = false;
  private inflight: Promise<SaveResult> | null = null;
  /** price levels waiting for the universe to start near the example's price (seeded once, never again) */
  private unseeded: RuleCondition[] = [];

  /** the check a new alert's Save needs first (www: Turnstile); none in the made-up backends */
  get check(): HumanCheck | null { return this.backend?.check ?? null; }

  /** A bell: its badge (and the stock, sector or mega caps it is tied to) joins the draft, which opens. */
  add(src: AlertSource, from: AlertFrom | null, seed?: AlertRow | null): void {
    if (!this.backend) return;
    const d = this.current();
    const more = sourceConditions(src, seed);
    if (!seed) this.unseeded.push(...more.filter((rc) => CONDITIONS[rc.c].seed));
    this.draftSig.set({ ...d, rule: this.append(d.rule, more), prefer: d.prefer ?? src.ticker ?? null, from: d.from ?? from });
    this.open();
    this.seed();
  }

  /** A badge of the editor's palette. */
  addCondition(rc: RuleCondition, seedLater = false): void {
    if (!this.backend) return;
    const d = this.current();
    if (seedLater && CONDITIONS[rc.c].seed) this.unseeded.push(rc);
    this.draftSig.set({ ...d, rule: this.append(d.rule, [rc]) });
    this.seed();
  }

  setParam(i: number, key: string, value: string | number): void {
    this.update((rule) => ({ ...rule, all: rule.all.map((rc, j) => (j === i ? { ...rc, p: { ...rc.p, [key]: value } } : rc)) }));
  }

  remove(i: number): void {
    this.update((rule) => ({ ...rule, all: rule.all.filter((_, j) => j !== i) }));
  }

  /** A condition swapped for another: a universe card edited company by company becomes the reader's portfolio. */
  replace(i: number, rc: RuleCondition): void {
    this.update((rule) => ({ ...rule, all: rule.all.map((x, j) => (j === i ? rc : x)) }));
  }

  rename(name: string): void {
    const d = this.draftSig();
    if (d) this.draftSig.set({ ...d, name });
  }

  open(): void {
    if (!this.backend) return;
    this.openedSig.set(true);
    if (this.asked) return;
    this.asked = true;
    this.backend.universe().then((u) => { this.universeSig.set(u); this.seed(); }, () => this.universeSig.set(null));
  }

  /** Hides the editor; the draft stays for the next bell. */
  close(): void { this.openedSig.set(false); }

  discard(): void {
    this.draftSig.set(null);
    this.openedSig.set(false);
  }

  /** Opens the editor on a saved rule (the manage page's Edit): saving then updates it. */
  edit(r: ManagedRule, token: string): void {
    if (!this.backend) return;
    this.draftSig.set({ rule: r.rule, prefer: null, from: null, name: r.name, editing: { id: r.id, token } });
    this.open();
  }

  /** One call at a time; a second press while the first is on its way gets the same answer. `turnstile`: the human check's token. */
  save(email: string, weekly: boolean, turnstile?: string | null): Promise<SaveResult> {
    if (this.inflight) return this.inflight;
    const d = this.draftSig();
    if (!this.backend || !d) return Promise.resolve({ ok: false, reason: 'invalid' });
    const name = d.name?.trim() || nameOf(d.rule);
    const call: Promise<SaveResult> = d.editing
      ? this.manage(d.editing.token, { op: 'update', id: d.editing.id, name, rule: d.rule })
        .then((s): SaveResult => (s && s !== 'failed' ? { ok: true } : { ok: false, reason: 'network' }))
      : this.backend.save({ email, name, rule: d.rule, from: d.from, weekly, ...(turnstile ? { turnstile } : {}) });
    this.savingSig.set(true);
    this.inflight = call.catch((): SaveResult => ({ ok: false, reason: 'network' })).then((r) => {
      this.savingSig.set(false);
      this.inflight = null;
      if (r.ok) this.draftSig.set(null);
      return r;
    });
    return this.inflight;
  }

  /** The session's 5-minute closes of a stock, for the cards' line (null when the page has none). */
  bars(ticker: string): Promise<number[] | null> {
    return this.backend ? this.backend.bars(ticker).catch(() => null) : Promise.resolve(null);
  }

  /** null: the link no longer works; 'failed': the call did not get through (try again) */
  manage(token: string, op: ManageOp): Promise<ManageState | null | 'failed'> {
    if (!this.backend) return Promise.resolve(null);
    return this.backend.manage(token, op).then((s) => {
      if (s) this.managedSig.set(s);
      return s;
    }, () => 'failed' as const);
  }

  landing(): AlertsLanding {
    return this.backend?.landing() ?? NONE;
  }

  private current(): AlertDraft {
    return this.draftSig() ?? { rule: { v: 1, all: [] }, prefer: null, from: null, name: null, editing: null };
  }

  /** Adds conditions up to RULE_MAX, never one the rule already has with the same values (the same bell pressed again). */
  private append(rule: Rule, more: RuleCondition[]): Rule {
    const all = [...rule.all];
    for (const rc of more) {
      if (all.length >= RULE_MAX) break;
      if (all.some((x) => same(x, rc))) continue;
      all.push(rc);
    }
    return { v: 1, all };
  }

  /** Once the universe is here, each price level added without one starts near the example's price — once: never a value chosen since. */
  private seed(): void {
    const u = this.universeSig(), d = this.draftSig();
    if (!u || !d || !this.unseeded.length) return;
    const ex = exampleOf(d.rule, rowsOf(u, null), d.prefer);
    const waiting = new Set(this.unseeded);
    this.unseeded = [];
    if (!ex) return;
    this.draftSig.set({ ...d, rule: { v: 1, all: d.rule.all.map((rc) => (waiting.has(rc) ? condition(rc.c, { ...rc.p, ...CONDITIONS[rc.c].seed!(ex) }) : rc)) } });
  }

  private update(f: (r: Rule) => Rule): void {
    const d = this.draftSig();
    if (d) this.draftSig.set({ ...d, rule: f(d.rule) });
  }
}

import { inject, Injectable, signal } from '@angular/core';
import { CONDITIONS } from './catalog';
import { nameOf, RULE_MAX, sourceConditions, type Rule, type RuleCondition } from './rule';
import type { AlertRow, AlertUniverse } from './rows';
import type { AlertSource } from './sources';
import { PT_ALERTS, type AlertDraft, type AlertFrom, type AlertsLanding, type ManagedRule, type ManageOp, type ManageState, type SaveResult } from './token';

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
  readonly draft = this.draftSig.asReadonly();
  readonly opened = this.openedSig.asReadonly();
  readonly saving = this.savingSig.asReadonly();
  /** undefined until asked and answered, null when the page could not get it */
  readonly universe = this.universeSig.asReadonly();
  private asked = false;
  private inflight: Promise<SaveResult> | null = null;

  /** A bell: its badge (and the stock, sector or mega caps it is tied to) joins the draft, which opens. */
  add(src: AlertSource, from: AlertFrom | null, seed?: AlertRow | null): void {
    if (!this.backend) return;
    const d = this.current();
    this.draftSig.set({ ...d, rule: this.append(d.rule, sourceConditions(src, seed)), prefer: d.prefer ?? src.ticker ?? null, from: d.from ?? from });
    this.open();
  }

  /** A badge of the editor's palette. */
  addCondition(rc: RuleCondition): void {
    if (!this.backend) return;
    const d = this.current();
    this.draftSig.set({ ...d, rule: this.append(d.rule, [rc]) });
  }

  setParam(i: number, key: string, value: string | number): void {
    this.update((rule) => ({ ...rule, all: rule.all.map((rc, j) => (j === i ? { ...rc, p: { ...rc.p, [key]: value } } : rc)) }));
  }

  remove(i: number): void {
    this.update((rule) => ({ ...rule, all: rule.all.filter((_, j) => j !== i) }));
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
    this.backend.universe().then((u) => this.universeSig.set(u), () => this.universeSig.set(null));
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

  /** One call at a time; a second press while the first is on its way gets the same answer. */
  save(email: string, weekly: boolean): Promise<SaveResult> {
    if (this.inflight) return this.inflight;
    const d = this.draftSig();
    if (!this.backend || !d) return Promise.resolve({ ok: false, reason: 'invalid' });
    const name = d.name?.trim() || nameOf(d.rule);
    const call: Promise<SaveResult> = d.editing
      ? this.backend.manage(d.editing.token, { op: 'update', id: d.editing.id, name, rule: d.rule })
        .then((s): SaveResult => (s ? { ok: true } : { ok: false, reason: 'network' }))
      : this.backend.save({ email, name, rule: d.rule, from: d.from, weekly });
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

  manage(token: string, op: ManageOp): Promise<ManageState | null> {
    return this.backend ? this.backend.manage(token, op).catch(() => null) : Promise.resolve(null);
  }

  landing(): AlertsLanding {
    return this.backend?.landing() ?? NONE;
  }

  private current(): AlertDraft {
    return this.draftSig() ?? { rule: { v: 1, all: [] }, prefer: null, from: null, name: null, editing: null };
  }

  /** Adds conditions up to RULE_MAX, never a universe condition the rule already has. */
  private append(rule: Rule, more: RuleCondition[]): Rule {
    const all = [...rule.all];
    for (const rc of more) {
      if (all.length >= RULE_MAX) break;
      if (CONDITIONS[rc.c].group === 'universe' && all.some((x) => same(x, rc))) continue;
      all.push(rc);
    }
    return { v: 1, all };
  }

  private update(f: (r: Rule) => Rule): void {
    const d = this.draftSig();
    if (d) this.draftSig.set({ ...d, rule: f(d.rule) });
  }
}

import { InjectionToken } from '@angular/core';
import type { Rule } from './rule';
import type { AlertUniverse } from './rows';

// The alerts' token and types alone: the page's main bundle imports this file (never the service, whose catalog is a chunk's).
/** Where an alert was started: the component, its section on the page and the page. */
export interface AlertFrom { tag: string; section: string | null; path: string }
export interface AlertDraft { rule: Rule; prefer: string | null; from: AlertFrom | null; name: string | null; editing: { id: string; token: string } | null }
/** `captcha`: the human check did not pass (or the token was spent): a fresh one, then try again */
export type SaveResult = { ok: true } | { ok: false; reason: 'invalid' | 'limit' | 'network' | 'captcha' };
/** What a human check says: a fresh token, or none (`failed`: it cannot run — blocked, offline — or Cloudflare refused it). */
export type CheckState = { token: string } | { token: null; failed: boolean };
/**
 * A human check drawn in an element of the editor (Turnstile on www): `reset` asks for a fresh token, `remove` takes it away.
 * `el` is the page's element, typed `object` so that this file stays free of DOM types (the platform's Worker compiles it).
 */
export interface HumanCheck { mount(el: object, on: (s: CheckState) => void): { reset(): void; remove(): void } }
/** `pending`: saved, its confirmation email not yet opened (it cannot be paused) */
export interface ManagedRule { id: string; name: string; rule: Rule; status: 'pending' | 'active' | 'paused' }
export interface ManageState {
  email: string; status: 'pending' | 'active' | 'unsubscribed'; weekly: boolean; rules: ManagedRule[];
  /** a rule just confirmed, and the companies meeting it right now (they fire only when they meet it again) */
  confirmed?: { id: string; now: string[] };
}
export type ManageOp = { op: 'list' | 'confirm' | 'unsubscribe' } | { op: 'pause' | 'resume' | 'delete'; id: string }
  | { op: 'update'; id: string; name: string; rule: Rule } | { op: 'weekly'; on: boolean };
/** What the page's address says: the event an email opened, the token of a confirm or manage link, and what that link is for. */
export interface AlertsLanding { alert: string | null; token: string | null; action: 'confirm' | 'manage' | 'weekly' | null }
/** The page's side of the alerts (the site: `/v1/alerts`, the universe, the session's bars). Absent on the server and in the checks. */
export interface AlertsBackend {
  universe(): Promise<AlertUniverse | null>;
  bars(ticker: string): Promise<number[] | null>;
  /** `turnstile`: the human check's token, when the backend has a check */
  save(req: { email: string; name: string; rule: Rule; from: AlertFrom | null; weekly: boolean; turnstile?: string }): Promise<SaveResult>;
  manage(token: string, op: ManageOp): Promise<ManageState | null>;
  landing(): AlertsLanding;
  /** the check a new alert's Save needs first (www: Turnstile); none: Save needs none (the stories' made-up backends) */
  check?: HumanCheck;
}
export const PT_ALERTS = new InjectionToken<AlertsBackend>('PT_ALERTS');


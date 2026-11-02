import { InjectionToken } from '@angular/core';
import type { Rule } from './rule';
import type { AlertUniverse } from './rows';

// The alerts' token and types alone: the page's main bundle imports this file (never the service, whose catalog is a chunk's).
/** Where an alert was started: the component, its section on the page and the page. */
export interface AlertFrom { tag: string; section: string | null; path: string }
export interface AlertDraft { rule: Rule; prefer: string | null; from: AlertFrom | null; name: string | null; editing: { id: string; token: string } | null }
export type SaveResult = { ok: true } | { ok: false; reason: 'invalid' | 'limit' | 'network' };
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
  save(req: { email: string; name: string; rule: Rule; from: AlertFrom | null; weekly: boolean }): Promise<SaveResult>;
  manage(token: string, op: ManageOp): Promise<ManageState | null>;
  landing(): AlertsLanding;
}
export const PT_ALERTS = new InjectionToken<AlertsBackend>('PT_ALERTS');


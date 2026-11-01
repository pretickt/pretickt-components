/**
 * The data context of components (Angular): `inject(Pt)`, one signal resource per call; `inject(PtPicks)`, the reader's calls;
 * `inject(PtLive)`, today's delayed prices;
 * `inject(PtAlerts)`, the alert being built and the page's alerts backend.
 */
export { Pt, PT_SLOT, PT_STORE, type PtPayload, type PtParams, type PtResource } from './pt';
export { PT_PICKS, PtPicks, type PickStore } from './picks';
export { PT_LIVE, PtLive, type LiveDay, type LiveEarnings, type LiveQuote, type LiveSource, type LiveStory } from './live';
export { PT_ALERTS, PtAlerts, type AlertDraft, type AlertFrom, type AlertsBackend, type AlertsLanding, type ManagedRule, type ManageOp, type ManageState, type SaveResult } from './alerts';
export { FAILED, methodOf, PtStore, typologyOf, type PtStoreOptions } from './store';
export { validateParams } from './validate';

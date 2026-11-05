/**
 * The data context of components (Angular): `inject(Pt)`, one signal resource per call; `inject(PtPicks)`, the reader's calls;
 * `inject(PtLive)`, today's delayed prices. (`PtAlerts` is the alerts' own: `@pretickt/components/alerts`.)
 */
export { Pt, PT_SLOT, PT_STORE, type PtPayload, type PtParams, type PtResource } from './pt';
export { PT_PICKS, PtPicks, type PickStore } from './picks';
export { BARS_EVERY_MS, mayRefresh, PT_LIVE, PtLive, type LiveBars, type LiveDay, type LiveEarnings, type LiveQuote, type LiveSource, type LiveStory } from './live';
export { FAILED, methodOf, PtStore, typologyOf, type PtStoreOptions } from './store';
export { validateParams } from './validate';

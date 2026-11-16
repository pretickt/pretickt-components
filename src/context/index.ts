/**
 * The data context of components (Angular): `inject(Pt)`, one signal resource per call; `inject(PtPicks)`, the reader's calls;
 * `inject(PtLive)`, today's delayed prices. (`PtAlerts` is the alerts' own: `@pretickt/components/alerts`.)
 */
export { Pt, PT_SLOT, PT_STORE, type PtPayload, type PtParams, type PtResource } from './pt';
export { PT_PICKS, PtPicks, type PickStore } from './picks';
export {
  answer, askAt, CTX_ASK, rememberedAt, rememberPanel, type CalendarCtx, type ClickData, type ClickKind, type ClickNote, type CtxAsk, type CtxBars, type CtxCol, type CtxKinds, type FeedCtx,
  type FollowingCtx, type HolderCtx, type HoldingCtx, type ListCtx, type MapCtx, type MentionCtx, type MoverCtx, type NewsCtx, type PeersCtx,
  type PortfolioCtx, type TalkCtx,
} from './click';
export { PT_FOLLOW, PT_FOLLOW_ON, type FollowLink, type FollowState, type FollowStore } from './follow-tokens';
export { BARS_EVERY_MS, mayRefresh, PT_LIVE, PtLive, type LiveBars, type LiveDay, type LiveEarnings, type LiveQuote, type LiveSource, type LiveStory } from './live';
export { FAILED, methodOf, PtStore, typologyOf, type PtStoreOptions } from './store';
export { validateParams } from './validate';

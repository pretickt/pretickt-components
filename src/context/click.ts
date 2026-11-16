/**
 * The click's context: what a company link said about the company when the reader clicked it. On a click (and when the hover card
 * opens) the page runtime dispatches `pt-ctx-ask` on the link, synchronously; the component the link belongs to listens on its host
 * and answers with a snapshot of the row the reader saw. The outer origin answers last, so it wins (a calendar row's sentence is
 * the calendar's). The landing page draws the box written for that kind. Nothing here is sent anywhere.
 */
import type { Said, Tone } from '../ds/format';

export const CTX_ASK = 'pt-ctx-ask';
export interface CtxAsk { data: ClickData | null }

/** A column of a list row as the list printed it. */
export interface CtxCol { label: string; text: string; tone?: string }

export interface CalendarCtx {
  title: string; ticker: string; logo: string | null; out: boolean; cue: string; cueTone: Tone | 'est'; when: string; hint: string;
  moves: number[]; said: Said; facts: string; page: { href: string; label: string } | null;
}
export interface MoverCtx {
  asOf: string; kind: 'rally' | 'drawdown'; move: number; since: string; days: number; week: number; month: number; quarter: number;
  today: { r: number; label: string } | null; industry: { median: number; peers: { ticker: string; move: number }[] } | null;
}
export interface MapCtx { asOf: string | null; lens: 'market' | 'mega'; move: number | null; cap: number; sector: string; rank: number; of: number; sectorMove: number | null }
export interface TalkCtx { lens: 'news' | 'social'; count: string; label: string }
export interface FeedCtx { label: string; sub: string; day: string; text: string; pill: { text: string; cls: string } | null; href: string; group: string }
export interface ListCtx { title: string; href: string; rank: number; of: number; cols: CtxCol[] }
export interface PeersCtx { of: { ticker: string; name: string }; href: string; cols: CtxCol[] }
export interface HoldingCtx { basket: { name: string; href: string }; weight: number; ret: number | null; points: number | null }
export interface PortfolioCtx {
  weight: number | null; ret: number | null; points: number | null; earnings: string | null; headline: { title: string; url: string } | null;
}
export interface NewsCtx { title: string; url: string; site: string; publishedAt: string }
export interface HolderCtx { of: { ticker: string; name: string }; question: string; label: string; href: string }
export interface MentionCtx { said: Said }
export interface FollowingCtx { name: string; alerts: number }

export interface CtxKinds {
  earnings: CalendarCtx; dividend: CalendarCtx; mover: MoverCtx; 'heat-map': MapCtx; 'talk-map': TalkCtx; feed: FeedCtx;
  list: ListCtx; peers: PeersCtx; holding: HoldingCtx; portfolio: PortfolioCtx; news: NewsCtx; holder: HolderCtx;
  mention: MentionCtx; following: FollowingCtx;
}
export type ClickKind = keyof CtxKinds;
export type ClickData = { [K in ClickKind]: { kind: K; d: CtxKinds[K] } }[ClickKind];
/** The note the click leaves: one at a time, in this browser's storage, for the page it leads to. */
export type ClickNote = ClickData & { v: 1; to: string; land: string; at: number; from: { path: string; title: string } };

/** An origin's answer: overwrites what an inner element answered (the outer origin wins). */
export function answer(e: Event, data: ClickData): void {
  const detail = (e as CustomEvent<CtxAsk>).detail;
  if (detail) detail.data = data;
}

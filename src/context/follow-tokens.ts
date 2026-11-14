import { InjectionToken } from '@angular/core';
import type { FollowState } from './follow-state';

export type { FollowLink, FollowState } from './follow-state';

// The page's providers import these alone: PtFollow (./follow.ts) stays out of the main bundle, in the chunks of the components with a bell.
/** Where the page keeps what the reader follows (the site: this browser's localStorage). Never on the server, never sent anywhere. */
export interface FollowStore {
  /** A promise the first time when the page loads its store on first use. */
  read(): FollowState | Promise<FollowState>;
  write(s: FollowState): void;
}
/** Provided by the page in the browser while follow is on; absent on the server and in the checks. */
export const PT_FOLLOW = new InjectionToken<FollowStore>('PT_FOLLOW');
/** The page has the bells (FOLLOW_ENABLED): provided on the server and in the browser alike, so both draw them. */
export const PT_FOLLOW_ON = new InjectionToken<boolean>('PT_FOLLOW_ON');

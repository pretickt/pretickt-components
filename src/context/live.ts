import { afterNextRender, computed, inject, Injectable, InjectionToken, signal, type Signal } from '@angular/core';

/** One company in the intraday file: the price of a 5-minute bar over for at least 15 minutes, against the previous close. */
export interface LiveQuote {
  /** price */ p: number;
  /** the previous session's close */ pc: number;
  /** change since that close */ r: number;
  /** its split like "why it moved": market (SPY) + sector (net of the market) + specific = r; null when unknown */
  m: number | null; s: number | null; x: number | null;
}
export interface LiveStory { title: string; site: string; url: string; at: string }
export interface LiveEarnings { date: string; time: 'bmo' | 'amc' | null; eps: number | null; epsEst: number | null; rev: number | null; revEst: number | null }
/**
 * The intraday file the platform uploads every 5 minutes of the session (pretickt-platform `plant/src/live`), as the page app gives it
 * to components: `time` is when its newest bar ended, in the reader's words ("11:45 AM ET").
 */
export interface LiveDay {
  session: string; prev: string; asOf: string; time: string; delayMin: number; closed: boolean;
  q: Record<string, LiveQuote>;
  /** stories since the previous close: how many, and the newest */
  news: Record<string, { n: number; top: LiveStory[] }>;
  /** results reported since the previous close */
  earnings: Record<string, LiveEarnings>;
}
/** Where the page reads the file (the site: one request when a component first asks). Absent on the server and in the checks. */
export interface LiveSource { load(): Promise<LiveDay | null> }
export const PT_LIVE = new InjectionToken<LiveSource>('PT_LIVE');

/**
 * Today's prices, 15 minutes late, on pages whose data stops at the previous close: `live.after(() => asOf)` is the day when its
 * session is newer than `asOf` (the build's last session), else null. Call it from a field initializer: it stays null on the server,
 * in the checks, until the file has loaded and until the calling component has rendered once in the browser — an island that
 * hydrates after the file arrived first takes over the server's markup as it is, then changes it (a binding that first meets live
 * values while hydrating adds its classes and styles to the server's instead of replacing them).
 */
@Injectable({ providedIn: 'root' })
export class PtLive {
  private readonly source = inject(PT_LIVE, { optional: true });
  private readonly day = signal<LiveDay | null>(null);

  constructor() {
    const source = this.source;
    if (source) afterNextRender(() => { source.load().then((d) => this.day.set(d), () => undefined); });
  }

  after(asOf: () => string | null | undefined): Signal<LiveDay | null> {
    const rendered = signal(false);
    afterNextRender(() => rendered.set(true));
    return computed(() => {
      const d = this.day(), a = asOf();
      return rendered() && d && a && d.session > a ? d : null;
    });
  }
}

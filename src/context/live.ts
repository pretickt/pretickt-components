import { afterNextRender, computed, DestroyRef, DOCUMENT, inject, Injectable, InjectionToken, signal, type Signal } from '@angular/core';

/** One company in the intraday file: the price of a 1-minute bar over for at least 15 minutes, against the previous close. */
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
 * The intraday file the platform uploads every 2 minutes of the session (pretickt-platform `plant/src/live`), as the page app gives it
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
/** The session's line of every company (`live/bars-v1.json`): one close per 5-minute slot from 9:30 ET, each over for at least 15 minutes. */
export interface LiveBars { session: string; prev?: string; asOf: string; time: string; closed: boolean; bars: Record<string, (number | null)[]> }
/**
 * Where the page reads the files (the site: one request for the day, when a component first asks; a fresh one for the lines at every turn). Absent on the
 * server and in the checks. `poll`: another rhythm for stories and tests.
 */
export interface LiveSource { load(): Promise<LiveDay | null>; bars?(): Promise<LiveBars | null>; poll?: { everyMs: number; anyTime: boolean } }
export const PT_LIVE = new InjectionToken<LiveSource>('PT_LIVE');

/** The file is uploaded every 2 minutes of the session. */
export const BARS_EVERY_MS = 120_000;
const NY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Whether to read the lines again: the tab in front, a weekday between the open and the job's last run (16:16), today's session not closed yet. */
export function mayRefresh(now: Date, last: LiveBars | null, visible: boolean): boolean {
  if (!visible) return false;
  const p = Object.fromEntries(NY.formatToParts(now).map((x) => [x.type, x.value]));
  const min = Number(p['hour']) * 60 + Number(p['minute']);
  if (p['weekday'] === 'Sat' || p['weekday'] === 'Sun' || min < 570 || min >= 980) return false;
  return !(last?.closed && last.session === `${p['year']}-${p['month']}-${p['day']}`);
}

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
  private readonly destroy = inject(DestroyRef);
  private readonly doc = inject(DOCUMENT);
  private readonly day = signal<LiveDay | null>(null);
  private readonly line = signal<LiveBars | null>(null);
  private dayAsked = false;
  private linesAsked = false;

  after(asOf: () => string | null | undefined): Signal<LiveDay | null> {
    const rendered = signal(false);
    afterNextRender(() => {
      rendered.set(true);
      if (!this.dayAsked && this.source) { this.dayAsked = true; this.source.load().then((d) => this.day.set(d), () => undefined); }
    });
    return computed(() => {
      const d = this.day(), a = asOf();
      return rendered() && d && a && d.session > a ? d : null;
    });
  }

  /**
   * The session's lines, read at once and again every 2 minutes while the session runs and the tab is in front. Call it from a field initializer: null on the
   * server, in the checks and until the calling component has rendered once in the browser. A failed read keeps the last lines.
   */
  bars(): Signal<LiveBars | null> {
    const rendered = signal(false);
    afterNextRender(() => { rendered.set(true); this.startLines(); });
    return computed(() => (rendered() ? this.line() : null));
  }

  private startLines(): void {
    const src = this.source;
    if (this.linesAsked || !src?.bars) return;
    this.linesAsked = true;
    const read = () => { src.bars!().then((b) => { if (b) this.line.set(b); }, () => undefined); };
    const doc = this.doc;
    const turn = () => { if (src.poll?.anyTime || mayRefresh(new Date(), this.line(), doc.visibilityState === 'visible')) read(); };
    read();
    const timer = setInterval(turn, src.poll?.everyMs ?? BARS_EVERY_MS);
    doc.addEventListener('visibilitychange', turn);
    this.destroy.onDestroy(() => { clearInterval(timer); doc.removeEventListener('visibilitychange', turn); });
  }
}

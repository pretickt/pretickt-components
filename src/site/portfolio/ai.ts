import { InjectionToken } from '@angular/core';
import type { AiHolding } from './parse';

/**
 * The site's AI reading a paste (Romeo, 2026-11-09: «Per il parsing dobbiamo usare sicuramente una LLM»): the pasted text and its kind go to www's
 * `/v1/ai/portfolio` when the reader presses Read — the only request of the page that carries what the reader typed; saved portfolios never leave
 * the browser. Five readings a day for an address; any answer but the lines (the five used, the reader not set up or not answering) leaves the
 * page to read in the browser, and to say so.
 */
export type AiAnswer = { ok: true; holdings: AiHolding[]; ignored: number[]; left: number }
  | { ok: false; reason: 'limit' | 'busy' | 'off' | 'bad' | 'error' | 'network' };
export interface AiReader { read(text: string, kind: 'portfolio' | 'watchlist'): Promise<AiAnswer> }
export const PT_PORTFOLIO_AI = new InjectionToken<AiReader>('pt-portfolio-ai');
/** What the reader accepts (the admin's own cap): a longer paste is read in the browser. */
export const MAX_AI_TEXT = 20_000;

const REASONS = new Set(['limit', 'busy', 'off', 'bad', 'error']);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown) => v === null || typeof v === 'string';
const holding = (h: unknown): h is AiHolding => {
  const x = h as Record<string, unknown> | null;
  return !!x && Number.isInteger(x['line']) && str(x['symbol']) && str(x['name']) && (x['amount'] === null || num(x['amount']))
    && (x['unit'] === null || x['unit'] === 'shares' || x['unit'] === 'usd' || x['unit'] === 'pct') && str(x['date']);
};
/** The answer as the page may use it: anything else is the reader not answering. */
export function answerOf(j: unknown): AiAnswer {
  const x = j as Record<string, unknown> | null;
  if (x?.['ok'] === true && Array.isArray(x['holdings']) && x['holdings'].every(holding) && Array.isArray(x['ignored']) && x['ignored'].every((n) => Number.isInteger(n)) && num(x['left']))
    return { ok: true, holdings: x['holdings'], ignored: x['ignored'] as number[], left: x['left'] as number };
  return { ok: false, reason: x?.['ok'] === false && REASONS.has(x['reason'] as string) ? x['reason'] as 'limit' : 'network' };
}

export function fetchReader(f: typeof fetch = fetch): AiReader {
  return {
    async read(text, kind) {
      try {
        const r = await f('/v1/ai/portfolio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, kind }) });
        return answerOf(await r.json().catch(() => null));
      } catch { return { ok: false, reason: 'network' }; }
    },
  };
}

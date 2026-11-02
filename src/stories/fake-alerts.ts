// Made-up answers for the alerts' stories: the page's backend faked on the made-up universe. Never real data.
import type { Provider } from '@angular/core';
import { estimate } from '../alerts/estimate';
import { MOCK_BARS, MOCK_UNIVERSE } from '../alerts/mock';
import { mockHistory } from '../alerts/mock-history';
import { prng, round } from '../typologies/common';
import { PtAlerts } from '../alerts/service';
import { PT_ALERTS, type AlertsBackend, type AlertsLanding, type HumanCheck, type ManageState } from '../alerts/token';

/**
 * The page's alerts faked: the made-up universe and session bars, a save that answers after 600 ms (or fails), a manage state;
 * `check`: a human check before Save (the Turnstile stories: Cloudflare's own test keys).
 */
export function fakeAlerts(o: { fail?: 'network' | 'limit' | 'captcha'; landing?: AlertsLanding; state?: ManageState | null; check?: HumanCheck } = {}): Provider[] {
  const backend: AlertsBackend = {
    universe: async () => MOCK_UNIVERSE,
    bars: async (t) => MOCK_BARS[t] ?? null,
    save: () => new Promise((r) => setTimeout(() => r(o.fail ? { ok: false, reason: o.fail } : { ok: true }), 600)),
    manage: async () => o.state ?? null,
    // the real estimate on made-up sessions, after a short wait like the Worker's
    estimate: (rule) => new Promise((r) => setTimeout(() => r(estimate(rule, mockHistory())?.perMonth ?? null), 250)),
    landing: () => o.landing ?? { alert: null, token: null, action: null },
    ...(o.check ? { check: o.check } : {}),
  };
  return [PtAlerts, { provide: PT_ALERTS, useValue: backend }];
}

/**
 * Made-up daily closes for a made-up row (price-series@1's shape), consistent with the row: the last two closes are its previous
 * close and its close, and the 48 before them sit where the 50-day average comes out at the row's — so a card's line ends where its
 * NOW label says.
 */
export function mockSeries(params: unknown): unknown {
  const p = params as { tickers: string[]; range: string };
  const n = p.range === '2y' ? 504 : p.range === '6m' ? 126 : p.range === '3m' ? 63 : 252;
  return p.tickers.map((ticker) => {
    const row = MOCK_UNIVERSE.rows.find((r) => r.ticker === ticker);
    const close = row?.close ?? 100, prev = row?.prevClose ?? close, rnd = prng(`series-${ticker}`);
    const plateau = row?.ma50 ? (50 * row.ma50 - close - prev) / 48 : close;
    const day = (i: number) => new Date(Date.UTC(2026, 9, 30) - (n - 1 - i) * 1.45 * 86400000).toISOString().slice(0, 10);
    const noise = (i: number) => (i % 2 ? 1 : -1) * plateau * 0.004 * rnd();   // alternating, so the average stays put
    return { ticker, points: Array.from({ length: n }, (_, i) => {
      const c = i === n - 1 ? close : i === n - 2 ? prev : round(plateau * (i < n - 50 ? 1.04 - 0.04 * (i / (n - 50)) : 1) + noise(i), 2);
      return { t: day(i), o: c, h: c * 1.01, l: c * 0.99, c, v: 1e6 };
    }) };
  });
}

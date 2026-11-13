// Made-up alert events for pt-alert-event's stories and spec: never real data.
import type { AlertEvent } from '../typologies/alerts';

/** Romeo's example (2026-11-01): a mega cap falls more than 5% in a session and trades far under its 50-day average. */
export const AE_AMD: AlertEvent = {
  id: 'e-demo-1', name: 'Mega-cap drops', ticker: 'AMD', companyName: 'Advanced Micro Devices, Inc.', logo: '/logos/amd.a8e17428.webp',
  session: '2026-10-30', firedAt: '3:45 PM ET',
  conditions: [
    { c: 'session-move', p: { dir: 'down', pct: 5 }, value: -0.079 },
    { c: 'below-average', p: { dir: 'below', pct: 15, days: '50' }, value: -0.24 },
    { c: 'mega-caps', p: {}, value: 310e9 },
  ],
};
/** A move read during the session: the line says when and at what price, so a rebound after it does not contradict it. */
export const AE_SEEN: AlertEvent = {
  id: 'e-demo-4', name: 'Drops 5%+', ticker: 'NVDA', companyName: 'NVIDIA Corporation', logo: '/logos/nvda.55199575.webp',
  session: '2026-10-30', firedAt: '9:49 AM ET',
  conditions: [{ c: 'session-move', p: { dir: 'down', pct: 5 }, value: -0.118, at: '9:33 AM ET', price: 153.5 }],
};
/** One condition: news. */
export const AE_ONE: AlertEvent = {
  id: 'e-demo-2', name: 'News 3× · NVDA', ticker: 'NVDA', companyName: 'NVIDIA Corporation', logo: '/logos/nvda.55199575.webp',
  session: '2026-10-29', firedAt: '11:20 AM ET',
  conditions: [{ c: 'news-spike', p: { times: 3 }, value: 4.1 }, { c: 'one-stock', p: { ticker: 'NVDA' }, value: null }],
};
/** Five conditions, one the company page does not show (social). */
export const AE_FIVE: AlertEvent = {
  id: 'e-demo-3', name: 'Quality pullback', ticker: 'MU', companyName: 'Micron Technology, Inc.', logo: '/logos/mu.516495fd.webp',
  session: '2026-10-30', firedAt: '4:10 PM ET',
  conditions: [
    { c: 'session-move', p: { dir: 'down', pct: 5 }, value: -0.057 },
    { c: 'analyst-upside', p: { pct: 20 }, value: 0.34 },
    { c: 'piotroski', p: { side: 'high', score: 7 }, value: 8 },
    { c: 'social-buzz', p: { times: 3 }, value: 3.6 },
    { c: 'earnings-soon', p: { days: 30 }, value: 12 },
    { c: 'sector', p: { sector: 'Technology' }, value: null },
  ],
};

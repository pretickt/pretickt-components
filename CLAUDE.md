# pretickt components — how to write a component (for humans and LLMs)

This repo is public (MIT). It holds the **component contract (SDK)**, the **typologies** (data contracts with
deterministic demo data), the **browser host**, the **published components** and the **design system**.
Data comes from closed pretickt APIs that you never call directly. Spec:
`pretickt/docs/superpowers/specs/2026-10-03-pretickt-production-platform-design.md` (§4–§8, §14).

## The model in one paragraph
A component is **one TypeScript file** that **declares** the data it needs (`needs`) and **renders it as an HTML
string** (`renderStatic`). The platform resolves the needs at build time and the page ships static HTML plus
the data inline. In the browser the host defines the custom element (Lit, light DOM) which re-renders with the
**same `renderStatic`**, so static and hydrated output cannot diverge. A component never fetches, stores, reads
the clock or touches anything outside its own markup.

## File shape (copy this)
```ts
import * as z from 'zod/mini';                                   // ONLY zod/mini, never 'zod'
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';           // community: '@pretickt/components/sdk'
import { Ticker, type MetricPayload } from '../src/typologies';                     // community: '@pretickt/components/typologies'
// optional: import { rsi, supportResistance } from '../src/sdk/indicators';      // community: '@pretickt/components/indicators'

export const manifest = defineComponent({
  tag: 'pt-my-thing',            // pt- prefix, lowercase, NO -v1 suffix (the host adds -v<major>)
  version: '1.0.0',              // semver; ANY change to a deployed component needs a new version (bundles are cached immutable)
  need: { question: 'What market question does this answer?', evidence: ['DataForSEO …', 'r/stocks thread …', 'beta: …'] },
  params: z.object({ ticker: Ticker, range: z._default(z.enum(['1m', '1y']), '1y') }),
  user: [],                      // user data (type 3) — not available yet
  uses: [],                      // composition — must stay empty for now
  needs: (p) => ({               // name → { t: '<typology>@<major>', params } ; names are the keys of `data`
    series: { t: 'price-series@1', params: { tickers: [p.ticker], range: p.range, interval: '1d', rebase: false } },
  }),
});

export const samples = [{ ticker: 'NVDA', range: '1y' }, { ticker: 'BRK.B', range: '1m' }];   // used by tests and build

type Data = DataFor<{ series: PriceSeries }>;    // every key may be null

export function renderStatic(data: Data, params: { ticker: string; range: string }, h: Helpers): string {
  if (!data.series?.[0]?.points.length) return h.na();      // ALWAYS handle null / empty
  return `<figure class="pt-chart">…${h.esc(something)}…</figure>`;
}
// optional: export const element = ({ PtElement, html, svg, unsafeHTML }) => class extends PtElement { … }
// Rarely needed: the default element already renders renderStatic, shows [data-tip] tooltips and handles [data-set] clicks.
```

## Rules (enforced by `lintSource` + `checkContract` + parity test; the build refuses a component that breaks them)
- **No data access**: no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import()`, `eval`, `Function`,
  storage, cookies, `window.top/parent/opener`, `postMessage`, `customElements`.
- **Deterministic & QuickJS-safe**: no `Date.now()`, `new Date()` without argument, `Math.random()`, `Intl`, `toLocale*`.
  "Today" is never known: use the `asOf` field that typologies return.
- **Top level**: only imports, exports, `const`, functions and types (no side effects, no classes — `element` is a factory).
- **Escape everything from data** with `h.esc` (attributes too). Tooltips: `h.tip({ Label: value })` → `data-tip`; the base
  element renders them as text.
- **Interactivity without code**: a button with `data-set='{"range":"5y"}'` patches params; the base element re-resolves only
  the needs whose key changed (via the API) and re-renders.
- **Null & unknown**: every `data` key can be `null` → render `h.na()` (or a reduced view). Payload lists may contain catalogue
  entries you don't know (new metric keys, new event kinds, events **without ticker**): render them generically or skip them,
  never throw. `checkContract` injects such items on purpose.
- **Public copy is US English**, templated from data. **No LLM prose** on pages.
- **Licence**: never show index symbols (`^…`); "the market" is SPY.

## Helpers (`h`)
`esc, num(v,digits), pct(fraction), money, compact, date(iso), toneOf, na(label?), tip(obj), icon(name), badge(item), badgeValue(item)`.
Icons: `calendar target trend-up trend-down alert peak`.

## Badges — the way to add a new metric from a component
Build an object with the `Badge` shape and call `h.badge(b)` inside `<ul class="pt-badges">`:
`{ key, label, value: number|null, text: string|null, unit: 'x'|'%'|'$'|'$c'|'d'|'', delta, tone: 'pos'|'neg'|'flat'|'na',
range: {lo,hi,marks}|null, icon, hint, asOf, dots?: ('pos'|'neg')[] }` (`%` = fraction, `$c` = compact dollars).
Compute it from any typology you receive (e.g. RSI from `price-series` with `indicators.rsi`, FCF growth from `fundamentals`).
If a metric is useful everywhere, propose it for the **precomputed catalogue** (`metric@1`, 25 keys, computed nightly by the
platform) instead.

## Typologies (`src/typologies`) — what you can ask for
| id | params | payload |
|---|---|---|
| `metric@1` | `{ticker, metrics: MetricKey[] (≤32)}` | `MetricItem[]` (Badge shape). Keys: `pe pe_vs_sector pe_vs_own pt_upside consensus market_cap fcf_yield insider_net earnings_in news off_high off_ath range_52w trend trend_ma ma_detail ma_cross sector_trend rsi14 support resistance bollinger macd atr_pct volume_ratio` |
| `price-series@1` | `{tickers ≤8, range 1m…5y, interval '1d', rebase}` | `[{ticker, points[{t,o,h,l,c,v}]}]` (adjusted) |
| `events@1` | `{scope: {by:'ticker',ticker,range,ahead} \| {by:'universe',month}, kinds: earnings,dividend,split,analyst,macro}` | `{asOf, items[]}` — `macro` items have **no ticker** (`meta.label` Fed/FOMC/CPI/PCE/Jobs/GDP) |
| `analysts@1` | `{ticker, window 1y\|2y}` | `{asOf, price, summary{low,mean,median,high,n}, consensus, history[], targets[], accuracy[]}` |
| `fundamentals@1` | `{ticker, periods ≤40}` | `{asOf, periods[{period,fiscal,revenue,eps,fcf,grossMargin,operatingMargin,netMargin,pe,shares}]}` oldest first |
| `insider@1` | `{ticker, days 30–730}` | `{asOf, items[{date,filingDate,name,title,type buy\|sell\|other,shares,price,value}]}` |
| `news@1` | `{ticker, limit ≤50}` | `{asOf, items[{publishedAt,title,site,url,sentiment −1…1\|null}]}` (sentiment by AI, numbers only) |
| `move-breakdown@1` | `{ticker, window 1d\|5d\|1m}` | `{asOf, ticker, name, sectorName, window, from, ret, marketRet, sectorRet, market, sector, specific, driver, news{today,avg30,spike,top[]}}` — `market+sector+specific = ret` |
| `screen@1` | `{scope: {list: biggest_losers\|biggest_gainers\|52w_low\|52w_high\|undervalued\|insider_buying\|most_active} \| {peersOf}, limit ≤50}` | `{asOf, rows[{ticker,name,sector,logo,close,chg1d,offHigh,pe,ptUpside,marketCap,insiderNet,volumeRatio,spark[20],self}]}` |
Each typology has `demo(params)`: deterministic fake data used by tests, parity and (later) the COMMUNITY sandbox.
Adding a typology or a catalogue entry is a platform change (schema here + resolver in the private platform + a public-data test).

## Indicators (`src/sdk/indicators`, pure, ported from beta with tests)
`sma ema rsi macd(→{macd,signal}) bollinger atr technicalSnapshot supportResistance vectorise(pivots) structuralTrend applyPrice trend(series, nowMs) buildSectorIndex maCrossEta`.

## Workflow
1. Write `components/pt-x.test.ts` first (`// @vitest-environment happy-dom`, call `standardSuite('pt-x.ts', mod)` + specific tests).
2. Write `components/pt-x.ts`. 3. `npm test` (all) and `npx tsc --noEmit`. 4. `npm run build` → `dist/` (static + browser bundles,
`host.js`, `ds.css`, `index.json`; size budget: host < 100 KB, component < 60 KB). 5. Styles: add semantic classes to `styles/ds.css`
(Tailwind v4 `@apply`), keep markup classes short. 6. Commit on `develop`; `main` = release. Pages that use a component are
defined in the platform repo (`plant/src/generate/pages.ts`).

## Existing components
`pt-metric` (1.1.0, badge strip of the catalogue) · `pt-price-events` (1.0.1, price line + E/D/S/A markers grouped per day, range
toggles) · `pt-price-target` (1.0.0, target stats, segments, consensus bar) · `pt-calendar` (1.2.0, month grid + macro dates + full
list; `kind` earnings|dividend) · `pt-why-today` (1.0.0, answer-first sentence + market/sector/stock bars + news spike) ·
`pt-screen` (1.0.0, ranked table with list-specific column and sparklines; lists and peers) · `pt-financials` (1.0.0, quarterly
revenue/FCF bars + margins table) · `pt-news` (1.0.0, headlines with AI sentiment dots, nofollow links) · `pt-insiders` (1.0.0,
buy/sell totals + Form 4 table).
Shared DS classes worth reusing: `pt-table-wrap/pt-table/pt-num`, `pt-toggles` (buttons with `aria-pressed`), `pt-t-pos/neg/flat/na`
(signed text; never `pt-na`, which is the not-available box), `pt-dot-pos/neg/flat/na`, `pt-note`, `pt-spark`.

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
import { Range, Ticker, type PriceSeries } from '../src/typologies';                // community: '@pretickt/components/typologies'
// optional: import { rsi, supportResistance } from '../src/sdk/indicators';      // community: '@pretickt/components/indicators'

export const manifest = defineComponent({
  tag: 'pt-my-thing',            // pt- prefix, lowercase, NO -v1 suffix (the host adds -v<major>)
  version: '1.0.0',              // semver; ANY change to a deployed component needs a new version (bundles are cached immutable)
  need: { question: 'What market question does this answer?', evidence: ['DataForSEO …', 'r/stocks thread …', 'beta: …'] },
  params: z.object({ ticker: Ticker, range: z._default(Range, '1y') }),   // reuse typology schemas (or a whole XParams) for limits
  user: [],                      // user data (type 3) — not available yet
  uses: [],                      // composition — must stay empty for now
  needs: (p) => ({               // name → { t: '<typology>@<major>', params } ; names are the keys of `data`
    series: { t: 'price-series@1', params: { tickers: [p.ticker], range: p.range, interval: '1d', rebase: false } },
  }),
});

export const samples = [{ ticker: 'NVDA', range: '1y' }, { ticker: 'BRK.B', range: '1m' }];   // used by tests and build

type Data = DataFor<{ series: PriceSeries }>;    // every key may be null

export function renderStatic(data: Data, params: z.output<typeof manifest.params>, h: Helpers): string {   // params arrive parsed (defaults applied)
  if (!data.series?.[0]?.points.length) return h.na();      // ALWAYS handle null / empty
  return `<figure class="pt-chart">…${h.esc(something)}…</figure>`;
}
// optional: export const element = ({ PtElement }: Kit<HTMLElement>) => class extends PtElement { firstUpdated() { super.firstUpdated(); … } }
// Rarely needed: the default element already renders renderStatic, shows [data-tip] tooltips and handles [data-set] clicks.
```

## Rules (checked by `lintSource` + `checkContract` + parity test; the build refuses a component that breaks them)
These checks are **quality feedback, not a security boundary**: a determined author can get past an AST lint. Untrusted code
(community or LLM-generated) is contained by isolation — a network-less, read-restricted sandbox process and sandboxed iframes on
the platform side — never by the lint alone.
- **No data access**: no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import()`, `eval`, `Function`,
  storage, cookies, `window.top/parent/opener`, `postMessage`, `customElements`.
- **Deterministic & QuickJS-safe**: no `Date.now()`, `new Date()` without argument, `Math.random()`, `Intl`, `toLocale*`.
  "Today" is never known: use the `asOf` field that typologies return.
- **Top level**: only imports, exports, `const`, functions and types (no side effects, no classes — `element` is a factory).
- **Escape everything from data** with `h.esc` (attributes too); every link from data goes through `h.href(url)` (http(s) or a site
  path; anything else becomes `#`), a company page through `h.stockHref(ticker)`. Rendered HTML must pass `checkMarkup` (no script/style/iframe/form…, no `on*=` handlers, no
  non-http URL schemes, no `id="pt-data"` or `data-pt`): the contract checks it on demo data and the platform on every real render. Tooltips: `h.tip({ Label: value })` → `data-tip`; the base
  element renders them as text.
- **Interactivity without code**: `<button type="button" ${h.set({ range: '5y' })}>` patches params (or `h.toggles('range', [['1y','1Y'],
  ['5y','5Y']], params.range, 'Range')` for the whole button group); the base element re-resolves only the needs whose key changed
  (via the API) and re-renders. Never hand-write `data-set` JSON.
- **Null & unknown**: every `data` key can be `null` → render `h.na()` (or a reduced view). Payload lists may contain catalogue
  entries you don't know (new metric keys, new event kinds, events **without ticker**): render them generically or skip them,
  never throw. `checkContract` injects such items on purpose. (Typology schemas are closed per build — the host and the API ship
  together — so new entries reach *older component bundles*, which is why components must tolerate them.)
- **Public copy is US English**, templated from data. **No LLM prose** on pages.
- **Licence**: never show index symbols (`^…`); "the market" is SPY.

## Helpers (`h`)
Text: `esc, num(v,digits), pct(fraction → "+12.3%"), level(fraction → "12.3%", no sign), usd(v,{compact,signed}), money(v,digits),
amount(cash, 2–4 decimals), compact, date(iso), month(ym → "Mar 26"), toneOf(v, flatBand)`. Links and states: `href(url), stockHref(ticker),
na(label?), tip(obj), set(patch), toggles(key, options, current, label), icon(name), badge(item), badgeValue(item)`.
Charts: `chartFrame(frame, parts), yAxis(frame, ticks), timeAxis(frame, ticks), svgId(s)`; pure geometry from the SDK:
`closeAt(points, iso), isoDay(iso), linePath([[x,y]…]), monthTicks(fromDay, toDay)`. Use these instead of local formatters.
Icons: `calendar target trend-up trend-down alert peak`.

## Zoom & pan — any chart (ported from beta's ZoomPan + ChartControls)
1. Params: `view: z.optional(ViewportParam)` (absent = full view; the static page always renders the full view).
2. Geometry: pass `params.view` through `applyXViewport(min, max, view)` and `applyYViewport(lo, hi, view)` (from the SDK).
3. Markup, one call: `h.chartFrame({ w, h, plotW, plotH, id, label, view: params.view }, { defs?, axes: h.yAxis(fr, yTicks) +
   h.timeAxis(fr, xTicks), plot, front?, after? })` — wrapper, `data-zoom`, clip, grab strips under the axis labels, the plot clipped,
   the view controls. Price labels sit in the right-hand strip.
The base element does the rest: wheel/drag on the plot = time, on the right strip = price scale, on the bottom strip = time
around the grab point, double-click = reset; fit / today » / reset view buttons appear only when there is something to undo.
A `data-set` patch (new data) drops the view. Examples: `pt-price-target`, `pt-price-events`.

## Badges — the way to add a new metric from a component
Build an object with the `Badge` shape (= a `metric@1` item, `MetricItem`) and call `h.badge(b)` inside `<ul class="pt-badges">`:
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
`sma smaLast ema wilder rsi macd(→{macd,signal}) bollinger atr technicalSnapshot supportResistance vectorise(pivots) dailySigmaPct SCALES
structuralTrend applyPrice trend(series, nowMs) buildSectorIndex maCrossEta`, and `barsOf(points)` to turn price-series points into the
bars they read. Fields named `*Pct` are in percent (2.5 = +2.5%), not fractions: divide by 100 for `h.pct` or a Badge with unit `%`.

## Workflow
1. Write `components/pt-x.test.ts` first (`// @vitest-environment happy-dom`, call `standardSuite(mod)` + specific tests; the suite
   already checks samples, lint, contract — null data included — and parity, so test only what is specific).
2. Write `components/pt-x.ts`. 3. `npm test` (all) and `npx tsc --noEmit`. 4. `npm run build` → `dist/` (static + browser bundles,
`host.js`, `ds.css`, `index.json`; the build refuses a host over 100 KB or a component bundle over 32 KB — `scripts/budget.ts`). 5. Styles: add semantic classes to `styles/ds.css`
(Tailwind v4 `@apply`), keep markup classes short. 6. Commit on `develop`; `main` = release. Pages that use a component are
defined in the platform repo (`plant/src/generate/pages.ts`).

## Existing components (versions: `dist/index.json`)
`pt-metric` (badge strip of the catalogue) · `pt-price-events` (price line + E/D/S/A markers grouped per day, range toggles, zoom & pan
through `h.chartFrame`) · `pt-price-target` (beta's pt-chart with zoom & pan: clustered dots, gradient segments, hover dash-flow + orbit +
staggered analyst rows via a small `element` factory — the reference example of `element`) · `pt-calendar` (month grid + macro dates +
full list; `kind` earnings|dividend) · `pt-why-today` (answer-first sentence + market/sector/stock bars + news spike) · `pt-screen` (ranked
table with list-specific column and sparklines; lists and peers) · `pt-financials` (quarterly revenue/FCF bars + margins table) ·
`pt-news` (headlines with AI sentiment dots, nofollow links) · `pt-insiders` (buy/sell totals + Form 4 table).
Shared DS classes worth reusing: `pt-head` (title row with controls), `pt-meta` (small secondary text), `pt-table-wrap/pt-table/pt-num`,
`pt-toggles` (via `h.toggles`), `pt-t-pos/neg/flat/na` (signed text; never `pt-na`, which is the not-available box),
`pt-dot-pos/neg/flat/na`, `pt-note`, `pt-spark`. Tones are always `pos/neg/flat/na`.

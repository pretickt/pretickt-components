# pretickt components — how to write a component (for humans and LLMs)

This repo is public (MIT). It holds the **components** (Vue single-file components), the **design system** (styles, formatting,
a few primitives), the **typologies** (the data contracts, with deterministic demo data) and the **islands runtime** that renders
components on the server and hydrates them in the browser. Data comes from closed pretickt APIs you never call yourself.
Spec: `pretickt/docs/superpowers/specs/2026-10-06-vue-components-design.md`.

## The model in one paragraph
A component is **one Vue file** (`components/pt-<name>.vue`, `<script setup lang="ts">`). It **asks for data where it needs it**:
`await usePt().<typology>(params)`. The platform renders it at build time (the page ships its HTML and the answers it received)
and hydrates it in the browser as an **island**: the same calls are answered from the page, new ones (a toggle, a month) go to the
API. You never declare needs, never fetch, never touch anything outside your template.

## File shape (copy this)
```vue
<!--
  The market question this answers, in one or two lines.
  @version 1.0.0
  @evidence where the need comes from (DataForSEO …, beta: …, a thread …) — at least one line, repeatable
-->
<script setup lang="ts">
import { ref } from 'vue';
import { usePt } from '@pretickt/components/context';
import { date, pct } from '@pretickt/components/format';
import { PtToggles } from '@pretickt/components/ds';

const props = withDefaults(defineProps<{ ticker: string; window?: '1d' | '5d' | '1m' }>(), { window: '1d' });
const pt = usePt();

const win = ref(props.window);
const move = ref(await pt.moveBreakdown({ ticker: props.ticker, window: win.value }));   // payload | null
const loading = ref(false);
async function show(w: '1d' | '5d' | '1m') {          // interaction = ordinary Vue: change state, ask again
  win.value = w;                                       // the toggle shows the choice at once
  loading.value = true;
  move.value = await pt.moveBreakdown({ ticker: props.ticker, window: w });
  loading.value = false;
}
</script>

<template>
  <p v-if="!move" class="pt-na">Data not available</p>                 <!-- ALWAYS handle null -->
  <section v-else :class="{ 'pt-busy': loading }">
    <div class="pt-head">
      <p class="pt-why-lead">{{ move.name }} {{ pct(move.ret) }} on {{ date(move.asOf) }}</p>
      <PtToggles :model-value="win" :options="[['1d', '1D'], ['5d', '5D'], ['1m', '1M']]" label="Window" @update:model-value="show" />
    </div>
  </section>
</template>

<style scoped>
/* Only what the design system does not have (see "CSS"). */
@reference "@pretickt/components/ds.css";
.spike { @apply rounded-control bg-neg/10 px-1.5 text-xs text-neg; }
</style>
```
- The **tag is the file name**; the island id is `tag@version`. Change `@version` on every change to a deployed component.
- **Props are the component's parameters** (pages set them; the checks sample them from their types — use literal unions and
  defaults, e.g. `window?: '1d' | '5d' | '1m'`). Known names the checks can fill: `ticker`, `peersOf`, `month`, `metrics`.
- Pure helpers (geometry, grouping) may live in a second, plain `<script lang="ts">` block and be exported for tests.

## Data: `usePt()` (`@pretickt/components/context`)
One async method per typology; params are checked by the types (and by the typology at build time); the answer is the payload or
**`null`** when it is not available. Call it at the top level of `<script setup>` (awaited) and again in handlers. All the calls
of one interaction answer, however they are nested (and at build time there are no interactions: every call answers); a call
superseded by a call of the same method from a **later interaction** (the reader clicked again) never answers — so the pattern
above cannot show stale data. A request that **fails** in the browser (rate limit, offline) never answers either: the island keeps
what it shows and the runtime adds the notice "Could not load data — showing the last values"; pressing the toggle again retries.
So **labels that name a parameter** (a month, a range) come from the data on screen — update them with the data, after the
`await` (`move.window` above, or a `shown` ref set next to the data) — while the toggle shows the reader's choice at once.
**Params must be deterministic** (never the clock or randomness): the browser finds the build's answer by the same params.

| method | params | payload |
|---|---|---|
| `pt.metric` | `{ticker, metrics: MetricKey[] (≤32)}` | `MetricItem[]` (Badge shape). Keys: `pe pe_vs_sector pe_vs_own pt_upside consensus market_cap fcf_yield insider_net earnings_in news off_high off_ath range_52w trend trend_ma ma_detail ma_cross sector_trend rsi14 support resistance bollinger macd atr_pct volume_ratio` |
| `pt.priceSeries` | `{tickers ≤8, range 1m…5y, interval '1d', rebase}` | `[{ticker, points[{t,o,h,l,c,v}]}]` (adjusted) |
| `pt.events` | `{scope: {by:'ticker',ticker,range,ahead} \| {by:'universe',month}, kinds: earnings,dividend,split,analyst,macro}` | `{asOf, items[]}` — `macro` items have **no ticker** (`meta.label` Fed/FOMC/CPI/PCE/Jobs/GDP) |
| `pt.analysts` | `{ticker, window 1y\|2y}` | `{asOf, price, summary{low,mean,median,high,n}, consensus, history[], targets[], accuracy[]}` |
| `pt.fundamentals` | `{ticker, periods ≤40}` | `{asOf, periods[{period,fiscal,revenue,eps,fcf,grossMargin,operatingMargin,netMargin,pe,shares}]}` oldest first |
| `pt.insider` | `{ticker, days 30–730}` | `{asOf, items[{date,filingDate,name,title,type buy\|sell\|other,shares,price,value}]}` |
| `pt.news` | `{ticker, limit ≤50}` | `{asOf, items[{publishedAt,title,site,url,sentiment −1…1\|null}]}` (sentiment by AI, numbers only) |
| `pt.moveBreakdown` | `{ticker, window 1d\|5d\|1m}` | `{asOf, ticker, name, sectorName, window, from, ret, marketRet, sectorRet, market, sector, specific, driver, news{today,avg30,spike,top[]}}` — `market+sector+specific = ret` |
| `pt.company` | `{ticker}` | `{ticker, name, sector, industry, logo}` — `logo` is a file the site publishes (`/logos/<file>`), or null |
| `pt.screen` | `{scope: {list: biggest_losers\|biggest_gainers\|52w_low\|52w_high\|undervalued\|insider_buying\|most_active} \| {peersOf}, limit ≤50}` | `{asOf, rows[{ticker,name,sector,logo,close,chg1d,offHigh,pe,ptUpside,marketCap,insiderNet,volumeRatio,spark[20],self}]}` |

Types (`MoveBreakdown`, `News`, `MetricItem`, `EventItem`, `ScreenList`, …) and plain values (`RANGES`, `SENTIMENT_FLAT`, `cmp`)
come from `@pretickt/components/typologies`. Each typology has a deterministic `demo` the checks and the admin bench use. Adding a
typology is a platform change (schema here + resolver in the private platform + a public-data test).

## Design system (`@pretickt/components/ds`, `@pretickt/components/format`, `styles/ds.css`)
- **Classes first** (global `ds.css`, Tailwind 4): `pt-head` (title row with controls), `pt-lede`, `pt-note`, `pt-meta` (small
  secondary text), `pt-na` (the not-available box — only for that), `pt-busy` (loading), `pt-table-wrap/pt-table/pt-num`,
  `pt-badges/pt-badge`, `pt-t-pos/neg/flat/na` (signed text), `pt-dot-pos/neg/flat/na`, `pt-news/pt-news-item`, `pt-spark`,
  `pt-chart/pt-chart-svg/pt-line/pt-grid/pt-axis`, `pt-legend/pt-key`. Tones are always `pos/neg/flat/na`. Tokens (colours,
  radius) are CSS variables: `--color-pos`, `--color-neg`, `--color-ink`, `--color-ink-soft`, `--color-surface`, `--color-primary`…
- **Format** (deterministic, the same on server and browser — never `Intl`/`toLocale*`): `num(v,digits)`, `pct(fraction →
  "+12.3%")`, `level(fraction → "12.3%")`, `usd(v,{compact,signed,digits})`, `money(v,digits)`, `amount(cash)`, `compact`,
  `date(iso → "Sep 30, 2026")`, `month(ym → "Mar 26")`, `tone(v, flatBand)`, `href(url)` (http(s) or a site path, else `#`),
  `stockHref(ticker)`, `tip({ Label: value })`, `badgeValue(badge)`, `svgId(s)`.
- **Companies**: `PtCompany` (`ticker`, `name?`, `logo?`: logo + ticker + name, linked to the company page) and `PtLogo` (`ticker`,
  `src` = a payload's `logo` — `company@1`, `events@1`, `screen@1` carry it —, `size`; no `src` → initials, no request). **Every link to `/stocks/<t>/` opens the
  company card on hover** (the runtime does it, desktop only): link companies with `stockHref` / `PtCompany`, nothing else to do; a
  `data-tip` on such a link becomes the card's footer instead of a text tooltip.
- **Primitives** (`@pretickt/components/ds`): `PtToggles` (`v-model` + `options: [value,label][]` + `label`), `PtBadge` (`:badge` = a
  `metric@1` item or any Badge you build, inside `<ul class="pt-badges">`; `size="mini"` for dense rows), `PtIcon` (`name`: calendar target trend-up trend-down
  alert peak), `PtChart` (zoomable chart frame: `w h plotW plotH id label`, `v-model:view`; slots `defs`, `axes`, default = the plot
  (clipped), `front`, `after`), `PtYAxis` / `PtTimeAxis` (for the `axes` slot). Geometry: `applyXViewport`, `applyYViewport`,
  `FULL_VIEWPORT`, `closeAt`, `isoDay`, `linePath`, `monthTicks`.
- **Tooltips without code**: `:data-tip="tip({ Label: value })"` on any element; the island runtime shows it as text.
- **Zoom & pan** comes with `PtChart`: wheel/drag on the plot = time, on the right strip = price scale, on the bottom strip = time
  around the grab point, double-click = reset; fit / today » / reset appear only when there is something to undo. Read the view in
  your geometry (`applyXViewport(min, max, view)`, `applyYViewport(lo, hi, view)`); reset it (`FULL_VIEWPORT`) when new data arrives.

## CSS
Design-system classes first. Custom CSS **only** in `<style scoped>`, **only** for what the design system does not have:
`@reference "@pretickt/components/ds.css";` to use its tokens and `@apply`; tokens only (no raw colours); no global selectors
(`:global`, `html`, `body`), no `!important`. A component's CSS **loads nothing**: no `@import`, no `url()`, no other
`@reference`, no escapes (`\`); at-rules are `@apply`, `@media`, `@supports`, `@keyframes`, `@container`. If a class would help
other components, propose it for `ds.css`.

## Rules (the checks enforce what they can; the platform sandbox contains the rest)
- **No data access of your own**: no `fetch`, `XMLHttpRequest`, `WebSocket`, storage, cookies, `window`/`document` in setup, no
  `import()`, no `eval`, no `import.meta`. Only these imports: `vue`, `@pretickt/components/{context,ds,format,typologies,indicators}`.
  The whole component is its one file: no `src=` on `<script>`, `<template>` or `<style>`.
- **Deterministic**: no `Date.now()`, `new Date()` without argument, `Math.random()`, `Intl`, `toLocale*` — "today" is the `asOf`
  the payload carries. Server and browser must render the same HTML (hydration).
- **Never `v-html`.** Vue escapes text and attributes; links from data go through `href(url)` (external ones get
  `target="_blank" rel="nofollow noopener noreferrer"`), company pages through `stockHref(ticker)`.
- **Null & unknown**: every call can answer `null` → render the `pt-na` state (or a reduced view). Payload lists may contain entries
  you don't know (new metric keys, new event kinds, events **without ticker**): render them generically or skip them, never throw.
- **Public copy is US English**, templated from data. **No LLM prose** on pages. Never show index symbols (`^…`); "the market" is SPY.

## Indicators (`@pretickt/components/indicators`, pure, ported from beta with tests)
`sma smaLast ema wilder rsi macd(→{macd,signal}) bollinger atr technicalSnapshot supportResistance vectorise(pivots) dailySigmaPct SCALES
structuralTrend applyPrice trend(series, nowMs) buildSectorIndex maCrossEta`, and `barsOf(points)` to turn price-series points into the
bars they read. Fields named `*Pct` are in percent (2.5 = +2.5%), not fractions: divide by 100 for `pct`.

## Checks (`components/_suite.ts` → `standardSuite(file, component)`)
For props sampled from the component's prop types (defaults, every literal of a union, known names): demo data renders with safe
markup and **hydrates without mismatch**; every call answering null renders the not-available state; unknown catalogue entries are
tolerated; the leading comment has the question, `@version` and `@evidence`. The build refuses a component over 32 KB.

## Workflow
1. Write `components/pt-x.test.ts` first (`// @vitest-environment happy-dom`, `standardSuite('pt-x.vue', PtX)` + what is specific —
   render with `render(PtX, props, withData({ 'news@1': payload }))`). 2. Write `components/pt-x.vue`. 3. `npm test` and
   `npm run typecheck` (vue-tsc). 4. `npm run build` → `dist/` (server bundle, client modules, `ds.css`, `index.json`). 5. Commit on
   `develop`; `main` = release. Pages that place a component are defined in the platform repo (`plant/src/generate/pages.ts`).

## Existing components (`dist/index.json`)
`pt-company-card` (the company at a glance — logo, price over 60 sessions, 52-week range, consensus, PT, tags with "Show all";
`size` wide = page header, compact = the hover card) · `pt-metric` (badge strip of the catalogue) · `pt-price-events` (price line + E/D/S/A markers grouped per day, range toggles, zoom &
pan) · `pt-price-target` (beta's pt-chart: clustered target dots, gradient segments, hover panel of the analysts, zoom & pan) ·
`pt-calendar` (month grid + macro dates + full list, previous/next month; `kind` earnings|dividend) · `pt-why-today` (answer-first
sentence + market/sector/stock bars + news spike) · `pt-screen` (ranked table with list-specific column and sparklines; `list` or
`peersOf`) · `pt-financials` (quarterly revenue/FCF bars + margins table) · `pt-news` (headlines with AI sentiment dots, nofollow
links) · `pt-insiders` (buy/sell totals + Form 4 table).

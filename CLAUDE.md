# pretickt components — how to write a component (for humans and LLMs)

This repo is public (MIT). It holds the **components** (Angular 22 standalone components), the **design system** (styles,
formatting, primitives), the **typologies** (the data contracts, with deterministic demo data) and the **page app** that renders
pages at build time and hydrates them in the browser. Data comes from closed pretickt APIs you never call yourself.
Spec: `pretickt/docs/superpowers/specs/2026-10-08-angular-components-design.md`. Node ≥ 24.15 (Angular CLI 22).

## The model in one paragraph
A component is **one TypeScript file** (`components/pt-<name>.ts`): a standalone component with signals, `input()` and the new
control flow (`@if`, `@for`, `@let`). It **asks for data where it declares its fields**: `pt.<typology>(() => params)` returns a
signal resource. The generator renders every page at build time with the official Angular compiler's server bundle (the page ships
its HTML and the answers it received); in the browser each placement hydrates when it scrolls into view (`@defer (hydrate on
viewport)`, generated for you): the same calls are answered from the page, new ones (a toggle, a month) go to the API. You never
fetch, never touch anything outside your template.

## File shape (copy this)
```ts
/**
 * The market question this answers, in one or two lines.
 * @version 1.0.0
 * @evidence where the need comes from (DataForSEO …, beta: …, a thread …) — at least one line, repeatable
 */
import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtToggles } from '@pretickt/components/ds';
import { date, pct } from '@pretickt/components/format';

type Window = '1d' | '5d' | '1m';

@Component({
  selector: 'pt-why-today',                       // = the file name, = the tag
  imports: [PtToggles],
  template: `
    @let m = move.value();
    @if (m === null) {<p class="pt-na">Data not available</p>}          <!-- ALWAYS handle null -->
    @else if (m) {
      <section [class.pt-busy]="move.loading()">
        <div class="pt-head">
          <p class="pt-why-lead">{{ m.name }} {{ pct(m.ret) }} on {{ date(m.asOf) }}</p>
          <div ptToggles [value]="win()" [options]="WINDOWS" aria-label="Window" (choose)="pick($event)"></div>
        </div>
      </section>
    }`,
})
export class PtWhyToday {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly window = input<Window>('1d');                       // a literal default: a page that omits it gets this one

  protected readonly win = linkedSignal(() => this.window());  // the reader's choice, shown at once
  protected readonly move = this.pt.moveBreakdown(() => ({ ticker: this.ticker(), window: this.win() }));
  protected readonly WINDOWS = [['1d', '1D'], ['5d', '5D'], ['1m', '1M']] as const;
  protected readonly pct = pct;
  protected readonly date = date;

  protected pick(w: Window) { this.win.set(w); this.move.retry(); }   // interaction = set a signal; retry after a failure
}
```
- The **tag is the file name** and the `selector`; the placement id is `tag@version`. Change `@version` on every change to a
  deployed component. The class name is the tag in PascalCase; the file exports exactly one component.
- **Inputs are the component's parameters** (pages set them; the checks sample them from their types — use literal unions and
  literal defaults). `input.required<T>()`, `input<T>(literal)` or `input<T>()` (optional, `undefined`); **no alias, no transform,
  no computed default**. Known names the checks can fill: `ticker`, `peersOf`, `month`, `metrics`.
- The template is **inline** (one file); no `styles` (see "CSS"). Pure helpers (geometry, grouping) live in the same file and may be exported for tests.

## Data: `Pt` (`@pretickt/components/context`)
`private readonly pt = inject(Pt)`, then one method per typology, called **where you declare a field**:
`pt.news(() => ({ ticker: this.ticker(), limit: this.limit() }))` → a `PtResource`:
- `value()`: the payload; **`null`** when it is not available; `undefined` only while a call never answered is pending (never on
  the first render of a page: the build recorded it) — templates read `@if (v === null) {na} @else if (v) {…}`.
- `loading()`: a newer call is on its way (show `pt-busy`); the last value stays on screen meanwhile.
- `params()`: the params of the **value shown** — labels that name a parameter (a month, a range) come from it, while the
  control shows the reader's choice at once (`linkedSignal` for the choice).
- `failed()` / `retry()`: in the browser a failed request (rate limit, offline) keeps the last value; the page adds the notice
  "Could not load data — showing the last values"; `retry()` asks again (call it when the reader presses the control again).
The params function is reactive: change a signal it reads and the resource asks again; the **latest params win**. Return `null`
for "no call". **Params must be deterministic** (never the clock or randomness): the browser finds the build's answer by them.

| method | params | payload |
|---|---|---|
| `pt.metric` | `{ticker, metrics: MetricKey[] (≤32)}` | `MetricItem[]` (Badge shape). Keys: `pe pe_vs_sector pe_vs_own pt_upside consensus market_cap fcf_yield insider_net earnings_in news off_high off_ath range_52w trend trend_ma ma_detail ma_cross sector_trend rsi14 support resistance bollinger macd atr_pct volume_ratio` |
| `pt.priceSeries` | `{tickers ≤8, range 1m…5y, interval '1d', rebase}` | `[{ticker, points[{t,o,h,l,c,v}]}]` (adjusted) |
| `pt.events` | `{scope: {by:'ticker',ticker,range,ahead} \| {by:'universe',month} \| {by:'dates',from,to ≤14 days}, kinds: earnings,dividend,split,analyst,macro}` (universe scopes: months within `CALENDAR_MONTHS` of the latest session; NYSE holidays come as `macro` items labelled "Closed") | `{asOf, items[]}` — `macro` items have **no ticker** (`meta.label` Fed/FOMC/CPI/PCE/Jobs/GDP) |
| `pt.analysts` | `{ticker, window 1y\|2y}` | `{asOf, price, summary{low,mean,median,high,n}, consensus, history[], targets[], accuracy[]}` |
| `pt.fundamentals` | `{ticker, periods ≤40}` | `{asOf, periods[{period,fiscal,revenue,eps,fcf,grossMargin,operatingMargin,netMargin,pe,shares}]}` oldest first |
| `pt.insider` | `{ticker, days 30–730}` | `{asOf, items[{date,filingDate,name,title,type buy\|sell\|other,shares,price,value}]}` |
| `pt.news` | `{ticker, limit ≤50}` | `{asOf, items[{publishedAt,title,site,url,sentiment −1…1\|null}]}` (sentiment by AI, numbers only) |
| `pt.moveBreakdown` | `{ticker, window 1d\|5d\|1m}` | `{asOf, ticker, name, sectorName, window, from, ret, marketRet, sectorRet, market, sector, specific, driver, news{today,avg30,spike,top[]}}` — `market+sector+specific = ret` |
| `pt.company` | `{ticker}` | `{ticker, name, sector, industry, logo}` — `logo` is a file the site publishes (`/logos/<file>`), or null |
| `pt.screen` | `{scope: {list: biggest_losers\|biggest_gainers\|52w_low\|52w_high\|undervalued\|insider_buying\|most_active} \| {peersOf}, limit ≤50}` | `{asOf, rows[{ticker,name,sector,logo,close,chg1d,offHigh,pe,ptUpside,marketCap,insiderNet,volumeRatio,spark[20],self}]}` |

Types (`MoveBreakdown`, `News`, `MetricItem`, `EventItem`, `ScreenList`, …) and plain values (`RANGES`, `SENTIMENT_FLAT`,
`METRIC_KEYS`, `CALENDAR_MONTHS`, `cmp`) come from `@pretickt/components/typologies` (in components that entry carries no schema:
zod never reaches a page). Each typology has a deterministic `demo` the checks and the admin bench use. Adding a typology is a
platform change (schema here + resolver in the private platform + a public-data test).

## Design system (`@pretickt/components/ds`, `@pretickt/components/format`, `styles/ds.css`)
- **Classes first** (global `ds.css`, Tailwind 4): `pt-head` (title row with controls), `pt-lede`, `pt-note`, `pt-meta` (small
  secondary text), `pt-na` (the not-available box — only for that), `pt-busy` (loading), `pt-table-wrap/pt-table/pt-num`,
  `pt-badges/pt-badge`, `pt-t-pos/neg/flat/na` (signed text), `pt-dot-pos/neg/flat/na`, `pt-news/pt-news-item`, `pt-spark`,
  `pt-chart/pt-chart-svg/pt-line/pt-grid/pt-axis`, `pt-legend/pt-key`. Tones are always `pos/neg/flat/na`. Tokens (colours,
  radius) are CSS variables: `--color-pos`, `--color-neg`, `--color-ink`, `--color-ink-soft`, `--color-surface`, `--color-primary`…
- **Format** (deterministic, the same on server and browser — never `Intl`/`toLocale*`): `num(v,digits)`, `pct(fraction →
  "+12.3%")`, `level(fraction → "12.3%")`, `usd(v,{compact,signed,digits})`, `money(v,digits)`, `amount(cash)`, `compact`,
  `date(iso → "Sep 30, 2026")`, `month(ym → "Mar 26")`, `tone(v, flatBand)`, `href(url)` (http(s) or a site path, else `#`),
  `stockHref(ticker)`, `tip({ Label: value })`, `badgeValue(badge)`, `svgId(s)`. Expose what the template uses as class fields
  (`protected readonly pct = pct`).
- **Companies**: `<a ptCompany [ticker] [name] [logo]></a>` (logo + ticker + name, linked to the company page) and `<pt-logo [ticker]
  [src] [size] />` (`src` = a payload's `logo`; none → initials, no request). **Every link to `/stocks/<t>/` opens the company card
  on hover** (the page does it, desktop only): link companies with `stockHref` / `ptCompany`, nothing else to do; a `data-tip` on
  such a link becomes the card's footer instead of a text tooltip.
- **Sortable tables**: `protected readonly sort = useSort(() => rows, { k: (row) => value, … })` and `<th ptSortTh
  [state]="sort.state('k')" (sort)="sort.toggle('k')">Label</th>` in the header, rows from `sort.sorted()` (numbers high first,
  dates newest first, text A→Z without case, then reverse, then the original order; missing values last). The server renders the
  original order.
- **Primitives**: `<div ptToggles [value] [options]="[[v, label], …]" aria-label="…" (choose)="…">` (emits on every press),
  `<li [ptBadge]="item" size="mini">` inside `<ul class="pt-badges">`, `<svg [ptIcon]="name">` (calendar target trend-up
  trend-down alert peak; wrap in `@if (iconPath(name))`), `<div ptChart [w] [h] [plotW] [plotH] [id] [label] [(view)]>` — the
  zoomable chart frame; put your parts in `<svg:g ptDefs>`, `<svg:g ptAxes>` (with `<svg:g ptYAxis …>` / `<svg:g ptTimeAxis …>`),
  `<svg:g ptPlot>` (clipped), `<svg:g ptFront>`, and html after the svg in `<ng-container ngProjectAs="[ptAfter]">`. Geometry:
  `applyXViewport`, `applyYViewport`, `FULL_VIEWPORT`, `closeAt`, `isoDay`, `linePath`, `monthTicks`. Reset the view when new data
  is on screen: `view = linkedSignal<unknown, Viewport>({ source: () => this.series.params(), computation: () => FULL_VIEWPORT })`.
- **Tooltips without code**: `[attr.data-tip]="tip({ Label: value })"` on any element; the page shows it as text.
- **Interactions** are counted by the page (analytics): the primitives dispatch `pt-interact`; for your own controls dispatch
  `new CustomEvent('pt-interact', { bubbles: true, detail: { action } })` from the element.

## CSS
**Design-system classes only** — a component has no `styles`: Angular inserts component styles as `<style>` elements, which the
site's CSP (`style-src 'self'`) refuses, so the lint refuses them. Compose the classes of `ds.css`; dynamic values go in `[style]`
/ `[class]` bindings (allowed); if a component needs a look the design system does not have, propose a class for `ds.css` (a
change in this repo, reviewed like any other).

## Rules (the lint enforces what it can; the platform sandbox contains the rest)
- **No data access of your own**: no `fetch`, `XMLHttpRequest`, `WebSocket`, storage, cookies, `window`/`document`, no `import()`,
  no `eval`, no `import.meta`, no `DomSanitizer`/`bypassSecurityTrust*`/`Renderer2`/`DOCUMENT` (an `ElementRef` from `viewChild`
  may read sizes and move focus). Only these imports: `@angular/core`, `@pretickt/components/{context,ds,format,typologies,indicators}`.
  No `templateUrl`, `styles`, `styleUrl(s)`, `providers`, `viewProviders`, `encapsulation`, `standalone: false`.
- **Deterministic**: no `Date.now()`, `new Date()` without argument, `Math.random()`, `Intl`, `toLocale*` — "today" is the `asOf`
  the payload carries. Server and browser must render the same HTML (hydration).
- **Never write HTML**: no `[innerHTML]`/`[outerHTML]`. Angular escapes text and attributes; links from data go through `href(url)`
  (external ones get `target="_blank" rel="nofollow noopener noreferrer"`), company pages through `stockHref(ticker)`. No `<script>`,
  `<style>`, `<iframe>`, `<form>` in a template; no `ld+json` either (structured data is the generator's, in `<head>`).
- **Null & unknown**: every call can answer `null` → render the `pt-na` state (or a reduced view). Payload lists may contain entries
  you don't know (new metric keys, new event kinds, events **without ticker**): render them generically or skip them, never throw.
- **Public copy is US English**, templated from data. **No LLM prose** on pages. Never show index symbols (`^…`); "the market" is SPY.

## Indicators (`@pretickt/components/indicators`, pure, ported from beta with tests)
`sma smaLast ema wilder rsi macd(→{macd,signal}) bollinger atr technicalSnapshot supportResistance vectorise(pivots) dailySigmaPct SCALES
structuralTrend applyPrice trend(series, nowMs) buildSectorIndex maCrossEta`, and `barsOf(points)` to turn price-series points into the
bars they read. Fields named `*Pct` are in percent (2.5 = +2.5%), not fractions: divide by 100 for `pct`.

## Checks
- `ng test` (Vitest + TestBed): `components/pt-x.spec.ts` with `render(PtX, inputs, withData({ 'news@1': payload }))` from
  `components/_spec.ts` (renders the way the build does; `{ browser: true }` for after-load behaviour), `basics(PtX, inputs)` (demo
  data renders, missing data shows `pt-na`), `press(f, el, label)` for interactions, `column(el, n)` for tables.
- `npm test` = Vitest for the plain TypeScript (typologies, indicators, checks, scripts) + `ng test` for the components.
- `npm run build`: the lint and the metadata of every component, inputs read by the TypeScript checker, the generated registry
  (`src/site/registry.generated.ts` — never edit it), `ng build`, budgets (main bundle ≤ 240 KB, a component's own chunk ≤ 32 KB).
- `npm run check` (after the build): for props sampled from the inputs' types, demo data renders with safe markup, missing data
  renders `pt-na`, unknown catalogue entries are tolerated; concurrent page renders are whole; each page **hydrates keeping every
  element of the server HTML** (development build: Angular validates every node; production build: as shipped) without one data
  request.

## Workflow
1. Write `components/pt-x.spec.ts` first. 2. Write `components/pt-x.ts`. 3. `npm test`. 4. `npm run build` → `dist/`
(`site/browser`, `site/server`, `ds.css`, `index.json`) and `npm run check`. 5. Commit on `develop`; `main` = release. Pages that
place a component are defined in the platform repo (`plant/src/generate/pages.ts`); the build makes every component placeable
(registry).

## Existing components (`dist/index.json`)
`pt-company-card` (the company at a glance — logo, price over 60 sessions, 52-week range, consensus, PT, tags with "Show all";
`size` wide = page header, compact = the hover card) · `pt-metric` (badge strip of the catalogue) · `pt-price-events` (price line +
E/D/S/A markers grouped per day, range toggles, zoom & pan) · `pt-price-target` (beta's pt-chart: clustered target dots, gradient
segments, hover panel of the analysts, zoom & pan) · `pt-calendar` (month grid + macro dates + full list, previous/next month; `kind`
earnings|dividend; `view: 'week'` + `start` = five sessions for the home page; "+N more" opens the whole day) · `pt-why-today`
(answer-first sentence + market/sector/stock bars + news spike) · `pt-screen` (ranked table with list-specific column and sparklines;
`list` or `peersOf`) · `pt-financials` (quarterly revenue/FCF bars + margins table) · `pt-news` (headlines with AI sentiment dots,
nofollow links) · `pt-insiders` (buy/sell totals + Form 4 table).

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
| `pt.events` | `{scope: {by:'ticker',ticker,range,ahead} \| {by:'universe',month} \| {by:'dates',from,to ≤14 days}, kinds: earnings,dividend,split,analyst,macro}` (universe scopes: months within `CALENDAR_MONTHS` of the latest session; NYSE holidays come as `macro` items labelled "Closed") | `{asOf, normal?, items[]}` — `macro` items have **no ticker** (`meta.label` Fed/FOMC/CPI/PCE/Jobs/GDP). 1.2, optional (what to expect): earnings `meta.moves` (≤ 8, the sessions after the last reports, oldest first, to 0.1%), `record{beats,of}` (against the EPS estimate), `move` (this report's, once traded), `news` (≤ 5: `publishedAt,title,site,url,tag` — tag from a classifier, null until then); macro `meta.headline{name,unit,expected,previous,actual}`, `moves` (SPY on the last releases), `move`, `news`; `normal` = SPY's usual daily move |
| `pt.analysts` | `{ticker, window 1y\|2y}` | `{asOf, price, summary{low,mean,median,high,n}, consensus, history[], targets[], accuracy[]}` |
| `pt.fundamentals` | `{ticker, periods ≤40}` | `{asOf, periods[{period,fiscal,revenue,eps,fcf,grossMargin,operatingMargin,netMargin,pe,shares}]}` oldest first |
| `pt.insider` | `{ticker, days 30–730}` | `{asOf, items[{date,filingDate,name,title,type buy\|sell\|other,shares,price,value}]}` |
| `pt.news` | `{ticker, limit ≤50}` | `{asOf, items[{publishedAt,title,site,url,sentiment −1…1\|null}]}` (sentiment by AI, numbers only) |
| `pt.moveBreakdown` | `{ticker, window 1d\|5d\|1m}` | `{asOf, ticker, name, sectorName, window, from, ret, marketRet, sectorRet, market, sector, specific, driver, news{today,avg30,spike,top[]}}` — `market+sector+specific = ret` |
| `pt.company` | `{ticker}` | `{ticker, name, sector, industry, logo}` — `logo` is a file the site publishes (`/logos/<file>`), or null |
| `pt.screen` | `{scope: {list: biggest_losers\|biggest_gainers\|52w_low\|52w_high\|undervalued\|insider_buying\|most_active\|largest, sector?: one of SECTORS} \| {peersOf}, limit ≤ SCREEN_MAX (600)}` | `{asOf, rows[{ticker,name,sector,logo,close,chg1d,offHigh,pe,ptUpside,marketCap,insiderNet,volumeRatio,spark[20],self}]}` |
| `pt.feed` | `{scope: {by:'ticker',ticker} \| {by:'sector',sector: one of SECTORS} \| {by:'market'}}` | `{asOf, items[{date,group technical\|fundamental\|news\|market,kind,ticker\|null,name,logo,label,sub,text,impact,impactKind day\|since\|expected\|typical\|null,session,href,spark{closes ≤ 40,at}\|null}]}` — the events of the last `FEED_DAYS.back` (120) days and the next `FEED_DAYS.ahead` (60), at most `FEED_MAX` (40) by relevance, in date order; `kind` is open (`FEED_KINDS` today), `ticker` null = the market's own (macro, SPY); `text` is the sentence (tooltip, indexed), `href` a site path |
| `pt.ongoingMoves` | `{sort: cap\|move}` (default cap) | `{asOf, threshold, market: bullish\|bearish\|sideways\|null, rows[{ticker,name,logo,marketCap,kind rally\|drawdown,since,days,move,close,week,month,quarter,industry{median,peers[{ticker,move}]}\|null}]}` — the moves above 4% still running (beta's zigzag), this week's losers then gainers, each most important first, ≤ MOVES_PER_SIDE (14) a side |
| `pt.basket` | `{ticker}` | `{asOf, ticker, name, logo, tracks, group, same[], note, close, ret, coverage, state ok\|low, stale, fund{expenseRatio,assets,holdings,top10,ret1y,ret5y,spy1y,spy5y,yield}, target{upside,price,share,median,top[]}\|null, consensus{buy,hold,sell,n,label,share}\|null, pe{value,share}\|null, questions[{key,pos,flat,neg,share,comparable}]\|null, moves{sum,up[],down[]}, holdings[{ticker\|null,name,logo,weight,ret,upside,label}], faq[]}` — a fund's whole basket, as the nightly computed it; state `low` (under 80% on the site, or no good file in 7 days) carries no basket figure |
| `pt.sector` | `{sector}` | `{kind 'sector', asOf, sector, name, tracker, companies, value, ret, coverage 1, state ok, target\|null, consensus\|null, pe\|null, questions[]\|null, moves{sum,up[],down[]}, holdings[{ticker,name,logo,weight,ret,upside,label,close}], series[{t,c}], badges[MetricItem], faq[]}` — a sector's whole basket: every company on the site weighted by market value, its value over the year (today's shares at each day's adjusted close, not an index) and the header's badges; `tracker` is the SPDR fund named and linked, never its price. `news@1` takes `{sector, limit}` and `events@1` the scope `{by:'sector', sector, range, ahead}` (its 10 and 5 largest companies) |

**The reader's picks** (`PtPicks`, same entry): a component that asks the reader to call an open outcome ("Beat" / "Miss")
remembers the answer with `private readonly picks = inject(PtPicks)`: `picks.of(() => key)` → the pick (`string | null`),
`picks.set(key, value)` (null clears), `picks.ready()` — true only in a browser whose page stores picks, after the first render.
Render the pick buttons inside `@if (picks.ready())`, so the server HTML and hydration never depend on a pick. Picks live in this
browser only (the page's store, never sent anywhere); keys ≤ 200 characters, values ≤ 40; name a key by what is being called
(`ep:earnings:NVDA:2026-11-19`). Count a pick like any control: dispatch `pt-interact` from the button.

**Today's prices** (`PtLive`, same entry; since 2026-10-22): while the market is open the platform uploads an intraday file every 5
minutes (prices of bars over for at least 15 minutes, the market / sector / specific split, news since the last close, results just
reported). `private readonly live = inject(PtLive)`; `live.after(() => asOf)` → the `LiveDay` when its session is newer than `asOf`
(the date your payload stops at), else null — null on the server, in the checks and until the file has loaded, so show the live parts
inside `@if` and never let the server HTML depend on them. Say the delay wherever a live price shows ("15-min delayed"). Only the page
app reads the file (`src/site/live.ts`, the page model's `live` address); a component never fetches.
`live.bars()` → the session's line of every company (`live/bars-v1.json`: one close per 5-minute slot from 9:30 ET, the session, its previous one, `closed`), read at once and
again every 2 minutes while the session runs and the tab is in front (`mayRefresh`); null on the server and until rendered, and a failed read keeps the last lines. pt-company-header reads
only this file, so a page that shows it does not download the day's file unless something asks `after()`.

Types (`MoveBreakdown`, `News`, `MetricItem`, `EventItem`, `ScreenList`, …) and plain values (`RANGES`, `SENTIMENT_FLAT`,
`METRIC_KEYS`, `CALENDAR_MONTHS`, `cmp`) come from `@pretickt/components/typologies` (in components that entry carries no schema:
zod never reaches a page). Each typology has a deterministic `demo` the checks and the admin bench use. Adding a typology is a
platform change (schema here + resolver in the private platform + a public-data test).

## Design system (`@pretickt/components/ds`, `@pretickt/components/format`, `styles/ds.css`)
- **Classes first** (global `ds.css`, Tailwind 4): `pt-head` (title row with controls), `pt-lede`, `pt-note`, `pt-meta` (small
  secondary text), `pt-answer` (a page's answer sentence), `pt-prose` (static text: paragraphs and lists), `pt-na` (the not-available box — only for that), `pt-busy` (loading), `pt-table-wrap/pt-table/pt-num`,
  `pt-badges/pt-badge`, `pt-t-pos/neg/flat/na` (signed text), `pt-dot-pos/neg/flat/na`, `pt-news/pt-news-item`, `pt-spark`,
  `pt-chart/pt-chart-svg/pt-line/pt-grid/pt-axis`, `pt-legend/pt-key`. Tones are always `pos/neg/flat/na`. Tokens (colours,
  radius) are CSS variables: `--color-pos`, `--color-neg`, `--color-ink`, `--color-ink-soft`, `--color-surface`, `--color-primary`…
- **Format** (deterministic, the same on server and browser — never `Intl`/`toLocale*`): `num(v,digits)`, `pct(fraction →
  "+12.3%")`, `level(fraction → "12.3%")`, `usd(v,{compact,signed,digits})`, `money(v,digits)`, `amount(cash)`, `compact`,
  `date(iso → "Sep 30, 2026")`, `month(ym → "Mar 26")`, `dayMonth(iso → "Oct 30")`, `tone(v, flatBand)`, `href(url)` (http(s) or a site path, else `#`),
  `stockHref(ticker)`, `plainName(name → "Apple" from "Apple Inc.")`, `tip({ Label: value })`, `badgeValue(badge)`, `svgId(s)`. Expose what the template uses as class fields
  (`protected readonly pct = pct`).
- **Companies**: `<a ptCompany [ticker] [name] [logo]></a>` (logo + ticker + name, linked to the company page) and `<pt-logo [ticker]
  [src] [size] />` (`src` = a payload's `logo`; none → initials, no request). **Every link to `/stocks/<t>/` opens the company card
  on hover** (the page does it, desktop only): link companies with `stockHref` / `ptCompany`, nothing else to do; a `data-tip` on
  such a link becomes the card's footer instead of a text tooltip. A symbol that cannot be a link (inside a `<summary>`, which is one
  control: pt-calendar's rows) opens the card with `[attr.data-card]="ticker"`. Where the card belongs inside a box the component opens
  (pt-calendar's event, on a click, on any device), leave an empty `<div [attr.data-card-slot]="ticker"></div>`: the page mounts the
  compact card in it and removes it with the box.
- **Sortable tables**: `protected readonly sort = useSort(() => rows, { k: (row) => value, … })` and `<th ptSortTh
  [state]="sort.state('k')" (sort)="sort.toggle('k')">Label</th>` in the header, rows from `sort.sorted()` (numbers high first,
  dates newest first, text A→Z without case, then reverse, then the original order; missing values last). The server renders the
  original order.
- **Long tables show 20 rows, then "Show 20 more"**: `@if (hasMore()) {<pt-more (more)="…" />}` centered under the table (`MORE_STEP`
  = 20). Rows the component already has: `shown = linkedSignal({ source: () => this.data.value(), computation: () => MORE_STEP })`,
  rows `sort.sorted().slice(0, shown())` (sort the whole set, then cut). Rows the API has: grow the call's `limit` (pt-screen).
- **Primitives**: `<div ptToggles [value] [options]="[[v, label], …]" aria-label="…" (choose)="…">` (emits on every press),
  `<li [ptBadge]="item" size="mini">` inside `<ul class="pt-badges">`, `<svg [ptIcon]="name">` (calendar target trend-up
  trend-down alert peak valley earnings dividend split upgrade downgrade insider bolt news cross gauge bank dot; wrap in
  `@if (iconPath(name))` unless the name is one of these), `<div ptChart [w] [h] [plotW] [plotH] [id] [label] [(view)]>` — the
  zoomable chart frame; put your parts in `<svg:g ptDefs>`, `<svg:g ptAxes>` (with `<svg:g ptYAxis …>` / `<svg:g ptTimeAxis …>`),
  `<svg:g ptPlot>` (clipped), `<svg:g ptFront>`, and html after the svg in `<ng-container ngProjectAs="[ptAfter]">`. Geometry:
  `applyXViewport`, `applyYViewport`, `FULL_VIEWPORT`, `closeAt`, `isoDay`, `linePath`, `monthTicks`, `padTime` (a time chart's
  natural x domain plus `TIME_PAD` = 6% of its span after the last day, so future events and 12-month targets stand clear of the
  price axis; apply the viewport on top). Reset the view when new data
  is on screen: `view = linkedSignal<unknown, Viewport>({ source: () => this.series.params(), computation: () => FULL_VIEWPORT })`.
- **Tooltips without code**: `[attr.data-tip]="tip({ Label: value })"` on any element; the page shows it as text.
- **Interactions** are counted by the page (analytics): the primitives dispatch `pt-interact`; for your own controls dispatch
  `new CustomEvent('pt-interact', { bubbles: true, detail: { action } })` from the element.
- **Sharing is the page's** (`src/site/share.ts`): under every placement a "Share" button draws the island as a PNG (html-to-image)
  with the page's title above and its link below, and offers the share sheet, copy, download, X and Reddit; the link is the
  canonical page with the section's anchor. Nothing to write in a component; keep its look inside its island (no rule that
  depends on the page around it) and its images on the site (`/logos/…`), so the drawing matches the screen.
  A **part** can be shared on its own (pt-value's cards): give it an `id` (its anchor) and `data-share-part="<its name>"`, and put
  inside it the icon alone — `<button type="button" class="pt-share-icon" data-share aria-haspopup="dialog" aria-label="Share this
  card"><svg ptIcon="share"></svg></button>` (Romeo: "for smaller parts leave the share icon only"), where it moves nothing the
  part lines up by. The page draws the part alone, at least 360 px wide, in its place's rules; links to its anchor; counts `share-part`.

## CSS
**Design-system classes only** — a component has no `styles`: Angular inserts component styles as `<style>` elements, which the
site's CSP (`style-src 'self'`) refuses, so the lint refuses them. Compose the classes of `ds.css`; dynamic values go in `[style]`
/ `[class]` bindings (allowed); if a component needs a look the design system does not have, propose a class for `ds.css` (a
change in this repo, reviewed like any other).

## Rules (the lint enforces what it can; the platform sandbox contains the rest)
- **No data access of your own**: no `fetch`, `XMLHttpRequest`, `WebSocket`, storage, cookies, `window`/`document`, no `import()`,
  no `eval`, no `import.meta`, no `DomSanitizer`/`bypassSecurityTrust*`/`Renderer2`/`DOCUMENT` (an `ElementRef` from `viewChild`
  may read sizes, move focus and scroll an element the component owns — pt-feed opens its strip on today in an `afterRenderEffect`). Only these imports: `@angular/core`, `@pretickt/components/{context,ds,format,typologies,indicators,alerts}`.
  No `templateUrl`, `styles`, `styleUrl(s)`, `providers`, `viewProviders`, `encapsulation`, `standalone: false`.
- **Deterministic**: no `Date.now()`, `new Date()` without argument, `Math.random()`, `Intl`, `toLocale*` — "today" is the `asOf`
  the payload carries. Server and browser must render the same HTML (hydration).
- **A sentence's parts never go in a `@let`** (`Said`, or any list mixing text and objects): alias them, `@if (sentence(); as s)`.
  Angular keeps a `@let`'s value among its own views and, cleaning up after hydration, takes a list whose second item is an object
  for one of them: an error on load when its seventh is text (`Cannot create property 'i18nNodes' on string …`, angular/angular#59504;
  pt-answer 1.3.1 broke the calendar, list and peers pages so). Lists of objects only (metric items, cards) survive it.
- **Never write HTML**: no `[innerHTML]`/`[outerHTML]`. Angular escapes text and attributes; links from data go through `href(url)`
  (external ones get `target="_blank" rel="nofollow noopener noreferrer"`), company pages through `stockHref(ticker)`. No `<script>`,
  `<style>`, `<iframe>`, `<form>` in a template; no `ld+json` either (structured data is the generator's, in `<head>`).
- **Null & unknown**: every call can answer `null` → render the `pt-na` state (or a reduced view). Payload lists may contain entries
  you don't know (new metric keys, new event kinds, events **without ticker**): render them generically or skip them, never throw.
- **Public copy is US English**, templated from data. **No LLM prose** on pages. Never show index symbols (`^…`); "the market" is SPY.

## Alerts (`@pretickt/components/alerts`, `src/site/alerts/`)
Email alerts (spec `pretickt/docs/superpowers/specs/2026-11-01-email-alerts-design.md`): on a page with alerts a bell under every
placement adds the badge of its section to the alert being built; an alert is a rule — every condition true together — saved with an
email, no account.
- **The catalog** (`src/alerts/catalog.ts`): 18 conditions, each with its params, the card's sentence, a short name, the event's line
  and `test(row, params)` — the same function counts in the editor and fires on the platform. Ids, params and defaults are stored in
  rules: change them with a migration. `rowsOf` merges the nightly's universe with a newer live day; rules in `rule.ts`; the server's
  schema is `@pretickt/components/alerts/schema` (never on a page); the badge each component's bell adds is `alertSourceOf`
  (`sources.ts`); version A's charts are `chartOf` (`charts.ts`, the email's image draws the same models).
- **`PtAlerts`** is the alerts entry's, not the context's: the draft, saving, the page's backend `PT_ALERTS` (`token.ts`). A component
  imports it from `@pretickt/components/alerts`.
- **The page app** owns the alerts' UI: renderPage computes each placement's badge on the server (`withAlerts`) when the page model has
  `alerts`, the slot draws the bell beside Share, and the page app loads one small chunk (`start.ts`, about 500 B): a bell's press
  loads the editor's chunk (`pressBell`), an email's `?alert=` shows the alert above the company page (`showEvent`, `event.ts`), the
  alerts' page's `[data-pt-alerts]` gets the manage page (`mountManage`). PtAlerts runs on the site's backend (`backend.ts`: the
  store's `alert-universe@1`, `live/bars-v1.json`, `/v1/alerts`) in an injector of its own (`env.ts`): main.ts provides nothing.
- **The human check** (Romeo, 2026-11-02): a new alert's Save waits for a Cloudflare Turnstile token. The backend's `check`
  (`turnstile.ts`, the page model's `turnstile` site key) loads Cloudflare's script from its own address only when the email field is
  first touched; the widget is invisible unless Cloudflare asks for a tap, a failed save asks for a fresh token (each is good once),
  the Worker verifies it before writing anything. The made-up backends have no check; the stories use Cloudflare's public test keys.
- **The main bundle is full** (about 242 KB of 243,500 bytes on 2026-11-05; Romeo raised the budget from 240 KB for pt-company-header, and the design of the baskets to 243,500): a registry component costs it about 1 KB, so the alerts' parts
  are not placeable components, and what they add to the main bundle stays a few bytes. Two traps: a `document:` host listener puts
  Angular's resolver in main (add such a listener by hand), and every symbol a chunk imports from main lengthens main's export list.

## Search engines and AI answers (SEO, AI search)
Google shows an AI Overview on most questions about a stock, and the chat assistants (ChatGPT, Claude, Gemini, Perplexity) answer
them too, quoting the sites that write the exact number with its date. What a component prints is that text:
- **The answer is a sentence in the page**: the company's common name with its ticker, the number, the date — "Nvidia NVDA moved
  ±6.8% on average in the session after its last 8 reports (as of Oct 27, 2026)". A `data-tip`, an SVG or a hover card is not text to
  them: the fact is in the template's text too (a `pt-sr` span when it must not show).
- **The question in the words people search, then the answer in its first sentence**: "Is Nvidia a good stock to buy?", "When does
  Nvidia report earnings?", "Earnings calendar this week", "Stock market heat map".
- **Common names, as people and the press write them**: every company name a component prints goes through `plainName` (format):
  the legal suffixes go, then `COMMON_NAMES` gives the name the press uses where the provider's is not it ("NVIDIA Corporation" →
  "Nvidia", "Meta Platforms, Inc." → "Meta", "Advanced Micro Devices" → "AMD"; read against www's 517 companies on 2026-10-31: a new
  company with an odd name gets its line there). `named(name, ticker)` is the usual form, "Nvidia NVDA", the ticker without parentheses
  (Romeo, 2026-10-31), the name alone when it is the ticker in other letters ("Meta", "AMD"); a table shows the name beside the ticker
  only when it differs.
- **Every company a text names is a link with its logo, and its card opens on the ticker** (Romeo, 2026-10-31: "aggiungi i loghi e
  passando sopra al simbolo compare sempre la card"). A sentence is built with `say` and drawn with `<pt-say [parts]>`: each
  `mention(ticker, name, logo)` becomes `<a ptMention>` (logo, common name, ticker; `section` opens the page at one of its sections).
  `saidText` is its text, "Nvidia NVDA". A ticker elsewhere (a table, a chart's row) is a link to `/stocks/<t>/` (a `#section`
  allowed): the page runtime opens the company card on every company link, the page's own company too, but in the header's search
  and the sub-navigation (cards.ts).
- **The date in the text**, and in a heading when the data is today's ("Earnings today · Wed, Oct 28"), always with the explicit date:
  a page built at night is read the next day. Say what is an estimate (a date not confirmed, a forecast).
- **Links say where they go** ("Nvidia earnings date", "Why Meta is down this week"), never "more" or "the answer on pretickt".
- **Questions with their answers come in the payload**, templated by the resolver; one answer per question on a page. A question about
  buying is answered with facts, never a yes or a no. The template marks each one it answers: `data-faq` around it, `data-faq-q` on the
  question, `data-faq-a` on the answer (visible text both). renderPage returns them (`faq`, src/site/faq.ts, in page order; a second
  answer to the same question further down comes back in `faqRepeated`) and the generator writes them as the page's FAQPage JSON-LD:
  components never write ld+json. A question another placement answers keeps its place with a link to that answer (`faqId` gives a
  question its address: pt-value's `#value-who-is-dumping-nvidia-stock`).
The evidence (the questions searched for each component, who the AI answers cite) is in the private repo: `launch/RESEARCH.md` §9
and `launch/AI-SEARCH.md`.

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
  (`src/site/registry.generated.ts` — never edit it), `ng build`, budgets (main bundle ≤ 243.5 KB, a component's own chunk ≤ 32 KB).
- `npm run check` (after the build): for props sampled from the inputs' types, demo data renders with safe markup, missing data
  renders `pt-na`, unknown catalogue entries are tolerated; concurrent page renders are whole; each page **hydrates keeping every
  element of the server HTML** (development build: Angular validates every node; production build: as shipped) without one data
  request and without an error, an uncaught one included. Besides the samples (one input changed at a time), the generator's pages:
  pt-answer on each topic with the company, list or month it needs, and the calendar pages (answer and calendar on one call).

## Stories (how a component is looked at)
Every component has `components/pt-x.stories.ts`: the scenarios a reader can meet, each a `story()` from `src/stories/story.ts` (a
port of browserbot's `story.component.ts`), exported as `stories` and listed in `src/stories/index.ts` (the package is
`sideEffects: false`: a stories file imported only for its effect would be dropped).
```ts
export const stories = [
  story(PtX, { name: 'Demo', inputs: { ticker: 'NVDA' } }),
  story(PtX, { name: 'www: NKE', inputs: { ticker: 'NKE' }, live: true }),                    // www's API, through the dev proxy
  story(PtX, { name: 'Crowded', inputs: { ticker: 'NVDA' }, data: { 'analysts@1': crowded } }), // fixed answers, the rest the demo
  story(PtX, { name: 'Market open', inputs: { ticker: 'NVDA' }, providers: liveDay({ q: { NVDA: … } }) }),
  story(PtX, { name: 'Not available', inputs: { ticker: 'NVDA' }, data: null }),
];
```
- `data`: answers by typology id — a payload, `null` (not available) or a function of the call's params (a toggle that asks again);
  `demo<T>(typology, params)` gives a payload to build a fixture on. `picks` pre-fills the reader's picks; `run(refresh, el)` plays
  an interaction a second after mounting (a press).
- Cover: the demo, each input that changes the look, the edge cases the spec tests (empty, a missing part, crowded, long), one or
  two live tickers that show them on real data, not available. **Fixtures are made up**: the repo is public, real payloads stay on
  www (`live` reads them when the page is viewed). A preview on real data gathered by hand (a draft with no pipeline yet) goes in
  `.stories/local/stories.ts`, git-ignored: `npm run stories` adds its stories at start, and it is never committed.
- `npm run stories` → http://localhost:4300/visual/pt-x, every scenario under its name (`?phone`: 390 px frames, so the phone
  media queries apply; `/visual/pt-x/<n>`: one alone). The platform's experiments (`admin/experiments`, next to this checkout)
  show up too, their bench presets as stories. In the console, `copy(storyOf($0))` copies what a story shows as a new story.
- `src/stories/stories.spec.ts` fails a component without stories, a fixture its typology rejects and a story that does not render.
- **Pages before they are published** (`src/stories/pages.stories.ts`, group "Pages · before publishing"): a page as the platform's
  `pages.ts` builds it (crumbs, h1, lede, sub-navigation, sections), its parts the components on www's data and the drafts on their
  made-up data, what changes marked new; above it what search engines read first (address, title, description, JSON-LD with the
  FAQPage read from the questions the page shows). `/visual/pt-preview-company`, `-home`, `-sector`, `-market-map`, `-trending`, and
  `/visual/pt-preview-names` (every company's name today and its common name). They mirror pages.ts by hand: change them with it.
- **Drafts** (`components/drafts/`): a component whose data has no pipeline yet, to be looked at before it has one. It takes its
  payload as an input (the shape its typology will have), its made-up data is in `mock.ts`, its classes in `drafts.css` (loaded by
  the stories app only) and its stories in `home.stories.ts`. The build never sees it (not in the registry, never on a page). To
  promote one: move it to `components/`, add the typology (schema = the input's type, demo = the mock) with its resolver in the
  platform, replace the input with the `pt` call, move its classes to `ds.css`, and give it `@evidence`.

## Workflow
1. Write `components/pt-x.spec.ts` first. 2. Write `components/pt-x.ts`. 3. Write `components/pt-x.stories.ts` and look at it
(`npm run stories`). 4. `npm test`. 5. `npm run build` → `dist/` (`site/browser`, `site/server`, `ds.css`, `index.json`) and
`npm run check`. 6. Commit on `develop`; `main` = release. Pages that place a component are defined in the platform repo
(`plant/src/generate/pages.ts`); the build makes every component placeable (registry).

## Existing components (`dist/index.json`)
`pt-company-header` (first on each company page, `size` full on the main page, low on the sub-pages: price over three months and the session, badges in Bullish / Neutral / Bearish bands that
follow the delayed price while the page is open; keeps its height at every update; the rule is `lean`, not the catalogue's tone; the strip below reads its classes) ·
`pt-basket` (a fund's sections, one per placement, `section` moves | holdings | analysts | questions | faq: why it moved with the companies behind it, keeping its height when the delayed prices arrive; what it holds; target, consensus and P/E, each saying how much of the fund it rests on; the questions about the business as shares of the weight, never a yes or a no; a fund we cover under 80% shows none of those figures) · `pt-company-card` (the company at a glance — logo, price over 60 sessions, 52-week range, consensus, PT, tags with "Show all";
`size` wide = page header, compact = the hover card; once the wide card has scrolled under the header, the page app shows the
company in the header — `src/site/cobar.ts` copies the text of `.pt-card-name`, `.pt-card-who .pt-meta`, `.pt-card-close` and
`.pt-card-pt`, so keep those classes) · `pt-metric` (badge strip of the catalogue) · `pt-price-events` (price line +
E/D/S/A markers grouped per day, range toggles, zoom & pan) · `pt-price-target` (the targets upright first — a rail from the lowest to the highest target, green above today's price and red
below, a dot per firm's latest target, today as a dark pill, low/average/median/high with their distance from today — then beta's
pt-chart: clustered target dots, gradient segments, hover panel of the analysts, zoom & pan) · `pt-answer` (the page's question answered first, in a sentence or two, from the data the page already asks for; `topic` forecast |
price-target | peers | financials | insiders | basket with `ticker`, list with `list` and optional `sector`, earnings | dividends with `month`) ·
`pt-calendar` (month grid + macro dates + full list, previous/next month; `kind`
earnings|dividend; `view: 'week'` + `start` = five sessions for the home page; "+N more" opens the whole day) · `pt-why-today`
(answer-first sentence + market/sector/stock bars + news spike) · `pt-screen` (ranked table with list-specific column and sparklines;
`list` or `peersOf`, optional `sector`; grows by 20 up to every company) · `pt-financials` (quarterly revenue/FCF bars + margins table) · `pt-news` (headlines with AI sentiment dots,
nofollow links) · `pt-insiders` (buy/sell totals + Form 4 table) · `pt-movers` (beta's "Ongoing moves" tornado for the home: this
week's losers left, gainers right, the largest — or with the toggle the biggest moves — in the middle; week / 30 / 90 days in three
shades with a legend, ⚠ when the industry moves too, the market chip; each bar links its company with its numbers as tooltip rows;
while a session newer than the data runs, a thin dark line per company for today's delayed move, read once when the page opens, with its time and delay in the legend;
phones see the middle half at double size) · `pt-feed` (the feed: small event cards on a strip that scrolls sideways and opens on
today — technical, fundamental, news and the market's own, each with the move it came with and a small price chart around it (the
event's jump or the move since in its tone; a coming event's band of its usual move), dashed when still to come; a click opens
the page that explains it, the sentence is the tooltip and the indexed text; `ticker`, or `sector`, or neither for the market).

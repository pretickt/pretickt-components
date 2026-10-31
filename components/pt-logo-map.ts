/**
 * The market at a glance: the largest companies as a map of logos, one block per sector, each company a tile as large as its
 * market value and coloured by today's move — where the market's weight is and which way it went today. Under the map a line says
 * how to read it, the way the AI answers describe a heat map; above it, the day in a dated sentence (sectors up, the three largest,
 * the biggest moves) — the text that changes every day and that an answer can quote with its date.
 * @version 0.2.1
 * @evidence Romeo 2026-10-25: home components "con i loghi delle aziende" for the overview — H3 · The market at a glance, ★ sector map (brainstorming/mappa-componenti.html)
 * @evidence DataForSEO 2026-10-28 (round 13): the "stock market heat map" family ≈33,400 searches a month, keyword difficulty 25–30, AI Overview on 2%, no dominant site (apps, guides, brokers); "largest companies by market cap" 22,200 (launch/RESEARCH.md §9)
 * @evidence AI answers (ChatGPT, Claude, Gemini, Perplexity, AI Mode, 2026-10-28) to "where can I see a stock market heat map today" list TradingView, Finviz, Investing.com, Barchart, MarketBeat, each with one line on how the map reads (launch/AI-SEARCH.md)
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { date, named, pct, plainName, stockHref, tip, usd } from '@pretickt/components/format';
import type { ScreenRow } from '@pretickt/components/typologies';

type Sector = 'Technology' | 'Industrials' | 'Financial Services' | 'Healthcare' | 'Consumer Cyclical' | 'Consumer Defensive' | 'Utilities'
  | 'Real Estate' | 'Basic Materials' | 'Energy' | 'Communication Services';
export interface Box { x: number; y: number; w: number; h: number }
export interface Tile extends Box { ticker: string; name: string; logo: string | null; move: number | null; cap: number; step: string; sector: string }
export interface Block extends Box { sector: string; move: number | null; head: boolean; label: string | null }

/** A squarified treemap (Bruls, Huizing, van Wijk): `items`, largest first, fill `r` in rows along its shorter side, tiles near square. */
export function squarify<T extends { value: number }>(items: readonly T[], r: Box): (T & Box)[] {
  const out: (T & Box)[] = [];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0 || r.w <= 0 || r.h <= 0) return out;
  let rest = items.map((i) => ({ i, a: (i.value / total) * r.w * r.h }));
  let { x, y, w, h } = r;
  while (rest.length) {
    const side = Math.min(w, h);
    let row: typeof rest = [], best = Infinity;
    for (const it of rest) {
      const next = [...row, it], s = next.reduce((a, b) => a + b.a, 0);
      const worst = Math.max(...next.map((n) => Math.max((side * side * n.a) / (s * s), (s * s) / (side * side * n.a))));
      if (worst > best) break;
      best = worst;
      row = next;
    }
    const thick = row.reduce((a, b) => a + b.a, 0) / side;
    let off = 0;
    for (const { i, a } of row) {
      const len = a / thick;
      out.push(w >= h ? { ...i, x, y: y + off, w: thick, h: len } : { ...i, x: x + off, y, w: len, h: thick });
      off += len;
    }
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    rest = rest.slice(row.length);
  }
  return out;
}

/** The colour step of a day's move: two shades each way, and flat within ±0.25%. */
export const stepOf = (m: number | null) =>
  m === null ? 'na' : m >= 0.025 ? 'up2' : m >= 0.0025 ? 'up1' : m <= -0.025 ? 'dn2' : m <= -0.0025 ? 'dn1' : 'flat';

const HEAD = 18;     // a sector's name strip, in map units
const SHORT: Record<string, string> = { 'Financial Services': 'Financials', 'Communication Services': 'Communication',
  'Consumer Cyclical': 'Cons. cyclical', 'Consumer Defensive': 'Cons. defensive', 'Basic Materials': 'Materials' };
/** A sector's name over its block: with its move, shorter, or bare — the first that fits (10-unit mono capitals), else none. */
export function sectorLabel(sector: string, move: number | null, w: number): string | null {
  const name = sector.toUpperCase(), short = (SHORT[sector] ?? sector).toUpperCase(), m = move === null ? '' : ` ${pct(move)}`;
  return [name + m, short + m, short].find((t) => t.length * 6.4 + 12 <= w) ?? null;
}
const round = (v: number) => Math.round(v * 10) / 10;
/** Only the site's own logo files (as pt-logo): anything else draws no image. */
const site = (s: string | null) => (s && /^\/logos\/[a-z0-9.-]{1,40}$/.test(s) ? s : null);
const capMove = (rows: ScreenRow[]) => {
  const known = rows.filter((r) => r.chg1d != null && r.marketCap);
  const w = known.reduce((s, r) => s + r.marketCap!, 0);
  return w ? known.reduce((s, r) => s + r.chg1d! * r.marketCap!, 0) / w : null;
};

/** The map of `rows` (the largest first) in a w × h box: sectors by their total value, companies inside, rounded to 0.1 unit. */
export function buildMap(rows: readonly ScreenRow[], w: number, h: number): { blocks: Block[]; tiles: Tile[] } {
  const known = rows.filter((r) => (r.marketCap ?? 0) > 0);
  const bySector = new Map<string, ScreenRow[]>();
  for (const r of known) bySector.set(r.sector ?? 'Other', [...(bySector.get(r.sector ?? 'Other') ?? []), r]);
  const sectors = [...bySector].map(([sector, list]) => ({ sector, list, value: list.reduce((s, r) => s + r.marketCap!, 0) }))
    .sort((a, b) => b.value - a.value || (a.sector < b.sector ? -1 : 1));
  const blocks: Block[] = [], tiles: Tile[] = [];
  for (const s of squarify(sectors, { x: 0, y: 0, w, h })) {
    const move = capMove(s.list), label = sectorLabel(s.sector, move, s.w);
    const head = s.h > HEAD * 2.5 && label !== null;
    blocks.push({ sector: s.sector, move, head, label, x: round(s.x), y: round(s.y), w: round(s.w), h: round(s.h) });
    const inner = { x: s.x, y: s.y + (head ? HEAD : 0), w: s.w, h: s.h - (head ? HEAD : 0) };
    for (const t of squarify(s.list.map((r) => ({ r, value: r.marketCap! })), inner)) {
      tiles.push({ ticker: t.r.ticker, name: t.r.name, logo: site(t.r.logo), move: t.r.chg1d, cap: t.r.marketCap!, step: stepOf(t.r.chg1d),
        sector: s.sector, x: round(t.x), y: round(t.y), w: round(t.w), h: round(t.h) });
    }
  }
  return { blocks, tiles };
}

/** "Nvidia (NVDA)", or the ticker alone when it is the name. */
const who = (r: ScreenRow) => named(r.name, r.ticker);
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * The day in a dated sentence, from the map's own numbers (the text search engines and AI answers read): "As of Oct 27, 2026: 7 of
 * 11 sectors rose, and 61 of the 100 largest companies. The three largest, Nvidia (NVDA), Apple (AAPL) and Microsoft (MSFT), moved
 * +1.2%, -0.4% and +0.8%; the biggest moves were …".
 */
export function mapSentence(rows: readonly ScreenRow[], blocks: Block[], asOf: string): string {
  const moved = rows.filter((r) => r.chg1d != null);
  if (!moved.length) return '';
  const up = moved.filter((r) => r.chg1d! > 0).length;
  const sec = blocks.filter((b) => b.move !== null), secUp = sec.filter((b) => b.move! > 0).length;
  const largest = [...moved].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 3);
  const best = moved.reduce((a, b) => (b.chg1d! > a.chg1d! ? b : a)), worst = moved.reduce((a, b) => (b.chg1d! < a.chg1d! ? b : a));
  const first = sec.length > 1 ? `${secUp} of ${sec.length} sectors rose, and ${up} of the ${moved.length} largest companies`
    : sec.length ? `${sec[0]!.sector} moved ${pct(sec[0]!.move)}, and ${up} of its ${moved.length} largest companies rose`
    : `${up} of the ${moved.length} largest companies rose`;
  return `As of ${date(asOf)}: ${first}. ` +
    `The ${['largest', 'largest', 'two largest', 'three largest'][largest.length]}, ${and(largest.map(who))}, moved ${and(largest.map((r) => pct(r.chg1d)))}` +
    (best !== worst ? `; the biggest moves were ${who(best)} ${pct(best.chg1d)} and ${who(worst)} ${pct(worst.chg1d)}.` : '.');
}
/** How to read the map, in the words the AI answers use for a heat map. */
export const HOW_TO_READ = 'Each tile is a company, sized by its market value and colored by the day’s move, grouped by sector.';

const WIDE = { w: 1000, h: 560, n: 100 } as const;
const NARROW = { w: 400, h: 600, n: 40 } as const;

@Component({
  selector: 'pt-logo-map',
  template: `
    @let s = data.value();
    @if (s === null) {<p class="pt-na">Data not available</p>}
    @else if (s) {
      @if (!s.rows.length) {<p class="pt-na">No companies to show</p>}
      @else {
        <figure class="pt-lm" [class.pt-busy]="data.loading()">
          <p class="pt-lede">{{ sentence() }}</p>
          @for (m of maps(); track m.key) {
            <svg [class]="'pt-lm-svg pt-lm-' + m.key" [attr.viewBox]="'0 0 ' + m.w + ' ' + m.h" role="group" [attr.aria-label]="'Stock market heat map: the ' + m.tiles.length + ' largest companies by sector, ' + date(s.asOf)">
              @for (b of m.blocks; track b.sector) {
                <rect class="pt-lm-block" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" />
                @if (b.head) {<text class="pt-lm-sector" [attr.x]="b.x + 6" [attr.y]="b.y + 13">{{ b.label }}</text>}
              }
              @for (t of m.tiles; track t.ticker) {
                @let big = t.w >= m.big && t.h >= m.big * 0.8;
                <a [attr.href]="stockHref(t.ticker)" [attr.aria-label]="plainName(t.name) + ', ' + (t.move === null ? 'no move' : pct(t.move)) + ' today'"
                  [attr.data-tip]="tileTip(t)">
                  <rect [class]="'pt-lm-tile pt-lm-' + t.step" [attr.x]="t.x + 1" [attr.y]="t.y + 1" [attr.width]="t.w - 2" [attr.height]="t.h - 2" rx="3" />
                  @if (big && t.logo) {<image class="pt-lm-logo" [attr.href]="t.logo" [attr.x]="t.x + t.w / 2 - logoSize(t, m) / 2" [attr.y]="t.y + t.h / 2 - logoSize(t, m) * 0.9" [attr.width]="logoSize(t, m)" [attr.height]="logoSize(t, m)" />}
                  @if (t.w >= m.label && t.h >= m.label * 0.55) {
                    <text class="pt-lm-t" [attr.x]="t.x + t.w / 2" [attr.y]="t.y + t.h / 2 + (big && t.logo ? logoSize(t, m) * 0.45 : 0)" text-anchor="middle">{{ t.ticker }}</text>
                    @if (t.h >= m.label * 0.9) {<text class="pt-lm-m" [attr.x]="t.x + t.w / 2" [attr.y]="t.y + t.h / 2 + (big && t.logo ? logoSize(t, m) * 0.45 : 0) + 13" text-anchor="middle">{{ pct(t.move) }}</text>}
                  }
                </a>
              }
            </svg>
          }
          <figcaption class="pt-legend pt-lm-legend">
            @for (k of LEGEND; track k[0]) {<span class="pt-key"><i [class]="'pt-lm-sw pt-lm-' + k[0]"></i>{{ k[1] }}</span>}
            <span class="pt-meta">size = market value · as of {{ date(s.asOf) }}</span>
          </figcaption>
          <p class="pt-note">{{ HOW_TO_READ }}</p>
        </figure>
      }
    }`,
})
export class PtLogoMap {
  private readonly pt = inject(Pt);
  readonly sector = input<Sector>();

  protected readonly data = this.pt.screen(() => {
    const s = this.sector();
    return { scope: s ? { list: 'largest' as const, sector: s } : { list: 'largest' as const }, limit: WIDE.n };
  });
  private readonly rows = computed(() => this.data.value()?.rows ?? []);
  protected readonly maps = computed(() => [
    { key: 'wide', ...WIDE, big: 70, label: 34, ...buildMap(this.rows(), WIDE.w, WIDE.h) },
    { key: 'narrow', ...NARROW, big: 64, label: 30, ...buildMap(this.rows().slice(0, NARROW.n), NARROW.w, NARROW.h) },
  ]);
  protected readonly sentence = computed(() => mapSentence(this.rows(), this.maps()[0]!.blocks, this.data.value()?.asOf ?? ''));
  protected readonly HOW_TO_READ = HOW_TO_READ;
  protected readonly LEGEND = [['dn2', '−2.5% or more'], ['dn1', 'down'], ['flat', 'flat'], ['up1', 'up'], ['up2', '+2.5% or more']] as const;
  protected readonly pct = pct;
  protected readonly date = date;
  protected readonly stockHref = stockHref;
  protected readonly plainName = plainName;
  protected readonly tileTip = (t: Tile) => tip({ [t.ticker]: plainName(t.name), Today: t.move === null ? null : pct(t.move), 'Market value': usd(t.cap, { compact: true }) });
  protected readonly logoSize = (t: Tile, m: { big: number }) => Math.round(Math.min(t.w, t.h, m.big * 1.6) * 0.42);
}

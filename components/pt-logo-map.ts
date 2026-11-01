/**
 * The market at a glance: the largest companies as a map of logos, one block per sector, each company a tile as large as its
 * market value and coloured by today's move — where the market's weight is and which way it went today. Under the map a line says
 * how to read it, the way the AI answers describe a heat map; above it, the day in a dated sentence (sectors up, the three largest,
 * the biggest moves) — the text that changes every day and that an answer can quote with its date.
 * Its sentence names the companies as links with their logos (PtSay): the card opens on hover, as on the tiles.
 * `lens` "mega": the same map of the mega caps, the companies worth $200 billion or more (from the same list of the largest).
 * The map takes its wide or its phone form by its own width, not the screen's: it stays readable inside a narrow column or a strip.
 * `form` "card": one landscape map of the 20 largest, its dated sentence under it (every card of a strip starts level), no legend —
 * a card in a strip of sectors.
 * `lens` "news": the 40 companies with the most news stories on the session's day (attention@1), each tile as large as its stories
 * and coloured by the day's move; the sentence names the most covered and how that compares with its usual day. "social": the same
 * with the day's posts on Reddit and X.
 * @version 0.6.0
 * @evidence Romeo 2026-10-25: home components "con i loghi delle aziende" for the overview — H3 · The market at a glance, ★ sector map (brainstorming/mappa-componenti.html)
 * @evidence DataForSEO 2026-10-28 (round 13): the "stock market heat map" family ≈33,400 searches a month, keyword difficulty 25–30, AI Overview on 2%, no dominant site (apps, guides, brokers); "largest companies by market cap" 22,200 (launch/RESEARCH.md §9)
 * @evidence Romeo 2026-11-01: "mettiamo alla fine della home la heat map del mercato delle mega caps", and a page of the heat maps
 * @evidence AI answers (ChatGPT, Claude, Gemini, Perplexity, AI Mode, 2026-10-28) to "where can I see a stock market heat map today" list TradingView, Finviz, Investing.com, Barchart, MarketBeat, each with one line on how the map reads (launch/AI-SEARCH.md)
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtSay } from '@pretickt/components/ds';
import { andSaid, date, mention, pct, plainName, say, stockHref, tip, usd, type Said } from '@pretickt/components/format';
import type { AttentionRow, ScreenRow } from '@pretickt/components/typologies';

/** What a map needs of a company: the market's list (screen@1) and the day's attention (attention@1) both have it. */
type MapRow = Pick<ScreenRow, 'ticker' | 'name' | 'sector' | 'logo' | 'chg1d' | 'marketCap'>;

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

/** The mega caps: the companies worth $200 billion or more. */
export const MEGA = 200e9;
export const megaCaps = <R extends Pick<MapRow, 'marketCap'>>(rows: readonly R[]) => rows.filter((r) => (r.marketCap ?? 0) >= MEGA);
/** What the map shows: the largest companies, the mega caps among them, or the companies most in the day's news or posts. */
export type Lens = 'market' | 'mega' | 'news' | 'social';
type Talk = 'news' | 'social';
const isTalk = (l: Lens): l is Talk => l === 'news' || l === 'social';
/** The words of each attention map: its tiles' unit, where it is counted, its sentence's verb. */
const TALK: Record<Talk, { one: string; many: string; size: string; most: string; key: string }> = {
  news: { one: 'story', many: 'stories', size: 'news stories that day', most: 'most in the news', key: 'Stories' },
  social: { one: 'post', many: 'posts', size: 'posts on Reddit and X that day', most: 'most talked about on Reddit and X', key: 'Posts' },
};
const NOUN: Record<'market' | 'mega', string> = { market: 'largest companies', mega: 'companies worth $200 billion or more' };
/** An attention map's size: its 40 most covered (or talked about) companies. */
const TALK_N = 40;

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
const capMove = (rows: MapRow[]) => {
  const known = rows.filter((r) => r.chg1d != null && r.marketCap);
  const w = known.reduce((s, r) => s + r.marketCap!, 0);
  return w ? known.reduce((s, r) => s + r.chg1d! * r.marketCap!, 0) / w : null;
};

/**
 * The map of `rows` (the largest first) in a w × h box: sectors by their total `size` (market value, unless said), companies inside,
 * rounded to 0.1 unit.
 */
export function buildMap<R extends MapRow>(rows: readonly R[], w: number, h: number, size: (r: R) => number | null = (r) => r.marketCap): { blocks: Block[]; tiles: Tile[] } {
  const known = rows.filter((r) => (size(r) ?? 0) > 0);
  const bySector = new Map<string, R[]>();
  for (const r of known) bySector.set(r.sector ?? 'Other', [...(bySector.get(r.sector ?? 'Other') ?? []), r]);
  const sectors = [...bySector].map(([sector, list]) => ({ sector, list, value: list.reduce((s, r) => s + size(r)!, 0) }))
    .sort((a, b) => b.value - a.value || (a.sector < b.sector ? -1 : 1));
  const blocks: Block[] = [], tiles: Tile[] = [];
  for (const s of squarify(sectors, { x: 0, y: 0, w, h })) {
    const move = capMove(s.list), label = sectorLabel(s.sector, move, s.w);
    const head = s.h > HEAD * 2.5 && label !== null;
    blocks.push({ sector: s.sector, move, head, label, x: round(s.x), y: round(s.y), w: round(s.w), h: round(s.h) });
    const inner = { x: s.x, y: s.y + (head ? HEAD : 0), w: s.w, h: s.h - (head ? HEAD : 0) };
    for (const t of squarify(s.list.map((r) => ({ r, value: size(r)! })), inner)) {
      tiles.push({ ticker: t.r.ticker, name: t.r.name, logo: site(t.r.logo), move: t.r.chg1d, cap: t.r.marketCap ?? 0, step: stepOf(t.r.chg1d),
        sector: s.sector, x: round(t.x), y: round(t.y), w: round(t.w), h: round(t.h) });
    }
  }
  return { blocks, tiles };
}

/** A company the sentence names: a link with its logo ("Nvidia NVDA"), its card on hover. */
const who = (r: MapRow) => mention(r.ticker, r.name, r.logo);
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * The day in a dated sentence, from the map's own numbers (the text search engines and AI answers read): "As of Oct 27, 2026: 7 of
 * 11 sectors rose, and 61 of the 100 largest companies. The three largest, Nvidia NVDA, Apple AAPL and Microsoft MSFT, moved
 * +1.2%, -0.4% and +0.8%; the biggest moves were …".
 */
export function mapSentence(rows: readonly MapRow[], blocks: Block[], asOf: string, lens: 'market' | 'mega' = 'market'): Said {
  const moved = rows.filter((r) => r.chg1d != null);
  if (!moved.length) return [];
  const up = moved.filter((r) => r.chg1d! > 0).length;
  const sec = blocks.filter((b) => b.move !== null), secUp = sec.filter((b) => b.move! > 0).length;
  const largest = [...moved].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 3);
  const best = moved.reduce((a, b) => (b.chg1d! > a.chg1d! ? b : a)), worst = moved.reduce((a, b) => (b.chg1d! < a.chg1d! ? b : a));
  const noun = NOUN[lens];
  const first = sec.length > 1 ? `${secUp} of ${sec.length} sectors rose, and ${up} of the ${moved.length} ${noun}`
    : sec.length ? `${sec[0]!.sector} moved ${pct(sec[0]!.move)}, and ${up} of its ${moved.length} ${noun} rose`
    : `${up} of the ${moved.length} ${noun} rose`;
  const extremes = best !== worst ? say`; the biggest moves were ${who(best)} ${pct(best.chg1d)} and ${who(worst)} ${pct(worst.chg1d)}.` : ['.'];
  const lead = say`As of ${date(asOf)}: ${first}. The ${['largest', 'largest', 'two largest', 'three largest'][largest.length]}, ${andSaid(largest.map((r) => [who(r)]))}, `;
  return say`${lead}moved ${and(largest.map((r) => pct(r.chg1d)))}${extremes}`;
}
/** "5×", "2.3×": how many times its usual day. */
const times = (x: number) => `${Math.round(x * 10) / 10}×`;
/** A company's stories or posts, against its usual day when it has one: "46, 5× its usual day". */
export const countOf = (r: Pick<AttentionRow, 'count' | 'usual'>) => (r.usual ? `${r.count}, ${times(r.count / r.usual)} its usual day` : `${r.count}`);

/**
 * The day's attention in a sentence, from the map's own numbers: "On Oct 30, 2026, the companies most in the news were Intel INTC, with
 * 46 stories (5× its usual day), Apple AAPL, 30, and Nvidia NVDA, 28." — or the most talked about on Reddit and X, with their posts.
 */
export function talkSentence(rows: readonly AttentionRow[], asOf: string, lens: Talk = 'news'): Said {
  const w = TALK[lens], top = rows.filter((r) => r.count > 0).slice(0, 3);
  if (!top.length) return [];
  const [first, ...rest] = top as [AttentionRow, ...AttentionRow[]];
  const items = [say`${who(first)}, with ${first.count} ${first.count === 1 ? w.one : w.many}${first.usual ? ` (${times(first.count / first.usual)} its usual day)` : ''}`,
    ...rest.map((r) => say`${who(r)}, ${r.count}`)];
  const list = items.length === 1 ? items[0]! : items.length === 2 ? say`${items[0]!} and ${items[1]!}` : say`${items[0]!}, ${items[1]!}, and ${items[2]!}`;
  return say`On ${date(asOf)}, the ${top.length > 1 ? 'companies' : 'company'} ${w.most} ${top.length > 1 ? 'were' : 'was'} ${list}.`;
}

/** How to read the map, in the words the AI answers use for a heat map. */
export const HOW_TO_READ = 'Each tile is a company, sized by its market value and colored by the day’s move, grouped by sector.';
/** The same for an attention map: sized by its stories or its posts. */
const howToRead = (lens: Lens) => (isTalk(lens)
  ? `Each tile is a company, sized by its ${TALK[lens].size} and colored by the day’s move, grouped by sector.` : HOW_TO_READ);

const WIDE = { w: 1000, h: 560, n: 100 } as const;
const NARROW = { w: 400, h: 600, n: 40 } as const;
const CARD = { w: 360, h: 270, n: 20 } as const;

@Component({
  selector: 'pt-logo-map',
  imports: [PtSay],
  template: `
    @let s = data.value();
    @if (s === null) {<p class="pt-na">Data not available</p>}
    @else if (s) {
      @if (!s.rows.length) {<p class="pt-na">No companies to show</p>}
      @else {
        <figure class="pt-lm" [class.pt-busy]="data.loading()">
          @if (form() === 'full') {<p class="pt-lede"><pt-say [parts]="sentence()" /></p>}
          @for (m of maps(); track m.key) {
            <svg [class]="'pt-lm-svg pt-lm-' + m.key" [attr.viewBox]="'0 0 ' + m.w + ' ' + m.h" role="group" [attr.aria-label]="mapLabel(m.tiles.length, s.asOf)">
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
          @if (form() === 'card') {<p class="pt-lede"><pt-say [parts]="sentence()" /></p>}
          @else {
            <figcaption class="pt-legend pt-lm-legend">
              @for (k of LEGEND; track k[0]) {<span class="pt-key"><i [class]="'pt-lm-sw pt-lm-' + k[0]"></i>{{ k[1] }}</span>}
              <span class="pt-meta">size = {{ sizeWords() }} · as of {{ date(s.asOf) }}</span>
            </figcaption>
            <p class="pt-note">{{ howToRead(lens()) }}</p>
          }
        </figure>
      }
    }`,
})
export class PtLogoMap {
  private readonly pt = inject(Pt);
  readonly sector = input<Sector>();
  readonly lens = input<Lens>('market');
  /** "card": one small landscape map under the sentence, for a strip of sectors. */
  readonly form = input<'full' | 'card'>('full');

  private readonly screen = this.pt.screen(() => {
    if (isTalk(this.lens())) return null;
    const s = this.sector();
    return { scope: s ? { list: 'largest' as const, sector: s } : { list: 'largest' as const }, limit: WIDE.n };
  });
  private readonly attention = this.pt.attention(() => { const l = this.lens(); return isTalk(l) ? { lens: l, limit: TALK_N } : null; });
  /** What the map shows: the market's list, or the day's news or posts. */
  protected readonly data = {
    value: computed(() => (isTalk(this.lens()) ? this.attention.value() : this.screen.value())),
    loading: computed(() => (isTalk(this.lens()) ? this.attention.loading() : this.screen.loading())),
  };
  private readonly rows = computed<MapRow[]>(() => {
    const rows: MapRow[] = this.data.value()?.rows ?? [];
    return this.lens() === 'mega' ? megaCaps(rows) : rows;
  });
  /** A tile's size: its stories or posts on an attention map, its market value on the others. */
  private readonly size = computed(() => (isTalk(this.lens()) ? (r: MapRow) => (r as AttentionRow).count : (r: MapRow) => r.marketCap));
  private readonly byTicker = computed(() => new Map((this.attention.value()?.rows ?? []).map((r) => [r.ticker, r])));
  protected readonly maps = computed(() => {
    const size = this.size(), rows = this.rows();
    return this.form() === 'card'
      ? [{ key: 'card', ...CARD, big: 64, label: 30, ...buildMap(rows.slice(0, CARD.n), CARD.w, CARD.h, size) }]
      : [
        { key: 'wide', ...WIDE, big: 70, label: 34, ...buildMap(rows, WIDE.w, WIDE.h, size) },
        { key: 'narrow', ...NARROW, big: 64, label: 30, ...buildMap(rows.slice(0, NARROW.n), NARROW.w, NARROW.h, size) },
      ];
  });
  protected readonly sentence = computed(() => {
    const asOf = this.data.value()?.asOf ?? '', lens = this.lens();
    return isTalk(lens) ? talkSentence(this.attention.value()?.rows ?? [], asOf, lens) : mapSentence(this.rows(), this.maps()[0]!.blocks, asOf, lens);
  });
  /** The map's name for a screen reader: what it shows, how many, the date. */
  protected mapLabel(n: number, asOf: string) {
    const lens = this.lens();
    return lens === 'news' ? `News heat map: the ${n} companies with the most news stories on ${date(asOf)}, by sector`
      : lens === 'social' ? `Social heat map: the ${n} companies most talked about on Reddit and X on ${date(asOf)}, by sector`
      : lens === 'mega' ? `Mega-cap stocks heat map: the ${n} ${NOUN.mega}, by sector, ${date(asOf)}`
      : `Stock market heat map: the ${n} ${NOUN.market} by sector, ${date(asOf)}`;
  }
  protected readonly howToRead = howToRead;
  protected readonly sizeWords = computed(() => { const l = this.lens(); return isTalk(l) ? TALK[l].size : 'market value'; });
  protected readonly LEGEND = [['dn2', '−2.5% or more'], ['dn1', 'down'], ['flat', 'flat'], ['up1', 'up'], ['up2', '+2.5% or more']] as const;
  protected readonly pct = pct;
  protected readonly date = date;
  protected readonly stockHref = stockHref;
  protected readonly plainName = plainName;
  protected readonly tileTip = (t: Tile) => {
    const l = this.lens(), r = isTalk(l) ? this.byTicker().get(t.ticker) : undefined;
    return r && isTalk(l) ? tip({ [t.ticker]: plainName(t.name), ...(t.move === null ? {} : { Today: pct(t.move) }), [TALK[l].key]: countOf(r) })
      : tip({ [t.ticker]: plainName(t.name), Today: t.move === null ? null : pct(t.move), 'Market value': usd(t.cap, { compact: true }) });
  };
  protected readonly logoSize = (t: Tile, m: { big: number }) => Math.round(Math.min(t.w, t.h, m.big * 1.6) * 0.42);
}

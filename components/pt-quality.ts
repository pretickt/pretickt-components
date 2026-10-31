/**
 * Is the company's quality intact, in the next months, the next years and beyond? Six questions (Demand, Advantage, Economics,
 * Execution, Fragility, Price) with a card for each new fact, dated and sourced, and — when the stock is well off its high — the
 * fall split into market, peers and its own part, with the pillars that moved since the high. Version 1 builds its cards from the
 * numbers pretickt already has (results, estimates, margins, P/E, analyst actions, prices); facts from filings and news come next.
 * It opens with its answer in a sentence — the company's common name and ticker, the 12 months to the date of the data, how many
 * facts strengthened its quality and how many weakened it — and names the company, not the ticker, in the drop test: the text an
 * AI answer can quote with its date.
 * The company is named as a link with its logo (PtSay): its card opens on hover, on its own page too.
 * @version 0.3.1
 * @evidence Romeo 2026-10-24: "la qualità dell'azienda è intatta, a breve, medio e lungo termine?" — six sections, a card per new fact (brainstorming/scheda-qualita.html, proposals A + D)
 * @evidence pulse 19–25 Oct 2026: 89% of the real questions about a stock ask about quality or the decision (impact scorecard 7.5/10)
 * @evidence DataForSEO 2026-10-28 (round 13): "is {company} a good stock to buy" ≈64,000 searches a month on ~100 companies, AI Overview on 90%; the facts' own words ("pe ratio", "revenue growth", "gross margin", "guidance"…) 153,000 on 25 companies (launch/RESEARCH.md §9)
 */
import { Component, computed, input, linkedSignal, inject } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtSay } from '@pretickt/components/ds';
import { cash, date, level, mention, num, pct, say, tip, type Mention, type Said } from '@pretickt/components/format';
import type { EventItem, Events, Fundamentals, PriceSeries } from '@pretickt/components/typologies';

export type Pillar = 'demand' | 'advantage' | 'economics' | 'execution' | 'fragility' | 'price';
/** What a fact does to its pillar: strengthens it (▲), weakens it (▼), or is one to watch (●) — never what to do with the stock. */
export type QTone = 'pos' | 'neg' | 'flat';
export type Horizon = 'long' | 'years' | 'months';
export interface QCard {
  pillar: Pillar; tone: QTone; date: string; horizon: Horizon;
  fact: string; why: string; href: string; source: string;
  /** the stock's move the session after the fact, when it is a report or an analyst's action */
  reaction: number | null;
  viz: { kind: 'change'; from: number; to: number } | { kind: 'surprise'; value: number } | null;
}
export interface Drop { high: string; ret: number; market: number | null; peers: number | null; own: number | null; since: Record<Pillar, QTone[]> }

export const PILLARS: Record<Pillar, { name: string; question: string }> = {
  demand: { name: 'Demand', question: 'Is its market growing, and for how long?' },
  advantage: { name: 'Advantage', question: 'Why do customers buy from it, and for how long?' },
  economics: { name: 'Economics', question: 'Does it turn that into prices and margins?' },
  execution: { name: 'Execution', question: 'Can it serve the demand: capacity, management, capital?' },
  fragility: { name: 'Fragility', question: 'What could break it: a customer, a new technology, the cycle?' },
  price: { name: 'Price', question: 'How much of this is already in the price?' },
};
export const ROWS: { horizon: Horizon; label: string; pillars: [Pillar, Pillar] }[] = [
  { horizon: 'long', label: 'Beyond 3 years', pillars: ['demand', 'advantage'] },
  { horizon: 'years', label: 'Next 1–3 years', pillars: ['economics', 'execution'] },
  { horizon: 'months', label: 'Next months', pillars: ['fragility', 'price'] },
];
const MARK: Record<QTone, string> = { pos: '▲', neg: '▼', flat: '●' };
const BAND = 0.02;            // a change smaller than 2 points is steady
const DAY = 86400000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const toneOf = (d: number, band = BAND): QTone => (d >= band ? 'pos' : d <= -band ? 'neg' : 'flat');
/** The operating margin against a year earlier: up from, down from, or little changed from it. */
export const marginFact = (now: number, before: number, tone: QTone = toneOf(now - before)) =>
  `Operating margin ${level(now)}, ${tone === 'flat' ? 'little changed from' : tone === 'pos' ? 'up from' : 'down from'} ${level(before)} a year earlier`;
/** A drop's own part in words: the points the stock lost on its own, or that the market and its peers explain all of it (or none). */
export function ownPart(d: { ret: number; own: number }): string {
  const own = -d.own * 100, total = -d.ret * 100;
  if (own <= 0.05) return 'the market and its peers explain all of it.';
  if (own >= total - 0.05) return 'all of it is its own.';
  return `${num(own, 1)} of the ${num(total, 1)} points are its own.`;
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };

type Bars = { t: string; c: number }[];
/** The close of the session after `iso` against the close before it: how the stock took the fact. */
export function reactionAfter(bars: Bars, iso: string, sameDay = false): number | null {
  const i = bars.findIndex((b) => (sameDay ? b.t >= iso : b.t > iso));
  return i > 0 ? bars[i]!.c / bars[i - 1]!.c - 1 : null;
}

/** The cards version 1 can build from numbers, newest first: revenue growth, margins, beats and misses, P/E, analysts' actions. */
export function qualityCards(ticker: string, f: Fundamentals | null | undefined, ev: Events | null | undefined, bars: Bars, asOf: string): QCard[] {
  const out: QCard[] = [];
  const t = ticker.toLowerCase();
  const fin = `/stocks/${t}/financials/`, targets = `/stocks/${t}/price-target/`;
  const recent = (iso: string) => days(iso, asOf) >= 0 && days(iso, asOf) <= 365;
  const earnings = (ev?.items ?? []).filter((e): e is Extract<EventItem, { kind: 'earnings' }> => e.kind === 'earnings' && e.date <= asOf);
  // a quarter is reported at the first earnings date within 100 days of its end; without one, at its end
  const reported = (end: string) => earnings.find((e) => e.date > end && days(end, e.date) <= 100)?.date ?? end;

  const ps = f?.periods ?? [];
  const py = f?.periodsPerYear ?? 4;
  for (let i = py; i < ps.length; i++) {
    const p = ps[i]!, a = ps[i - py]!, when = reported(p.period);
    if (!recent(when)) continue;
    const reaction = when === p.period ? null : reactionAfter(bars, when, earnings.find((e) => e.date === when)?.meta.time === 'bmo');
    if (p.revenue != null && a.revenue != null && a.revenue > 0) {
      const yoy = p.revenue / a.revenue - 1;
      const b = ps[i - 1], ba = ps[i - 1 - py];
      const prev = b?.revenue != null && ba?.revenue != null && ba.revenue > 0 ? b.revenue / ba.revenue - 1 : null;
      const tone: QTone = yoy < 0 ? 'neg' : prev === null ? 'flat' : toneOf(yoy - prev);
      out.push({ pillar: 'demand', tone, date: when, horizon: 'long', href: fin, source: 'Quarterly results', reaction,
        fact: `Revenue ${pct(yoy)} from a year earlier (${p.fiscal})`,
        why: yoy < 0 ? 'Sales are shrinking from a year earlier.' : prev === null ? 'The first quarter with a year to compare.'
          : tone === 'pos' ? `Growth picked up from ${pct(prev)} the quarter before.` : tone === 'neg' ? `Growth slowed from ${pct(prev)} the quarter before.`
          : `Growth held near ${pct(prev)}.`,
        viz: prev === null ? null : { kind: 'change', from: prev, to: yoy } });
    }
    if (p.operatingMargin != null && a.operatingMargin != null) {
      const tone = toneOf(p.operatingMargin - a.operatingMargin);
      out.push({ pillar: 'economics', tone, date: when, horizon: 'years', href: fin, source: 'Quarterly results', reaction,
        fact: marginFact(p.operatingMargin, a.operatingMargin, tone),
        why: tone === 'pos' ? 'More of each dollar of sales is left as profit.' : tone === 'neg' ? 'Less of each dollar of sales is left as profit.'
          : 'Margins held where they were a year earlier.',
        viz: { kind: 'change', from: a.operatingMargin, to: p.operatingMargin } });
    }
    if (p.grossMargin != null && a.grossMargin != null && Math.abs(p.grossMargin - a.grossMargin) >= 0.03) {
      const tone = toneOf(p.grossMargin - a.grossMargin);
      out.push({ pillar: 'advantage', tone, date: when, horizon: 'long', href: fin, source: 'Quarterly results', reaction,
        fact: `Gross margin ${level(p.grossMargin)}, ${tone === 'pos' ? 'up' : 'down'} from ${level(a.grossMargin)} a year earlier`,
        why: tone === 'pos' ? 'Customers pay more over what its products cost to make: pricing power.' : 'Customers pay less over what its products cost to make.',
        viz: { kind: 'change', from: a.grossMargin, to: p.grossMargin } });
    }
  }

  for (const e of earnings) {
    const { epsActual: act, epsEst: est } = e.meta;
    if (act == null || est == null || !recent(e.date) || est === 0) continue;
    const s = (act - est) / Math.abs(est);
    const tone = toneOf(s);
    out.push({ pillar: 'execution', tone, date: e.date, horizon: 'years', href: fin, source: 'Earnings report',
      reaction: reactionAfter(bars, e.date, e.meta.time === 'bmo'),
      fact: `EPS ${cash(act, f?.currency, { digits: 2 })} vs ${cash(est, f?.currency, { digits: 2 })} expected (${pct(s)})`,
      why: tone === 'pos' ? 'It earned more than analysts expected.' : tone === 'neg' ? 'It earned less than analysts expected.' : 'In line with what analysts expected.',
      viz: { kind: 'surprise', value: s } });
  }

  for (const e of ev?.items ?? []) {
    if (e.kind !== 'analyst' || days(e.date, asOf) < 0 || days(e.date, asOf) > 90) continue;
    const a = e.meta.action.toLowerCase();
    if (a !== 'upgrade' && a !== 'downgrade') continue;
    out.push({ pillar: 'price', tone: a === 'upgrade' ? 'pos' : 'neg', date: e.date, horizon: 'months', href: targets, source: 'Analyst action',
      reaction: reactionAfter(bars, e.date, true),
      fact: `${e.meta.firm} ${a}s it${e.meta.to ? ` to ${e.meta.to}` : ''}`,
      why: a === 'upgrade' ? 'An analyst sees more value than the price holds.' : 'An analyst sees less value than the price holds.', viz: null });
  }

  // the P/E is a quarterly reading: dated at the last report, like the other numbers of the results
  const pe = ps.filter((p) => p.pe != null && p.pe > 0).slice(-12).map((p) => p.pe!);
  const lastQ = ps.at(-1), last = lastQ?.pe;
  if (pe.length >= 8 && lastQ && last != null && last > 0) {
    const m = median(pe), r = last / m - 1;
    const tone: QTone = r <= -0.15 ? 'pos' : r >= 0.15 ? 'neg' : 'flat';
    out.push({ pillar: 'price', tone, date: reported(lastQ.period), horizon: 'months', href: fin, source: 'P/E history', reaction: null,
      fact: `P/E ratio ${num(last, 1)}× at the last report, ${tone === 'flat' ? 'near' : tone === 'pos' ? 'below' : 'above'} its 3-year median of ${num(m, 1)}×`,
      why: tone === 'pos' ? 'Less of its future is in the price than usual.' : tone === 'neg' ? 'More of its future is in the price than usual.'
        : 'About as much of its future is in the price as usual.',
      viz: { kind: 'change', from: m, to: last } });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * The drop test: from the year's highest close to the last, the stock against the market (SPY) and the median of its peers over
 * the same sessions — market + sector + own = the fall — and what each pillar's cards did since the high. Null when the stock is
 * less than 10% off its high and did not just lose 5% in a session.
 */
export function dropTest(series: PriceSeries | null | undefined, ticker: string, cards: QCard[]): Drop | null {
  const of = (t: string) => series?.find((s) => s.ticker === t)?.points ?? [];
  const bars = of(ticker);
  if (bars.length < 2) return null;
  const hi = bars.reduce((m, b) => (b.c > m.c ? b : m), bars[0]!);
  const lastBar = bars.at(-1)!, prevBar = bars.at(-2)!;
  const ret = lastBar.c / hi.c - 1;
  if (ret > -0.1 && lastBar.c / prevBar.c - 1 > -0.05) return null;
  const move = (t: string) => {
    const ps = of(t);
    const a = ps.find((p) => p.t >= hi.t), b = ps.at(-1);
    return a && b && b.t >= lastBar.t ? b.c / a.c - 1 : null;
  };
  const market = move('SPY');
  const others = (series ?? []).filter((s) => s.ticker !== ticker && s.ticker !== 'SPY').map((s) => move(s.ticker)).filter((v): v is number => v !== null);
  const peers = others.length ? median(others) : null;
  const since = Object.fromEntries(Object.keys(PILLARS).map((k) => [k, cards.filter((c) => c.pillar === k && c.date >= hi.t).map((c) => c.tone)])) as Record<Pillar, QTone[]>;
  return { high: hi.t, ret, market, peers, own: peers === null ? null : ret - peers, since };
}

/** "strengthened", "weakened", "mixed", "steady" or "no new facts", from the tones of a pillar's cards. */
export function verdict(tones: QTone[]): string {
  const up = tones.filter((t) => t === 'pos').length, down = tones.filter((t) => t === 'neg').length;
  if (!tones.length) return 'no new facts';
  if (up && down) return up > down ? 'mostly strengthened' : down > up ? 'mostly weakened' : 'mixed';
  return up ? 'strengthened' : down ? 'weakened' : 'steady';
}

/**
 * The answer first, in a sentence: "Nvidia NVDA in the 12 months to Oct 23, 2026: 3 facts strengthened its quality, 3 weakened it,
 * 4 to watch." — `who` is the company, named as a link with its logo (its card on hover).
 */
export function qualityLead(who: Mention, cards: QCard[], asOf: string): Said {
  const n = (t: QTone) => cards.filter((c) => c.tone === t).length, up = n('pos'), down = n('neg'), flat = n('flat');
  if (!cards.length) return say`${who}: no new facts in the 12 months to ${date(asOf)}.`;
  return say`${who} in the 12 months to ${date(asOf)}: ${up} ${up === 1 ? 'fact' : 'facts'} strengthened its quality, ${down} weakened it${flat ? `, ${flat} to watch` : ''}.`;
}

/** A row's sentence (templated, the text search engines read): "Next 1–3 years: Economics weakened, Execution strengthened." */
export const rowSentence = (label: string, pillars: [Pillar, Pillar], cards: QCard[]) =>
  `${label}: ${pillars.map((p) => `${PILLARS[p].name} ${verdict(cards.filter((c) => c.pillar === p).map((c) => c.tone))}`).join(', ')}.`;

/** A two-point slope, the fact's "from → to", in a 56 × 20 box. */
export function slope(from: number, to: number) {
  const lo = Math.min(from, to, 0), hi = Math.max(from, to, 0), span = hi - lo || 1;
  const y = (v: number) => 17 - ((v - lo) / span) * 14;
  return { y1: Math.round(y(from) * 10) / 10, y2: Math.round(y(to) * 10) / 10, zero: Math.round(y(0) * 10) / 10 };
}

@Component({
  selector: 'pt-quality',
  imports: [PtSay],
  template: `
    @let f = fund.value();
    @if (f === null) {<p class="pt-na">Data not available</p>}
    @else if (f) {
      <section class="pt-q" [class.pt-busy]="fund.loading()">
        <p class="pt-lede"><pt-say [parts]="lead()" /></p>
        @if (drop(); as d) {
          <div class="pt-q-drop">
            <p class="pt-q-drop-lead"><pt-say [parts]="[who()]" /> is {{ level(-d.ret) }} below its high of {{ date(d.high) }}.
              @if (d.peers !== null && d.own !== null && d.market !== null) {
                Over the same sessions the market (SPY) moved {{ pct(d.market) }} and its peers {{ pct(d.peers) }}:
                {{ ownPart({ ret: d.ret, own: d.own }) }}
              } @else if (d.market !== null) {Over the same sessions the market (SPY) moved {{ pct(d.market) }}.}
            </p>
            <p class="pt-q-drop-since">Since the high:
              @for (p of DROP_ORDER; track p; let last = $last) { {{ PILLARS[p].name }} {{ verdict(d.since[p]) }}{{ last ? '.' : ',' }} }
              Price {{ verdict(d.since.price) }}: {{ base().price }}.</p>
          </div>
        }
        <div class="pt-q-rows">
          @for (r of ROWS; track r.horizon) {
            <div class="pt-q-row">
              <p class="pt-q-row-h">{{ rowSentence(r.label, r.pillars, cards()) }}</p>
              <div class="pt-q-pair">
                @for (p of r.pillars; track p) {
                  @let mine = byPillar()[p];
                  <button type="button" class="pt-q-box" [class.pt-q-price]="p === 'price'" [attr.aria-pressed]="open() === p" (click)="pick(p, $event)">
                    <span class="pt-q-name">{{ PILLARS[p].name }}</span>
                    <span class="pt-q-ask">{{ PILLARS[p].question }}</span>
                    <span class="pt-q-base">{{ base()[p] }}</span>
                    <span class="pt-q-counts">
                      @for (t of TONES; track t) {@if (count(mine, t); as n) {<span [class]="'pt-q-n pt-q-' + t">{{ MARK[t] }} {{ n }}</span>}}
                      @if (!mine.length) {<span class="pt-q-n">no facts in 12 months</span>}
                    </span>
                    @if (mine[0]; as c) {<span class="pt-q-last">{{ date(c.date) }} · {{ c.fact }}</span>}
                  </button>
                }
              </div>
            </div>
          }
        </div>
        @for (p of PILLAR_KEYS; track p) {
          <div class="pt-q-panel" [hidden]="open() !== p">
            <h3 class="pt-q-panel-h">{{ PILLARS[p].name }}: {{ PILLARS[p].question }}</h3>
            @if (byPillar()[p]; as list) {
              @if (list.length) {
                <ul class="pt-q-cards">
                  @for (c of list; track $index) {
                    <li [class]="'pt-q-card pt-q-' + c.tone">
                      <span class="pt-q-mark" aria-hidden="true">{{ MARK[c.tone] }}</span>
                      <div class="pt-q-body">
                        <p class="pt-q-fact">{{ c.fact }}</p>
                        <p class="pt-q-why">{{ c.why }}</p>
                        <p class="pt-meta">{{ date(c.date) }} · {{ HORIZON[c.horizon] }} · <a [href]="c.href">{{ c.source }}</a>
                          @if (c.reaction !== null) { · the next session {{ pct(c.reaction) }}}</p>
                      </div>
                      @if (c.viz; as v) {
                        @if (v.kind === 'change') {
                          @let s = slope(v.from, v.to);
                          <svg class="pt-q-viz" viewBox="0 0 56 20" role="img" [attr.aria-label]="'from ' + fmt(v.from, c) + ' to ' + fmt(v.to, c)"
                            [attr.data-tip]="tip({ From: fmt(v.from, c), To: fmt(v.to, c) })">
                            <line class="pt-q-zero" x1="4" x2="52" [attr.y1]="s.zero" [attr.y2]="s.zero" />
                            <line class="pt-q-slope" x1="8" x2="48" [attr.y1]="s.y1" [attr.y2]="s.y2" />
                            <circle class="pt-q-from" cx="8" [attr.cy]="s.y1" r="2.5" /><circle class="pt-q-to" cx="48" [attr.cy]="s.y2" r="3" />
                          </svg>
                        } @else {
                          @let w = surpriseWidth(v.value);
                          <svg class="pt-q-viz" viewBox="0 0 56 20" role="img" [attr.aria-label]="pct(v.value) + ' against the estimate'">
                            <line class="pt-q-zero" x1="28" x2="28" y1="3" y2="17" />
                            <rect class="pt-q-bar" [attr.x]="v.value < 0 ? 28 - w : 28" y="6" [attr.width]="w" height="8" rx="2" />
                          </svg>
                        }
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p class="pt-q-empty">{{ EMPTY[p] }}</p>
              }
            }
          </div>
        }
        <p class="pt-note">Built from pretickt's own data: reported results, estimates, analysts' actions and prices; facts from filings and
          news come next. Each card says what a fact does to its pillar, never what to do with the stock. For information only — not
          investment advice.</p>
      </section>
    }`,
})
export class PtQuality {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();

  protected readonly fund = this.pt.fundamentals(() => ({ ticker: this.ticker(), periods: 16 }));
  protected readonly events = this.pt.events(() => ({ scope: { by: 'ticker' as const, ticker: this.ticker(), range: '1y' as const, ahead: 0 }, kinds: ['earnings' as const, 'analyst' as const] }));
  protected readonly analysts = this.pt.analysts(() => ({ ticker: this.ticker(), window: '1y' as const }));
  protected readonly peers = this.pt.screen(() => ({ scope: { peersOf: this.ticker() }, limit: 7 }));
  // the year's prices of the company, the market and up to six peers: asked once the peers are known
  protected readonly prices = this.pt.priceSeries(() => {
    const p = this.peers.value();
    if (p === undefined) return null;
    const others = (p?.rows ?? []).filter((r) => !r.self && r.ticker !== this.ticker()).slice(0, 6).map((r) => r.ticker);
    return { tickers: [this.ticker(), 'SPY', ...others], range: '1y' as const, interval: '1d' as const, rebase: false };
  });

  protected readonly asOf = computed(() => this.fund.value()?.asOf ?? '');
  /** The company, "Nvidia NVDA" with its logo: its name and logo from the peers' list (its own row), the ticker alone until it is known */
  protected readonly who = computed(() => {
    const t = this.ticker(), row = this.peers.value()?.rows.find((r) => r.ticker === t);
    return mention(t, row?.name ?? null, row?.logo ?? null);
  });
  protected readonly lead = computed(() => qualityLead(this.who(), this.cards(), this.asOf()));
  private readonly bars = computed(() => this.prices.value()?.find((s) => s.ticker === this.ticker())?.points ?? []);
  protected readonly cards = computed(() => qualityCards(this.ticker(), this.fund.value(), this.events.value(), this.bars(), this.asOf()));
  protected readonly byPillar = computed(() => Object.fromEntries(Object.keys(PILLARS).map((k) => [k, this.cards().filter((c) => c.pillar === k)])) as Record<Pillar, QCard[]>);
  protected readonly drop = computed(() => dropTest(this.prices.value(), this.ticker(), this.cards()));
  /** the box open below the rows: the reader's choice, else the pillar of the newest fact */
  protected readonly open = linkedSignal<Pillar>(() => this.cards()[0]?.pillar ?? 'economics');

  protected readonly base = computed<Record<Pillar, string>>(() => {
    const ps = this.fund.value()?.periods ?? [];
    const py = this.fund.value()?.periodsPerYear ?? 4;
    const p = ps.at(-1), a = ps.at(-1 - py);
    const yoy = p?.revenue != null && a?.revenue ? p.revenue / a.revenue - 1 : null;
    const exec = this.byPillar().execution;
    const beats = exec.filter((c) => c.tone === 'pos').length;
    const bars = this.bars();
    const hi = bars.reduce((m, b) => Math.max(m, b.c), 0);
    let fall = 0, peak = 0;
    for (const b of bars) { peak = Math.max(peak, b.c); fall = Math.min(fall, b.c / peak - 1); }
    const a1 = this.analysts.value();
    const up = a1?.summary && a1.price ? a1.summary.mean / a1.price - 1 : null;
    return {
      demand: yoy === null ? 'Revenue growth: not reported' : `Revenue ${pct(yoy)} from a year earlier`,
      advantage: p?.grossMargin == null ? 'Gross margin: not reported' : `Gross margin ${level(p.grossMargin)}`,
      economics: p?.operatingMargin == null ? 'Operating margin: not reported' : `Operating margin ${level(p.operatingMargin)}`,
      execution: exec.length ? `Beat the EPS estimate ${beats} of ${exec.length} times` : 'No report with an estimate in 12 months',
      fragility: hi ? `Largest fall in 12 months ${level(-fall)}` : 'No prices',
      price: `${p?.pe != null && p.pe > 0 ? `P/E ${num(p.pe, 1)}×` : 'P/E: no earnings'}${up === null ? '' : ` · average target ${pct(up)}`}`,
    };
  });

  protected readonly PILLARS = PILLARS;
  protected readonly PILLAR_KEYS = Object.keys(PILLARS) as Pillar[];
  protected readonly DROP_ORDER: Pillar[] = ['demand', 'advantage', 'economics', 'execution', 'fragility'];
  protected readonly ROWS = ROWS;
  protected readonly TONES: QTone[] = ['pos', 'neg', 'flat'];
  protected readonly MARK = MARK;
  protected readonly HORIZON: Record<Horizon, string> = { long: 'beyond 3 years', years: 'next 1–3 years', months: 'next months' };
  protected readonly EMPTY: Record<Pillar, string> = {
    demand: 'No quarter with a year to compare in the last 12 months.',
    advantage: 'Gross margin moved less than 3 points: nothing new from the numbers. Facts from filings and news come next.',
    economics: 'No quarter with a year to compare in the last 12 months.',
    execution: 'No report with an estimate in the last 12 months.',
    fragility: 'Nothing from the numbers: customers, rivals and the cycle come from filings and news, next.',
    price: 'No P/E history or analyst action to report.',
  };
  protected readonly date = date;
  protected readonly level = level;
  protected readonly ownPart = ownPart;
  protected readonly num = num;
  protected readonly pct = pct;
  protected readonly tip = tip;
  protected readonly verdict = verdict;
  protected readonly rowSentence = rowSentence;
  protected readonly slope = slope;
  protected readonly count = (cards: QCard[], t: QTone) => cards.filter((c) => c.tone === t).length;
  protected readonly surpriseWidth = (v: number) => Math.max(1.5, Math.min(24, Math.abs(v) * 100));
  /** a change's two values as its card writes them: P/E in ×, the rest as levels */
  protected fmt(v: number, c: QCard) { return c.pillar === 'price' ? `${num(v, 1)}×` : c.pillar === 'demand' ? pct(v) : level(v); }

  protected pick(p: Pillar, e: Event) {
    this.open.set(p);
    e.target?.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action: 'pillar' } }));
  }
}

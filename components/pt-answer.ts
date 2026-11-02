/**
 * The page's question answered first, in a sentence or two, from the data the page shows below it: a stock's analyst forecast and
 * price target, its peers, its latest quarter, its insiders; who leads a market list; a calendar month at a glance.
 * Company topics name the company as people search it, with its ticker ("Nvidia NVDA"): the sentence an answer engine quotes stands on its own.
 * Each company a sentence names is a link with its logo (PtSay, PtMention): on the site its card opens on hover, the page's own company too.
 * @version 1.4.0
 * @evidence DataForSEO: "<ticker> stock forecast" 151k/month, "<ticker> price target" 103k/month, "earnings calendar" 153k/month, list queries (launch/data/08c-serp-*.json)
 * @evidence SEO measurement 2026-10-09: list and company subpages of ~80–200 words; the answer belongs in the first lines, with its numbers
 * @evidence DataForSEO round 16 (2026-11-02): "<ticker> 200 day moving average" 4,080/month on 9 tickers, 50-day 1,550, 52-week high 1,300; the AI
 *   Overview quotes the pages that state the number (launch/data/16-summary.json)
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtSay } from '@pretickt/components/ds';
import { amount, andSaid, cash, date, level, mention, money, num, pct, say, usd, type Mention, type Said } from '@pretickt/components/format';
import { INSIDER_WINDOW_DAYS, type EventItem, type ScreenList, type ScreenRow, type Sector } from '@pretickt/components/typologies';

export { plainName } from '@pretickt/components/format';

type Topic = 'forecast' | 'price-target' | 'peers' | 'financials' | 'insiders' | 'list' | 'earnings' | 'dividends' | 'technicals';
type Named = { ticker: string; name: string; logo?: string | null };

/** A company the answer names: a link with its logo ("Apple AAPL"), its card on hover. */
const who = (c: Named): Mention => mention(c.ticker, c.name, c.logo);
const and = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);
const many = (n: number, one: string, more = `${one}s`) => `${n} ${n === 1 ? one : more}`;
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
/** A fraction as "18.2% above" / "6.3% below" / "in line with". */
const versus = (f: number) => (Math.abs(f) < 0.0005 ? 'in line with' : `${level(Math.abs(f))} ${f > 0 ? 'above' : 'below'}`);
const growth = (f: number) => (Math.abs(f) < 0.0005 ? 'flat' : `${f > 0 ? 'up' : 'down'} ${level(Math.abs(f))}`);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym} ${ym.slice(0, 4)}`;
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); const m = s.length / 2; return s.length % 2 ? s[Math.floor(m)]! : (s[m - 1]! + s[m]!) / 2; };
const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
/** Still waiting: nothing on screen yet. Not available: the na box. */
const PENDING: Said = [];

/**
 * Who leads each list, with the number it ranks by: `say` takes the sector ("Technology " on a sector page, else ""), the session and
 * the leaders already joined; `none` is the answer of an empty list.
 */
const LISTS: Record<ScreenList, { say: (sec: string, d: string, top: Said) => Said; item: (r: ScreenRow) => Said; none: (sec: string, d: string) => string }> = {
  biggest_losers: { say: (sec, d, top) => say`The biggest ${sec}losers on ${d}: ${top}.`, item: (r) => say`${who(r)} ${pct(r.chg1d)}`,
    none: (sec, d) => `No ${sec}stock fell on ${d}.` },
  biggest_gainers: { say: (sec, d, top) => say`The biggest ${sec}gainers on ${d}: ${top}.`, item: (r) => say`${who(r)} ${pct(r.chg1d)}`,
    none: (sec, d) => `No ${sec}stock rose on ${d}.` },
  '52w_low': { say: (sec, d, top) => say`The largest ${sec}stocks near their 52-week low on ${d}: ${top}.`, item: (r) => [who(r)],
    none: (sec, d) => `No ${sec}stock is near its 52-week low on ${d}.` },
  '52w_high': { say: (sec, d, top) => say`The largest ${sec}stocks near their 52-week high on ${d}: ${top}.`, item: (r) => [who(r)],
    none: (sec, d) => `No ${sec}stock is near its 52-week high on ${d}.` },
  undervalued: { say: (sec, d, top) => say`On ${d}, the undervalued ${sec}stocks with the most upside to their average analyst target are ${top}.`,
    item: (r) => say`${who(r)} (${pct(r.ptUpside, 0)})`, none: (sec, d) => `No ${sec}stock passes the undervalued screen on ${d}.` },
  insider_buying: { say: (sec, _d, top) => say`The largest net insider buying${sec ? ` in ${sec.trim()}` : ''} over the last ${INSIDER_WINDOW_DAYS} days: ${top}.`,
    item: (r) => say`${who(r)} ${usd(r.insiderNet, { compact: true, signed: true })}`,
    none: (sec) => `No ${sec}company had net insider buying over the last ${INSIDER_WINDOW_DAYS} days.` },
  most_active: { say: (sec, d, top) => say`The most traded ${sec}stocks by dollar volume on ${d}: ${top}.`, item: (r) => [who(r)], none: (sec, d) => `No ${sec}stock traded on ${d}.` },
  largest: { say: (sec, d, top) => say`The largest ${sec}companies by market capitalization on ${d}: ${top}.`, item: (r) => say`${who(r)} ${usd(r.marketCap, { compact: true })}`,
    none: (sec, d) => `No ${sec}company is listed on ${d}.` },
  // round 16: the lists people search
  upgrades_downgrades: { say: (sec, d, top) => say`The latest analyst ${sec}upgrades and downgrades in the week to ${d}: ${top}.`,
    item: (r) => say`${who(r)} ${r.rating?.dir === 'down' ? 'downgraded' : 'upgraded'} by ${r.rating?.firm ?? 'an analyst'}`,
    none: (sec, d) => `No analyst upgraded or downgraded a ${sec}stock in the week to ${d}.` },
  golden_cross: { say: (sec, d, top) => say`${sec ? `${sec}stocks` : 'Stocks'} whose 50-day average crossed above their 200-day lately (a golden cross), as of ${d}: ${top}.`,
    item: (r) => say`${who(r)} (${r.cross ? date(r.cross) : 'lately'})`, none: (sec, d) => `No ${sec}stock had a golden cross in the two weeks to ${d}.` },
  death_cross: { say: (sec, d, top) => say`${sec ? `${sec}stocks` : 'Stocks'} whose 50-day average crossed below their 200-day lately (a death cross), as of ${d}: ${top}.`,
    item: (r) => say`${who(r)} (${r.cross ? date(r.cross) : 'lately'})`, none: (sec, d) => `No ${sec}stock had a death cross in the two weeks to ${d}.` },
  low_pe: { say: (sec, d, top) => say`The profitable ${sec}stocks with the lowest P/E ratios on ${d}: ${top}.`, item: (r) => say`${who(r)} ${num(r.pe, 1)}`,
    none: (sec, d) => `No profitable ${sec}stock has a P/E on ${d}.` },
  piotroski: { say: (sec, d, top) => say`The largest ${sec}companies with a Piotroski F-score of 8 or 9 on ${d}: ${top}.`,
    item: (r) => say`${who(r)} (${r.fscore ?? '—'} of 9)`, none: (sec, d) => `No ${sec}company scores 8 or 9 on the Piotroski checks on ${d}.` },
  unusual_volume: { say: (sec, d, top) => say`The ${sec}stocks trading furthest above their usual volume on ${d}: ${top}.`,
    item: (r) => say`${who(r)} ${num(r.volumeRatio, 1)}×`, none: (sec, d) => `No ${sec}stock traded twice its usual volume on ${d}.` },
};

@Component({
  selector: 'pt-answer',
  imports: [PtSay],
  // the sentence is a list (text and companies): an @if alias, never a @let — Angular stores a @let's value among its own views and,
  // cleaning up after hydration, takes a list whose second part is a company for one of them (angular/angular#59504)
  template: `
    @if (sentence(); as s) {
      @if (s.length) {<p class="pt-answer"><pt-say [parts]="s" /></p>}
    } @else {<p class="pt-na">Data not available</p>}`,
})
export class PtAnswer {
  private readonly pt = inject(Pt);
  readonly topic = input<Topic>('forecast');
  readonly ticker = input<string>();
  readonly list = input<ScreenList>('biggest_losers');
  readonly sector = input<Sector>();
  readonly month = input<string>();

  /** The company of a company topic, or null: each call below is made only for the topic that reads it (the page asked for the same). */
  private readonly of = (...topics: Topic[]) => (topics.includes(this.topic()) ? this.ticker() ?? null : null);
  /** The company's name for the company topics: the card at the top of every company page asks for it too (the same call). */
  protected readonly company = this.pt.company(() => {
    const t = this.of('forecast', 'price-target', 'peers', 'financials', 'insiders', 'technicals');
    return t ? { ticker: t } : null;
  });
  protected readonly analysts = this.pt.analysts(() => { const t = this.of('forecast', 'price-target'); return t ? { ticker: t, window: '1y' } : null; });
  protected readonly rating = this.pt.metric(() => { const t = this.of('forecast', 'price-target'); return t ? { ticker: t, metrics: ['pt_upside', 'consensus'] } : null; });
  protected readonly peers = this.pt.screen(() => { const t = this.of('peers'); return t ? { scope: { peersOf: t }, limit: 12 } : null; });
  protected readonly quarters = this.pt.fundamentals(() => { const t = this.of('financials'); return t ? { ticker: t, periods: 12 } : null; });
  protected readonly insiders = this.pt.insider(() => { const t = this.of('insiders'); return t ? { ticker: t, days: 365 } : null; });
  // the year's daily bars of the hub's price chart (pt-price-events asks the same): the averages and the range come from them
  protected readonly bars = this.pt.priceSeries(() => { const t = this.of('technicals'); return t ? { tickers: [t], range: '1y', interval: '1d', rebase: false } : null; });
  protected readonly leaders = this.pt.screen(() => {
    if (this.topic() !== 'list') return null;
    const s = this.sector();
    return { scope: s ? { list: this.list(), sector: s } : { list: this.list() }, limit: 20 };
  });
  // the same call as pt-calendar's under it (its kind with the market dates): the page carries one month, not two
  protected readonly calendar = this.pt.events(() => {
    const t = this.topic(), m = this.month();
    return (t === 'earnings' || t === 'dividends') && m
      ? { scope: { by: 'universe' as const, month: m }, kinds: [t === 'earnings' ? 'earnings' as const : 'dividend' as const, 'macro' as const] } : null;
  });

  /** The answer: a sentence (or two); null when the data is not available (or the placement lacks the company or month its topic needs); '' while it is on its way. */
  protected readonly sentence = computed((): Said | null => {
    switch (this.topic()) {
      case 'forecast': case 'price-target': return this.target();
      case 'peers': return this.peerAnswer();
      case 'financials': return this.quarterAnswer();
      case 'insiders': return this.insiderAnswer();
      case 'list': return this.listAnswer();
      case 'technicals': return this.technicalsAnswer();
      default: return this.calendarAnswer();
    }
  });

  /** The page's company as a mention ("Nvidia NVDA" with its logo; the ticker alone without a name); undefined while it is on its way. */
  private named(t: string): Mention | undefined {
    const c = this.company.value();
    return c === undefined ? undefined : mention(t, c?.name ?? null, c?.logo ?? null);
  }

  private target(): Said | null {
    const a = this.analysts.value(), t = this.ticker();
    if (!t) return null;
    if (a === undefined) return PENDING;
    if (a === null) return null;
    const n = this.named(t);
    if (n === undefined) return PENDING;
    const text = this.rating.value()?.find((m) => m.key === 'consensus')?.text;
    const rating = text ? ` Rating consensus: ${text}.` : '';
    const s = a.summary;
    if (!s || !finite(a.price) || a.price <= 0) return say`No analyst published a price target for ${n} in the last 12 months.${rating}`;
    const vs = `${versus(s.mean / a.price - 1)} the last close of ${money(a.price)} on ${date(a.asOf)}`;
    if (this.topic() === 'forecast')
      return say`The average 12-month analyst price target for ${n} is ${money(s.mean)}, ${vs}; targets range from ${money(s.low)} to ${money(s.high)}.${rating}`;
    const firms = s.n === 1 ? 'the one analyst firm that published one' : `the ${s.n} analyst firms that published one`;
    const range = `Targets range from ${money(s.low)} to ${money(s.high)}, with a median of ${money(s.median)}.${rating}`;
    return say`The average price target of ${firms} in the last 12 months is ${money(s.mean)} for ${n}, ${vs}. ${range}`;
  }

  /**
   * The close against its 200- and 50-day moving averages (simple, on the daily closes) and its 52-week high and low (the bars' own
   * highs and lows); a listing younger than 200 sessions has the 50-day only, younger than a year its range since its first session.
   */
  private technicalsAnswer(): Said | null {
    const s = this.bars.value(), t = this.ticker();
    if (!t) return null;
    if (s === undefined) return PENDING;
    const pts = s?.[0]?.points ?? [];
    if (pts.length < 50) return null;
    const n = this.named(t);
    if (n === undefined) return PENDING;
    const last = pts.at(-1)!, c = last.c, avg = (k: number) => pts.slice(-k).reduce((a, p) => a + p.c, 0) / k;
    const ma50 = avg(50), ma200 = pts.length >= 200 ? avg(200) : null;
    const year = pts.slice(-252), hi = Math.max(...year.map((p) => p.h)), lo = Math.min(...year.map((p) => p.l));
    const fifty = `${versus(c / ma50 - 1)} its 50-day moving average of ${money(ma50)}`;
    const mas = ma200 === null ? fifty : `${versus(c / ma200 - 1)} its 200-day moving average of ${money(ma200)} and ${fifty}`;
    const range = pts.length >= 252 ? `its 52-week high of ${money(hi)}; its 52-week low is ${money(lo)}`
      : `its high since ${date(year[0]!.t)} of ${money(hi)}; its low since then is ${money(lo)}`;
    return say`${n} closed at ${money(c)} on ${date(last.t)}, ${mas}. It is ${versus(c / hi - 1)} ${range}.`;
  }

  private peerAnswer(): Said | null {
    const p = this.peers.value(), t = this.ticker();
    if (!t) return null;
    if (p === undefined) return PENDING;
    if (p === null) return null;
    const n = this.named(t);
    if (n === undefined) return PENDING;
    const self = p.rows.find((r) => r.self || r.ticker === t);
    const others = p.rows.filter((r) => r !== self);
    if (!others.length) return say`${n} has no tracked peer in its industry or sector.`;
    let s = say`The peers of ${n} by industry and size include ${andSaid(others.slice(0, 3).map((r) => [who(r)]))}.`;
    if (self && finite(self.marketCap)) {
      const rank = p.rows.filter((r) => finite(r.marketCap) && r.marketCap > self.marketCap!).length + 1;
      const pes = others.map((r) => r.pe).filter((v): v is number => finite(v) && v > 0);
      const pe = finite(self.pe) && self.pe > 0 && pes.length ? `; its P/E of ${num(self.pe, 1)} compares with a median of ${num(median(pes), 1)} for its peers` : '';
      s = say`${s} Among these ${p.rows.length} companies ${n} ranks ${ordinal(rank)} by market cap (${usd(self.marketCap, { compact: true })})${pe}.`;
    }
    return s;
  }

  private quarterAnswer(): Said | null {
    const f = this.quarters.value(), t = this.ticker();
    if (!t) return null;
    if (f === undefined) return PENDING;
    if (f === null) return null;
    const n = this.named(t);
    if (n === undefined) return PENDING;
    const q = f.periods.at(-1);
    if (!q) return say`No quarterly results are available for ${n}.`;
    const per = f.periodsPerYear ?? 4, cur = f.currency, span = per === 2 ? 'half-year' : 'quarter';
    const ago = f.periods.length > per ? f.periods.at(-1 - per)! : null;
    const yoy = finite(q.revenue) && finite(ago?.revenue) && ago.revenue > 0 ? `, ${growth(q.revenue / ago.revenue - 1)} from a year earlier` : '';
    const lead = finite(q.revenue)
      ? say`${n} reported revenue of ${cash(q.revenue, cur, { compact: true })} for the ${span} ended ${date(q.period)} (${q.fiscal})${yoy}.`
      : say`The latest reported ${span} of ${n} ended ${date(q.period)} (${q.fiscal}).`;
    const parts = [finite(q.eps) ? `diluted EPS of ${cash(q.eps, cur, { digits: 2 })}` : '', finite(q.fcf) ? `free cash flow of ${cash(q.fcf, cur, { compact: true })}` : '',
      finite(q.netMargin) ? `a net margin of ${level(q.netMargin)}` : ''].filter(Boolean);
    return parts.length ? say`${lead} It posted ${and(parts)}.` : lead;
  }

  private insiderAnswer(): Said | null {
    const ins = this.insiders.value(), t = this.ticker();
    if (!t) return null;
    if (ins === undefined) return PENDING;
    if (ins === null) return null;
    const n = this.named(t);
    if (n === undefined) return PENDING;
    const trades = ins.items.filter((i) => i.type === 'buy' || i.type === 'sell');
    if (!trades.length) return say`No open-market purchase or sale of ${n} stock by its officers and directors was reported in the last 12 months.`;
    const side = (type: 'buy' | 'sell', one: string) => {
      const list = trades.filter((i) => i.type === type);
      const value = list.reduce((s, i) => s + (i.value ?? 0), 0);
      return `${many(list.length, one)}${value > 0 ? ` worth ${usd(value, { compact: true })}` : ''}`;
    };
    const last = [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0]!;
    const latest = `The latest: ${last.name}${last.title ? ` (${last.title})` : ''} ${last.type === 'buy' ? 'bought' : 'sold'} ${num(last.shares, 0)} shares` +
      `${finite(last.price) && last.price > 0 ? ` at ${money(last.price)}` : ''} on ${date(last.date)}.`;
    return say`In the last 12 months ${n} insiders made ${side('buy', 'open-market purchase')} and ${side('sell', 'sale')}, as reported on SEC Form 4. ${latest}`;
  }

  private listAnswer(): Said | null {
    const l = this.leaders.value();
    if (l === undefined) return PENDING;
    if (l === null) return null;
    const rule = LISTS[this.list()] ?? LISTS.biggest_losers;
    const sec = this.sector() ? `${this.sector()} ` : '', d = date(l.asOf);
    return l.rows.length ? rule.say(sec, d, andSaid(l.rows.slice(0, 3).map(rule.item))) : [rule.none(sec, d)];
  }

  private calendarAnswer(): Said | null {
    const e = this.calendar.value(), m = this.month();
    if (!m) return null;
    if (e === undefined) return PENDING;
    if (e === null) return null;
    const kind = this.topic() === 'earnings' ? 'earnings' : 'dividend';
    const items = e.items.filter((i): i is Extract<EventItem, { kind: 'earnings' | 'dividend' }> => i.kind === kind && i.date.startsWith(m));
    const label = monthName(m);
    if (!items.length) return [kind === 'earnings' ? `No earnings report is scheduled for ${label} yet.` : `No ex-dividend date is scheduled for ${label} yet.`];
    const companies = new Set(items.map((i) => i.ticker)).size;
    const bySize = (a: { mcap: number | null }, b: { mcap: number | null }) => (b.mcap ?? 0) - (a.mcap ?? 0);
    if (kind === 'dividend') {
      const top = [...items].sort(bySize).slice(0, 3);
      return say`${many(companies, 'company goes', 'companies go')} ex-dividend in ${label}. The largest: ${andSaid(top.map((i) =>
        say`${who(i)} ${i.kind === 'dividend' ? amount(i.meta.amount) : ''} on ${date(i.date)}`))}.`;
    }
    const days = new Map<string, typeof items>();
    for (const i of items) days.set(i.date, [...(days.get(i.date) ?? []), i]);
    const [day, list] = [...days].sort(([a, x], [b, y]) => y.length - x.length || (a < b ? -1 : 1))[0]!;
    const top = [...list].sort(bySize).slice(0, 3);
    const busiest = `The busiest day is ${date(day)}, with ${many(list.length, 'report')}${list.length === 1 ? ':' : ', among them'}`;
    return say`${many(companies, 'company reports', 'companies report')} earnings in ${label}. ${busiest} ${andSaid(top.map((i) => [who(i)]))}.`;
  }
}

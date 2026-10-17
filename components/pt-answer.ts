/**
 * The page's question answered first, in a sentence or two, from the data the page shows below it: a stock's analyst forecast and
 * price target, its peers, its latest quarter, its insiders; who leads a market list; a calendar month at a glance.
 * @version 1.0.0
 * @evidence DataForSEO: "<ticker> stock forecast" 151k/month, "<ticker> price target" 103k/month, "earnings calendar" 153k/month, list queries (launch/data/08c-serp-*.json)
 * @evidence SEO measurement 2026-10-09: list and company subpages of ~80–200 words; the answer belongs in the first lines, with its numbers
 */
import { Component, computed, inject, input } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { amount, date, level, money, num, pct, usd } from '@pretickt/components/format';
import { INSIDER_WINDOW_DAYS, type EventItem, type ScreenList, type ScreenRow, type Sector } from '@pretickt/components/typologies';

type Topic = 'forecast' | 'price-target' | 'peers' | 'financials' | 'insiders' | 'list' | 'earnings' | 'dividends';
type Named = { ticker: string; name: string };

// legal suffixes and share classes at the end of a provider name; "Company"/"Co." go with their "and"/"&" (the generator's shortName)
const SUFFIX = /(?:(?:\s+(?:and|&))?,?\s+(?:Company|Co\.)|,?\s+(?:Inc\.?|Incorporated|Corporation|Corp\.?|plc|PLC|Ltd\.?|Limited|Public Limited Company|N\.V\.|S\.A\.|L\.P\.)|\s+Class [A-C](?: Common Stock)?|\s+Common Stock|\s+American Depositary Shares|\s+Ordinary Shares)$/;
/** A company's name as people search it: "Apple Inc." → "Apple", "The Coca-Cola Company" → "Coca-Cola". */
export function plainName(name: string): string {
  let n = name.trim();
  for (let prev = ''; prev !== n;) { prev = n; const next = n.replace(SUFFIX, ''); if (next) n = next; }
  return n.replace(/^The\s+/, '') || n;
}
/** "Apple (AAPL)", or the ticker alone when it is the name. */
const who = (c: Named) => { const n = plainName(c.name); return n.toUpperCase() === c.ticker ? c.ticker : `${n} (${c.ticker})`; };
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
const PENDING = '';

/**
 * Who leads each list, with the number it ranks by: `say` takes the sector ("Technology " on a sector page, else ""), the session and
 * the leaders already joined; `none` is the answer of an empty list.
 */
const LISTS: Record<ScreenList, { say: (sec: string, d: string, top: string) => string; item: (r: ScreenRow) => string; none: (sec: string, d: string) => string }> = {
  biggest_losers: { say: (sec, d, top) => `The biggest ${sec}losers on ${d}: ${top}.`, item: (r) => `${who(r)} ${pct(r.chg1d)}`,
    none: (sec, d) => `No ${sec}stock fell on ${d}.` },
  biggest_gainers: { say: (sec, d, top) => `The biggest ${sec}gainers on ${d}: ${top}.`, item: (r) => `${who(r)} ${pct(r.chg1d)}`,
    none: (sec, d) => `No ${sec}stock rose on ${d}.` },
  '52w_low': { say: (sec, d, top) => `The largest ${sec}stocks near their 52-week low on ${d}: ${top}.`, item: who,
    none: (sec, d) => `No ${sec}stock is near its 52-week low on ${d}.` },
  '52w_high': { say: (sec, d, top) => `The largest ${sec}stocks near their 52-week high on ${d}: ${top}.`, item: who,
    none: (sec, d) => `No ${sec}stock is near its 52-week high on ${d}.` },
  undervalued: { say: (sec, d, top) => `On ${d}, the undervalued ${sec}stocks with the most upside to their average analyst target are ${top}.`,
    item: (r) => `${who(r)} (${pct(r.ptUpside, 0)})`, none: (sec, d) => `No ${sec}stock passes the undervalued screen on ${d}.` },
  insider_buying: { say: (sec, _d, top) => `The largest net insider buying${sec ? ` in ${sec.trim()}` : ''} over the last ${INSIDER_WINDOW_DAYS} days: ${top}.`,
    item: (r) => `${who(r)} ${usd(r.insiderNet, { compact: true, signed: true })}`,
    none: (sec) => `No ${sec}company had net insider buying over the last ${INSIDER_WINDOW_DAYS} days.` },
  most_active: { say: (sec, d, top) => `The most traded ${sec}stocks by dollar volume on ${d}: ${top}.`, item: who, none: (sec, d) => `No ${sec}stock traded on ${d}.` },
  largest: { say: (sec, d, top) => `The largest ${sec}companies by market capitalization on ${d}: ${top}.`, item: (r) => `${who(r)} ${usd(r.marketCap, { compact: true })}`,
    none: (sec, d) => `No ${sec}company is listed on ${d}.` },
};

@Component({
  selector: 'pt-answer',
  template: `
    @let s = sentence();
    @if (s === null) {<p class="pt-na">Data not available</p>}
    @else if (s) {<p class="pt-answer">{{ s }}</p>}`,
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
  protected readonly analysts = this.pt.analysts(() => { const t = this.of('forecast', 'price-target'); return t ? { ticker: t, window: '1y' } : null; });
  protected readonly rating = this.pt.metric(() => { const t = this.of('forecast', 'price-target'); return t ? { ticker: t, metrics: ['pt_upside', 'consensus'] } : null; });
  protected readonly peers = this.pt.screen(() => { const t = this.of('peers'); return t ? { scope: { peersOf: t }, limit: 12 } : null; });
  protected readonly quarters = this.pt.fundamentals(() => { const t = this.of('financials'); return t ? { ticker: t, periods: 12 } : null; });
  protected readonly insiders = this.pt.insider(() => { const t = this.of('insiders'); return t ? { ticker: t, days: 365 } : null; });
  protected readonly leaders = this.pt.screen(() => {
    if (this.topic() !== 'list') return null;
    const s = this.sector();
    return { scope: s ? { list: this.list(), sector: s } : { list: this.list() }, limit: 20 };
  });
  protected readonly calendar = this.pt.events(() => {
    const t = this.topic(), m = this.month();
    return (t === 'earnings' || t === 'dividends') && m ? { scope: { by: 'universe' as const, month: m }, kinds: [t === 'earnings' ? 'earnings' as const : 'dividend' as const] } : null;
  });

  /** The answer: a sentence (or two); null when the data is not available (or the placement lacks the company or month its topic needs); '' while it is on its way. */
  protected readonly sentence = computed((): string | null => {
    switch (this.topic()) {
      case 'forecast': case 'price-target': return this.target();
      case 'peers': return this.peerAnswer();
      case 'financials': return this.quarterAnswer();
      case 'insiders': return this.insiderAnswer();
      case 'list': return this.listAnswer();
      default: return this.calendarAnswer();
    }
  });

  private target(): string | null {
    const a = this.analysts.value(), t = this.ticker();
    if (!t) return null;
    if (a === undefined) return PENDING;
    if (a === null) return null;
    const text = this.rating.value()?.find((m) => m.key === 'consensus')?.text;
    const rating = text ? ` Rating consensus: ${text}.` : '';
    const s = a.summary;
    if (!s || !finite(a.price) || a.price <= 0) return `No analyst published a price target for ${t} in the last 12 months.${rating}`;
    const vs = `${versus(s.mean / a.price - 1)} the last close of ${money(a.price)} on ${date(a.asOf)}`;
    if (this.topic() === 'forecast')
      return `The average 12-month analyst price target for ${t} is ${money(s.mean)}, ${vs}; targets range from ${money(s.low)} to ${money(s.high)}.${rating}`;
    const firms = s.n === 1 ? 'the one analyst firm that published one' : `the ${s.n} analyst firms that published one`;
    return `The average price target of ${firms} in the last 12 months is ${money(s.mean)} for ${t}, ${vs}. ` +
      `Targets range from ${money(s.low)} to ${money(s.high)}, with a median of ${money(s.median)}.${rating}`;
  }

  private peerAnswer(): string | null {
    const p = this.peers.value(), t = this.ticker();
    if (!t) return null;
    if (p === undefined) return PENDING;
    if (p === null) return null;
    const self = p.rows.find((r) => r.self || r.ticker === t);
    const others = p.rows.filter((r) => r !== self);
    if (!others.length) return `${t} has no tracked peer in its industry or sector.`;
    let s = `${t}’s peers by industry and size include ${and(others.slice(0, 3).map(who))}.`;
    if (self && finite(self.marketCap)) {
      const rank = p.rows.filter((r) => finite(r.marketCap) && r.marketCap > self.marketCap!).length + 1;
      const pes = others.map((r) => r.pe).filter((v): v is number => finite(v) && v > 0);
      const pe = finite(self.pe) && self.pe > 0 && pes.length ? `; its P/E of ${num(self.pe, 1)} compares with a median of ${num(median(pes), 1)} for its peers` : '';
      s += ` Among these ${p.rows.length} companies ${t} ranks ${ordinal(rank)} by market cap (${usd(self.marketCap, { compact: true })})${pe}.`;
    }
    return s;
  }

  private quarterAnswer(): string | null {
    const f = this.quarters.value(), t = this.ticker();
    if (!t) return null;
    if (f === undefined) return PENDING;
    if (f === null) return null;
    const q = f.periods.at(-1);
    if (!q) return `No quarterly results are available for ${t}.`;
    const ago = f.periods.length >= 5 ? f.periods.at(-5)! : null;
    const yoy = finite(q.revenue) && finite(ago?.revenue) && ago.revenue > 0 ? `, ${growth(q.revenue / ago.revenue - 1)} from a year earlier` : '';
    const lead = finite(q.revenue)
      ? `${t} reported revenue of ${usd(q.revenue, { compact: true })} for the quarter ended ${date(q.period)} (${q.fiscal})${yoy}.`
      : `${t}’s latest reported quarter ended ${date(q.period)} (${q.fiscal}).`;
    const parts = [finite(q.eps) ? `diluted EPS of ${money(q.eps)}` : '', finite(q.fcf) ? `free cash flow of ${usd(q.fcf, { compact: true })}` : '',
      finite(q.netMargin) ? `a net margin of ${level(q.netMargin)}` : ''].filter(Boolean);
    return parts.length ? `${lead} It posted ${and(parts)}.` : lead;
  }

  private insiderAnswer(): string | null {
    const ins = this.insiders.value(), t = this.ticker();
    if (!t) return null;
    if (ins === undefined) return PENDING;
    if (ins === null) return null;
    const trades = ins.items.filter((i) => i.type === 'buy' || i.type === 'sell');
    if (!trades.length) return `No open-market purchase or sale of ${t} stock by its officers and directors was reported in the last 12 months.`;
    const side = (type: 'buy' | 'sell', one: string) => {
      const list = trades.filter((i) => i.type === type);
      const value = list.reduce((s, i) => s + (i.value ?? 0), 0);
      return `${many(list.length, one)}${value > 0 ? ` worth ${usd(value, { compact: true })}` : ''}`;
    };
    const last = [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0]!;
    return `In the last 12 months ${t} insiders made ${side('buy', 'open-market purchase')} and ${side('sell', 'sale')}, as reported on SEC Form 4. ` +
      `The latest: ${last.name}${last.title ? ` (${last.title})` : ''} ${last.type === 'buy' ? 'bought' : 'sold'} ${num(last.shares, 0)} shares` +
      `${finite(last.price) && last.price > 0 ? ` at ${money(last.price)}` : ''} on ${date(last.date)}.`;
  }

  private listAnswer(): string | null {
    const l = this.leaders.value();
    if (l === undefined) return PENDING;
    if (l === null) return null;
    const rule = LISTS[this.list()] ?? LISTS.biggest_losers;
    const sec = this.sector() ? `${this.sector()} ` : '', d = date(l.asOf);
    return l.rows.length ? rule.say(sec, d, and(l.rows.slice(0, 3).map(rule.item))) : rule.none(sec, d);
  }

  private calendarAnswer(): string | null {
    const e = this.calendar.value(), m = this.month();
    if (!m) return null;
    if (e === undefined) return PENDING;
    if (e === null) return null;
    const kind = this.topic() === 'earnings' ? 'earnings' : 'dividend';
    const items = e.items.filter((i): i is Extract<EventItem, { kind: 'earnings' | 'dividend' }> => i.kind === kind && i.date.startsWith(m));
    const label = monthName(m);
    if (!items.length) return kind === 'earnings' ? `No earnings report is scheduled for ${label} yet.` : `No ex-dividend date is scheduled for ${label} yet.`;
    const companies = new Set(items.map((i) => i.ticker)).size;
    const bySize = (a: { mcap: number | null }, b: { mcap: number | null }) => (b.mcap ?? 0) - (a.mcap ?? 0);
    if (kind === 'dividend') {
      const top = [...items].sort(bySize).slice(0, 3);
      return `${many(companies, 'company goes', 'companies go')} ex-dividend in ${label}. The largest: ` +
        `${and(top.map((i) => `${who(i)} ${i.kind === 'dividend' ? amount(i.meta.amount) : ''} on ${date(i.date)}`))}.`;
    }
    const days = new Map<string, typeof items>();
    for (const i of items) days.set(i.date, [...(days.get(i.date) ?? []), i]);
    const [day, list] = [...days].sort(([a, x], [b, y]) => y.length - x.length || (a < b ? -1 : 1))[0]!;
    const top = [...list].sort(bySize).slice(0, 3);
    return `${many(companies, 'company reports', 'companies report')} earnings in ${label}. The busiest day is ${date(day)}, with ` +
      `${many(list.length, 'report')}${list.length === 1 ? ':' : ', among them'} ${and(top.map(who))}.`;
  }
}

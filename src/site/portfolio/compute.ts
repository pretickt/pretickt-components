import {
  BASKET_MIN_COVERAGE, basketConsensus, basketPe, basketQuestions, basketTarget, consensusOf, valueMoves,
  type BasketLine, type ClosesFile, type FactsFile, type PortfolioBasket, type PortfolioHolding,
} from '@pretickt/components/typologies';
import type { StoredPortfolio, StoredRow } from './store';

/**
 * A reader's portfolio or watchlist as the page shows it, computed in the browser from the nightly's files (design 2026-11-07 Part B, amended
 * 2026-11-08): the funds' and sectors' figures (the components' basket math) over its companies, a fund looked through to the companies it holds
 * that we cover; each line's return since its purchase date on the split basis. Nothing here leaves the browser.
 */
const DAY = 86_400_000;
/** A purchase date reads the first session on or after it within a week; later than that, the date is before a first close or a break. */
const WEEK_DAYS = 7;
const EARNINGS_DAYS = 90;
const EARNINGS_MIN_WEIGHT = 0.01;
/** A target's base when there is no value (percentages, equal weight, a fund line): 100, so the upside keeps its basis points (basketTarget rounds the price to cents). */
const NO_VALUE_BASE = 100;
const HEADLINES = 10;
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * The close of the first session on or after `d`, within a week. Null: no close there (a date before a first close, or before the company's corporate
 * break `cut`: the closes after it are on another basis). Undefined: no file loaded holds the date yet (its year's file is on its way).
 */
export function closeOn(closes: ReadonlyMap<string, ClosesFile>, t: string, d: string, cut?: string): number | null | undefined {
  if (![...closes.values()].some((f) => f.from <= d && d <= f.to)) return undefined;
  if (cut && d < cut) return null;
  const until = addDays(d, WEEK_DAYS);
  const files = [...closes.values()].filter((f) => f.to >= d && f.from <= until).sort((a, b) => (a.from < b.from ? -1 : 1));
  for (const f of files) {
    const c = f.closes[t];
    if (!c) continue;
    for (let i = 0; i < f.dates.length; i++) {
      const x = f.dates[i]!;
      if (x < d) continue;
      if (x > until) break;
      if (c[i] != null) return c[i]!;
    }
  }
  return null;
}

/** The calendar years whose closes a portfolio's dates need beyond the last year's file (`oneYearFrom`, its first date; null: not loaded yet). */
export function closesNeeded(p: StoredPortfolio, oneYearFrom: string | null): string[] {
  if (p.kind === 'watchlist') return [];
  const years = new Set<string>();
  for (const r of p.rows) {
    if (!r.d || (oneYearFrom != null && r.d >= oneYearFrom)) continue;
    years.add(r.d.slice(0, 4));
    // a date in the year's last days may find its session in the next year's file
    if (r.d.slice(5) >= '12-24') years.add(String(Number(r.d.slice(0, 4)) + 1));
  }
  return [...years].sort();
}

/**
 * A line's return since its purchase dates: shares at their own closes (what they cost on the split basis), other amounts averaged by size; `bought`
 * the earliest date read. A date whose file is still on its way leaves the line waiting (no return, nothing said); none read: no return, said.
 */
function sinceOf(lots: readonly StoredRow[], now: number | null, then: (d: string) => number | null | undefined, shares: boolean): { since: number | null; noSince: boolean; bought: string | null } {
  const dated = lots.filter((l) => l.d != null).map((l) => ({ l, c: then(l.d!) })).sort((a, b) => (a.l.d! < b.l.d! ? -1 : 1));
  if (!dated.length) return { since: null, noSince: false, bought: null };
  if (dated.some((x) => x.c === undefined)) return { since: null, noSince: false, bought: dated[0]!.l.d };
  const read = dated.filter((x) => x.c != null && x.c > 0).map((x) => ({ n: x.l.n ?? 1, c: x.c!, d: x.l.d! }));
  if (!read.length || now == null) return { since: null, noSince: true, bought: dated[0]!.l.d };
  const v = shares ? read.reduce((s, x) => s + x.n * now, 0) / read.reduce((s, x) => s + x.n * x.c, 0) - 1
    : read.reduce((s, x) => s + x.n * (now / x.c - 1), 0) / read.reduce((s, x) => s + x.n, 0);
  return { since: round(v, 4), noSince: false, bought: read[0]!.d };
}

/**
 * A logo's file names its company (nvda.1a2b3c4d.png): fetched from this page, it would tell the server what the reader holds (Romeo, 2026-11-08:
 * the portfolio's data stay offline, in the browser). So the logos here are the ones the page cut out of the sheet every reader loads (`cut`, as
 * data URLs), never a facts file's own; a line without one shows its initials. Once per facts file and set of logos.
 */
const NO_LOGOS: ReadonlyMap<string, string> = new Map();
const branded = new WeakMap<FactsFile, { cut: ReadonlyMap<string, string>; out: FactsFile }>();
function withLogos(f: FactsFile, cut: ReadonlyMap<string, string>): FactsFile {
  const was = branded.get(f);
  if (was?.cut === cut) return was.out;
  const out = { ...f, companies: Object.fromEntries(Object.entries(f.companies).map(([t, c]) => [t, { ...c, logo: cut.get(t) ?? null }])),
    funds: Object.fromEntries(Object.entries(f.funds).map(([t, x]) => [t, { ...x, logo: cut.get(t) ?? null }])) };
  branded.set(f, { cut, out });
  return out;
}

export function computePortfolio(p: StoredPortfolio, input: FactsFile, closes: ReadonlyMap<string, ClosesFile>, logos = NO_LOGOS): PortfolioBasket {
  const facts = withLogos(input, logos);
  const lots = new Map<string, StoredRow[]>();
  for (const row of p.rows) lots.set(row.t, [...(lots.get(row.t) ?? []), row]);
  const shares = p.unit === 'shares';
  const priceOf = (t: string) => facts.companies[t]?.close ?? facts.funds[t]?.close ?? null;
  // each line's amount: its value (shares × close, dollars), its percentage, or 1 (equal); a holding in shares with no price cannot be weighed
  const amounts = [...lots].map(([t, rs]) => {
    const n = rs.reduce((s, r) => s + (r.n ?? 0), 0), price = priceOf(t);
    return { t, rs, amount: p.unit === 'equal' ? 1 : shares ? (price != null ? n * price : null) : n };
  });
  // percentages that add up to less than 100 leave the rest of the portfolio out: it counts, not covered
  const typed = amounts.reduce((s, a) => s + (a.amount ?? 0), 0);
  const total = p.unit === 'pct' ? Math.max(100, typed) : typed;
  const weightOf = (a: number | null) => (a == null || !total ? null : a / total);

  const covered = new Map<string, number>(), uncovered: PortfolioBasket['uncovered'] = [], holdings: PortfolioHolding[] = [];
  const add = (t: string, w: number) => covered.set(t, (covered.get(t) ?? 0) + w);
  for (const { t, rs, amount } of amounts) {
    const w = weightOf(amount), c = facts.companies[t], f = facts.funds[t];
    if (w == null || (!c && !f)) { uncovered.push({ name: t, weight: w == null ? null : round(w, 4) }); continue; }
    const now = c ? c.close : f!.close;
    const { since, noSince, bought } = p.kind === 'portfolio' ? sinceOf(rs, now, (d) => closeOn(closes, t, d, facts.breaks?.[t]), shares) : { since: null, noSince: false, bought: null };
    if (c) {
      add(t, w);
      holdings.push({ ticker: t, name: c.name, logo: c.logo, weight: round(w, 5), ret: c.ret == null ? null : round(c.ret, 5), upside: c.upside == null ? null : round(c.upside, 4),
        label: c.consensus ? consensusOf(c.consensus)?.label ?? null : null, close: c.close, fund: false, bought, since, noSince });
    } else {
      for (const [ct, fw] of f!.weights) add(ct, w * fw);
      if (f!.coverage < 1) uncovered.push({ name: `${f!.name}, ${f!.old ? 'its holdings list is out of date' : 'outside the companies we cover'}`, weight: round(w * (1 - f!.coverage), 4) });
      const own = basketTarget(f!.weights.flatMap(([ct, fw]): BasketLine[] => (facts.companies[ct] ? [{ ticker: ct, f: facts.companies[ct]!, weight: fw }] : [])), NO_VALUE_BASE);
      holdings.push({ ticker: t, name: f!.name, logo: f!.logo, weight: round(w, 5), ret: f!.ret == null ? null : round(f!.ret, 5), upside: own ? round(own.upside, 4) : null,
        label: null, close: f!.close, fund: true, bought, since, noSince });
    }
  }
  if (p.unit === 'pct' && typed < 100) uncovered.push({ name: 'The rest of your portfolio', weight: round(1 - typed / 100, 4) });
  holdings.sort((a, b) => b.weight - a.weight);
  uncovered.sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1));

  const lines: BasketLine[] = [...covered].map(([t, weight]) => ({ ticker: t, f: facts.companies[t]!, weight })).sort((a, b) => b.weight - a.weight);
  // a holding in shares we cannot price has an unknown value: so is the share we cover, and no figure can say what it rests on
  const unpriced = uncovered.some((u) => u.weight == null);
  const coverage = round(lines.reduce((s, l) => s + l.weight, 0), 4), ok = coverage >= BASKET_MIN_COVERAGE && !unpriced;
  const value = shares || p.unit === 'usd' ? round(total, 2) : null;
  const moves = valueMoves(holdings.map((h) => ({ ticker: h.ticker, name: h.name, logo: h.logo, value: h.weight, ret: h.ret, headline: facts.companies[h.ticker]?.headline ?? null })));

  // the whole return since purchase: shares only, every line dated and read
  const dated = p.kind === 'portfolio' && shares && p.rows.length > 0 && p.rows.every((r) => r.d != null && r.n != null);
  const then = dated ? p.rows.map((r) => ({ r, c: closeOn(closes, r.t, r.d!, facts.breaks?.[r.t]), now: priceOf(r.t) })) : [];
  const since = dated && then.every((x) => x.c != null && x.now != null)
    ? { from: p.rows.map((r) => r.d!).sort()[0]!, ret: round(then.reduce((s, x) => s + x.r.n! * x.now!, 0) / then.reduce((s, x) => s + x.r.n! * x.c!, 0) - 1, 4) } : null;

  const until = addDays(facts.asOf, EARNINGS_DAYS);
  return {
    kind: p.kind, name: p.name, asOf: facts.asOf, unit: p.unit, value, ret: moves.ret, since, coverage, state: ok ? 'ok' : 'low', uncovered,
    target: ok ? basketTarget(lines, value ?? NO_VALUE_BASE) : null, consensus: ok ? basketConsensus(lines) : null, pe: ok ? basketPe(lines) : null, questions: ok ? basketQuestions(lines, coverage) : null,
    moves: { sum: moves.ret, up: moves.up, down: moves.down },
    holdings,
    // a company that weighs under 1% (a fund's smallest) is not this portfolio's news
    earnings: lines.filter((l) => l.weight >= EARNINGS_MIN_WEIGHT && l.f.nextEarnings != null && l.f.nextEarnings > facts.asOf && l.f.nextEarnings <= until)
      .sort((a, b) => (a.f.nextEarnings! < b.f.nextEarnings! ? -1 : a.f.nextEarnings! > b.f.nextEarnings! ? 1 : b.weight - a.weight)).slice(0, 10)
      .map((l) => ({ ticker: l.ticker, name: l.f.name, logo: l.f.logo, date: l.f.nextEarnings! })),
    headlines: lines.filter((l) => l.f.headline).slice(0, HEADLINES).map((l) => ({ ticker: l.ticker, name: l.f.name, title: l.f.headline!.title, url: l.f.headline!.url })),
  };
}

/** The portfolio's year on the page: what today's holdings were worth each day (shares), or their weighted return since the first day (the rest). */
export interface YearLine { unit: 'value' | 'return'; points: { t: string; v: number }[] }
/**
 * The year's line from the 1y closes file: with shares, Σ shares × that day's close; otherwise Σ today's weight × the return since the first day. A
 * holding not listed yet counts at its first close (the line shows prices, not listings); one with no close in the file at tonight's.
 */
export function yearLine(p: StoredPortfolio, facts: FactsFile, oneYear: ClosesFile): YearLine | null {
  if (!p.rows.length || !oneYear.dates.length) return null;
  const series = (t: string): number[] => {
    const c = oneYear.closes[t] ?? [], now = facts.companies[t]?.close ?? facts.funds[t]?.close ?? null;
    const first = c.find((x) => x != null) ?? now ?? 0;
    let last = first;
    return oneYear.dates.map((_, i) => (last = c[i] ?? last));
  };
  if (p.kind === 'portfolio' && p.unit === 'shares') {
    const n = new Map<string, number>();
    for (const r of p.rows) n.set(r.t, (n.get(r.t) ?? 0) + (r.n ?? 0));
    const lines = [...n].map(([t, k]) => ({ k, s: series(t) }));
    return { unit: 'value', points: oneYear.dates.map((t, i) => ({ t, v: round(lines.reduce((s, l) => s + l.k * l.s[i]!, 0), 2) })) };
  }
  const b = computePortfolio(p, facts, new Map());
  const lines = b.holdings.map((h) => ({ w: h.weight, s: series(h.ticker) })).filter((l) => l.s[0]! > 0);
  const total = lines.reduce((s, l) => s + l.w, 0);
  if (!total) return null;
  return { unit: 'return', points: oneYear.dates.map((t, i) => ({ t, v: round(lines.reduce((s, l) => s + l.w * (l.s[i]! / l.s[0]! - 1), 0) / total, 4) })) };
}

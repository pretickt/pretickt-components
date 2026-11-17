/**
 * The technicals' arithmetic (spec pretickt/docs/superpowers/specs/2026-11-17-technicals-page-design.md): pure, shared by the plant's nightly
 * step and the typology's demo. Every past state is read point in time — a session's levels come from the closes up to it only.
 */
import { bollinger, macd, rsi, sma, smaLast, supportResistance } from '../indicators';
import type { TechCard, TechEpisode, TechState, TechSum } from './technicals';

export const TECH_CARDS = ['rsi', 'support', 'resistance', 'ma200', 'mas', 'cross', 'bollinger', 'macd', 'high'] as const;
export type TechCardKey = (typeof TECH_CARDS)[number];
export const TECH_STATES = {
  rsi: ['below30', 'above70', 'between'], support: ['near', 'far', 'none'], resistance: ['near', 'far', 'none'],
  ma200: ['below', 'above'], mas: ['belowAll', 'aboveAll', 'mixed'], cross: ['golden', 'death'],
  bollinger: ['belowLower', 'aboveUpper', 'inside'], macd: ['pos', 'neg'], high: ['off40', 'off30', 'off20', 'off10', 'near'],
} as const satisfies Record<TechCardKey, readonly string[]>;

/** Five years of sessions; the levels read two years before each; a page needs a year; 1 and 3 months after; a new episode after 10 sessions out. */
export const TECH = { WINDOW: 1260, WARMUP: 504, MIN_SESSIONS: 252, H: [21, 63] as const, GAP: 10, SR_EVERY: 5, NEAR: 0.05, BEYOND: 0.03,
  KEEP: 12, PATHS: 12, STEP: 3, HUB: 300 } as const;

export interface TechSeries { dates: string[]; closes: number[]; highs: (number | null)[] }
type A = (number | null)[];
type StateOut = Omit<TechState, 'all'> & { all: null };
type CardOut = Omit<TechCard, 'states'> & { states: StateOut[] };

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
/** A price or an indicator for a chart: two decimals, three under 10. */
const px = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : Math.round(v * (Math.abs(v) < 10 ? 1000 : 100)) / (Math.abs(v) < 10 ? 1000 : 100));
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return r4(s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2); };
/** The last index where `f` holds (es2022: no findLastIndex). */
const lastWhere = (a: A, f: (v: number | null) => boolean) => { for (let i = a.length - 1; i >= 0; i--) if (f(a[i]!)) return i; return -1; };
const firstDefined = (a: A) => { const i = a.findIndex((v) => v != null); return i < 0 ? Infinity : i; };

/** The sessions that enter a state: in it, after at least `gap` sessions out (the start counts as out); only from `from` on. */
export function episodesOf(inState: boolean[], from: number, gap: number = TECH.GAP): number[] {
  const out: number[] = [];
  let away = gap;
  for (let i = 0; i < inState.length; i++) {
    if (inState[i]) { if (away >= gap && i >= from) out.push(i); away = 0; } else away++;
  }
  return out;
}

/** Where the close was 21 and 63 sessions after `i`, and SPY over the same dates (null: too recent, or no market). */
export function outcome(s: TechSeries, spy: Map<string, number> | null, i: number): Pick<TechEpisode, 'r' | 'm'> {
  const at = (h: number) => {
    const j = i + h;
    if (j >= s.closes.length) return [null, null] as const;
    const r = r4(s.closes[j]! / s.closes[i]! - 1);
    const a = spy?.get(s.dates[i]!), b = spy?.get(s.dates[j]!);
    return [r, a && b ? r4(b / a - 1) : null] as const;
  };
  const [a, b] = [at(TECH.H[0]), at(TECH.H[1])];
  return { r: [a[0], b[0]], m: [a[1], b[1]] };
}

/** One horizon's counts: episodes with an outcome, how many ended higher, the median, the market's median, the median net of it. */
export function summarize(eps: readonly Pick<TechEpisode, 'r' | 'm'>[], h: 0 | 1, market: boolean): TechSum {
  const done = eps.filter((e) => e.r[h] != null), both = done.filter((e) => e.m[h] != null);
  return { n: done.length, up: done.filter((e) => e.r[h]! > 0).length, med: median(done.map((e) => e.r[h]!)),
    mkt: market ? median(both.map((e) => e.m[h]!)) : null, net: market ? median(both.map((e) => e.r[h]! - e.m[h]!)) : null };
}

/** Each week's last session among `idx` (ISO weeks, Monday first). */
function weekly(dates: string[], idx: number[]): number[] {
  const week = (d: string) => Math.floor((Date.parse(`${d}T00:00:00Z`) / 86_400_000 + 3) / 7);
  return idx.filter((i, k) => k === idx.length - 1 || week(dates[idx[k + 1]!]!) !== week(dates[i]!));
}

/**
 * One ticker's cards and its episodes for the pooled table (`pool`, keyed `card:state`, every episode of the window). Null under a year of
 * closes. `today.hi52`: the 52-week high the hub's badge reads (the traded intraday highs), so the card agrees with it.
 */
export function computeTechnicals(s: TechSeries, o: { asOf: string; spy: Map<string, number> | null; today?: { hi52?: number | null } }):
  { payload: { asOf: string; since: string; fullWindow: boolean; close: number; daily: { t: string[]; c: number[] }; weekly: { t: string[]; c: number[] }; cards: CardOut[] };
    pool: Record<string, TechEpisode[]> } | null {
  const { dates, closes } = s, L = closes.length;
  if (L < TECH.MIN_SESSIONS) return null;
  const market = o.spy != null, ws = Math.max(0, L - TECH.WINDOW), last = closes[L - 1]!;
  const all = Array.from({ length: L }, (_, i) => i);
  const D = all.slice(-252), W = weekly(dates, all.slice(ws));
  const pool: Record<string, TechEpisode[]> = {};

  // the series, over the whole history read (the windows' first values settle before the five years start)
  const rsiS = rsi(closes), ma = { 20: sma(closes, 20), 50: sma(closes, 50), 100: sma(closes, 100), 200: sma(closes, 200) };
  const bb = bollinger(closes), mc = macd(closes), hist: A = mc.macd.map((v, i) => (v != null && mc.signal[i] != null ? v - mc.signal[i]! : null));
  const highs = s.highs.map((h, i) => h ?? closes[i]!);
  const hi52: A = all.map((i) => (i < 20 ? null : Math.max(...highs.slice(Math.max(0, i - 251), i + 1))));
  // the levels point in time: every 5th session from the closes up to it, carried to the next four
  const sup: A = Array(L).fill(null), res: A = Array(L).fill(null);
  for (let i = Math.max(10, ws - TECH.GAP); i < L; i += TECH.SR_EVERY) {
    const sr = supportResistance(closes.slice(Math.max(0, i - TECH.WARMUP + 1), i + 1));
    for (let j = i; j < Math.min(L, i + TECH.SR_EVERY); j++) { sup[j] = sr.supports[0]?.price ?? null; res[j] = sr.resistances[0]?.price ?? null; }
  }

  const ep = (i: number, level: A | null, kind: 'support' | 'resistance' | null): TechEpisode => {
    let held: boolean | null = null;
    if (kind && level && i + TECH.H[0] < L) {
      const lv = level[i]!, next = closes.slice(i + 1, i + 1 + TECH.H[0]);
      held = kind === 'support' ? !next.some((c) => c < lv * (1 - TECH.BEYOND)) : !next.some((c) => c > lv * (1 + TECH.BEYOND));
    }
    return { t: dates[i]!, ...outcome(s, o.spy, i), held };
  };
  const path = (i: number) => Array.from({ length: TECH.H[1] / TECH.STEP + 1 }, (_, k) => (i + k * TECH.STEP < L ? r4(closes[i + k * TECH.STEP]! / closes[i]! - 1) : null));
  /** A state's episodes and counts; `shown` adds the paths. */
  const state = (card: TechCardKey, key: string, inState: boolean[], valid: number, shown: boolean, level: A | null = null, kind: 'support' | 'resistance' | null = null): StateOut => {
    const idx = episodesOf(inState, Math.max(ws, valid + TECH.GAP)), eps = idx.map((i) => ep(i, level, kind));
    pool[`${card}:${key}`] = eps;
    return { key, total: eps.length, episodes: eps.slice(-TECH.KEEP), paths: shown ? idx.slice(-TECH.PATHS).map(path) : null,
      held: kind ? eps.filter((e) => e.held === true).length : null, stock: [summarize(eps, 0, market), summarize(eps, 1, market)], all: null };
  };
  const line = (k: string, a: A, idx: number[], from = 0) => ({ k, v: idx.slice(from).map((i) => px(a[i])) });
  // a mark on its chart's own date: a weekly chart's is the week's last session (review: 79% of the weekly marks were dropped)
  const at = new Map(dates.map((d, i) => [d, i]));
  const onChart = (t: string, idx: number[]) => { const i = at.get(t)!; let lo = 0, hi = idx.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (idx[m]! < i) lo = m + 1; else hi = m; } return idx[lo]! >= i ? dates[idx[lo]!]! : null; };
  const marks = (states: StateOut[], idx: number[], from: number, keys?: string[]) => states.filter((st) => (keys ?? [st.key]).includes(st.key) && (st.paths || keys))
    .flatMap((st) => st.episodes.filter((e) => e.t >= dates[idx[from]!]!).flatMap((e) => { const t = onChart(e.t, idx); return t ? [{ t, k: st.key }] : []; }));
  const cards: CardOut[] = [];
  const C = (i: number) => closes[i]!;

  // RSI (14 days): today's on the hub's window of 300 closes, so the card and the badge agree
  const rsiT = rsi(closes.slice(-TECH.HUB)), rNow = rsiT.at(-1) ?? null;
  if (rNow != null) {
    const st = rNow < 30 ? 'below30' : rNow > 70 ? 'above70' : 'between', v = firstDefined(rsiS);
    const states = [state('rsi', 'below30', all.map((i) => rsiS[i] != null && rsiS[i]! < 30), v, st !== 'above70'),
      state('rsi', 'above70', all.map((i) => rsiS[i] != null && rsiS[i]! > 70), v, st !== 'below30')];
    cards.push({ key: 'rsi', state: st, now: { rsi: px(rNow), was: px(rsiT.at(-6) ?? null) },
      chart: { range: 'daily', from: 0, lines: [], levels: [], marks: marks(states, D, 0), pane: { k: 'rsi', lines: [line('rsi', rsiS, D)], bars: null, guides: [30, 70] } }, states });
  }

  // support and resistance: today's on the hub's two years; the past's point in time; near = within 5%, as the badge
  const srT = supportResistance(closes.slice(-TECH.WARMUP));
  for (const kind of ['support', 'resistance'] as const) {
    const lv = kind === 'support' ? srT.supports[0] : srT.resistances[0], level = kind === 'support' ? sup : res;
    const near = all.map((i) => level[i] != null && (kind === 'support'
      ? C(i) >= level[i]! && C(i) / level[i]! - 1 <= TECH.NEAR : C(i) <= level[i]! && level[i]! / C(i) - 1 <= TECH.NEAR));
    const states = [state(kind, 'near', near, 0, true, level, kind)];
    cards.push({ key: kind, state: !lv ? 'none' : lv.near ? 'near' : 'far', now: { level: lv ? px(lv.price) : null, dist: lv ? r4(lv.distPct / 100) : null, touches: lv?.touches ?? null },
      chart: { range: 'daily', from: 0, lines: [], levels: lv ? [{ k: kind, v: px(lv.price)! }] : [], marks: marks(states, D, 0), pane: null }, states });
  }

  // the 200-day average and the 50/200 cross
  const m200 = smaLast(closes, 200), m50 = smaLast(closes, 50);
  if (m200 != null && m50 != null) {
    const v = firstDefined(ma[200]), st = last < m200 ? 'below' : 'above';
    const states = [state('ma200', 'below', all.map((i) => ma[200][i] != null && C(i) < ma[200][i]!), v, st === 'below'),
      state('ma200', 'above', all.map((i) => ma[200][i] != null && C(i) > ma[200][i]!), v, st === 'above')];
    cards.push({ key: 'ma200', state: st, now: { ma: px(m200), dist: r4(last / m200 - 1) },
      chart: { range: 'weekly', from: 0, lines: [line('ma200', ma[200], W)], levels: [], marks: marks(states, W, 0, ['below', 'above']), pane: null }, states });
    const diff: A = all.map((i) => (ma[50][i] != null && ma[200][i] != null ? ma[50][i]! - ma[200][i]! : null));
    const cs = m50 > m200 ? 'golden' : 'death', flip = lastWhere(diff, (d) => d != null && (d > 0) !== (cs === 'golden'));
    const cstates = [state('cross', 'golden', diff.map((d) => d != null && d > 0), v, cs === 'golden'),
      state('cross', 'death', diff.map((d) => d != null && d < 0), v, cs === 'death')];
    cards.push({ key: 'cross', state: cs, now: { ma50: px(m50), ma200: px(m200), ago: flip >= ws ? L - 1 - flip - 1 : null },
      chart: { range: 'weekly', from: 0, lines: [line('ma50', ma[50], W), line('ma200', ma[200], W)], levels: [], marks: marks(cstates, W, 0, ['golden', 'death']), pane: null }, states: cstates });
  }

  // the 20, 50 and 100-day averages
  const m20 = smaLast(closes, 20), m100 = smaLast(closes, 100);
  if (m20 != null && m50 != null && m100 != null) {
    const v = firstDefined(ma[100]), below = last < m20 && last < m50 && last < m100, above = last > m20 && last > m50 && last > m100;
    const st = below ? 'belowAll' : above ? 'aboveAll' : 'mixed';
    const states = [state('mas', 'belowAll', all.map((i) => ma[100][i] != null && C(i) < ma[20][i]! && C(i) < ma[50][i]! && C(i) < ma[100][i]!), v, st !== 'aboveAll'),
      state('mas', 'aboveAll', all.map((i) => ma[100][i] != null && C(i) > ma[20][i]! && C(i) > ma[50][i]! && C(i) > ma[100][i]!), v, st !== 'belowAll')];
    cards.push({ key: 'mas', state: st, now: { ma20: px(m20), ma50: px(m50), ma100: px(m100), d20: r4(last / m20 - 1), d50: r4(last / m50 - 1), d100: r4(last / m100 - 1) },
      chart: { range: 'daily', from: 126, lines: [line('ma20', ma[20], D, 126), line('ma50', ma[50], D, 126), line('ma100', ma[100], D, 126)], levels: [], marks: marks(states, D, 126), pane: null }, states });
  }

  // Bollinger Bands (20, 2σ): the last band is the same on any window
  const lo = bb.lower.at(-1), up = bb.upper.at(-1), mid = bb.mid.at(-1);
  if (lo != null && up != null && mid != null) {
    const v = firstDefined(bb.mid), st = last < lo ? 'belowLower' : last > up ? 'aboveUpper' : 'inside';
    const states = [state('bollinger', 'belowLower', all.map((i) => bb.lower[i] != null && C(i) < bb.lower[i]!), v, st !== 'aboveUpper'),
      state('bollinger', 'aboveUpper', all.map((i) => bb.upper[i] != null && C(i) > bb.upper[i]!), v, st !== 'belowLower')];
    cards.push({ key: 'bollinger', state: st, now: { pctB: r4((last - lo) / (up - lo || 1)), upper: px(up), lower: px(lo), width: r4((up - lo) / mid) },
      chart: { range: 'daily', from: 126, lines: [line('upper', bb.upper, D, 126), line('mid', bb.mid, D, 126), line('lower', bb.lower, D, 126)], levels: [], marks: marks(states, D, 126), pane: null }, states });
  }

  // MACD (12, 26, 9): today's on the hub's 300 closes
  const mT = macd(closes.slice(-TECH.HUB)), hT: A = mT.macd.map((x, i) => (x != null && mT.signal[i] != null ? x - mT.signal[i]! : null)), hNow = hT.at(-1) ?? null;
  if (hNow != null) {
    const v = firstDefined(hist), st = hNow > 0 ? 'pos' : 'neg', flip = lastWhere(hT, (x) => x != null && (x > 0) !== (st === 'pos'));
    const states = [state('macd', 'pos', hist.map((x) => x != null && x > 0), v, st === 'pos'), state('macd', 'neg', hist.map((x) => x != null && x < 0), v, st === 'neg')];
    cards.push({ key: 'macd', state: st, now: { hist: px(hNow), ago: flip >= 0 ? hT.length - 1 - flip : null },
      chart: { range: 'daily', from: 126, lines: [], levels: [], marks: marks(states, D, 126),
        pane: { k: 'macd', lines: [line('macd', mc.macd, D, 126), line('signal', mc.signal, D, 126)], bars: D.slice(126).map((i) => px(hist[i])), guides: [0] } }, states });
  }

  // the distance from the 52-week high: today's from the hub's high; each depth's first close beyond it
  const h52 = o.today?.hi52 ?? hi52[L - 1];
  if (h52) {
    const dist = last / h52 - 1, v = firstDefined(hi52) + 231; // a high over a whole year, not a few weeks
    const st = dist <= -0.4 ? 'off40' : dist <= -0.3 ? 'off30' : dist <= -0.2 ? 'off20' : dist <= -0.1 ? 'off10' : 'near';
    const shownKey = st === 'near' ? 'off10' : st;
    const states = ([40, 30, 20, 10] as const).map((d) => state('high', `off${d}`, all.map((i) => hi52[i] != null && C(i) / hi52[i]! - 1 <= -d / 100), v, shownKey === `off${d}`));
    cards.push({ key: 'high', state: st, now: { high: px(h52), dist: r4(dist) },
      chart: { range: 'weekly', from: 0, lines: [line('high52', hi52, W)], levels: [], marks: marks(states, W, 0), pane: null }, states });
  }

  cards.sort((a, b) => TECH_CARDS.indexOf(a.key) - TECH_CARDS.indexOf(b.key));
  return {
    payload: { asOf: o.asOf, since: dates[ws]!, fullWindow: L - ws >= TECH.WINDOW, close: px(last)!,
      daily: { t: D.map((i) => dates[i]!), c: D.map((i) => px(closes[i])!) }, weekly: { t: W.map((i) => dates[i]!), c: W.map((i) => px(closes[i])!) }, cards },
    pool,
  };
}

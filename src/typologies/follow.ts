import * as z from 'zod/mini';
import { DEMO_ASOF, DEMO_COMPANIES, IsoDate, prng, round, sessionsBack, Ticker, ToneSchema } from './common';
import { FOLLOW_KINDS, FOLLOW_RECENT, type FollowKind } from './values';

/**
 * A company's alerts (Romeo, 2026-11-14: «oggi azienda nella tooltip card e nella Company page ha una campanella, con badge per gli allarmi
 * recenti come in un'app mobile per l'icona … gli allarmi sono legati agli strumenti: vicino a supporto, vicino a resistenza, vicino a rally
 * medio, drawdown importante, ma, cross»; spec pretickt/docs/superpowers/specs/2026-11-14-follow-alerts-design.md). The nightly picks them
 * from the company's labelled facts and statistics: a badge (label, figure, tone), one short line with its number, a small picture.
 */


/** The picture's numbers: a line (`c`), an optional second line (`c2`), dashed levels, a band (RSI's 30–70) and the marked point. */
export const FollowPic = z.object({
  c: z.array(z.number()).check(z.minLength(2), z.maxLength(60)),
  c2: z.optional(z.array(z.number()).check(z.maxLength(60))),
  lv: z.optional(z.array(z.number()).check(z.maxLength(3))),
  band: z.optional(z.tuple([z.number(), z.number()])),
  at: z.optional(z.int()),
});
export type FollowPic = z.infer<typeof FollowPic>;

export const FollowAlert = z.object({
  kind: z.string().check(z.regex(/^[a-z0-9-]{1,24}$/)),
  session: IsoDate,
  /** The badge's colour: the way the fact points (a level broken upward, results above the estimate), never advice. */
  tone: ToneSchema,
  label: z.string(), value: z.nullable(z.string()),
  /** One short sentence with its number. */
  line: z.string(),
  pic: z.nullable(FollowPic),
});
export type FollowAlert = z.infer<typeof FollowAlert>;

/** `/data/alerts-v1.json`: every company's recent alerts, one file for every reader (nobody's list of follows reaches the server). */
export const FollowFile = z.object({
  v: z.literal(1), asOf: IsoDate,
  companies: z.record(Ticker, z.object({ name: z.string(), alerts: z.array(FollowAlert),
    /** the nearest support and resistance of the last night (the floating window lights them as the day's prices reach them) */
    levels: z.optional(z.object({ s: z.optional(z.number()), r: z.optional(z.number()) })) })),
});
export type FollowFile = z.infer<typeof FollowFile>;

type Made = Omit<FollowAlert, 'session'>;
/** Made up, one per kind: the lines read like the nightly's, the numbers come from the ticker's prng. */
function made(kind: FollowKind, r: () => number): Made {
  const px = round(80 + r() * 300), pct = round(1 + r() * 4, 1), walk = (n: number, from: number, step: number) => Array.from({ length: n }, (_, i) => round(from + i * step + (r() - 0.5) * from * 0.02));
  const closes = walk(40, px * 1.08, -px * 0.002);
  switch (kind) {
    case 'level-broken': return { kind, tone: 'neg', label: 'Below support', value: `$${px}`, line: `Closed below its $${px} support`, pic: { c: closes, lv: [px] } };
    case 'results': return { kind, tone: 'pos', label: 'Beat', value: `EPS $${round(r() * 3, 2)}`, line: `Results: EPS ${pct}% above the estimate`, pic: { c: closes.slice(-20), at: 14 } };
    case 'big-move': return { kind, tone: 'pos', label: 'Big move', value: `+${round(pct * 2, 1)}%`, line: `Rose ${round(pct * 2, 1)}% in the session, about 3× its usual move`, pic: { c: closes.slice(-20), at: 19 } };
    case 'drawdown': return { kind, tone: 'neg', label: 'Drawdown', value: `-${round(20 + pct * 4, 0)}%`, line: `Down ${round(20 + pct * 4, 0)}% from its high, past its 20% mark`, pic: { c: closes, lv: [round(px * 1.3)] } };
    case 'analysts': return { kind, tone: 'pos', label: 'Upgrade', value: 'Citi', line: `Citi raised its rating; target $${round(px * 1.2)}`, pic: { c: closes.slice(-20), at: 19 } };
    case 'near-support': return { kind, tone: 'flat', label: 'Support', value: `${pct}% below`, line: `Closed ${pct}% above its $${px} support, where price turned 4 times`, pic: { c: closes, lv: [round(px * (1 - pct / 100))] } };
    case 'near-resistance': return { kind, tone: 'flat', label: 'Resistance', value: `${pct}% above`, line: `Closed ${pct}% under its $${px} resistance, where price turned 3 times`, pic: { c: closes, lv: [round(px * (1 + pct / 100))] } };
    case 'ma-cross': return { kind, tone: 'pos', label: '20- vs 50-day', value: 'crossed', line: `The 20-day average crossed above the 50-day ($${px})`, pic: { c: walk(40, px, px * 0.003), c2: walk(40, px * 1.04, 0) } };
    case 'ma-200': return { kind, tone: 'neg', label: '200-day', value: `${pct}% below`, line: `Closed ${pct}% below the 200-day average ($${px})`, pic: { c: closes, lv: [px] } };
    case 'near-52w': return { kind, tone: 'pos', label: '52-week high', value: `${pct}% under`, line: `Closed ${pct}% under its 52-week high of $${px}`, pic: { c: closes, lv: [px] } };
    case 'rally-typical': return { kind, tone: 'pos', label: 'Rise', value: `+${round(30 + pct * 3, 0)}%`, line: `Up ${round(30 + pct * 3, 0)}% from its low; its rises in 5 years had a median of 35%`, pic: { c: walk(40, px * 0.7, px * 0.01), lv: [round(px * 0.7)] } };
    case 'rsi': return { kind, tone: 'flat', label: 'RSI', value: String(Math.round(71 + r() * 8)), line: `RSI (14 days) at ${Math.round(71 + r() * 8)}, over the 70 line read as overbought`, pic: { c: walk(20, 60, 0.7), band: [30, 70] } };
    case 'news': return { kind, tone: 'flat', label: 'News', value: `${Math.round(4 + r() * 6)} stories`, line: `${Math.round(4 + r() * 6)} stories in the session, 3× its usual`, pic: null };
    case 'insider': return { kind, tone: 'pos', label: 'Insider buy', value: `$${round(1 + r() * 4, 1)}M`, line: `A director bought $${round(1 + r() * 4, 1)}M of shares`, pic: { c: closes.slice(-20), at: 17 } };
    case 'earnings-soon': return { kind, tone: 'flat', label: 'Report', value: 'in 3 sessions', line: 'Reports results in 3 sessions', pic: null };
    case 'dates': return { kind, tone: 'flat', label: 'Ex-dividend', value: 'in 3 sessions', line: `Goes ex-dividend in 3 sessions ($${round(r(), 2)} a share)`, pic: null };
  }
}
/** How many alerts each demo company has (the first four together hold every kind). */
const DEMO_COUNTS = [4, 4, 4, 4, 3, 2, 1, 0, 2, 3, 1, 2];

/** A company's made-up alerts: newest first, one session each over the last five. */
export function followDemo(ticker: string, asOf = DEMO_ASOF): FollowAlert[] {
  const r = prng(`${ticker}:follow`), i = DEMO_COMPANIES.findIndex(([t]) => t === ticker);
  const n = i >= 0 ? DEMO_COUNTS[i]! : Math.floor(r() * 5), start = i >= 0 ? (i * 4) % FOLLOW_KINDS.length : Math.floor(r() * FOLLOW_KINDS.length);
  const days = sessionsBack(asOf, FOLLOW_RECENT).reverse();
  return Array.from({ length: n }, (_, j) => ({ session: days[Math.min(j, FOLLOW_RECENT - 1)]!, ...made(FOLLOW_KINDS[(start + j) % FOLLOW_KINDS.length]!, r) }));
}

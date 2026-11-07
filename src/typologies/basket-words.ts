import { plainName } from '../ds/format';

/*
 * A fund in words, one definition for the page and the fund's questions. In a module of their own, so they stay in pt-basket's chunk: the main bundle is full.
 */
/**
 * The companies behind a fund's or a sector's move, in words: "SMH fell 2.75%. Nvidia took off 0.76 points, Micron 0.36." `label` is the fund's ticker or
 * the sector's name. One definition for the page and the FAQ.
 */
export function basketMoved(label: string, ret: number | null, up: readonly { name: string; points: number }[], down: readonly { name: string; points: number }[]): string {
  const pts = (p: number) => Math.abs(p * 100).toFixed(2);
  const two = (list: readonly { name: string; points: number }[], verb: string) => {
    const [a, b] = list;
    return a ? ` ${plainName(a.name)} ${verb} ${pts(a.points)} points${b ? `, ${plainName(b.name)} ${pts(b.points)}` : ''}.` : '';
  };
  if (ret == null) return `${two(up, 'added')}${two(down, 'took off')}`.trim();
  const size = `${Math.abs(ret * 100).toFixed(2)}%`;
  return ret >= 0 ? `${label} rose ${size}.${two(up, 'added')}` : `${label} fell ${size}.${two(down, 'took off')}`;
}

/** A company with two share classes is one mover: its weights and points add up, its move is what they imply, the first line gives the ticker. "Alphabet took off 0.21 points, Alphabet 0.17" is one fact. */
export function oneMover<T extends { name: string; weight: number; points: number; ret: number }>(rows: readonly T[]): T[] {
  const by = new Map<string, T>();
  for (const r of rows) {
    const had = by.get(r.name);
    if (!had) { by.set(r.name, r); continue; }
    const weight = had.weight + r.weight, points = had.points + r.points;
    by.set(r.name, { ...had, weight, points, ret: weight ? points / weight : had.ret });
  }
  return [...by.values()];
}

const BUSINESS = ['demand', 'advantage', 'economics', 'execution', 'fragility'];
/**
 * What the holdings read on the five questions about the business, in facts: "By weight, SMH's holdings are strong on 67% of the questions about the
 * business; weakest on fragility. Each reading rests on at least 71% of the fund." Null when none of the five reads across this fund. A sector's
 * reads "Technology's companies … of the sector".
 */
export function basketLead(label: string, questions: readonly { key: string; pos: number; comparable: boolean; share: number }[] | null, whole: 'fund' | 'sector' = 'fund'): string | null {
  const read = (questions ?? []).filter((q) => q.comparable && BUSINESS.includes(q.key));
  if (!read.length) return null;
  const mean = read.reduce((s, q) => s + q.pos, 0) / read.length;
  const weakest = read.reduce((a, b) => (b.pos < a.pos ? b : a));
  const base = Math.min(...read.map((q) => q.share));
  return `By weight, ${label}'s ${whole === 'fund' ? 'holdings' : 'companies'} are strong on ${Math.round(mean * 100)}% of the questions about the business; weakest on ${weakest.key}. Each reading rests on at least ${Math.round(base * 100)}% of the ${whole}.`;
}

/**
 * Why a sector's figures differ from its fund's, word for word (design 2026-11-07): "XLK holds the S&P 500's technology companies; this page weighs every
 * technology company on pretickt." The header's note and the sector's FAQ say it the same way.
 */
export function sectorFundLine(sector: string, tracker: string): string {
  const s = sector.toLowerCase();
  return `${tracker} holds the S&P 500's ${s} companies; this page weighs every ${s} company on pretickt.`;
}

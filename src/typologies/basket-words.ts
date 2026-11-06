import { plainName } from '../ds/format';

/*
 * A fund in words, one definition for the page and the fund's questions. In a module of their own, so they stay in pt-basket's chunk: the main bundle is full.
 */
/** The companies behind a fund's move, in words: "SMH fell 2.75%. Nvidia took off 0.76 points, Micron 0.36." One definition for the page and the fund's FAQ. */
export function basketMoved(ticker: string, ret: number | null, up: readonly { name: string; points: number }[], down: readonly { name: string; points: number }[]): string {
  const pts = (p: number) => Math.abs(p * 100).toFixed(2);
  const two = (list: readonly { name: string; points: number }[], verb: string) => {
    const [a, b] = list;
    return a ? ` ${plainName(a.name)} ${verb} ${pts(a.points)} points${b ? `, ${plainName(b.name)} ${pts(b.points)}` : ''}.` : '';
  };
  if (ret == null) return `${two(up, 'added')}${two(down, 'took off')}`.trim();
  const size = `${Math.abs(ret * 100).toFixed(2)}%`;
  return ret >= 0 ? `${ticker} rose ${size}.${two(up, 'added')}` : `${ticker} fell ${size}.${two(down, 'took off')}`;
}

const BUSINESS = ['demand', 'advantage', 'economics', 'execution', 'fragility'];
/**
 * What the holdings read on the five questions about the business, in facts: "By weight, SMH's holdings are strong on 67% of the questions about the
 * business; weakest on fragility." Null when none of the five reads across this fund.
 */
export function basketLead(ticker: string, questions: readonly { key: string; pos: number; comparable: boolean }[] | null): string | null {
  const read = (questions ?? []).filter((q) => q.comparable && BUSINESS.includes(q.key));
  if (!read.length) return null;
  const mean = read.reduce((s, q) => s + q.pos, 0) / read.length;
  const weakest = read.reduce((a, b) => (b.pos < a.pos ? b : a));
  return `By weight, ${ticker}'s holdings are strong on ${Math.round(mean * 100)}% of the questions about the business; weakest on ${weakest.key}.`;
}

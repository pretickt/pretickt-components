/** Pure chart geometry shared by the components. Points are oldest first (as every typology returns them). */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Whole UTC days since the epoch of an ISO date (a time part is ignored): the x unit of time charts. */
export const isoDay = (iso: string): number => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);

/** The last close at or before `iso`; the first close when `iso` is before the series. */
export function closeAt(points: readonly { t: string; c: number }[], iso: string): number {
  let c = points[0]?.c ?? NaN;
  for (const p of points) { if (p.t.slice(0, 10) > iso.slice(0, 10)) break; c = p.c; }
  return c;
}

/** An SVG path through [x, y] points, coordinates rounded to a tenth. */
export const linePath = (pts: readonly (readonly [number, number])[]): string =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ');

/** Month starts across [from, to] (epoch days), at most `max`, labelled "Mar 26"; the first sits on `from` when its month began earlier. */
export function monthTicks(from: number, to: number, max = 6): { day: number; label: string }[] {
  const all: { day: number; label: string }[] = [];
  const d = new Date(from * DAY_MS);
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth(); ; m++) {
    const start = Math.floor(Date.UTC(y, m, 1) / DAY_MS);
    if (start > to) break;
    const at = new Date(start * DAY_MS);
    all.push({ day: Math.max(start, from), label: `${MON[at.getUTCMonth()]} ${String(at.getUTCFullYear()).slice(2)}` });
  }
  const step = Math.ceil(all.length / max);
  return all.filter((_, i) => i % step === 0);
}

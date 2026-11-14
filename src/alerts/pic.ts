import type { FollowPic } from '../typologies';

const PAD = 2;
const f1 = (v: number) => v.toFixed(1);

/**
 * An alert's small picture as geometry (follow, 2026-11-14): its line, an optional second line (the 50-day under the 20-day), dashed levels
 * (a support, a 52-week high), a band (RSI's 30–70) and the marked point (the event's day, else the last close), all on one y scale with a
 * 2-unit padding. Pure, so the bell's panel draws it now and the email's pictures can draw the same later.
 */
export function picGeometry(p: FollowPic, w: number, h: number): { line: string; line2: string | null; levels: string[]; band: { y1: number; y2: number } | null; dot: { x: number; y: number } | null } {
  const all = [...p.c, ...(p.c2 ?? []), ...(p.lv ?? []), ...(p.band ?? [])];
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo;
  const y = (v: number) => (span > 0 ? PAD + ((hi - v) / span) * (h - 2 * PAD) : h / 2);
  const path = (c: readonly number[]) => c.map((v, i) => `${i ? 'L' : 'M'}${f1(PAD + (c.length > 1 ? i / (c.length - 1) : 0) * (w - 2 * PAD))},${f1(y(v))}`).join(' ');
  const at = p.at != null && p.at >= 0 && p.at < p.c.length ? p.at : p.c.length - 1;
  return {
    line: path(p.c),
    line2: p.c2 && p.c2.length >= 2 ? path(p.c2) : null,
    levels: (p.lv ?? []).map((v) => f1(y(v))),
    band: p.band ? { y1: Math.min(y(p.band[0]), y(p.band[1])), y2: Math.max(y(p.band[0]), y(p.band[1])) } : null,
    dot: p.c.length ? { x: Number(f1(PAD + (p.c.length > 1 ? at / (p.c.length - 1) : 0) * (w - 2 * PAD))), y: Number(f1(y(p.c[at]!))) } : null,
  };
}

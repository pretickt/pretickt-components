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

const INK = { pos: '#1f9d55', neg: '#d64545', flat: '#5b6472', na: '#5b6472' } as const;

/**
 * The same picture as a standalone SVG (the digest email's PNG: the VM draws it with sharp, no browser): white ground, the band, the
 * dashed levels, the second line, the line in the alert's tone, the dot. No text, so no font is needed. `scale` sets the pixel size.
 */
export function picSvg(p: FollowPic, w: number, h: number, tone: keyof typeof INK, scale = 1): string {
  const g = picGeometry(p, w, h), ink = INK[tone] ?? INK.flat;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#ffffff"/>` +
    (g.band ? `<rect x="0" y="${g.band.y1.toFixed(1)}" width="${w}" height="${(g.band.y2 - g.band.y1).toFixed(1)}" fill="#eef0f3"/>` : '') +
    (g.levels.length ? `<g stroke="#8a929c" stroke-width="1" stroke-dasharray="4 3">${g.levels.map((y) => `<line x1="0" x2="${w}" y1="${y}" y2="${y}"/>`).join('')}</g>` : '') +
    (g.line2 ? `<path d="${g.line2}" fill="none" stroke="#3b82c4" stroke-width="1.2" opacity="0.8"/>` : '') +
    `<path d="${g.line}" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>` +
    (g.dot ? `<circle cx="${g.dot.x}" cy="${g.dot.y}" r="2.6" fill="${ink}"/>` : '') +
    '</svg>';
}

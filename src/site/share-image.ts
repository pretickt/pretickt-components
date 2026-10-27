import { toCanvas } from 'html-to-image';

/** What frames a placement in its image: the page's title, the section's, and the address that brings a reader back. */
export interface ShareFrame { title: string; section: string; url: string }

/** CSS px: the margin around the placement, the band above it (brand, titles) and the one below it (the address). */
export const FRAME = { pad: 24, head: 84, foot: 44 } as const;

/** The image's size in CSS px for a placement of w × h: the placement whole, inside its frame. */
export const frameSize = (w: number, h: number) => ({ w: Math.ceil(w) + 2 * FRAME.pad, h: Math.ceil(h) + FRAME.head + FRAME.foot });

/** `text` cut with an ellipsis so it fits `max` px in the context's current font. */
export function fit(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// the mark (styles/brand/pretickt-mark.svg, 48 × 48): seven white candles on the cyan square; the site does not publish the file
const MARK_BARS = [[8.1, 17.4], [12.6, 22.4], [17.1, 27.5], [21.6, 22.75], [26.1, 18], [30.6, 13.25], [35.1, 8.5]] as const;

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = size / 48;
  ctx.fillStyle = '#00AEEF';
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 11 * k); ctx.fill();
  ctx.fillStyle = '#fff';
  for (const [bx, by] of MARK_BARS) { ctx.beginPath(); ctx.roundRect(x + bx * k, y + by * k, 3.8 * k, 11 * k, 1.3 * k); ctx.fill(); }
}

/** The wordmark as the header draws it: PRETICKT in spaced capitals, TICK in the brand cyan. Returns where it ends. */
function drawWord(ctx: CanvasRenderingContext2D, x: number, y: number, ink: string, brand: string): number {
  const spacing = 13 * 0.16;
  for (const [run, color] of [['PRE', ink], ['TICK', brand], ['T', ink]] as const) {
    ctx.fillStyle = color;
    for (const ch of run) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + spacing; }
  }
  return x;
}

// html-to-image copies the computed style of each HTML element, but clones an <svg> as it is: a chart's parts would lose the
// design system's paint (fills, strokes, fonts set by class), and its logos would not load inside the drawn image
const SVG_PAINT = ['display', 'visibility', 'opacity', 'color', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'paint-order', 'stop-color',
  'stop-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline',
  'filter', 'mix-blend-mode', 'vector-effect', 'shape-rendering'];

const dataUrl = (b: Blob) => new Promise<string>((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => ko(r.error);
  r.readAsDataURL(b);
});

/**
 * A copy of the placement to draw instead: each part of its charts carries its computed paint, each chart image (a logo) is
 * inlined, and it sits off screen at the placement's width, where html-to-image reads the computed style of the rest.
 */
async function paintedCopy(island: HTMLElement, width: number): Promise<{ copy: HTMLElement; holder: HTMLElement }> {
  const doc = island.ownerDocument;
  const copy = island.cloneNode(true) as HTMLElement;
  const to = copy.querySelectorAll<SVGElement>('svg *');
  island.querySelectorAll('svg *').forEach((el, i) => {
    const cs = getComputedStyle(el);
    to[i]?.setAttribute('style', SVG_PAINT.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  await Promise.all([...copy.querySelectorAll('svg image')].map(async (img) => {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href');
    if (!href || href.startsWith('data:')) return;
    try { img.setAttribute('href', await dataUrl(await (await fetch(href)).blob())); } catch { img.remove(); }
  }));
  const holder = doc.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;pointer-events:none`;
  holder.append(copy);
  doc.body.append(holder);
  return { copy, holder };
}

/**
 * A placement as a PNG to share: the brand and the page's title above it, the placement as it is on screen (html-to-image
 * draws a painted copy of its DOM with the page's fonts and logos; the share button under it stays out), the page's address
 * below it. Twice the CSS size, so the text stays sharp where it is shown.
 */
export async function drawShareImage(island: HTMLElement, f: ShareFrame, ratio = 2): Promise<{ blob: Blob; dataUrl: string }> {
  const doc = island.ownerDocument;
  const root = getComputedStyle(doc.documentElement);
  const token = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback;
  const bg = getComputedStyle(doc.body).backgroundColor || '#fff';
  const ink = token('--color-ink', '#1f2430'), soft = token('--color-ink-soft', '#6b7280'), primary = token('--color-primary', '#007bb5');
  const sans = token('--font-sans', 'sans-serif'), mono = token('--font-mono', 'monospace');

  const box = island.getBoundingClientRect();
  const foot = island.querySelector('.pt-island-foot');
  const height = Math.max(1, Math.round(foot ? foot.getBoundingClientRect().top - box.top : box.height));
  const { copy, holder } = await paintedCopy(island, box.width);
  let shot: HTMLCanvasElement;
  try {
    shot = await toCanvas(copy, { pixelRatio: ratio, backgroundColor: bg, width: Math.round(box.width), height,
      filter: (n) => !(n instanceof Element && n.classList.contains('pt-island-foot')) });
  } finally { holder.remove(); }

  await doc.fonts?.ready;
  const size = frameSize(box.width, height);
  const c = doc.createElement('canvas');
  c.width = size.w * ratio;
  c.height = size.h * ratio;
  const ctx = c.getContext('2d')!;
  ctx.scale(ratio, ratio);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.textBaseline = 'alphabetic';

  const { pad } = FRAME;
  drawMark(ctx, pad, 18, 24);
  ctx.font = `600 13px ${sans}`;
  const end = drawWord(ctx, pad + 34, 35, ink, token('--color-brand', '#00a0dc'));
  if (f.section) {
    ctx.font = `500 13px ${sans}`;
    ctx.fillStyle = soft;
    ctx.textAlign = 'right';
    ctx.fillText(fit(ctx, f.section, size.w - pad - end - 24), size.w - pad, 35);
    ctx.textAlign = 'left';
  }
  ctx.font = `600 19px ${sans}`;
  ctx.fillStyle = ink;
  ctx.fillText(fit(ctx, f.title, size.w - 2 * pad), pad, 68);

  ctx.drawImage(shot, pad, FRAME.head, box.width, height);

  ctx.font = `500 13px ${mono}`;
  ctx.fillStyle = primary;
  ctx.fillText(fit(ctx, f.url.replace(/^https?:\/\/(www\.)?/, ''), size.w - 2 * pad), pad, size.h - 17);

  const blob = await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('no image'))), 'image/png'));
  return { blob, dataUrl: c.toDataURL('image/png') };
}

// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FRAME, fit, frameSize } from './share-image';
import { attachShare, postLinks, shareFile, shareLink, shareTarget, type DrawShare } from './share';

const page = (o: { canonical?: boolean } = {}) => {
  document.head.innerHTML = o.canonical === false ? '' : '<link rel="canonical" href="https://www.pretickt.com/stocks/nvda/">';
  document.body.innerHTML = '<main><h1 class="pt-h1">NVIDIA (NVDA) Stock Forecast</h1>' +
    '<section class="pt-section" id="price-target"><h2 class="pt-section-title">Analyst price targets</h2>' +
    '<div class="pt-island" data-island="pt-price-target@2.4.1"><p>chart</p>' +
    '<div class="pt-island-foot"><button type="button" class="pt-share" data-share>Share</button></div></div></section></main>';
  return document.querySelector<HTMLButtonElement>('[data-share]')!;
};
const image = { blob: new Blob(['png'], { type: 'image/png' }), dataUrl: 'data:image/png;base64,AAAA' };
const settle = () => new Promise((r) => setTimeout(r, 0));

let attached: { detach: () => void }[] = [];
const attach = (o: Parameters<typeof attachShare>[1]) => { const a = attachShare(document, o); attached.push(a); return a; };
afterEach(() => { for (const a of attached) a.detach(); attached = []; document.body.innerHTML = ''; });

describe('the link and the names of a share', () => {
  it('the page\'s own address, no query, the section\'s anchor', () => {
    expect(shareLink('https://www.pretickt.com/stocks/nvda/?utm_source=x#news', 'price-target')).toBe('https://www.pretickt.com/stocks/nvda/#price-target');
    expect(shareLink('https://www.pretickt.com/', null)).toBe('https://www.pretickt.com/');
  });
  it('a downloaded file is named after the page and the section', () => {
    expect(shareFile('https://www.pretickt.com/stocks/nvda/#price-target')).toBe('pretickt-nvda-price-target.png');
    expect(shareFile('https://www.pretickt.com/')).toBe('pretickt.png');
    expect(shareFile('https://www.pretickt.com/earnings-calendar/#week')).toBe('pretickt-earnings-calendar-week.png');
  });
  it('X\'s and Reddit\'s forms carry the text and the link', () => {
    const p = postLinks('https://www.pretickt.com/stocks/nvda/#price-target', 'NVIDIA · Analyst price targets');
    expect(p.x).toBe('https://x.com/intent/post?text=NVIDIA%20%C2%B7%20Analyst%20price%20targets&url=https%3A%2F%2Fwww.pretickt.com%2Fstocks%2Fnvda%2F%23price-target');
    expect(p.reddit).toContain('https://www.reddit.com/submit?url=https%3A%2F%2Fwww.pretickt.com%2Fstocks%2Fnvda%2F%23price-target&title=NVIDIA');
  });
  it('a button shares its placement: the page\'s title, the section\'s, the canonical link to the section', () => {
    const t = shareTarget(page())!;
    expect(t).toMatchObject({ title: 'NVIDIA (NVDA) Stock Forecast', section: 'Analyst price targets',
      url: 'https://www.pretickt.com/stocks/nvda/#price-target', file: 'pretickt-nvda-price-target.png' });
    expect(t.island.getAttribute('data-island')).toBe('pt-price-target@2.4.1');
  });
  it('a placement can name its own title and address (the stories page)', () => {
    const b = page();
    Object.assign(b.closest<HTMLElement>('.pt-island')!.dataset, { shareTitle: 'Crowded at the bottom', shareUrl: 'https://www.pretickt.com/' });
    expect(shareTarget(b)).toMatchObject({ title: 'Crowded at the bottom', url: 'https://www.pretickt.com/' });
  });
});

describe('the image\'s frame', () => {
  it('the placement whole, a margin around it, the bands above and below', () => {
    expect(frameSize(800.4, 300)).toEqual({ w: 801 + 2 * FRAME.pad, h: 300 + FRAME.head + FRAME.foot });
  });
  it('a title too long for the width ends with an ellipsis', () => {
    const ctx = { measureText: (s: string) => ({ width: s.length * 10 }) } as unknown as CanvasRenderingContext2D;
    expect(fit(ctx, 'short', 100)).toBe('short');
    expect(fit(ctx, 'a much longer title', 100)).toBe('a much lo…'); // 9 letters and the ellipsis: 100 px
  });
});

describe('the share menu', () => {
  it('opens on the button with the image drawn, counts the press on its placement, closes on Escape giving the focus back', async () => {
    const b = page();
    const sent: string[] = [];
    document.addEventListener('pt-interact', (e) => sent.push(`${(e.target as Element).getAttribute('data-island')}|${(e as CustomEvent).detail.action}`));
    const draw = vi.fn<DrawShare>(async () => image);
    attach({ draw });
    b.click();
    const menu = document.querySelector('.pt-share-menu')!;
    expect(menu.getAttribute('role')).toBe('dialog');
    expect(menu.textContent).toContain('Drawing the image…');
    expect([...menu.querySelectorAll('.pt-share-act')].filter((a) => !(a as HTMLElement).hidden).map((a) => a.textContent))
      .toEqual(expect.arrayContaining(['Download', 'Copy link', 'Post on X', 'Post on Reddit']));
    expect(sent).toEqual(['pt-price-target@2.4.1|share']);
    expect(draw.mock.calls[0]![1]).toMatchObject({ title: 'NVIDIA (NVDA) Stock Forecast', section: 'Analyst price targets' });
    await settle();
    expect(menu.querySelector('img.pt-share-preview')!.getAttribute('src')).toBe(image.dataUrl);
    const download = [...menu.querySelectorAll('a')].find((a) => a.textContent === 'Download')!;
    expect(download.getAttribute('href')).toBe(image.dataUrl);
    expect(download.getAttribute('download')).toBe('pretickt-nvda-price-target.png');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.pt-share-menu')).toBeNull();
    expect(document.activeElement).toBe(b);
  });
  it('copies the link; the same button closes it again; a click outside closes it', async () => {
    const b = page();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    attach({ draw: async () => image });
    b.click();
    [...document.querySelectorAll<HTMLButtonElement>('.pt-share-act')].find((x) => x.textContent === 'Copy link')!.click();
    await settle();
    expect(writeText).toHaveBeenCalledWith('https://www.pretickt.com/stocks/nvda/#price-target');
    expect(document.querySelector('.pt-share-note')!.textContent).toBe('Link copied.');
    b.click();
    expect(document.querySelector('.pt-share-menu')).toBeNull();
    b.click();
    document.querySelector('h1')!.click();
    expect(document.querySelector('.pt-share-menu')).toBeNull();
  });
  it('an image that cannot be drawn leaves the link to share', async () => {
    page({ canonical: false });
    attach({ draw: async () => { throw new Error('tainted'); } });
    document.querySelector<HTMLButtonElement>('[data-share]')!.click();
    await settle();
    const menu = document.querySelector('.pt-share-menu')!;
    expect(menu.textContent).toContain('Could not draw the image. The link still works.');
    expect(menu.querySelector('img')).toBeNull();
    expect([...menu.querySelectorAll('a')].find((a) => a.textContent === 'Post on X')!.getAttribute('href')).toContain(encodeURIComponent('#price-target'));
  });
});

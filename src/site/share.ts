/**
 * Share a placement as an image and a link: buzz, and links back to the page. The "Share" button under each placement (the
 * registry's island footer, in the server HTML) opens a menu with the placement drawn as a PNG (share-image.ts, loaded with
 * html-to-image on the first press) and the ways to pass it on: the system's share sheet where it takes files, copy or download
 * the image, copy the link, post on X or Reddit. The link is the page's canonical address with the section's anchor and no
 * parameters, so a link back counts for the page itself. Each action is an interaction of its placement (`share`, `share-x`, …).
 * A part of a placement can be shared on its own (pt-value's cards): an element with `data-share-part` (its name, e.g. the
 * question a card answers) and an id, with a `[data-share]` icon inside it; the image is that part alone, the link its anchor, and
 * the press a `share-part` of its placement.
 * The menu is one node in `<body>`, outside what Angular hydrates (as the tooltip is).
 */
import type { ShareFrame } from './share-image';

/** `part`: the part of the placement the button shares, or null for the whole placement. */
export interface ShareTarget extends ShareFrame { island: HTMLElement; part: HTMLElement | null; file: string }
/** Draws what is shared: the placement, or one of its parts. */
export type DrawShare = (el: HTMLElement, f: ShareFrame) => Promise<{ blob: Blob; dataUrl: string }>;

/** The address to share: the page's own (no query, no fragment), with the section's anchor. */
export function shareLink(base: string, section?: string | null): string {
  const u = new URL(base);
  u.search = '';
  u.hash = section ? `#${section}` : '';
  return u.toString();
}

/** `pretickt-nvda-price-target.png`: the page and the section, for a downloaded file; a word said twice in a row once (`/value/#value`). */
export function shareFile(url: string): string {
  const u = new URL(url);
  const slug = `${u.pathname} ${u.hash.slice(1)}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/^stocks-/, '')
    .split('-').filter((w, i, all) => w !== all[i - 1]).join('-');
  return `pretickt${slug ? `-${slug}` : ''}.png`;
}

/** X's and Reddit's own forms to post a link, filled in. */
export const postLinks = (url: string, text: string) => ({
  x: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
});

/**
 * What a share button shares: its placement, the page's title and the section's, the link. A placement may name its own (stories).
 * A button inside a part shares the part: the link to its anchor, its name in the section's place.
 */
export function shareTarget(button: Element): ShareTarget | null {
  const island = button.closest<HTMLElement>('.pt-island');
  if (!island) return null;
  const doc = island.ownerDocument;
  const near = button.closest<HTMLElement>('[data-share-part]');
  const part = near && near !== island && island.contains(near) ? near : null;
  const section = island.closest('section');
  const own = island.dataset['shareUrl'];
  const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  const url = shareLink(own ?? (canonical || doc.location.href), part?.id || (own ? null : section?.id));
  const title = island.dataset['shareTitle'] ?? doc.querySelector('h1')?.textContent?.trim() ?? doc.title;
  const name = part ? part.dataset['sharePart'] ?? '' : section?.querySelector('.pt-section-title')?.textContent?.trim() ?? '';
  return { island, part, title, section: name, url, file: shareFile(url) };
}

const drawWithLibrary: DrawShare = async (el, f) => (await import('./share-image')).drawShareImage(el, f);

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text = '', attrs: Record<string, string> = {}) {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function attachShare(doc: Document, o: { draw?: DrawShare } = {}) {
  const w = doc.defaultView;
  const draw = o.draw ?? drawWithLibrary;
  let menu: HTMLElement | null = null;
  let opener: HTMLElement | null = null;

  const close = () => {
    menu?.remove();
    menu = null;
    opener?.focus();
    opener = null;
  };

  function open(button: HTMLElement) {
    const t = shareTarget(button);
    if (!t) return;
    opener = button;
    const count = (action: string) => t.island.dispatchEvent(new CustomEvent('pt-interact', { bubbles: true, detail: { action } }));
    count(t.part ? 'share-part' : 'share');
    const text = t.section ? `${t.title} · ${t.section}` : t.title;
    const posts = postLinks(t.url, text);

    const m = menu = el(doc, 'div', 'pt-share-menu', '', { role: 'dialog', 'aria-label': 'Share', tabindex: '-1' });
    const head = el(doc, 'div', 'pt-share-head');
    const x = el(doc, 'button', 'pt-share-x', '×', { type: 'button', 'aria-label': 'Close' });
    x.addEventListener('click', close);
    head.append(el(doc, 'span', '', 'Share as an image'), x);
    const preview = el(doc, 'div', 'pt-share-wait', 'Drawing the image…');
    const note = el(doc, 'p', 'pt-share-note', '', { 'aria-live': 'polite' });
    const say = (s: string) => { note.textContent = s; };

    const native = el(doc, 'button', 'pt-share-act pt-share-main', 'Share…', { type: 'button' });
    native.hidden = true;
    const copyImage = el(doc, 'button', 'pt-share-act', 'Copy image', { type: 'button', disabled: '' });
    const download = el(doc, 'a', 'pt-share-act', 'Download', { 'aria-disabled': 'true', download: t.file });
    const copyLink = el(doc, 'button', 'pt-share-act', 'Copy link', { type: 'button' });
    const onX = el(doc, 'a', 'pt-share-act', 'Post on X', { href: posts.x, target: '_blank', rel: 'noopener' });
    const onReddit = el(doc, 'a', 'pt-share-act', 'Post on Reddit', { href: posts.reddit, target: '_blank', rel: 'noopener' });
    const canClipImage = !!w && 'ClipboardItem' in w && !!w.navigator.clipboard?.write;
    if (!canClipImage) copyImage.hidden = true;

    copyLink.addEventListener('click', () => {
      count('share-link');
      w?.navigator.clipboard?.writeText(t.url).then(() => say('Link copied.'), () => say(t.url)) ?? say(t.url);
    });
    onX.addEventListener('click', () => count('share-x'));
    onReddit.addEventListener('click', () => count('share-reddit'));
    download.addEventListener('click', (e) => { if (!download.getAttribute('href')) e.preventDefault(); else count('share-download'); });

    const acts = el(doc, 'div', 'pt-share-acts');
    acts.append(native, copyImage, download, copyLink, onX, onReddit);
    m.append(head, preview, acts, note);

    // under the button, right-aligned with it, and always whole on screen: measured again once the image is in
    const place = () => {
      const r = button.getBoundingClientRect();
      const vw = w?.innerWidth ?? 1024, vh = w?.innerHeight ?? 768;
      m.style.right = `${Math.max(16, vw - r.right)}px`;
      m.style.top = `${Math.max(16, Math.min(r.bottom + 6, vh - m.offsetHeight - 16))}px`;
    };
    doc.body.append(m);
    place();
    m.focus();

    draw(t.part ?? t.island, t).then(({ blob, dataUrl }) => {
      if (menu !== m) return;
      const img = el(doc, 'img', 'pt-share-preview', '', { alt: `The image to share: ${text}` });
      img.addEventListener('load', place);
      img.src = dataUrl;
      preview.replaceWith(img);
      download.setAttribute('href', dataUrl);
      download.removeAttribute('aria-disabled');
      copyImage.removeAttribute('disabled');
      copyImage.addEventListener('click', () => {
        count('share-copy-image');
        w!.navigator.clipboard.write([new w!.ClipboardItem({ 'image/png': blob })])
          .then(() => say('Image copied: paste it into your post.'), () => say('Could not copy the image: download it instead.'));
      });
      const file = new File([blob], t.file, { type: 'image/png' });
      if (w?.navigator.canShare?.({ files: [file] })) {
        native.hidden = false;
        native.addEventListener('click', () => {
          count('share-native');
          w.navigator.share({ files: [file], title: text, text: `${text} ${t.url}` }).catch(() => undefined);
        });
      }
    }, () => { if (menu === m) preview.textContent = 'Could not draw the image. The link still works.'; });
  }

  const onClick = (e: Event) => {
    const target = e.target as Element | null;
    const button = target?.closest?.<HTMLElement>('[data-share]');
    if (button) {
      e.preventDefault();
      const again = opener === button;
      if (menu) close();
      if (!again) open(button);
      return;
    }
    if (menu && target && !menu.contains(target)) close();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && menu) close(); };
  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);
  return { close, detach: () => { close(); doc.removeEventListener('click', onClick); doc.removeEventListener('keydown', onKey); } };
}

/**
 * The blog (2026-11-17) before it is published: /blog/ and an article as pretickt-platform's plant/src/generate/blog.ts writes them — static
 * markup of the generator's in the design system's blog classes (`.pt-blog-*`, `.pt-article*`, `.pt-toc`), the JSON-LD above. Made-up text: the real
 * articles live in the platform (plant/content/blog). Mirrors blog.ts by hand: change them together. `?phone` shows the 390 px view.
 */
import { Component, input } from '@angular/core';
import { PtPagePreview, type PreviewPage } from './page-preview';
import { story } from './story';

const GROUP = 'Pages · before publishing (www not changed)';
const BASE = 'https://www.pretickt.com';
const HOME = { label: 'Home', href: '/' };

/** A made-up component image (the article's figures are the Share button's drawings of www's components): a drawn placeholder with its size. */
const picture = (w: number, h: number, label: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<rect width="${w}" height="${h}" fill="#f7f9fc"/><rect x="24" y="18" width="24" height="24" rx="6" fill="#00AEEF"/><text x="58" y="36" font-family="Geist,sans-serif" font-size="13" font-weight="600" letter-spacing="2" fill="#1f2430">PRETICKT</text>` +
  `<text x="24" y="72" font-family="Geist,sans-serif" font-size="19" font-weight="600" fill="#1f2430">${label}</text><rect x="24" y="92" width="${w - 48}" height="${h - 150}" rx="10" fill="#fff" stroke="#dde3ea"/>` +
  `<path d="M48 ${h - 90} L${w * 0.3} ${h - 130} L${w * 0.55} ${h - 110} L${w - 60} ${h * 0.35}" fill="none" stroke="#0076af" stroke-width="2"/>` +
  `<text x="24" y="${h - 22}" font-family="monospace" font-size="13" fill="#0076af">pretickt.com/stocks/aapl/why-moving/#why</text></svg>`)}`;

const POSTS = [
  { slug: 'what-happens-after-a-stock-split', kind: 'Study', title: 'What Happens After a Stock Split? Every S&amp;P 500 and Nasdaq-100 Split, Measured',
    description: 'We measured every stock split since 2010. The rally comes before the split; after it, the stock is a coin flip.' },
  { slug: 'buy-the-dip-what-to-check', kind: 'How-to', title: 'Buy the Dip? 5 Things to Check Before Buying a Stock After a Drop',
    description: 'Buy the dip, or catch a falling knife? 5 checks, each tied to a number you can read in a minute.' },
  { slug: 'what-is-a-good-pe-ratio', kind: 'Guide', title: 'What Is a Good P/E Ratio? The Average P/E by Sector Today',
    description: 'A good P/E ratio depends on the sector. Today\'s median P/E for 11 sectors, when a low P/E isn\'t cheap, negative P/E.' },
  { slug: 'what-does-palantir-do', kind: 'Company', title: 'What Does Palantir Do, and How Does It Make Money?',
    description: 'What Palantir sells in plain words, who pays for it and how its revenue splits by segment and country.' },
];
const cover = (title: string) => picture(1200, 630, title.replace(/&amp;/g, 'and').slice(0, 60));

/** blog.ts `blogIndexPage`. */
const indexPage: PreviewPage = {
  path: '/blog/', title: 'Blog: stock market studies and guides | pretickt', h1: 'The pretickt blog', lede: 'Studies and guides on the numbers behind US stocks, by Salvatore Romeo',
  description: 'Studies on the site\'s own data and plain guides to the numbers on a stock page: P/E, splits, dips, the S&P 500\'s returns, what companies do.',
  crumbs: [HOME, { label: 'Blog' }], sections: [],
  intro: `<ul class="pt-blog-cards">${POSTS.map((p, n) => `<li><a class="pt-blog-card" href="/blog/${p.slug}/"><img src="${cover(p.title)}" width="1200" height="630" alt=""${n < 2 ? '' : ' loading="lazy"'} decoding="async">` +
    `<div class="pt-blog-card-body"><span class="pt-blog-kind">${p.kind}</span><h2>${p.title}</h2><p>${p.description}</p><time datetime="2026-11-17">Nov 17, 2026</time></div></a></li>`).join('')}</ul>`,
  ld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'The pretickt blog', url: `${BASE}/blog/` }],
};

const fig = (w: number, h: number, phone: [number, number] | null, caption: string, first: boolean) => {
  const img = `<img src="${picture(w, h, caption)}" width="${w}" height="${h}" alt="${caption}"${first ? '' : ' loading="lazy"'} decoding="async">`;
  return `<figure class="pt-article-fig"><a href="/stocks/aapl/why-moving/#why">${phone ? `<picture><source media="(max-width: 40rem)" srcset="${picture(phone[0], phone[1], caption)}" width="${phone[0]}" height="${phone[1]}">${img}</picture>` : img}</a>` +
    `<figcaption>${caption} · <a href="/stocks/aapl/why-moving/#why">Open it on pretickt</a></figcaption></figure>`;
};
const TABLE = '<div class="pt-table-wrap"><table class="pt-table"><thead><tr><th scope="col">After the first close 10% below the 52-week high</th><th scope="col">January 2015 to August 2026</th><th scope="col" class="pt-num">Drops</th><th scope="col" class="pt-num">Higher after 3 months</th></tr></thead><tbody>' +
  '<tr><td>Every drop</td><td>All the stocks tracked today, survivors only</td><td class="pt-num">7,447</td><td class="pt-num">60.4%</td></tr>' +
  '<tr><td>The market within 5% of its high</td><td>The fall belonged to the stock or its sector</td><td class="pt-num">4,837</td><td class="pt-num">56.7%</td></tr>' +
  '<tr><td><strong>Any day</strong></td><td><strong>For comparison</strong></td><td class="pt-num"><strong>—</strong></td><td class="pt-num"><strong>59.3%</strong></td></tr></tbody></table></div>';
const TOC = [['the-need', 'The need'], ['check-1-whose-drop-is-it', 'Check 1: whose drop is it?'], ['check-4-is-the-drop-big-for-this-stock', 'Check 4: is the drop big for this stock?'], ['conclusions', 'Conclusions']];
const url = encodeURIComponent(`${BASE}/blog/buy-the-dip-what-to-check/`);

/** blog.ts `blogPostPage`, on made-up text with the article's parts: a table, a quote, a list, a wide figure with its phone drawing and a small card. */
const articlePage: PreviewPage = {
  path: '/blog/buy-the-dip-what-to-check/', title: 'Buy the Dip? 5 Things to Check Before Buying a Stock After a Drop', h1: POSTS[1]!.title,
  description: POSTS[1]!.description, lede: 'By Salvatore Romeo · Nov 17, 2026 · Data as of Nov 16, 2026 · 13 min read',
  crumbs: [HOME, { label: 'Blog', href: '/blog/' }, { label: POSTS[1]!.title }], sections: [],
  intro: `<div class="pt-blog-layout"><nav class="pt-toc" aria-label="On this page"><p class="pt-toc-title">On this page</p><ol>${TOC.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol></nav>` +
    '<article class="pt-article"><p>The stock you\'ve been watching for months is suddenly 12% cheaper. Is it a bargain? Is something broken?</p>' +
    '<h2 id="the-need">The need</h2><p>It often happens like this. A company you like has always looked too expensive. One morning it opens 8% lower.</p>' + TABLE +
    '<p>Six out of ten. Sounds like a good bet, doesn\'t it? Now read the last row: on an ordinary day the same stocks were higher 59.3% of the time.</p>' +
    '<h2 id="check-1-whose-drop-is-it">Check 1: whose drop is it?</h2><p>pretickt does the subtraction on every <a href="/stocks/aapl/">company page</a>:</p>' +
    '<blockquote><p>Last close (Nov 16): AAPL −1.0% = market (SPY) −1.9% + Technology sector −1.1% + AAPL on its own +2.1%.</p></blockquote>' +
    fig(785, 418, [406, 573], 'Check 1 on a real page: Apple\'s move, split', true) +
    '<h2 id="check-4-is-the-drop-big-for-this-stock">Check 4: is the drop big for this stock?</h2><ul><li><strong>Tesla</strong> moved ±23% in a typical month;</li><li><strong>Coca-Cola</strong> ±6%.</li></ul>' +
    fig(408, 291, null, 'A small card stays at its own size', false) +
    '<h2 id="conclusions">Conclusions</h2><p>A lower price is a fact. A bargain is a conclusion.</p>' +
    '<footer class="pt-article-foot"><p><em>The count of drops uses daily prices from Yahoo Finance. Today\'s readings are pretickt\'s own.</em></p><p><em>Disclaimer: this article is not investment advice.</em></p><p>Happy investing, and feel free to reach out.</p></footer>' +
    `<aside class="pt-article-share" aria-label="Share this article"><span>Share this article</span><a class="pt-btn pt-btn-quiet pt-btn-sm" href="https://x.com/intent/post?url=${url}" target="_blank" rel="noopener">Post on X</a>` +
    `<a class="pt-btn pt-btn-quiet pt-btn-sm" href="https://www.reddit.com/submit?url=${url}" target="_blank" rel="noopener">Post on Reddit</a><a class="pt-btn pt-btn-quiet pt-btn-sm" href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener">Share on LinkedIn</a>` +
    `<a class="pt-btn pt-btn-quiet pt-btn-sm" href="mailto:?body=${url}">Email</a></aside></article></div>` +
    `<section class="pt-section"><div class="pt-section-head"><h2 class="pt-section-title">More from the blog</h2><a class="pt-section-more" href="/blog/">All articles →</a></div><ul class="pt-blog-list">${POSTS.filter((p) => p.kind !== 'How-to').map((p) =>
      `<li><a href="/blog/${p.slug}/">${p.title}</a><span>${p.kind} · Nov 17, 2026</span></li>`).join('')}</ul></section>`,
  ld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: POSTS[1]!.title, datePublished: '2026-11-17', dateModified: '2026-11-17',
    author: { '@type': 'Person', name: 'Salvatore Romeo', url: `${BASE}/about/` }, publisher: { '@type': 'Organization', name: 'pretickt' } }],
};

@Component({ selector: 'pt-preview-blog', imports: [PtPagePreview], template: '<pt-page-preview [page]="page()" />' })
export class PtPreviewBlog { readonly page = input.required<PreviewPage>(); }

export const stories = [
  story(PtPreviewBlog, { name: '/blog/: a card per article, newest first (made-up covers)', group: GROUP, inputs: { page: indexPage } }),
  story(PtPreviewBlog, { name: '/blog/<slug>/: an article — sections beside it, a table, a quote, a wide figure with its phone drawing, a small card (made-up text)', group: GROUP, inputs: { page: articlePage } }),
];

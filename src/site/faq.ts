/**
 * The questions a page answers, for its structured data. A placement marks a question it answers with `data-faq` around it,
 * `data-faq-q` on the question and `data-faq-a` on the answer: both visible text (structured data repeats the page, never adds to
 * it). The build reads them from the rendered page (renderPage) and the generator writes them as the page's FAQPage JSON-LD. One
 * answer per question on a page: the first wins, a second one is reported.
 */
export interface FaqPair { q: string; a: string }

const text = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Every marked question with its answer, in page order; `repeated`: the questions answered again further down. */
export function readFaq(root: ParentNode): { pairs: FaqPair[]; repeated: string[] } {
  const pairs: FaqPair[] = [], repeated: string[] = [], seen = new Set<string>();
  for (const w of Array.from(root.querySelectorAll('[data-faq]'))) {
    const q = text(w.querySelector('[data-faq-q]')), a = text(w.querySelector('[data-faq-a]'));
    if (!q || !a) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) { repeated.push(q); continue; }
    seen.add(key);
    pairs.push({ q, a });
  }
  return { pairs, repeated };
}

/** schema.org FAQPage of the pairs; null without any (a page answers no question it does not show). */
export const faqLd = (pairs: FaqPair[]) => (pairs.length ? {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: pairs.map((p) => ({ '@type': 'Question', name: p.q, acceptedAnswer: { '@type': 'Answer', text: p.a } })),
} : null);

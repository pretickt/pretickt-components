import { faqLd, readFaq } from './faq';

const page = (html: string) => { const el = document.createElement('main'); el.innerHTML = html; return el; };

describe('the questions a page answers, for its structured data', () => {
  it('reads every marked question with its answer, in page order, the text as the page shows it', () => {
    const { pairs, repeated } = readFaq(page(`
      <div data-faq><h2 data-faq-q>Is Nvidia a good stock to buy?</h2><p data-faq-a><b>Nvidia is strong</b>  on 4 of the 5
        questions.</p></div>
      <h3>Not marked: not a question the page answers</h3>
      <article data-faq><h3 data-faq-q>When does Nvidia report earnings?</h3><p data-faq-a>On Wed, Nov 18, 2026, after the close.</p></article>`));
    expect(pairs).toEqual([
      { q: 'Is Nvidia a good stock to buy?', a: 'Nvidia is strong on 4 of the 5 questions.' },
      { q: 'When does Nvidia report earnings?', a: 'On Wed, Nov 18, 2026, after the close.' },
    ]);
    expect(repeated).toEqual([]);
  });

  it('one answer per question: the first on the page wins, a second one is reported; a question without its answer is left out', () => {
    const { pairs, repeated } = readFaq(page(`
      <div data-faq><h3 data-faq-q>Who is dumping Nvidia stock?</h3><p data-faq-a>Its executives sold $1.9B.</p></div>
      <div data-faq><h3 data-faq-q> who is dumping  Nvidia stock? </h3><p data-faq-a>Insiders sold some.</p></div>
      <div data-faq><h3 data-faq-q>How does Nvidia make money?</h3></div>`));
    expect(pairs).toEqual([{ q: 'Who is dumping Nvidia stock?', a: 'Its executives sold $1.9B.' }]);
    expect(repeated).toEqual(['who is dumping Nvidia stock?']);
  });

  it('as schema.org FAQPage JSON-LD; none without a question', () => {
    expect(faqLd([{ q: 'Q?', a: 'A.' }])).toEqual({ '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }] });
    expect(faqLd([])).toBeNull();
  });
});

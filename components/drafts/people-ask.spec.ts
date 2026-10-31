import { render } from '../_spec';
import { PA_KO, PA_MRNA, PA_NVDA, PA_NVDA_ALL, PA_NVDA_HUB, PA_ODFL } from './people-ask-mock';
import { askLede, needBar, PtPeopleAsk } from './pt-people-ask';

describe('pt-people-ask (draft): what people ask about a company, answered', () => {
  it('opens with the week on Reddit and X, the heat against a usual week and the two most asked kinds', () => {
    expect(askLede(PA_NVDA)).toBe('264 posts on Reddit and X mentioned Nvidia in the week to Oct 23, 2026, 3.1× its usual week. ' +
      'Most asked why it is moving (38%) and about earnings (24%).');
    expect(askLede(PA_MRNA)).toBe('143 posts on Reddit and X mentioned Moderna in the week to Oct 22, 2026, 11.9× its usual week. ' +
      'Most asked why it is moving (61%) and whether to buy the dip (17%).');
    expect(askLede(PA_KO)).toBe('A quiet week: 9 posts on Reddit and X mentioned Coca-Cola in the week to Oct 23, 2026. ' +
      'Most asked about the dividend (44%) and about earnings (33%).');
    expect(askLede(PA_ODFL)).toBe('The questions people ask about Old Dominion Freight Line, answered with the data as of Oct 23, 2026.');
    expect(askLede({ ...PA_NVDA, chatter: { ...PA_NVDA.chatter!, posts: 0 } })).toBe(askLede({ ...PA_NVDA, chatter: null }));
  });

  it('a bar of the kinds of question, the largest first, unknown kinds folded into the rest', () => {
    const bar = needBar(PA_NVDA.needs);
    expect(bar.map((s) => s.key)).toEqual(['why_moving', 'earnings_events', 'buy_or_not', 'when_sell', 'who_sells', 'other']);
    expect(bar.at(-1)!.share).toBeCloseTo(0.05, 9);
    expect(needBar([{ need: 'astrology' as never, share: 0.1 }, { need: 'buy_or_not', share: 0.9 }]).map((s) => [s.key, s.share]))
      .toEqual([['buy_or_not', 0.9], ['other', expect.closeTo(0.1, 9)]]);
  });

  it('each question a heading with its answer in a sentence and the page that explains it', async () => {
    const { el, text } = await render(PtPeopleAsk, { data: PA_NVDA });
    const qs = [...el.querySelectorAll('h3')].map((h) => h.textContent!.trim());
    expect(qs).toHaveLength(PA_NVDA.items.length);
    expect(qs[0]).toBe('Why is Nvidia stock down today?');
    expect(text()).toContain(PA_NVDA.items[0]!.answer);
    expect(text()).toContain('asked 41 times this week');
    expect(el.querySelector('a[href="/stocks/nvda/why-moving/"]')!.textContent).toContain('Why Nvidia moved');
    expect(el.querySelector('.dp-faq')).not.toBeNull();
  });

  it('in the words people search: the common name, the questions Google keeps asking, dates said confirmed or not', () => {
    const all = [PA_NVDA_ALL, PA_MRNA, PA_KO, PA_ODFL].flatMap((d) => d.items);
    expect(all.some((a) => /NVIDIA/.test(a.question + a.answer + a.link))).toBe(false);
    expect(PA_NVDA_ALL.items.map((a) => a.question)).toEqual(expect.arrayContaining(['When does Nvidia report earnings?', 'Is Nvidia a good stock to buy?',
      'Should I sell Nvidia stock?', 'Who is dumping Nvidia stock?', 'What if I invested $10,000 in Nvidia 5 years ago?', 'How does Nvidia make money?',
      'Who owns Nvidia?', 'Does Nvidia pay dividends?']));
    for (const a of all.filter((x) => x.need === 'earnings_events')) expect(a.answer).toMatch(/\((confirmed date|date not confirmed)\)/);
    expect(new Set(PA_NVDA_ALL.items.map((a) => a.question)).size).toBe(PA_NVDA_ALL.items.length);
  });

  it('answers when the company reports, asked or not: the next report is always one of its questions, never twice', async () => {
    const qs = (el: HTMLElement) => [...el.querySelectorAll('h3')].map((h) => h.textContent!.trim());
    expect(PA_MRNA.items.some((a) => a.need === 'earnings_events')).toBe(false);
    const mrna = await render(PtPeopleAsk, { data: PA_MRNA });
    expect(qs(mrna.el).at(-1)).toBe('When does Moderna report earnings?');
    expect(mrna.text()).toContain(PA_MRNA.earnings!.answer!);
    const nvda = await render(PtPeopleAsk, { data: PA_NVDA });
    expect(qs(nvda.el).filter((q) => q === 'When does Nvidia report earnings?')).toHaveLength(1);
  });

  it('a question another placement answers (pt-value\'s): the question stays, with a link to that answer and no second one', async () => {
    const { el, text } = await render(PtPeopleAsk, { data: PA_NVDA_HUB });
    const buy = [...el.querySelectorAll('article')].find((a) => a.querySelector('h3')!.textContent === 'Is Nvidia a good stock to buy?')!;
    expect(buy.querySelector('.dp-a')).toBeNull();
    expect(buy.querySelector('a')!.getAttribute('href')).toBe('#value');
    expect(buy.textContent).toContain('asked 23 times this week · answered on this page:');
    expect(text()).not.toContain('The analysts’ average price target for Nvidia');
  });

  it('marks each question it answers, and only those, for the page\'s structured data', async () => {
    const { el } = await render(PtPeopleAsk, { data: PA_NVDA_HUB });
    const marked = [...el.querySelectorAll('[data-faq]')].map((w) => w.querySelector('[data-faq-q]')!.textContent!.trim());
    expect(marked).toEqual(PA_NVDA_HUB.items.filter((a) => a.answer).map((a) => a.question));
    for (const w of el.querySelectorAll('[data-faq]')) expect(w.querySelector('[data-faq-a]')!.textContent!.trim()).not.toBe('');
  });

  it('cards show the same questions and answers (the text a search engine reads does not change)', async () => {
    const faq = await render(PtPeopleAsk, { data: PA_MRNA });
    const cards = await render(PtPeopleAsk, { data: PA_MRNA, variant: 'cards' });
    expect(cards.el.querySelector('.dp-cards')).not.toBeNull();
    const words = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(words(cards.text())).toBe(words(faq.text()));
  });

  it('a company nobody talks about keeps its questions, without the week on the networks', async () => {
    const { el, text } = await render(PtPeopleAsk, { data: PA_ODFL });
    expect(el.querySelectorAll('h3')).toHaveLength(PA_ODFL.items.length);
    expect(el.querySelector('.dp-pulse')).toBeNull();
    expect(text()).not.toContain('asked');
  });

  it('not available', async () => {
    const { el } = await render(PtPeopleAsk, { data: null });
    expect(el.querySelector('.pt-na')).not.toBeNull();
  });
});

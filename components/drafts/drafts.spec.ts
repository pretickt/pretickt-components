import { ASKED, BOARD, HOT, ODDS } from './mock';
import { railMarks, splitBars } from './pt-asked';
import { bubbleSize, etTime, heat, hotSentence, hotWhen, PtHot, ring } from './pt-hot';
import { arc, oddsDays, oddsTone } from './pt-odds';
import { boardColumns, boardSentence, boardWeek, PtQualityStrip } from './pt-quality-strip';
import { arcPath, at, barGeom, companyRows, list, NOT_ADVICE, onArc, priceSentence, PtValue, valueAnswer, type Value } from './pt-value';
import { VALUE_INTC, VALUE_NKE, VALUE_NVDA } from './value-mock';
import { render } from '../_spec';

describe('home drafts: the helpers their components will keep', () => {
  it('H1: heat against a usual day, the ring it earns, a bubble whose area grows with the posts, the sentence', () => {
    expect(heat({ mentions: 220, usual: 70 })).toBeCloseTo(22 / 7, 9);
    expect(heat({ mentions: 5, usual: 0 })).toBeNull();
    expect([2.5, 1, 0.5, null].map(ring)).toEqual(['hot', 'usual', 'cool', 'cool']);
    expect(bubbleSize(400) - 34).toBeCloseTo(2 * (bubbleSize(100) - 34), 0);
    expect(hotSentence(HOT.rows, hotWhen(HOT), HOT.sources)).toBe('Most discussed on Reddit and X in the 24 hours to 10:30 a.m. ET, Mon, Oct 26, 2026: ' +
      'SpaceX SPCX (220 posts, 3.1× its usual), Alphabet GOOGL (170) and Amazon AMZN (150). Amgen AMGN draws 6.7× its usual. Posts from r/wallstreetbets, r/stocks and X.');
    expect(hotSentence(HOT.rows.slice(0, 2))).toBe('Most discussed on Reddit and X in the last 24 hours: SpaceX SPCX (220 posts, 3.1× its usual) and Alphabet GOOGL (170). ' +
      'SpaceX SPCX draws 3.1× its usual.');
    expect([etTime('10:30'), etTime('14:00'), etTime('09:05'), etTime('00:15')]).toEqual(['10:30 a.m. ET', '2 p.m. ET', '9:05 a.m. ET', '12:15 a.m. ET']);
    expect(hotWhen({ asOf: '2026-10-26', time: null })).toBe('Mon, Oct 26, 2026');
  });
  it('H1 in the page: the heading says "today" only while the counts are today\'s; a bubble opens what people ask about the company', async () => {
    const fresh = await render(PtHot, { data: HOT });
    expect(fresh.el.querySelector('.dr-head h2')!.textContent).toBe('Trending stocks on Reddit and X today');
    expect(fresh.el.querySelector('.dr-bub')!.getAttribute('href')).toBe('/stocks/spcx/#people-ask');
    expect(fresh.el.querySelector('.dr-bub')!.getAttribute('aria-label')).toBe('What people ask about SpaceX: 220 posts in 24 hours, 3.1 times its usual');
    const stale = await render(PtHot, { data: { ...HOT, asOf: '2026-10-23', stale: true } });
    expect(stale.el.querySelector('.dr-head h2')!.textContent).toBe('Trending stocks on Reddit and X');
    expect(stale.text()).toContain('last updated 10:30 a.m. ET, Fri, Oct 23, 2026 — not today’s counts');
  });
  it('H1 on its own page (/trending): no heading (the page has it), the time kept, the most talked about as a list with their counts', async () => {
    const { el, text } = await render(PtHot, { data: HOT, head: false, rank: 5 });
    expect(el.querySelector('.dr-head h2')).toBeNull();
    expect(text()).toContain('last 24 hours · as of 10:30 a.m. ET, Mon, Oct 26, 2026');
    const rows = [...el.querySelectorAll('ol.dr-rank li')].map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows).toHaveLength(5);
    expect(rows[0]).toBe('SpaceX SPCX: 220 posts in 24 hours, 3.1× its usual day');
    expect(el.querySelector('ol.dr-rank a')!.getAttribute('href')).toBe('/stocks/spcx/#people-ask');
    expect((await render(PtHot, { data: HOT })).el.querySelector('ol.dr-rank')).toBeNull();
  });
  it('H2: a move split into three bars in proportion; a rail with price, high and target on it', () => {
    const b = splitBars({ market: -0.004, sector: -0.003, own: -0.087 });
    expect(b.map((x) => x.k)).toEqual(['m', 's', 'o']);
    expect(b[2]!.w).toBeGreaterThan(b[0]!.w * 10);
    expect(railMarks({ price: 164, high: 209, target: 216 })).toEqual({ price: 8, high: 167, target: 192 });
    expect(ASKED.items.every((a) => a.href.startsWith('/stocks/'))).toBe(true);
  });
  it('H4: the weekdays of the week, the most traded first, four a day; a chance\'s tone and arc', () => {
    const days = oddsDays(ODDS);
    expect(days.map((d) => d.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(days[1]!.items.map((i) => i.ticker)).toEqual(['V', 'RCL', 'UPS', 'BA']);
    expect(days[1]!.more).toBe(1);
    expect([0.6, 0.5, 0.4].map(oddsTone)).toEqual(['pos', 'flat', 'neg']);
    expect(arc(0.5)).toBe('69.1 138.2');
  });
  it('H5: six columns, strengthened above and the rest below; the two busiest in a sentence', () => {
    const cols = boardColumns(BOARD);
    expect(cols.map((c) => c.name)).toEqual(['Demand', 'Advantage', 'Economics', 'Execution', 'Fragility', 'Price']);
    expect(cols[3]!.up).toHaveLength(8);
    expect(cols[3]!.down.map((i) => i.ticker)).toEqual(['NKE']);
    expect(boardSentence(BOARD)).toBe('In the week to Oct 23, 2026, Execution strengthened at 8 companies; Fragility weakened or needs watching at Meta and Alphabet.');
    expect(boardWeek(BOARD)).toBe('Oct 19–Oct 23, 2026');
  });
  it('H5 in the page: each logo\'s link says where it goes', async () => {
    const { el } = await render(PtQualityStrip, { data: BOARD });
    expect(el.querySelector('a[href="/stocks/meta/#quality"]')!.getAttribute('aria-label')).toMatch(/^Meta’s quality this week: /);
  });
});


describe('pt-value (draft): the answer and the small pictures', () => {
  it('answers "Is it a good stock to buy?" in facts: the strong questions about the business, the P/E against its median, dated — never a yes or a no', () => {
    expect(valueAnswer(VALUE_NVDA)).toEqual({ lead: 'Nvidia is strong on 4 of the 5 questions about the business.',
      text: 'The price is high: 41.2 times its earnings, above its 3-year median of 33.4 (Oct 26, 2026). pretickt does not say whether to buy or sell.' });
    expect(valueAnswer(VALUE_NKE)).toEqual({ lead: 'Nike is strong on 1 of the 5 questions about the business; weak on demand and economics.',
      text: 'The price is low: 19.4 times its earnings, below its 3-year median of 30.2 (Oct 26, 2026). pretickt does not say whether to buy or sell.' });
    expect(valueAnswer(VALUE_INTC)).toEqual({ lead: 'Intel is weak on advantage, economics, execution and fragility; demand in between.',
      text: 'With a loss over the last 12 months, Intel has no P/E ratio (Oct 26, 2026). pretickt does not say whether to buy or sell.' });
    expect(valueAnswer({ ...VALUE_NVDA, sections: [], pe: null } as Value)).toEqual({ lead: 'The questions about Nvidia\'s business have no data yet.', text: NOT_ADVICE });
    for (const v of [VALUE_NVDA, VALUE_NKE, VALUE_INTC]) expect(valueAnswer(v).lead).not.toMatch(/^(yes|no|mostly)\b/i);
    expect([list([]), list(['a']), list(['a', 'b']), list(['a', 'b', 'c'])]).toEqual(['', 'a', 'a and b', 'a, b and c']);
  });
  it('the price sentence: within 15% of its 3-year median the P/E is about usual; no median, the P/E alone; no reading, nothing', () => {
    expect(priceSentence({ ...VALUE_NVDA, pe: { now: 35, median: 33.4 } })).toBe('The price is about usual: 35.0 times its earnings, near its 3-year median of 33.4 (Oct 26, 2026).');
    expect(priceSentence({ ...VALUE_NVDA, pe: { now: 41.2, median: null } })).toBe('Nvidia\'s P/E ratio is 41.2 (Oct 26, 2026).');
    expect(priceSentence({ ...VALUE_NVDA, pe: null })).toBe('');
  });
  it('bars stand on zero, negatives hang below it, the last one is the one in colour', () => {
    const g = barGeom([16, 4, 27, -7]);
    expect(g.bars.map((b) => [b.neg, b.last])).toEqual([[false, false], [false, false], [false, false], [true, true]]);
    expect(g.bars[3]!.y).toBe(g.base);
    expect(g.bars[2]!.y + g.bars[2]!.h).toBeCloseTo(g.base, 1);
  });
  it('the gauge: a share of the half circle from the left, its arcs from share to share', () => {
    expect([at(5, 0, 10), at(-1, 0, 10), at(11, 0, 10)]).toEqual([0.5, 0, 1]);
    expect(onArc(0)).toEqual({ x: 30, y: 36 });
    expect(onArc(0.5)).toEqual({ x: 60, y: 6 });
    expect(arcPath(0, 1)).toBe('M30 36A30 30 0 0 1 90 36');
  });
});

describe('pt-value (draft): the cards read across other companies', () => {
  it('bars as a share of the largest value, the tone from the sign unless given, the page\'s company marked; no bars without them', () => {
    const rows = companyRows([{ ticker: 'NVDA', logo: null, value: 78, label: '78%', self: true }, { ticker: 'INTC', logo: null, value: -2, label: '−2%' },
      { ticker: 'QCOM', logo: null, value: null, label: 'no profit' }], true);
    expect(rows.map((r) => [r.ticker, r.width, r.tone, r.self])).toEqual([['NVDA', 100, 'pos', true], ['INTC', 3, 'neg', false], ['QCOM', null, 'na', false]]);
    expect(companyRows([{ ticker: 'GS', logo: null, value: 1, label: 'upgrade', tone: 'pos' }], false)[0]).toMatchObject({ width: null, tone: 'pos' });
  });
  it('every card that reads other companies says so, with their logos where the site has one', () => {
    const via = [VALUE_NVDA, VALUE_NKE, VALUE_INTC].flatMap((v) => v.sections.flatMap((s) => s.cards)).filter((c) => c.viz.kind === 'companies');
    expect(via.length).toBeGreaterThanOrEqual(10);
    expect(via.every((c) => !!c.via)).toBe(true);
    expect(via.flatMap((c) => (c.viz.kind === 'companies' ? c.viz.rows : [])).filter((r) => r.logo).length).toBeGreaterThan(30);
  });
});

describe('pt-value (draft): every card', () => {
  const all = [VALUE_NVDA, VALUE_NKE, VALUE_INTC];
  it('has a short title that reads after the ticker, one of a kind in its column, and a source', () => {
    for (const v of all) for (const s of v.sections) {
      for (const c of s.cards) {
        expect(c.title).toMatch(/^([a-z]|[A-Z]{2,}\b)/);
        expect(`${v.ticker} ${c.title}`.length).toBeLessThanOrEqual(c.term ? 24 : 30);
        expect(c.source.length).toBeGreaterThan(0);
      }
      expect(new Set(s.cards.map((c) => c.title)).size).toBe(s.cards.length);
    }
  });
  it('says how much the biggest customers weigh, under fragility: the 10-K table, the customers unnamed', () => {
    const fragility = all.map((v) => v.sections.find((s) => s.key === 'fragility')!.cards.find((c) => c.title === 'biggest customers'));
    expect(fragility.map((c) => c?.big)).toEqual(['34%', 'under 10%', '42%']);
    expect(fragility.every((c) => c?.viz.kind === 'split' && c.source.includes('financial-reports-json'))).toBe(true);
  });
  it('says its fact in a sentence that names the company; a searched term beside the title only when it differs', () => {
    for (const v of all) for (const c of v.sections.flatMap((s) => s.cards)) {
      expect(c.say).toContain(v.name);
      expect(c.say).toMatch(/\.$/);
      if (c.term) expect(c.term.toLowerCase()).not.toBe(c.title.toLowerCase());
    }
    const titles = VALUE_NVDA.sections.flatMap((s) => s.cards.map((c) => `${c.title}${c.term ? ` · ${c.term}` : ''}`));
    expect(titles).toEqual(expect.arrayContaining(['price vs profit · P/E ratio', 'competitors', 'number of employees', 'shareholders · institutional ownership', 'insider selling', 'CEO pay']));
  });
});

describe('pt-value (draft): in the page\'s text', () => {
  it('the searched question on top, each card\'s sentence and the searched questions with their answers as headings', async () => {
    const { el, text } = await render(PtValue, { data: VALUE_NVDA });
    expect(el.querySelector('h2.dv-q')!.textContent).toBe('Is Nvidia a good stock to buy?');
    expect(text()).toContain('Nvidia\'s P/E ratio is 41.2 (Oct 26, 2026), above its 3-year median of 33.4.');
    expect([...el.querySelectorAll('.dv-faq h3')].map((h) => h.textContent)).toEqual(VALUE_NVDA.faq.map((f) => f.q));
    expect(text()).toContain(VALUE_NVDA.faq[0]!.a);
    for (const v of [VALUE_NVDA, VALUE_NKE, VALUE_INTC]) expect(v.faq.every((f) => f.q.endsWith('?') && f.a.includes(v.name))).toBe(true);
  });
  it('the columns carry the words people search beside their own: valuation (the most searched), moat, risks', async () => {
    const { el } = await render(PtValue, { data: VALUE_NVDA });
    expect([...el.querySelectorAll('.dv-col-h .dv-term')].map((t) => t.textContent)).toEqual([' moat', ' risks', ' valuation']);
    expect(el.querySelector('.dv-col:last-child .dv-name')!.textContent).toBe('Price valuation');
  });
  it('marks each question and its answer for the page\'s structured data, each question with an address of its own', async () => {
    const { el } = await render(PtValue, { data: VALUE_NVDA });
    const pairs = [...el.querySelectorAll('[data-faq]')].map((w) => [w.querySelector('[data-faq-q]')!.textContent!.trim(), w.querySelector('[data-faq-a]')!.textContent!.trim()]);
    const { lead, text } = valueAnswer(VALUE_NVDA);
    expect(pairs[0]).toEqual(['Is Nvidia a good stock to buy?', `${lead} ${text}`]);
    expect(pairs.slice(1)).toEqual(VALUE_NVDA.faq.map((f) => [f.q, f.a]));
    expect(el.querySelector('#value-who-is-dumping-nvidia-stock h3')!.textContent).toBe('Who is dumping Nvidia stock?');
  });
  it('each card\'s title starts with the company\'s ticker, the searched term after it', async () => {
    for (const v of [VALUE_NVDA, VALUE_NKE, VALUE_INTC]) {
      const { el } = await render(PtValue, { data: v });
      const titles = [...el.querySelectorAll('.dv-title')].map((t) => t.textContent!);
      expect(titles.length).toBe(v.sections.flatMap((s) => s.cards).length);
      expect(titles.every((t) => t.startsWith(`${v.ticker} `))).toBe(true);
    }
    const { el } = await render(PtValue, { data: VALUE_NVDA });
    expect(el.querySelector('.dv-title')!.textContent).toBe('NVDA sales growth revenue growth');
  });
  it('each card\'s title is a heading, as the searched questions under the columns, with its searched term inside it', async () => {
    const { el } = await render(PtValue, { data: VALUE_NVDA });
    const titles = [...el.querySelectorAll('.dv-title')];
    expect(titles.length).toBe(VALUE_NVDA.sections.flatMap((s) => s.cards).length);
    expect(titles.every((t) => t.tagName === 'H3')).toBe(true);
    expect(el.querySelector('h3.dv-title .dv-term')!.textContent).toBe(' revenue growth');
  });
});

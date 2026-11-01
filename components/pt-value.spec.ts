import type { Value } from '../src/typologies';
import { valueDemo } from '../src/typologies/value-demo';
import { faqId } from '../src/ds/format';
import { iconPath } from '../src/ds/pt-icon';
import { arcPath, at, barGeom, checkGroups, companyRows, list, NOT_ADVICE, onArc, priceSentence, PtValue, QS_TRACK, QUESTIONS, quarterGeom, valueAnswer } from './pt-value';
import { render, withData } from './_spec';

/** value@1's demo: three made-up companies (a strong business at a high price, a weakening one at a low price, a fragile one). */
const NVDA = valueDemo({ ticker: 'NVDA' }), NKE = valueDemo({ ticker: 'NKE' }), INTC = valueDemo({ ticker: 'INTC' });

describe('pt-value: the answer and the small pictures', () => {
  it('answers "Is it a good stock to buy?" in facts: the strong questions about the business, the P/E against its median, dated — never a yes or a no', () => {
    expect(valueAnswer(NVDA)).toEqual({ lead: 'Nvidia is strong on 4 of the 5 questions about the business.',
      text: 'The price is high: 41.2 times its earnings, above its 3-year median of 33.4 (Oct 26, 2026). pretickt does not say whether to buy or sell.' });
    expect(valueAnswer(NKE)).toEqual({ lead: 'Nike is strong on 1 of the 5 questions about the business; weak on demand and economics.',
      text: 'The price is low: 19.4 times its earnings, below its 3-year median of 30.2 (Oct 26, 2026). pretickt does not say whether to buy or sell.' });
    expect(valueAnswer(INTC)).toEqual({ lead: 'Intel is weak on advantage, economics, execution and fragility; demand in between.',
      text: 'With a loss over the last 12 months, Intel has no P/E ratio (Oct 26, 2026). pretickt does not say whether to buy or sell.' });
    expect(valueAnswer({ ...NVDA, sections: [], pe: null } as Value)).toEqual({ lead: 'The questions about Nvidia\'s business have no data yet.', text: NOT_ADVICE });
    for (const v of [NVDA, NKE, INTC]) expect(valueAnswer(v).lead).not.toMatch(/^(yes|no|mostly)\b/i);
    expect([list([]), list(['a']), list(['a', 'b']), list(['a', 'b', 'c'])]).toEqual(['', 'a', 'a and b', 'a, b and c']);
  });
  it('the price sentence: within 15% of its 3-year median the P/E is about usual; no median, the P/E alone; no reading, nothing', () => {
    expect(priceSentence({ ...NVDA, pe: { now: 35, median: 33.4 } })).toBe('The price is about usual: 35.0 times its earnings, near its 3-year median of 33.4 (Oct 26, 2026).');
    expect(priceSentence({ ...NVDA, pe: { now: 41.2, median: null } })).toBe('Nvidia\'s P/E ratio is 41.2 (Oct 26, 2026).');
    expect(priceSentence({ ...NVDA, pe: null })).toBe('');
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

describe('pt-value: the quarters, oldest first', () => {
  const Q = (q: string, fy: string, by: number) => ({ q, fy, by });
  it('a bar per quarter on one line: up by what it beat, down by what it missed, the latest marked', () => {
    const g = quarterGeom([Q('Q3', 'FY25', 0.04), Q('Q4', 'FY25', -0.02), Q('Q1', 'FY26', 0.08)], 'the estimate');
    expect(g.bars.map((b) => [b.q, b.tone, b.last])).toEqual([['Q3', 'pos', false], ['Q4', 'neg', false], ['Q1', 'pos', true]]);
    expect(g.bars[0]!.top + g.bars[0]!.h).toBeCloseTo(g.base, 1);
    expect(g.bars[1]!.top).toBe(g.base);
    expect(g.bars[2]!.h / g.bars[0]!.h).toBeCloseTo(2, 1);
  });
  it('beats only: the line at the bottom, and small beats stay small (a 5% beat fills the height)', () => {
    const g = quarterGeom([Q('Q1', 'FY26', 0.01), Q('Q2', 'FY26', 0.05)], 'the estimate');
    expect(g.bars.every((b) => Math.abs(b.top + b.h - g.base) < 0.05)).toBe(true);
    expect(g.base).toBeGreaterThan(QS_TRACK * 0.9);
    expect(g.bars[1]!.h / g.bars[0]!.h).toBeCloseTo(5, 1);
    expect(quarterGeom([Q('Q1', 'FY26', 0.4), Q('Q2', 'FY26', 0.05)], 'the estimate').bars[0]!.top).toBeLessThan(2);
  });
  it('misses only: the line at the top; in line with it: a mark on the line', () => {
    const g = quarterGeom([Q('Q1', 'FY26', -0.03), Q('Q2', 'FY26', 0)], 'the estimate');
    expect(g.base).toBeLessThan(4);
    expect(g.bars.map((b) => b.tone)).toEqual(['neg', 'flat']);
    expect(g.bars[1]!.top).toBeLessThan(g.base);
    expect(g.bars[1]!.top + g.bars[1]!.h).toBeGreaterThan(g.base);
  });
  it('the fiscal year once, under its quarters; the number of each quarter on hover', () => {
    const g = quarterGeom([Q('Q3', 'FY25', 0.04), Q('Q4', 'FY25', -0.02), Q('Q1', 'FY26', 0.08), Q('Q2', 'FY26', 0.01), Q('Q1', 'FY27', 0.02)], 'the estimate');
    expect(g.years).toEqual([{ fy: 'FY25', span: 2 }, { fy: 'FY26', span: 2 }, { fy: 'FY27', span: 1 }]);
    expect(JSON.parse(g.bars[1]!.tip)).toEqual({ 'Q4 FY25': '-2.0% vs the estimate' });
    expect(JSON.parse(g.bars[2]!.tip)).toEqual({ 'Q1 FY26': '+8.0% vs the estimate' });
  });
});

describe('pt-value: the Piotroski checks, by what they look at', () => {
  it('nine checks in three groups people read — profit and cash, debt and shares, efficiency — each passed or missed, named on hover', () => {
    const g = checkGroups({ roa: true, cfo: true, droa: true, accruals: true, leverage: true, liquidity: false, shares: false, margin: true, turnover: false });
    expect(g.map((x) => [x.label, x.checks.length])).toEqual([['Profit & cash', 4], ['Debt & shares', 3], ['Efficiency', 2]]);
    expect(g.map((x) => x.checks.map((c) => c.ok))).toEqual([[true, true, true, true], [true, false, false], [true, false]]);
    expect(JSON.parse(g[1]!.checks[2]!.tip)).toEqual({ 'No new shares issued': 'missed' });
    expect(JSON.parse(g[0]!.checks[0]!.tip)).toEqual({ 'A profit (return on assets above zero)': 'passed' });
  });
});

describe('pt-value: the cards read across other companies', () => {
  it('bars as a share of the largest value, the tone from the sign unless given, the page\'s company marked; no bars without them', () => {
    const rows = companyRows([{ ticker: 'NVDA', name: 'Nvidia', logo: null, value: 78, label: '78%', self: true }, { ticker: 'INTC', name: 'Intel', logo: null, value: -2, label: '−2%' },
      { ticker: 'QCOM', name: 'Qualcomm', logo: null, value: null, label: 'no profit' }], true);
    expect(rows.map((r) => [r.ticker, r.width, r.tone, r.self])).toEqual([['NVDA', 100, 'pos', true], ['INTC', 3, 'neg', false], ['QCOM', null, 'na', false]]);
    expect(companyRows([{ ticker: null, name: 'Goldman Sachs', logo: null, value: 1, label: 'upgrade', tone: 'pos' }], false)[0]).toMatchObject({ key: 'Goldman Sachs', width: null, tone: 'pos' });
  });
  it('every card that reads other companies says so', () => {
    const via = [NVDA, NKE, INTC].flatMap((v) => v.sections.flatMap((s) => s.cards)).filter((c) => c.viz.kind === 'companies');
    expect(via.length).toBeGreaterThanOrEqual(10);
    expect(via.every((c) => !!c.via)).toBe(true);
  });
});

describe('pt-value: every card', () => {
  const all = [NVDA, NKE, INTC];
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
    const titles = NVDA.sections.flatMap((s) => s.cards.map((c) => `${c.title}${c.term ? ` · ${c.term}` : ''}`));
    expect(titles).toEqual(expect.arrayContaining(['price vs profit · P/E ratio', 'competitors', 'number of employees', 'shareholders · institutional ownership', 'insider selling', 'CEO pay']));
  });
  it('the quality checks show which ones pass, their "7 of 9" counts them, and the sentence names what it misses', () => {
    const cards = all.flatMap((v) => v.sections.flatMap((s) => s.cards.map((c) => ({ v, c })))).filter(({ c }) => c.title === 'quality checks');
    expect(cards.length).toBe(3);
    for (const { c } of cards) {
      expect(c.viz.kind).toBe('checks');
      const ok = c.viz.kind === 'checks' ? Object.values(c.viz.ok) : [];
      const [, hits, total] = /^(\d+) of (\d+)$/.exec(c.big)!.map(Number);
      expect([ok.filter(Boolean).length, ok.length]).toEqual([hits, total]);
      expect(c.say).toMatch(/misses on|passes only/);
    }
  });
  it('a record over time shows its quarters, and its "5 of 8" counts them: the beats are the bars above the line', () => {
    const records = all.flatMap((v) => v.sections.flatMap((s) => s.cards)).filter((c) => /vs (estimates|forecast)$/.test(c.title));
    expect(records.length).toBe(5);
    for (const c of records) {
      expect(c.viz.kind).toBe('quarters');
      const [, hits, total] = /^(\d+) of (\d+)$/.exec(c.big)!.map(Number);
      const qs = c.viz.kind === 'quarters' ? c.viz.quarters : [];
      expect([qs.filter((x) => x.by > 0).length, qs.length]).toEqual([hits, total]);
    }
  });
});

describe('pt-value: in the page\'s text', () => {
  it('the searched question on top, each card\'s sentence and the searched questions with their answers as headings', async () => {
    const { el, text } = await render(PtValue, { ticker: 'NVDA' });
    expect(el.querySelector('h2.dv-q')!.textContent).toBe('Is Nvidia a good stock to buy?');
    expect(text()).toContain('Nvidia\'s P/E ratio is 41.2 (Oct 26, 2026), above its 3-year median of 33.4.');
    expect([...el.querySelectorAll('.dv-faq h3')].map((h) => h.textContent)).toEqual(NVDA.faq.map((f) => f.q));
    expect(text()).toContain(NVDA.faq[0]!.a);
    for (const v of [NVDA, NKE, INTC]) expect(v.faq.every((f) => f.q.endsWith('?') && f.a.includes(v.name))).toBe(true);
  });
  it('the columns carry the words people search beside their own: valuation (the most searched), moat, risks', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    expect([...el.querySelectorAll('.dv-col-h .dv-term')].map((t) => t.textContent)).toEqual([' moat', ' risks', ' valuation']);
    expect(el.querySelector('.dv-col:last-child .dv-name')!.textContent).toBe('Price valuation');
  });
  it('marks each question and its answer for the page\'s structured data, each question with an address of its own', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    const pairs = [...el.querySelectorAll('[data-faq]')].map((w) => [w.querySelector('[data-faq-q]')!.textContent!.trim(), w.querySelector('[data-faq-a]')!.textContent!.trim()]);
    const { lead, text } = valueAnswer(NVDA);
    expect(pairs[0]).toEqual(['Is Nvidia a good stock to buy?', `${lead} ${text}`]);
    expect(pairs.slice(1)).toEqual(NVDA.faq.map((f) => [f.q, f.a]));
    expect(el.querySelector('#value-who-is-dumping-nvidia-stock h3')!.textContent).toBe('Who is dumping Nvidia stock?');
  });
  it('the other companies a card reads open their card from the ticker, as every ticker on the site does', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    const t = [...el.querySelectorAll('.dv-cos a.pt-mention')];
    expect(t.length).toBeGreaterThan(10);
    expect(t.find((a) => a.textContent === 'MSFT')!.getAttribute('href')).toBe('/stocks/msft/');
    // a holder with no page on pretickt is its name, never a link to a missing page
    expect([...el.querySelectorAll('.dv-cos span.dv-co-t')].map((x) => x.textContent)).toContain('Vanguard');
  });
  it('each card\'s title starts with the company\'s ticker, the searched term after it', async () => {
    for (const v of [NVDA, NKE, INTC]) {
      const { el } = await render(PtValue, { ticker: v.ticker });
      const titles = [...el.querySelectorAll('.dv-title')].map((t) => t.textContent!);
      expect(titles.length).toBe(v.sections.flatMap((s) => s.cards).length);
      expect(titles.every((t) => t.startsWith(`${v.ticker} `))).toBe(true);
    }
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    expect(el.querySelector('.dv-title')!.textContent).toBe('NVDA sales growth revenue growth');
  });
  it('a quarters card: a bar for each quarter, the quarter under it, the fiscal year under its quarters', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    const card = [...el.querySelectorAll('.dv-card')].find((c) => c.querySelector('.dv-title')!.textContent!.includes('earnings vs estimates'))!;
    expect(card.querySelectorAll('.dv-qs-slot')).toHaveLength(8);
    expect(card.querySelectorAll('.dv-qs-bar.dv-qs-pos')).toHaveLength(8);
    expect([...card.querySelectorAll('.dv-qs-q')].map((x) => x.textContent)).toEqual(['Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2']);
    expect([...card.querySelectorAll('.dv-qs-y')].map((x) => x.textContent)).toEqual(['FY25', 'FY26', 'FY27']);
    expect(JSON.parse(card.querySelectorAll('.dv-qs-slot')[7]!.getAttribute('data-tip')!)).toEqual({ 'Q2 FY27': '+4.4% vs the analysts\' estimate' });
  });
  it('the quality checks card: a row per group with its name, a check mark when a check passes, an x when it misses', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    const card = [...el.querySelectorAll('.dv-card')].find((c) => c.querySelector('.dv-title')!.textContent!.includes('quality checks'))!;
    expect([...card.querySelectorAll('.dv-ck-g')].map((x) => x.textContent)).toEqual(['Profit & cash', 'Debt & shares', 'Efficiency']);
    const marks = [...card.querySelectorAll('.dv-ck svg.pt-icon')];
    expect(marks).toHaveLength(9);
    expect(marks.filter((m) => m.querySelector('path')!.getAttribute('d') === iconPath('check'))).toHaveLength(7);
    expect(marks.filter((m) => m.querySelector('path')!.getAttribute('d') === iconPath('x'))).toHaveLength(2);
    expect(card.querySelectorAll('.dv-ck svg.dv-ck-off')).toHaveLength(2);
    expect(card.querySelectorAll('.dv-ck svg[data-tip]')).toHaveLength(9);
  });
  it('each card\'s title is a heading, as the searched questions under the columns, with its searched term inside it', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    const titles = [...el.querySelectorAll('.dv-title')];
    expect(titles.length).toBe(NVDA.sections.flatMap((s) => s.cards).length);
    expect(titles.every((t) => t.tagName === 'H3')).toBe(true);
    expect(el.querySelector('h3.dv-title .dv-term')!.textContent).toBe(' revenue growth');
  });
});


describe('pt-value: on its own page and on the company page', () => {
  it('compact: the question and its answer, the verdicts, a link to the full page; no cards and no structured data (the full page has it)', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA', compact: true });
    expect(el.querySelector('h2.dv-q')!.textContent).toBe('Is Nvidia a good stock to buy?');
    expect(el.querySelectorAll('.dv-chip')).toHaveLength(6);
    expect(el.querySelector('a.dv-more')!.getAttribute('href')).toBe('/stocks/nvda/value/');
    expect(el.querySelectorAll('[data-faq], .dv-card')).toHaveLength(0);
  });
  it('each verdict is a link to its question: on the company page to the value page at it, on the value page to its column (Romeo, 2026-11-01)', async () => {
    const compact = (await render(PtValue, { ticker: 'NVDA', compact: true })).el;
    expect([...compact.querySelectorAll('.dv-chip a')].map((a) => a.getAttribute('href'))).toEqual(NVDA.sections.map((s) => `/stocks/nvda/value/#value-${s.key}`));
    expect(compact.querySelector('.dv-chip a')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(`Demand ${NVDA.sections[0]!.verdict}`);
    const full = (await render(PtValue, { ticker: 'NVDA' })).el;
    // the page's own address with the anchor: on that page a jump, whatever <base> a page carries (the stories' "/")
    expect([...full.querySelectorAll('.dv-chip a')].map((a) => a.getAttribute('href'))).toEqual(NVDA.sections.map((s) => `/stocks/nvda/value/#value-${s.key}`));
    expect([...full.querySelectorAll('.dv-col')].map((c) => c.id)).toEqual(NVDA.sections.map((s) => `value-${s.key}`));
    // an arrow says it opens something (Romeo, 2026-11-01: "metti una freccia … per indicare che si può cliccare"), no words added
    expect([...compact.querySelectorAll('.dv-chip a')].every((a) => a.querySelector('svg.dv-chip-go path'))).toBe(true);
    expect(compact.querySelector('.dv-chip a')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(`Demand ${NVDA.sections[0]!.verdict}`);
  });
  it('each card can be shared on its own: an address of its own, its question named, a share icon and no word (Romeo, 2026-11-01)', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' });
    const cards = [...el.querySelectorAll<HTMLElement>('.dv-card')];
    const ids = NVDA.sections.flatMap((s) => s.cards.map((c) => `value-${s.key}-${faqId(c.title)}`));
    expect(cards.map((c) => c.id)).toEqual(ids);
    expect(cards[0]!.id).toBe('value-demand-sales-growth');
    expect(new Set(ids).size).toBe(ids.length);
    expect(cards.map((c) => c.dataset['sharePart'])).toEqual(NVDA.sections.flatMap((s) => s.cards.map(() => QUESTIONS[s.key].name)));
    // "for smaller parts leave the share icon only": the icon, its name for a screen reader and the hover, no word on the card
    const says = NVDA.sections.flatMap((s) => s.cards.map((c) => c.say));
    cards.forEach((c, i) => {
      const b = c.querySelector<HTMLButtonElement>('button[data-share]')!;
      expect(b.getAttribute('aria-label')).toBe('Share this card');
      expect(b.textContent!.trim()).toBe('');
      expect(b.querySelector('svg path')!.getAttribute('d')).toBe(iconPath('share'));
      // at the end of the card's sentence, below everything the cards line up by; the sentence's words unchanged
      expect(c.querySelector('.dv-say')!.lastElementChild).toBe(b);
      expect(c.querySelector('.dv-say')!.textContent).toBe(says[i]);
    });
    // the company page's form has no cards: the placement's own Share stays its only one
    expect((await render(PtValue, { ticker: 'NVDA', compact: true })).el.querySelectorAll('[data-share]')).toHaveLength(0);
  });
  it('a question without cards is left out: as many columns as questions (a bank answers three)', async () => {
    const bank: Value = { ...NVDA, sections: NVDA.sections.filter((s) => ['economics', 'execution', 'price'].includes(s.key)) };
    const { el } = await render(PtValue, { ticker: 'NVDA' }, withData({ 'value@1': bank }));
    expect(el.querySelectorAll('.dv-col')).toHaveLength(3);
    expect((el.querySelector('section.dv') as HTMLElement).style.getPropertyValue('--dv-n')).toBe('3');
  });
  it('no payload: not available', async () => {
    const { el } = await render(PtValue, { ticker: 'NVDA' }, withData({ 'value@1': null }));
    expect(el.textContent).toContain('Data not available');
  });
  it('a quarter far off the others is drawn at three times the usual one, its number unchanged on hover', () => {
    const Q = (q: string, fy: string, by: number) => ({ q, fy, by });
    const g = quarterGeom([Q('Q1', 'FY26', 0.04), Q('Q2', 'FY26', 0.05), Q('Q3', 'FY26', 1.5), Q('Q4', 'FY26', 0.03)], 'the estimate');
    expect(g.bars[2]!.h / g.bars[1]!.h).toBeCloseTo(3, 1);
    expect(JSON.parse(g.bars[2]!.tip)).toEqual({ 'Q3 FY26': '+150.0% vs the estimate' });
  });
});

import { ASKED, BOARD, HOT, ODDS } from './mock';
import { railMarks, splitBars } from './pt-asked';
import { bubbleSize, heat, hotSentence, ring } from './pt-hot';
import { arc, oddsDays, oddsTone } from './pt-odds';
import { boardColumns, boardSentence } from './pt-quality-strip';
import { arcPath, at, barGeom, companyRows, list, onArc, valueAnswer, type Value } from './pt-value';
import { VALUE_INTC, VALUE_NKE, VALUE_NVDA } from './value-mock';

describe('home drafts: the helpers their components will keep', () => {
  it('H1: heat against a usual day, the ring it earns, a bubble whose area grows with the posts, the sentence', () => {
    expect(heat({ mentions: 220, usual: 70 })).toBeCloseTo(22 / 7, 9);
    expect(heat({ mentions: 5, usual: 0 })).toBeNull();
    expect([2.5, 1, 0.5, null].map(ring)).toEqual(['hot', 'usual', 'cool', 'cool']);
    expect(bubbleSize(400) - 34).toBeCloseTo(2 * (bubbleSize(100) - 34), 0);
    expect(hotSentence(HOT.rows)).toBe('Most discussed in the last 24 hours: SPCX (220 posts, 3.1× its usual), GOOGL (170) and AMZN (150). AMGN draws 6.7× its usual.');
    expect(hotSentence(HOT.rows.slice(0, 2))).toBe('Most discussed in the last 24 hours: SPCX (220 posts, 3.1× its usual) and GOOGL (170). SPCX draws 3.1× its usual.');
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
    expect(boardSentence(BOARD)).toBe('This week Execution strengthened at 8 companies; Fragility weakened or needs watching at META and GOOGL.');
  });
});


describe('pt-value (draft): the answer and the small pictures', () => {
  it('answers in words: how many of the five questions about the business are strong, what is weak, then the price', () => {
    expect(valueAnswer(VALUE_NVDA)).toEqual({ lead: 'Mostly yes', text: 'A strong business on 4 of the 5 questions about the company. The price: expensive.' });
    expect(valueAnswer(VALUE_NKE)).toEqual({ lead: 'Not really, for now', text: 'A strong business on 1 of the 5 questions about the company; weak on demand and economics. The price: below its usual.' });
    expect(valueAnswer(VALUE_INTC)).toEqual({ lead: 'Mostly no', text: 'Weak on advantage, economics, execution and fragility; demand in between. The price: hard to judge.' });
    expect(valueAnswer({ ...VALUE_NVDA, sections: [] } as Value)).toEqual({ lead: 'Not enough data yet', text: 'The questions about the company have no data yet.' });
    expect([list([]), list(['a']), list(['a', 'b']), list(['a', 'b', 'c'])]).toEqual(['', 'a', 'a and b', 'a, b and c']);
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
  it('has a short title, one of a kind in its column, and a source', () => {
    for (const v of all) for (const s of v.sections) {
      expect(s.cards.every((c) => c.title.length > 0 && c.title.length <= 24 && c.source.length > 0)).toBe(true);
      expect(new Set(s.cards.map((c) => c.title)).size).toBe(s.cards.length);
    }
  });
  it('says how much the biggest customers weigh, under fragility: the 10-K table, the customers unnamed', () => {
    const fragility = all.map((v) => v.sections.find((s) => s.key === 'fragility')!.cards.find((c) => c.title === 'Biggest customers'));
    expect(fragility.map((c) => c?.big)).toEqual(['34%', 'under 10%', '42%']);
    expect(fragility.every((c) => c?.viz.kind === 'split' && c.source.includes('financial-reports-json'))).toBe(true);
  });
});

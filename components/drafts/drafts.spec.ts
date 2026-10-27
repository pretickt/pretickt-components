import { ASKED, BOARD, HOT, ODDS } from './mock';
import { railMarks, splitBars } from './pt-asked';
import { bubbleSize, heat, hotSentence, ring } from './pt-hot';
import { arc, oddsDays, oddsTone } from './pt-odds';
import { boardColumns, boardSentence } from './pt-quality-strip';

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

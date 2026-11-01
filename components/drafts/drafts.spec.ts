import { ASKED, BOARD, HOT, ODDS } from './mock';
import { railMarks, splitBars } from './pt-asked';
import { bubbleSize, etTime, heat, hotSentence, hotWhen, PtHot, ring } from './pt-hot';
import { arc, oddsDays, oddsTone } from './pt-odds';
import { boardColumns, boardSentence, boardWeek, PtQualityStrip } from './pt-quality-strip';
import { render } from '../_spec';
import { saidText } from '../../src/ds/format';

describe('home drafts: the helpers their components will keep', () => {
  it('H1: heat against a usual day, the ring it earns, a bubble whose area grows with the posts, the sentence', () => {
    expect(heat({ mentions: 220, usual: 70 })).toBeCloseTo(22 / 7, 9);
    expect(heat({ mentions: 5, usual: 0 })).toBeNull();
    expect([2.5, 1, 0.5, null].map(ring)).toEqual(['hot', 'usual', 'cool', 'cool']);
    expect(bubbleSize(400) - 34).toBeCloseTo(2 * (bubbleSize(100) - 34), 0);
    expect(saidText(hotSentence(HOT.rows, hotWhen(HOT), HOT.sources))).toBe('Most discussed on Reddit and X in the 24 hours to 10:30 a.m. ET, Mon, Oct 26, 2026: ' +
      'SpaceX SPCX (220 posts, 3.1× its usual), Alphabet GOOGL (170) and Amazon AMZN (150). Amgen AMGN draws 6.7× its usual. Posts from r/wallstreetbets, r/stocks and X.');
    expect(saidText(hotSentence(HOT.rows.slice(0, 2)))).toBe('Most discussed on Reddit and X in the last 24 hours: SpaceX SPCX (220 posts, 3.1× its usual) and Alphabet GOOGL (170). ' +
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
    expect(el.querySelector('ol.dr-rank a.pt-mention')!.getAttribute('href')).toBe('/stocks/spcx/#people-ask');
    // the sentence names them as links with their logos too: the card opens on any ticker
    expect([...el.querySelectorAll('.pt-lede a.pt-mention')].map((a) => a.getAttribute('href')).slice(0, 3)).toEqual(['/stocks/spcx/', '/stocks/googl/', '/stocks/amzn/']);
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



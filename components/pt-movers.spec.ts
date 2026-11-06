import { ongoingMovesDemo, type OngoingMoveRow, type OngoingMoves } from '../src/typologies';
import { buildMovers, capShort, pctShort, PtMovers } from './pt-movers';
import type { LiveDay } from '../src/context';
import { basics, liveDay, press, render, settle, withData } from './_spec';

const row = (ticker: string, week: number | null, o: Partial<OngoingMoveRow> = {}): OngoingMoveRow => ({
  ticker, name: `${ticker} Inc.`, logo: null, marketCap: 1e11, kind: (week ?? 0) < 0 ? 'drawdown' : 'rally', since: '2026-09-01', days: 29,
  move: (week ?? 0) < 0 ? -0.08 : 0.08, close: 100, week, month: week === null ? null : week * 2, quarter: week === null ? null : week * 3,
  industry: null, ...o,
});
const payload = (rows: OngoingMoveRow[], o: Partial<OngoingMoves> = {}): OngoingMoves => ({ asOf: '2026-10-16', threshold: 0.04, market: 'bullish', rows, ...o });
const view = (d: unknown) => render(PtMovers, { sort: 'cap' }, withData({ 'ongoing-moves@1': d }));

describe('buildMovers (beta\'s tornado)', () => {
  // the payload arrives ranked: losers then gainers, each most important first
  const ranked = [row('L1', -0.05), row('L2', -0.03), row('G1', 0.04), row('G2', 0.02)];
  it('losers on the left, gainers on the right, the most important next to the centre', () => {
    const g = buildMovers(ranked)!;
    expect(g.bars.map((b) => b.ticker)).toEqual(['L2', 'L1', 'G1', 'G2']);
    expect(g.bars.every((b, i, a) => i === 0 || b.x > a[i - 1]!.x)).toBe(true);
    const by = Object.fromEntries(g.bars.map((b) => [b.ticker, b]));
    expect(by.L1!.weekY).toBeGreaterThan(g.zeroY);
    expect(by.G1!.weekY).toBeLessThan(g.zeroY);
  });
  it('one scale for the three windows: the largest of them reaches the top margin; three nested bars, widest the 90 days', () => {
    const g = buildMovers([row('A', -0.02, { month: -0.05, quarter: 0.1 }), row('B', 0.01)])!;
    const a = g.bars[0]!;
    expect(a.rects.map((r) => r.cls)).toEqual(['pt-mv-q pt-mv-bar-pos', 'pt-mv-m pt-mv-bar-neg', 'pt-mv-w pt-mv-bar-neg']);
    const [q, m, w] = a.rects;
    expect(q!.y).toBeCloseTo(26, 0); // +10% is the largest value of the chart: the top margin
    expect(q!.w).toBeGreaterThan(m!.w);
    expect(m!.w).toBeGreaterThan(w!.w);
    expect(w!.rx).toBe(2);
  });
  it('the losers/gainers boundary is the centre whatever the balance: the top loser and the top gainer flank it at the same distance', () => {
    const g = buildMovers([row('L1', -0.05), row('L2', -0.04), row('L3', -0.03), row('G1', 0.02)])!;
    const x = Object.fromEntries(g.bars.map((b) => [b.ticker, b.x]));
    expect(g.bars.every((b) => (b.up ? b.x > 400 : b.x < 400))).toBe(true);
    expect(400 - x.L1!).toBeCloseTo(x.G1! - 400, 1);
    const balanced = buildMovers(Array.from({ length: 28 }, (_, i) => row(`T${String(i).padStart(2, '0')}`, i < 14 ? -0.01 - i / 100 : 0.01 + i / 100)))!;
    expect(balanced.bars.map((b) => b.x)).toEqual(Array.from({ length: 28 }, (_, i) => Math.round(((800 / 29) * (i + 1)) * 10) / 10)); // beta's slots
  });
  it('a phone crops to the middle half only when a side has more than 7 companies', () => {
    expect(buildMovers(Array.from({ length: 8 }, (_, i) => row(`L${i}`, -0.01 - i / 100)))!.crop).toBe(true);
    expect(buildMovers([...Array.from({ length: 7 }, (_, i) => row(`L${i}`, -0.01 - i / 100)), row('G1', 0.02)])!.crop).toBe(false);
  });
  it('draws what a row has: no 90-day backdrop without a quarter, one side alone, nothing for an empty or weekless list', () => {
    expect(buildMovers([row('A', 0.03, { quarter: null })])!.bars[0]!.rects.map((r) => r.cls.split(' ')[0])).toEqual(['pt-mv-m', 'pt-mv-w']);
    expect(buildMovers([row('A', -0.03), row('B', -0.01)])!.bars).toHaveLength(2);
    expect(buildMovers([])).toBeNull();
    expect(buildMovers([row('A', null)])).toBeNull();
  });
  it('labels the week\'s move (one decimal under 10%) and the market cap, short', () => {
    expect([pctShort(-0.141), pctShort(0.02), pctShort(-0.073), pctShort(0)]).toEqual(['-14%', '+2.0%', '-7.3%', '+0.0%']);
    expect([capShort(5.2e12), capShort(4.53e11), capShort(9.37e10), capShort(8.6e9), capShort(null)]).toEqual(['$5.2T', '$453B', '$94B', '$8.6B', '']);
  });
  it('a logo only from the site\'s own files; initials otherwise (no request)', () => {
    const g = buildMovers([row('BRK.B', 0.02, { logo: '/logos/brk.b.1a2b3c4d.webp' }), row('ZZ', 0.01, { logo: 'https://evil.example/x.png' })])!;
    expect(g.bars.map((b) => [b.logo, b.initials])).toEqual([['/logos/brk.b.1a2b3c4d.webp', 'BR'], [null, 'ZZ']]);
  });
});

describe('buildMovers: today\'s line (the delayed move)', () => {
  const day = (q: Record<string, number>, o: Partial<LiveDay> = {}): LiveDay => ({ session: '2026-10-19', prev: '2026-10-16', asOf: '2026-10-19T15:30:00.000Z', time: '11:30 AM ET', delayMin: 15,
    closed: false, q: Object.fromEntries(Object.entries(q).map(([t, r]) => [t, { p: 100, pc: 100, r, m: null, s: null, x: null }])), news: {}, earnings: {}, ...o });
  // one scale: the quarter's ±10% reaches the top margin (94 units above the baseline at 120)
  const base = [row('A', -0.02, { month: -0.04, quarter: -0.1 }), row('B', 0.02, { month: 0.04, quarter: 0.1 })];
  it('a line from the baseline, up for a gain and down for a loss, on the bars\' scale and narrower than the week\'s bar', () => {
    const g = buildMovers(base, day({ A: 0.05, B: -0.05 }))!;
    const a = g.bars.find((b) => b.ticker === 'A')!.today!, b = g.bars.find((x) => x.ticker === 'B')!.today!;
    expect([a.y, a.h]).toEqual([73, 47]); // +5% of a 10% scale: half way up
    expect([b.y, b.h]).toEqual([120, 47]);
    const week = g.bars.find((x) => x.ticker === 'A')!.rects.at(-1)!;
    expect(a.w).toBeLessThan(week.w / 3);
    expect(a.x + a.w / 2).toBeCloseTo(g.bars.find((x) => x.ticker === 'A')!.x, 1);
  });
  it('no line without a quote for the company, or without the day: then the chart is the end-of-day one', () => {
    const g = buildMovers(base, day({ A: 0.05 }))!;
    expect(g.bars.find((b) => b.ticker === 'B')!.today).toBeNull();
    expect(buildMovers(base)!.bars.every((b) => b.today === null)).toBe(true);
    expect(buildMovers(base, null)).toEqual(buildMovers(base));
  });
  it('a flat day still shows, and today\'s move joins the scale when it is the largest', () => {
    expect(buildMovers(base, day({ A: 0 }))!.bars.find((b) => b.ticker === 'A')!.today!.h).toBe(0.5);
    const g = buildMovers(base, day({ A: -0.2 }))!;
    expect(g.bars.find((b) => b.ticker === 'A')!.today!.h).toBe(94); // -20% now fills the height
    expect(g.bars.find((b) => b.ticker === 'A')!.rects[0]!.h).toBe(47); // and the quarter's -10% halves
  });
  it('the tooltip opens with today\'s move and its delay, the spoken label ends with it', () => {
    const b = buildMovers(base, day({ A: -0.021 }))!.bars.find((x) => x.ticker === 'A')!;
    const rows = JSON.parse(b.tip) as Record<string, string>;
    expect(Object.entries(rows)[0]).toEqual(['Today (15-min delayed)', '-2.1%']);
    expect(rows['This week']).toBe('-2.0%');
    expect(b.label).toBe('A, -2.0% this week, -2.1% today');
    const closed = buildMovers(base, day({ A: -0.021 }, { closed: true }))!.bars.find((x) => x.ticker === 'A')!;
    expect(Object.keys(JSON.parse(closed.tip) as object)[0]).toBe('Today (close, preliminary)');
  });
});

describe('pt-movers', () => {
  basics(PtMovers, { sort: 'cap' });

  describe('today\'s line on the page', () => {
    const data = withData({ 'ongoing-moves@1': payload([row('NVDA', -0.066), row('AAPL', 0.02)]) });
    const open = { session: '2026-10-19', prev: '2026-10-16', time: '11:30 AM ET', q: { NVDA: { p: 180, pc: 184, r: -0.0217, m: null, s: null, x: null } } };
    const live = async (d: Partial<LiveDay>) => {
      const r = await render(PtMovers, { sort: 'cap' }, data, { browser: true, providers: liveDay(d) });
      await settle(r.f);
      return r;
    };
    it('once the delayed prices arrive: the line on the companies they cover, and a legend key that says the delay and the time', async () => {
      const r = await live(open);
      expect(r.el.querySelectorAll('.pt-mv-d')).toHaveLength(1);
      expect(r.el.querySelector('a[href="/stocks/nvda/"] .pt-mv-d')).toBeTruthy();
      const keys = [...r.el.querySelectorAll('.pt-mv-legend .pt-mv-key')].map((k) => k.textContent!.trim());
      expect(keys[0]).toBe('Today · 11:30 AM ET, 15-min delayed');
    });
    it('after the close the key says the number is preliminary', async () => {
      const r = await live({ ...open, closed: true });
      expect(r.el.querySelector('.pt-mv-legend .pt-mv-key')!.textContent!.trim()).toBe('Today · close Oct 19, 2026, preliminary');
    });
    it('a session the payload already holds draws no line and no key, and neither does the page the build renders', async () => {
      const same = await live({ ...open, session: '2026-10-16' });
      expect(same.el.querySelector('.pt-mv-d')).toBeNull();
      expect(same.el.querySelector('.pt-mv-legend .pt-mv-key')!.textContent!.trim()).toBe('This week');
      const built = await view(payload([row('NVDA', -0.066)]));
      expect(built.el.querySelector('.pt-mv-d')).toBeNull();
    });
  });

  it('every company is a link to its page, its numbers in the tooltip, its move spoken', async () => {
    const r = await view(payload([row('NVDA', -0.066, { name: 'NVIDIA Corporation', industry: { median: -0.05, peers: [{ ticker: 'AMD', move: -0.09 }] } }), row('AAPL', 0.02)]));
    const links = [...r.el.querySelectorAll('a.pt-mv-co')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/stocks/nvda/', '/stocks/aapl/']);
    expect(links[0]!.getAttribute('aria-label')).toBe('Nvidia, -6.6% this week');
    const rows = JSON.parse(links[0]!.getAttribute('data-tip')!) as Record<string, string>;
    expect(rows).toEqual({ 'This week': '-6.6%', 'Last 30 days': '-13.2%', 'Last 90 days': '-19.8%', Drawdown: '-8.0% since Sep 1, 2026 (29 days)',
      'Industry moving too': 'median -5.0%', Peers: 'AMD -9.0%' });
  });
  it('marks a move the industry shares with the ⚠ triangle, and only that one', async () => {
    const r = await view(payload([row('NVDA', -0.066, { industry: { median: -0.05, peers: [] } }), row('AAPL', 0.02)]));
    expect(r.el.querySelectorAll('.pt-mv-alert')).toHaveLength(1);
    expect(r.el.querySelector('a[href="/stocks/nvda/"] .pt-mv-alert')).toBeTruthy();
  });
  it('legend: the three windows, each a green and a red swatch, and the industry mark', async () => {
    const r = await view(payload([row('AAPL', 0.02)]));
    const keys = [...r.el.querySelectorAll('.pt-mv-legend .pt-mv-key')].map((k) => k.textContent!.trim());
    expect(keys).toEqual(['This week', 'Last 30 days', 'Last 90 days', '⚠Industry moving too']);
    expect(r.el.querySelectorAll('.pt-mv-legend .pt-mv-sw.pt-mv-sw-pos')).toHaveLength(3);
    expect(r.el.querySelectorAll('.pt-mv-legend .pt-mv-sw.pt-mv-sw-neg')).toHaveLength(3);
  });
  it('a quiet market says so, with no chart and no legend', async () => {
    const r = await view(payload([]));
    expect(r.text()).toContain('Quiet market: no stock is in a move of more than 4% right now.');
    expect(r.el.querySelector('svg')).toBeNull();
    expect(r.el.querySelector('.pt-mv-legend')).toBeNull();
    expect(r.html()).not.toContain('pt-na');
  });
  it('the market chip follows SPY\'s trend, and is left out when unknown', async () => {
    expect((await view(payload([row('A', 0.02)], { market: 'bearish' }))).el.querySelector('.pt-mv-market')!.textContent!.trim()).toBe('Market ▼');
    expect((await view(payload([row('A', 0.02)], { market: 'sideways' }))).el.querySelector('.pt-mv-market-sideways')).toBeTruthy();
    expect((await view(payload([row('A', 0.02)], { market: null }))).el.querySelector('.pt-mv-market')).toBeNull();
  });
  it('states the rule and the date; a provider name stays text, never markup', async () => {
    const r = await view(payload([row('A', 0.02, { name: 'A <b>Corp</b>' })]));
    expect(r.text()).toContain('Companies in a rally or drawdown of more than 4% that is still running');
    expect(r.text()).toContain('as of Oct 16, 2026');
    expect(r.el.querySelector('b')).toBeNull();
    expect(r.el.querySelector('a.pt-mv-co')!.getAttribute('aria-label')).toBe('A <b>Corp</b>, +2.0% this week');
  });
  it('% move asks the API for that order; the note follows the data on screen', async () => {
    const r = await render(PtMovers, { sort: 'cap' });
    expect(r.text()).toContain('the largest companies in the middle');
    await press(r.f, r.el, '% move');
    expect(r.text()).toContain('the biggest moves in the middle');
    expect(r.el.querySelector('.pt-toggles button[aria-pressed="true"]')!.textContent).toBe('% move');
    const moved = ongoingMovesDemo({ sort: 'move' });
    expect([...r.el.querySelectorAll('a.pt-mv-co')].map((a) => a.getAttribute('href'))).toHaveLength(moved.rows.length);
  });
});

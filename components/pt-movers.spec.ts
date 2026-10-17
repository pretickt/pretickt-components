import { ongoingMovesDemo, type OngoingMoveRow, type OngoingMoves } from '../src/typologies';
import { buildMovers, capShort, pctShort, PtMovers } from './pt-movers';
import { basics, press, render, withData } from './_spec';

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

describe('pt-movers', () => {
  basics(PtMovers, { sort: 'cap' });

  it('every company is a link to its page, its numbers in the tooltip, its move spoken', async () => {
    const r = await view(payload([row('NVDA', -0.066, { industry: { median: -0.05, peers: [{ ticker: 'AMD', move: -0.09 }] } }), row('AAPL', 0.02)]));
    const links = [...r.el.querySelectorAll('a.pt-mv-co')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/stocks/nvda/', '/stocks/aapl/']);
    expect(links[0]!.getAttribute('aria-label')).toBe('NVDA Inc., -6.6% this week');
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

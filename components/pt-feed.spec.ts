import { feedUnknownVariant, type Feed, type FeedItem } from '../src/typologies';
import { feedCards, pill, PtFeed } from './pt-feed';
import { basics, demo, render, withData } from './_spec';

const ASOF = '2026-10-16';
const item = (date: string, o: Partial<FeedItem> = {}): FeedItem => ({
  date, group: 'technical', kind: 'big-move', ticker: 'AAPL', name: 'Apple', logo: null, label: 'Big move', sub: '3× usual',
  text: `Apple moved on ${date}.`, impact: 0.032, impactKind: 'day', session: date, href: '/stocks/aapl/#price', ...o,
});
const feed = (items: FeedItem[]): Feed => ({ asOf: ASOF, items });
const view = (d: unknown, inputs: Record<string, unknown> = { ticker: 'AAPL' }) => render(PtFeed, inputs, withData({ 'feed@1': d }));

describe('feedCards', () => {
  const past = [item('2026-08-01'), item('2026-10-16', { kind: 'earnings' })], coming = [item('2026-10-20'), item('2026-11-30')];
  it('keeps the date order and puts today after the last past card (an event on the session itself is past)', () => {
    const { cards, todayAt } = feedCards([...past, ...coming], ASOF, true);
    expect(cards.map((c) => c.future)).toEqual([false, false, true, true]);
    expect(todayAt).toBe(2);
  });
  it('only past → today at the end; only coming → today first; nothing → no cards', () => {
    expect(feedCards(past, ASOF, true).todayAt).toBe(2);
    expect(feedCards(coming, ASOF, true).todayAt).toBe(0);
    expect(feedCards([], ASOF, true)).toEqual({ cards: [], todayAt: 0 });
  });
  it('a company chip off the company\'s own feed, "Market" for the market\'s own items, none on the company\'s feed', () => {
    const items = [item('2026-10-01'), item('2026-10-02', { ticker: null, name: null, group: 'market', kind: 'macro', label: 'CPI' })];
    expect(feedCards(items, ASOF, false).cards.map((c) => c.co)).toEqual([{ ticker: 'AAPL', logo: null }, 'market']);
    expect(feedCards(items, ASOF, true).cards.map((c) => c.co)).toEqual([null, 'market']);
  });
  it('known kinds get their glyph, others the generic one', () => {
    const { cards } = feedCards([item('2026-10-01', { kind: 'earnings' }), item('2026-10-02', { kind: 'brand-new' })], ASOF, true);
    expect(cards.map((c) => c.glyph)).toEqual(['earnings', 'dot']);
  });
});

describe('pill', () => {
  it('the session\'s move, toned; the move since, toned and marked; coming events dashed; nothing without a number', () => {
    expect(pill(item('2026-10-01', { impact: 0.032, impactKind: 'day' }))).toEqual({ text: '+3.2%', since: false, cls: 'pt-feed-pill pt-feed-pill-pos' });
    expect(pill(item('2026-10-01', { impact: -0.041, impactKind: 'since' }))).toEqual({ text: '-4.1%', since: true, cls: 'pt-feed-pill pt-feed-pill-neg' });
    expect(pill(item('2026-10-01', { impact: 0.0001, impactKind: 'day' }))?.cls).toBe('pt-feed-pill pt-feed-pill-flat');
    expect(pill(item('2026-11-01', { impact: 0.065, impactKind: 'typical' }))).toEqual({ text: '±6.5%', since: false, cls: 'pt-feed-pill pt-feed-pill-est' });
    expect(pill(item('2026-11-01', { impact: -0.004, impactKind: 'expected' }))).toEqual({ text: '-0.4%', since: false, cls: 'pt-feed-pill pt-feed-pill-est' });
    expect(pill(item('2026-11-01', { impact: null, impactKind: null }))).toBeNull();
    expect(pill(item('2026-11-01', { impact: 0.01, impactKind: null }))).toBeNull();
  });
});

describe('pt-feed', () => {
  basics(PtFeed, { ticker: 'AAPL' });
  basics(PtFeed, { sector: 'Technology' });
  basics(PtFeed, {});

  it('asks for the company, the sector or the market', async () => {
    const asked: unknown[] = [];
    const spy = (inputs: Record<string, unknown>) => render(PtFeed, inputs, async (t, p) => { asked.push(p); return demo()(t, p); });
    await spy({ ticker: 'NVDA' });
    await spy({ sector: 'Energy' });
    await spy({});
    expect(asked).toEqual([{ scope: { by: 'ticker', ticker: 'NVDA' } }, { scope: { by: 'sector', sector: 'Energy' } }, { scope: { by: 'market' } }]);
  });

  it('every card is one link with its sentence as text and as tooltip; the visual part is hidden from screen readers', async () => {
    const r = await view(feed([item('2026-10-01', { text: 'Apple fell 6.1% on Oct 1, 2026.', label: 'Big move' })]));
    const a = r.el.querySelector('a.pt-feed-card')!;
    expect(a.getAttribute('href')).toBe('/stocks/aapl/#price');
    expect(JSON.parse(a.getAttribute('data-tip')!)).toEqual({ 'Big move · Oct 1, 2026': 'Apple fell 6.1% on Oct 1, 2026.' });
    expect(a.querySelector('.pt-sr')!.textContent).toBe('Apple fell 6.1% on Oct 1, 2026.');
    const shown = a.querySelector('[aria-hidden="true"]')!.textContent!;
    expect(shown).toContain('Big move');
    expect(shown).toContain('Oct 1');
    expect(shown).not.toContain('2026');
    expect(shown).toContain('+3.2%');
  });

  it('the Today marker sits between the last past card and the first coming one; coming cards are marked', async () => {
    const r = await view(feed([item('2026-10-01', { label: 'Past' }), item('2026-10-30', { label: 'Coming', impact: 0.05, impactKind: 'typical', session: null })]));
    const lis = [...r.el.querySelectorAll('.pt-feed-strip > li')];
    expect(lis.map((li) => li.className.split(' ')[0])).toEqual(['pt-feed-item', 'pt-feed-today', 'pt-feed-item']);
    expect(lis[1]!.textContent).toContain('Today');
    expect(lis[1]!.textContent).toContain('Oct 16');
    expect(lis[2]!.classList.contains('pt-feed-future')).toBe(true);
    expect(lis[2]!.textContent).toContain('±5.0%');
  });

  it('off a company\'s own page each card names its company; the market\'s own say "Market"', async () => {
    const r = await view(feed([item('2026-10-01'), item('2026-10-02', { ticker: null, name: null, group: 'market', kind: 'macro', label: 'CPI' })]), {});
    const chips = [...r.el.querySelectorAll('.pt-feed-co')].map((c) => c.textContent!.trim());
    expect(chips).toEqual(['AAPL', 'Market']);
    const own = await view(feed([item('2026-10-01')]));
    expect(own.el.querySelector('.pt-feed-co')).toBeNull();
  });

  it('a quiet window says so in one line; no strip', async () => {
    const r = await view(feed([]));
    expect(r.el.querySelector('.pt-feed-strip')).toBeNull();
    expect(r.text()).toContain('No events in the last 120 days or the next 60');
    expect(r.html()).not.toContain('pt-na');
  });

  it('a kind or link this build has never seen still renders, as a generic card', async () => {
    const r = await view(feedUnknownVariant(feed([item('2026-10-01')])));
    expect(r.el.querySelectorAll('a.pt-feed-card')).toHaveLength(2);
  });

  it('a legend names the groups on screen', async () => {
    const r = await view(feed([item('2026-10-01'), item('2026-10-02', { group: 'news', kind: 'news', label: 'In the news' })]));
    expect([...r.el.querySelectorAll('.pt-feed-key')].map((k) => k.textContent!.trim())).toEqual(['Technical', 'News']);
  });
});

import { describe, expect, it } from 'vitest';
import { demoFor, getTypology } from './index';
import { FeedPayload, feedUnknownVariant, type Feed, type FeedItem } from './feed';
import { FEED_DAYS, FEED_GROUPS, FEED_IMPACTS, FEED_MAX } from './values';
import { addDays } from './common';

const demo = (scope: unknown) => demoFor({ t: 'feed@1', params: { scope } }) as Feed;
const item = (o: Partial<FeedItem> = {}): FeedItem => ({
  date: '2026-09-29', group: 'technical', kind: 'big-move', ticker: 'AAPL', name: 'Apple', logo: null, label: 'Big move', sub: '3× usual',
  text: 'Apple rose 4.0% on Sep 29, 2026.', impact: 0.04, impactKind: 'day', session: '2026-09-29', href: '/stocks/aapl/#price', spark: null, ...o,
});

describe('feed@1', () => {
  it('ticker scope: every item is that company\'s; both sides of the session; every group and impact kind; a card without a pill', () => {
    const d = demo({ by: 'ticker', ticker: 'NVDA' });
    expect(FeedPayload.parse(d)).toEqual(d);
    expect(d.items.every((i) => i.ticker === 'NVDA')).toBe(true);
    expect(d.items.some((i) => i.date <= d.asOf) && d.items.some((i) => i.date > d.asOf)).toBe(true);
    expect(new Set(d.items.map((i) => i.group))).toEqual(new Set(FEED_GROUPS.filter((g) => g !== 'market')));
    expect(new Set(d.items.map((i) => i.impactKind))).toEqual(new Set([...FEED_IMPACTS, null]));
    expect(d.items.length).toBeLessThanOrEqual(FEED_MAX);
  });
  it('items are in date order, inside the window, with site paths for links', () => {
    for (const scope of [{ by: 'ticker', ticker: 'BRK.B' }, { by: 'sector', sector: 'Energy' }, { by: 'market' }]) {
      const d = demo(scope);
      expect(d.items.map((i) => i.date)).toEqual([...d.items.map((i) => i.date)].sort());
      expect(d.items.every((i) => i.date >= addDays(d.asOf, -FEED_DAYS.back) && i.date <= addDays(d.asOf, FEED_DAYS.ahead))).toBe(true);
      expect(d.items.every((i) => /^\/(?![/\\])[a-z0-9/#._-]*$/.test(i.href))).toBe(true);
    }
  });
  it('market scope: the market\'s own items carry no ticker; companies\' items carry theirs', () => {
    const d = demo({ by: 'market' });
    const own = d.items.filter((i) => i.ticker === null);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((i) => i.group === 'market')).toBe(true);
    expect(own.some((i) => i.kind === 'macro')).toBe(true);
    expect(d.items.some((i) => i.ticker !== null)).toBe(true);
  });
  it('sector scope: several companies', () => {
    const d = demo({ by: 'sector', sector: 'Technology' });
    expect(new Set(d.items.map((i) => i.ticker)).size).toBeGreaterThan(2);
  });
  it('refuses a link off the site, a kind that is not a slug, an impact kind it does not know, an unknown sector', () => {
    const ok = { asOf: '2026-09-30', items: [item()] };
    expect(FeedPayload.safeParse(ok).success).toBe(true);
    for (const bad of [{ href: 'https://evil.example/' }, { href: '//evil.example/' }, { href: '/\\evil' }, { kind: 'big move' }, { impactKind: 'week' }])
      expect(FeedPayload.safeParse({ ...ok, items: [item(bad as Partial<FeedItem>)] }).success).toBe(false);
    expect(getTypology('feed@1')!.params.safeParse({ scope: { by: 'sector', sector: 'Crypto' } }).success).toBe(false);
  });
  it('each card carries its chart: closes around a past event with the event\'s place, the last closes before a coming one (place = after the end)', () => {
    const d = demo({ by: 'ticker', ticker: 'AAPL' });
    for (const i of d.items) {
      expect(i.spark, i.kind).not.toBeNull();
      const { closes, at } = i.spark!;
      expect(closes.length).toBeGreaterThanOrEqual(2);
      expect(closes.length).toBeLessThanOrEqual(40);
      if (i.date > d.asOf) expect(at).toBe(closes.length); else expect(at).toBeLessThan(closes.length);
    }
    const ok = { asOf: '2026-09-30', items: [item({ spark: { closes: [1, 2, 3], at: 3 } })] };
    expect(FeedPayload.safeParse(ok).success).toBe(true);
    for (const spark of [{ closes: [1, 2, 3], at: 4 }, { closes: [1], at: 0 }, { closes: Array(41).fill(1), at: 0 }, { closes: [1, 2], at: -1 }])
      expect(FeedPayload.safeParse({ ...ok, items: [item({ spark })] }).success, JSON.stringify(spark).slice(0, 40)).toBe(false);
    expect(FeedPayload.safeParse({ ...ok, items: [item({ spark: null })] }).success).toBe(true);
  });
  it('a newer API may send kinds and groups this build has never seen', () => {
    const d = demo({ by: 'ticker', ticker: 'AAPL' });
    const v = feedUnknownVariant(d) as Feed;
    expect(v.items.length).toBe(d.items.length + 1);
    expect(v.items.some((i) => i.kind === 'brand-new')).toBe(true);
  });
});

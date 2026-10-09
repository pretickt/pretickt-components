import { describe, expect, it } from 'vitest';
import { needKey } from '../api';
import { SCREEN_LISTS, ScreenParams, screenDemo } from './screen';
import { SECTORS } from './values';

describe('screen@1: sectors, the largest companies, up to every company', () => {
  it('a list may name one of the 11 sectors; "largest" lists by market cap; the limit goes up to 600', () => {
    expect(SECTORS).toHaveLength(11);
    expect(SCREEN_LISTS).toContain('largest');
    expect(ScreenParams.safeParse({ scope: { list: 'largest', sector: 'Financial Services' }, limit: 600 }).success).toBe(true);
    expect(ScreenParams.safeParse({ scope: { list: 'largest' }, limit: 601 }).success).toBe(false);
    expect(ScreenParams.safeParse({ scope: { list: 'largest', sector: 'Crypto' } }).success).toBe(false);
    expect(ScreenParams.safeParse({ scope: { peersOf: 'NVDA', sector: 'Technology' } }).success).toBe(false); // peers have their own sector
  });
  it('params without a sector keep the need keys pages already carry', () => {
    expect(needKey({ t: 'screen@1', params: { scope: { list: 'biggest_losers' }, limit: 5 } })).toBe('screen@1|{"limit":5,"scope":{"list":"biggest_losers"}}');
  });
  it('the demo answers with the sector asked for, and a different list for each sector', () => {
    const energy = screenDemo(ScreenParams.parse({ scope: { list: 'largest', sector: 'Energy' }, limit: 5 }));
    expect(energy.rows.every((r) => r.sector === 'Energy')).toBe(true);
    const tech = screenDemo(ScreenParams.parse({ scope: { list: 'largest', sector: 'Technology' }, limit: 5 }));
    expect(tech.rows[0]!.close).not.toBe(energy.rows[0]!.close);
  });
});

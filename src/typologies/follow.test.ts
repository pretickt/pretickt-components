import { describe, expect, it } from 'vitest';
import { DEMO_ASOF, DEMO_COMPANIES } from './common';
import { CompanyPayload, companyDemo } from './company';
import { FollowAlert, FollowFile, followDemo } from './follow';
import { FOLLOW_KINDS, FOLLOW_MAX, FOLLOW_RECENT } from './values';

describe("a company's alerts (the bell, Romeo 2026-11-14: «badge per gli allarmi recenti come in un'app mobile»)", () => {
  it('an alert parses with its badge, line and picture, and one of a kind this build does not know parses too', () => {
    const known = { kind: 'near-support', session: '2026-11-13', tone: 'flat', label: 'Support', value: '2.1% below', line: 'Closed 2.1% above its $182.40 support',
      pic: { c: [190, 188, 186.2], lv: [182.4] } };
    expect(FollowAlert.safeParse(known).success).toBe(true);
    expect(FollowAlert.safeParse({ kind: 'brand-new', session: '2026-11-13', tone: 'flat', label: 'Something', value: null, line: 'x', pic: null }).success).toBe(true);
    expect(FollowAlert.safeParse({ ...known, kind: 'Near Support' }).success).toBe(false);
  });
  it('a company payload from an older build (no alerts) still parses', () => {
    expect(CompanyPayload.safeParse({ ticker: 'NVDA', name: 'N', sector: null, industry: null, logo: null }).success).toBe(true);
  });
  it('the demo gives each company at most 12 alerts, newest first, within the last 5 sessions, and parses', () => {
    const seen = new Set<string>();
    for (const [ticker] of DEMO_COMPANIES) {
      const c = companyDemo({ ticker });
      expect(CompanyPayload.safeParse(c).success).toBe(true);
      const a = c.alerts ?? [];
      expect(a.length).toBeLessThanOrEqual(FOLLOW_MAX);
      for (let i = 1; i < a.length; i++) expect(a[i]!.session <= a[i - 1]!.session).toBe(true);
      expect(new Set(a.map((x) => x.session)).size).toBeLessThanOrEqual(FOLLOW_RECENT);
      for (const x of a) { seen.add(x.kind); expect(x.session <= DEMO_ASOF).toBe(true); expect(x.line).toMatch(/\d/); }
    }
    expect([...seen].sort()).toEqual([...FOLLOW_KINDS].sort());
  });
  it('the night file parses', () => {
    expect(FollowFile.safeParse({ v: 1, asOf: DEMO_ASOF, companies: { NVDA: { name: 'Nvidia', alerts: followDemo('NVDA') } } }).success).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { methodOf, typologyOf } from '../context/store';
import { TYPOLOGY_IDS } from './ids';
import { CompanyParams, CompanyPayload, companyDemo, TYPOLOGIES } from './index';

describe('company@1', () => {
  it('asks for one ticker and answers the profile the company card needs', () => {
    expect(CompanyParams.safeParse({ ticker: 'NVDA' }).success).toBe(true);
    expect(CompanyParams.safeParse({ ticker: '^GSPC' }).success).toBe(false);
    const d = companyDemo({ ticker: 'NVDA' });
    const { alerts, ...profile } = d;
    expect(profile).toEqual({ ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', logo: null });
    expect(alerts?.map((a) => a.kind)).toEqual(['ma-200', 'near-52w', 'rally-typical', 'rsi']); // the bell's recent alerts (follow.ts)
    expect(companyDemo({ ticker: 'INTC' }).alerts).toBeUndefined(); // a company with none carries no field
    expect(CompanyPayload.safeParse(d).success).toBe(true);
    expect(companyDemo({ ticker: 'ZZZ' }).name).toBe('ZZZ Demo Corp.');
  });
  it('is registered: id, samples, and a pt method', () => {
    expect(TYPOLOGY_IDS).toContain('company@1');
    expect(TYPOLOGIES['company@1'].samples.length).toBeGreaterThan(0);
    expect([methodOf('company@1'), typologyOf('company')]).toEqual(['company', 'company@1']);
  });
});

import * as z from 'zod/mini';
import { DEMO_COMPANIES, demoName, Ticker } from './common';

/** The profile of one listed company: what the company card shows that no other typology gives. */
export const CompanyParams = z.object({ ticker: Ticker });
export const CompanyPayload = z.object({
  ticker: Ticker, name: z.string(), sector: z.nullable(z.string()), industry: z.nullable(z.string()),
  /** The site path of its logo (`/logos/<ticker>`), or null. */
  logo: z.nullable(z.string()),
});
export type CompanyParams = z.output<typeof CompanyParams>;
export type CompanyProfile = z.infer<typeof CompanyPayload>;

export const companySamples: z.input<typeof CompanyParams>[] = [{ ticker: 'NVDA' }];

export function companyDemo(p: CompanyParams): CompanyProfile {
  const known = DEMO_COMPANIES.find(([t]) => t === p.ticker);
  return { ticker: p.ticker, name: known?.[1] ?? demoName(p.ticker), sector: 'Technology', industry: 'Semiconductors', logo: null };
}

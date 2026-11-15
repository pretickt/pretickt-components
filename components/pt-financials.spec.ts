import { PtFinancials } from './pt-financials';
import { basics, render, withData } from './_spec';

describe('pt-financials', () => {
  basics(PtFinancials, { ticker: 'NVDA', periods: 8 });
  // the statements' EPS beside the one an earnings report is judged on (often adjusted) read as two figures for one quarter on a company's
  // page — AbbVie: $2.71 in «Next earnings», 1.02 in the table (455 companies on www, 2026-11-15): the column says which it is
  it('the EPS column says it is the statements\' (GAAP)', async () => {
    const { el } = await render(PtFinancials, { ticker: 'NVDA', periods: 8 });
    const heads = [...el.querySelectorAll('th')].map((th) => th.textContent!.replace(/[↕▲▼\s]+$/, '').trim());
    expect(heads).toContain('GAAP EPS');
    expect(heads).not.toContain('EPS');
  });
  // Cameco: «EPS of $0.00 … revenue of $435M» in the earnings sentence, CA$603M in this table (www, 2026-11-15): the note says which is in what
  it('statements in another currency say so, and that an earnings report beside its estimates is in US dollars', async () => {
    const fin = { asOf: '2026-10-02', currency: 'CAD', periodsPerYear: 4, periods: [{ period: '2026-09-30', fiscal: 'Q3 FY2026', revenue: 603e6, eps: 0.1, fcf: -134e6,
      grossMargin: 0.16, operatingMargin: 0.04, netMargin: 0.07, pe: null, shares: 435e6 }] };
    const { el } = await render(PtFinancials, { ticker: 'CCJ', periods: 8 }, withData({ 'fundamentals@1': fin }));
    expect(el.textContent).toContain('Figures in Canadian Dollar (CAD), as reported; an earnings report beside analysts’ estimates is in US dollars.');
    expect((await render(PtFinancials, { ticker: 'NVDA', periods: 8 })).el.textContent).not.toContain('as reported');
  });
});

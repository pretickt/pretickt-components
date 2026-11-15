import { PtInsiders } from './pt-insiders';
import { basics, render, withData } from './_spec';

describe('pt-insiders', () => {
  basics(PtInsiders, { ticker: 'NVDA', days: 365 });
  it('no trade in the window, and no filing on record at all, are two messages (ASML, Shopify on www, 2026-11-15: «No insider transactions in the last 365 days»)', async () => {
    const said = async (o: object) => (await render(PtInsiders, { ticker: 'NVDA', days: 365 }, withData({ 'insider@1': { asOf: '2026-10-02', items: [], ...o } }))).el.querySelector('.pt-na')!.textContent!.trim();
    expect(await said({})).toBe('No insider transactions in the last 365 days.');
    expect(await said({ filed: true })).toBe('No insider transactions in the last 365 days.');
    expect(await said({ filed: false })).toBe('No SEC Form 4 filing by this company’s officers and directors is on record here, so their trades are not known.');
  });
});

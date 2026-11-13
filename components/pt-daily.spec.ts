import { PtDaily } from './pt-daily';
import { describe, expect, it } from 'vitest';
import { basics, render, withData } from './_spec';

const AS_OF = '2026-11-12';
const MOVE = { kind: 'day', date: AS_OF, text: 'Last close (Nov 12): NVDA -4.3% = market (SPY) -0.4% + Technology sector -0.8% + NVDA on its own -3.1%.' };
const TARGET = { kind: 'analysts', date: AS_OF, text: 'Analysts\' mean price target as of Nov 12: $212.40 from 41 firms; last close $188.20.',
  was: 'Analysts\' mean price target as of Nov 11: $220.00 from 40 firms; last close $196.60.' };
const card = (o: object = {}) => ({ session: AS_OF, writtenAt: '2026-11-13T01:10:00Z', message: 'Analysts cut their mean price target for Nvidia on Nov 12',
  body: 'The mean target fell from $220.00 as the stock lost 4.3% in the session.', facts: [TARGET, MOVE], ...o });
const data = (o: object = {}) => withData({ 'daily@1': { asOf: AS_OF, ticker: 'NVDA', name: 'NVIDIA Corporation', card: card(), facts: [], ...o } });
const show = (o: object = {}) => render(PtDaily, { ticker: 'NVDA' }, data(o));

describe('pt-daily', () => {
  basics(PtDaily, { ticker: 'NVDA' });
  it('today\'s card: the company and the date, the message, the body, each cited fact, who wrote it', async () => {
    const r = await show();
    const text = r.text();
    expect(r.el.querySelector('.pt-meta')!.textContent!.trim()).toBe('Nvidia NVDA · Nov 12, 2026');
    expect(r.el.querySelector('.pt-daily-message')!.textContent).toBe('Analysts cut their mean price target for Nvidia on Nov 12');
    expect(r.el.querySelector('.pt-daily-body')!.textContent).toBe('The mean target fell from $220.00 as the stock lost 4.3% in the session.');
    expect(r.el.querySelectorAll('.pt-daily-facts li')).toHaveLength(2);
    expect(text).toContain(MOVE.text);
    expect(r.el.querySelector('.pt-note')!.textContent!.trim()).toBe('Wording by an AI model from pretickt\'s data; the dated facts under it are the platform\'s own. Not investment advice.');
    expect(text).not.toContain('Latest:');
    expect(r.html()).not.toContain('pt-na');
  });
  it('an older card says Latest with its date', async () => {
    const r = await show({ card: card({ session: '2026-11-10' }) });
    expect(r.el.querySelector('.pt-meta')!.textContent!.trim()).toBe('Nvidia NVDA · Latest: Nov 10, 2026');
  });
  it('a changed fact shows what it was', async () => {
    const r = await show();
    const was = [...r.el.querySelectorAll('.pt-daily-was')].map((x) => x.textContent!.trim());
    expect(was).toEqual(['Before: Analysts\' mean price target as of Nov 11: $220.00 from 40 firms; last close $196.60.']);
  });
  it('no card: the day\'s facts under the site\'s date, and no line about AI', async () => {
    const r = await show({ card: null, facts: [MOVE, TARGET] });
    expect(r.el.querySelector('.pt-meta')!.textContent!.trim()).toBe('Nvidia NVDA · Nov 12, 2026');
    expect(r.el.querySelectorAll('.pt-daily-facts li')).toHaveLength(2);
    expect(r.el.querySelector('.pt-daily-was')!.textContent).toContain('Before: ');
    expect(r.el.querySelector('.pt-daily-message')).toBeNull();
    expect(r.text()).not.toContain('AI');
    expect(r.html()).not.toContain('pt-na');
  });
  it('neither: a line that claims nothing about the company — the night did not read it — not an empty section', async () => {
    const r = await show({ card: null, facts: [] });
    expect(r.el.querySelector('.pt-na')!.textContent!.trim()).toBe('No daily summary for Nvidia NVDA on Nov 12, 2026');
    expect(r.text()).not.toContain('Nothing new');
    expect(r.el.querySelector('.pt-daily-facts')).toBeNull();
    expect(r.text()).not.toContain('AI');
  });
  it('a card\'s text is never markup', async () => {
    const r = await show({ card: card({ message: 'A <b>bold</b> & co', body: '<img src=x onerror=alert(1)>', facts: [{ ...MOVE, text: '<i>fact</i>', was: '<u>was</u>' }] }) });
    expect(r.el.querySelector('b, img, i, u')).toBeNull();
    expect(r.el.querySelector('.pt-daily-message')!.textContent).toBe('A <b>bold</b> & co');
    expect(r.text()).toContain('<img src=x onerror=alert(1)>');
    expect(r.text()).toContain('Before: <u>was</u>');
  });
  it('a card without cited facts still stands (an old row): no empty list', async () => {
    const r = await show({ card: card({ facts: [] }) });
    expect(r.el.querySelector('.pt-daily-facts')).toBeNull();
    expect(r.el.querySelector('.pt-daily-message')).not.toBeNull();
  });
  it('asks daily@1 for its ticker', async () => {
    const asked: unknown[] = [];
    await render(PtDaily, { ticker: 'MSFT' }, async (t, p) => { asked.push([t, p]); return withData({})(t, p); });
    expect(asked).toEqual([['daily@1', { ticker: 'MSFT' }]]);
  });
});

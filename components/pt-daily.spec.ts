import { AI_NOTE_BOTH, PtDaily, segments, WATCH_TITLE } from './pt-daily';
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

  describe('1.1: chips, bold and the "What to watch" half (Romeo, 2026-11-14: «Sempre la più vicina e usa badge e grassetto per aiutare la lettura»)', () => {
    const SUP = { kind: 'level-below', date: AS_OF, text: 'Support as of Nov 12: $146.88, 2.1% below the last close; it held 6 times.', chip: { label: 'Support', value: '2.1% below' } };
    const RSI = { kind: 'rsi', date: AS_OF, text: 'RSI (14 days) as of Nov 12: 25, under the 30 line read as oversold.', chip: { label: 'RSI', value: '25' } };
    const half = (o: object = {}) => ({ kind: 'half', session: AS_OF, writtenAt: '2026-11-13T01:20:00Z', message: 'Nvidia closed 2.1% above a support it held 6 times',
      body: 'The support at $146.88 is the nearest level; the stock **turned there 6 times**. RSI stands at 25.', facts: [SUP, RSI], ...o });
    const chips = (el: Element, sel = '.pt-daily-chips') => [...el.querySelectorAll(`${sel} li`)].map((x) => x.textContent!.replace(/\s+/g, ' ').trim());
    it('segments: a well-formed bold, an unpaired mark left as it is, two spans', () => {
      expect(segments('a **b c** d')).toEqual([{ t: 'a ', b: false }, { t: 'b c', b: true }, { t: ' d', b: false }]);
      expect(segments('a ** b')).toEqual([{ t: 'a ** b', b: false }]);
      expect(segments('**x** and **y**')).toEqual([{ t: 'x', b: true }, { t: ' and ', b: false }, { t: 'y', b: true }]);
    });
    it('the body\'s bold is <b>, and a card\'s text is still never markup', async () => {
      const r = await show({ card: card({ body: '<i>x</i> **turned there 6 times**' }) });
      const b = r.el.querySelectorAll('.pt-daily-body b');
      expect(b).toHaveLength(1);
      expect(b[0]!.textContent).toBe('turned there 6 times');
      expect(r.el.querySelector('i')).toBeNull();
      expect(r.el.querySelector('.pt-daily-body')!.textContent).toBe('<i>x</i> turned there 6 times');
    });
    it('chips in a row, lead first, a fact without a chip skipped', async () => {
      const r = await show({ card: card({ facts: [SUP, MOVE, RSI] }) });
      expect(chips(r.el)).toEqual(['Support · 2.1% below', 'RSI · 25']);
    });
    it('a card stored before chips: no chips row and no picture', async () => {
      const r = await show();
      expect(r.el.querySelector('.pt-daily-chips')).toBeNull();
      expect(r.el.querySelector('.pt-daily-visual')).toBeNull();
    });
    it('watch absent: no heading, no "Nothing close", today\'s note', async () => {
      const r = await show();
      expect(r.html()).not.toContain(WATCH_TITLE);
      expect(r.text()).not.toContain('Nothing close');
      expect(r.el.querySelector('.pt-note')!.textContent!.trim()).toBe('Wording by an AI model from pretickt\'s data; the dated facts under it are the platform\'s own. Not investment advice.');
    });
    it('a half under the card, with its heading, bold, chips and the note for both', async () => {
      const r = await show({ watch: half() });
      expect(r.el.querySelector('.pt-daily-half')!.textContent!.trim()).toBe('What to watch');
      const w = r.el.querySelector('.pt-daily-watch')!;
      expect(w.querySelector('.pt-daily-message')!.textContent).toBe('Nvidia closed 2.1% above a support it held 6 times');
      expect(w.querySelector('.pt-daily-body b')!.textContent).toBe('turned there 6 times');
      expect(chips(w)).toEqual(['Support · 2.1% below', 'RSI · 25']);
      expect(w.querySelectorAll('.pt-daily-facts li')).toHaveLength(2);
      const notes = r.el.querySelectorAll('.pt-note');
      expect(notes).toHaveLength(1);
      expect(notes[0]!.textContent!.trim()).toBe(AI_NOTE_BOTH);
      expect(AI_NOTE_BOTH).toBe('Wording by an AI model from pretickt\'s data; the levels, dates and dated facts are the platform\'s own. Not investment advice.');
    });
    it('the platform\'s sentence when no half was written tonight: no AI note for it', async () => {
      const r = await show({ watch: { kind: 'fact', fact: SUP } });
      const w = r.el.querySelector('.pt-daily-watch')!;
      expect(w.querySelector('.pt-daily-line')!.textContent).toBe(SUP.text);
      expect(chips(w)).toEqual(['Support · 2.1% below']);
      expect(w.querySelector('.pt-daily-message')).toBeNull();
      expect(r.el.querySelector('.pt-note')!.textContent!.trim()).toBe('Wording by an AI model from pretickt\'s data; the dated facts under it are the platform\'s own. Not investment advice.');
      const bare = await show({ card: null, facts: [MOVE], watch: { kind: 'fact', fact: SUP } });
      expect(bare.el.querySelector('.pt-note')).toBeNull();
      expect(bare.text()).not.toContain('AI');
    });
    it('nothing close: the line in pt-meta', async () => {
      const line = 'Nothing close as of Nov 12: no level within 5%, no date in the next 10 sessions, RSI between 36 and 64.';
      const r = await show({ watch: { kind: 'nothing', text: line } });
      expect(r.el.querySelector('.pt-daily-watch .pt-meta')!.textContent!.trim()).toBe(line);
      expect(r.el.querySelector('.pt-daily-half')).not.toBeNull();
    });
    it('watch null: no heading', async () => {
      const r = await show({ watch: null });
      expect(r.el.querySelector('.pt-daily-half')).toBeNull();
      expect(r.el.querySelector('.pt-daily-watch')).toBeNull();
    });
  });
});

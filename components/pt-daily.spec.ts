import { AI_NOTE_BOTH, picture, PtDaily, segments, tipOf, WATCH_TITLE, type Pic } from './pt-daily';
import type { DailyVisual } from '@pretickt/components/typologies';
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

  describe('1.1: the pictures, drawn from the platform\'s numbers (spec 2026-11-14 what-to-watch, "Visuals")', () => {
    const of = (p: Pic | null, k: string, c?: string) => (p?.shapes ?? []).filter((x) => x.k === k && (c === undefined || x.c === c)) as any[];
    const ys = (d: string) => [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m) => Number(m[2]));
    const noNaN = (p: Pic | null) => expect(JSON.stringify(p)).not.toMatch(/NaN|Infinity|null,|:null/);
    const closes = Array.from({ length: 11 }, (_, i) => 100 + i);   // 100 … 110
    it('a level beside the closes: the scale holds both, and the level is as far as its percentage', () => {
      const p = picture({ v: 'level', close: 110, level: 99.22, distPct: -9.8, closes })!;
      const line = ys(of(p, 'path')[0].d), dash = of(p, 'dash')[0], dot = of(p, 'dot')[0];
      const top = Math.min(...line, dash.y1), bottom = Math.max(...line, dash.y1);
      expect(top).toBeGreaterThanOrEqual(0); expect(bottom).toBeLessThanOrEqual(40);
      // one linear scale: (level → close) over (lowest close → highest close) is the same in numbers and on screen
      const lowY = Math.max(...line), highY = Math.min(...line);
      expect((dash.y1 - dot.y) / (lowY - highY)).toBeCloseTo((110 - 99.22) / (110 - 100), 1);
      expect(of(p, 'text').map((t) => t.t)).toContain('$99.22');
      noNaN(p);
    });
    it('the 200-day average and a crossed level are drawn the same way', () => {
      expect(of(picture({ v: 'ma200', close: 101, ma200: 100, closes })!, 'dash')).toHaveLength(1);
      expect(of(picture({ v: 'crossed', level: 105, close: 104, closes })!, 'dash')).toHaveLength(1);
    });
    it('the 52-week range: the dot sits at its share of the bar', () => {
      const p = picture({ v: 'range', lo: 80, hi: 120, close: 110 })!;
      const bar = of(p, 'rect', 'track')[0], dot = of(p, 'dot')[0];
      expect((dot.x - bar.x) / bar.w).toBeCloseTo(0.75, 2);
    });
    it('RSI: always 0 to 100, the 30 and 70 lines, gaps break the trail', () => {
      const p = picture({ v: 'rsi', values: [40, null, 35, 28, 25] })!;
      const [g30, g70] = of(p, 'dash');
      expect(g30.y1).toBeCloseTo(40 - 2 - 0.3 * 36, 1); expect(g70.y1).toBeCloseTo(40 - 2 - 0.7 * 36, 1);
      expect(of(p, 'path')[0].d.match(/M/g)).toHaveLength(2);
      expect(of(p, 'dot')[0].y).toBeCloseTo(40 - 2 - 0.25 * 36, 1);
      noNaN(p);
    });
    it('the two averages share one scale; a cross is marked where it happened', () => {
      const p = picture({ v: 'ma', fast: [10, 10.5, 11, 11.5], slow: [11, 11, 11, 11], crossAgo: 1 })!;
      const [f, sl] = of(p, 'path');
      expect(Math.min(...ys(f.d))).toBeLessThan(Math.min(...ys(sl.d)));   // the fast one ends higher
      expect(of(p, 'rule')).toHaveLength(1);
      expect(of(p, 'rule')[0].x1).toBeCloseTo(66, 0);   // the third of four points: 2 + 2 × 96 / 3
      expect(of(picture({ v: 'ma', fast: [10, 11], slow: [11, 11], crossAgo: 0 })!, 'rule')).toHaveLength(1);
      expect(of(picture({ v: 'ma', fast: [10, 11], slow: [11, 12], crossAgo: null })!, 'rule')).toHaveLength(0);
    });
    it('a date: the sessions to it, one in the singular', () => {
      expect(of(picture({ v: 'date', date: '2026-11-19', sessions: 3 }), 'text').map((t) => t.t)).toContain('in 3 sessions');
      expect(of(picture({ v: 'date', date: '2026-11-19', sessions: 1 }), 'text').map((t) => t.t)).toContain('in 1 session');
    });
    it('the move\'s split: widths as the parts\' sizes, the sum labelled as the move', () => {
      const p = picture({ v: 'split', ret: -0.043, market: -0.004, sector: -0.008, specific: -0.031 })!;
      const [m, sec, own] = of(p, 'rect');
      expect(sec.w / m.w).toBeCloseTo(2, 1); expect(own.w / m.w).toBeCloseTo(7.75, 0);   // widths rounded to 0.1 of a 64-unit plot
      expect(own.c).toBe('neg');
      expect(of(p, 'text').map((t) => t.t)).toContain('-4.3%');
    });
    it('a target before and after on one scale; the ratings as two bars on one scale', () => {
      const t = picture({ v: 'target', before: 208.1, after: 212.4 })!;
      const [a, b] = of(t, 'dot');
      expect(b.x).toBeGreaterThan(a.x);
      expect(of(t, 'text').map((x) => x.t)).toEqual(['$208.10', '$212.40']);
      const r = picture({ v: 'ratings', before: { buy: 30, hold: 6, sell: 0 }, after: { buy: 31, hold: 5, sell: 0 } })!;
      const buys = of(r, 'rect', 'buy');
      expect(buys[1].w / buys[0].w).toBeCloseTo(31 / 30, 2);
    });
    it('an event: its day marked on the closes, no mark when the day is not in them', () => {
      const pts = [{ t: '2026-11-11', c: 100 }, { t: '2026-11-12', c: 95 }, { t: '2026-11-13', c: 96 }];
      const p = picture({ v: 'event', date: '2026-11-12', closes: pts })!;
      expect(of(p, 'rule')).toHaveLength(1);
      expect(of(p, 'rule')[0].x1).toBeCloseTo(50, 0);
      expect(of(picture({ v: 'event', date: '2026-11-20', closes: pts })!, 'rule')).toHaveLength(0);
    });
    it('numbers that cannot be drawn honestly give no picture, and none gives NaN', () => {
      expect(picture({ v: 'level', close: 100, level: 98, distPct: -2, closes: [100] })).toBeNull();
      expect(picture({ v: 'range', lo: 100, hi: 100, close: 100 })).toBeNull();
      expect(picture({ v: 'split', ret: 0, market: 0, sector: 0, specific: 0 })).toBeNull();
      expect(picture({ v: 'rsi', values: [null, null] })).toBeNull();
      expect(picture({ v: 'level', close: Number.NaN, level: 98, distPct: -2, closes: [99, 100] })).toBeNull();
      expect(picture({ v: 'ratings', before: { buy: 0, hold: 0, sell: 0 }, after: { buy: 0, hold: 0, sell: 0 } })).toBeNull();
      expect(picture({ v: 'event', date: '2026-11-12', closes: [{ t: '2026-11-12', c: 1 }] })).toBeNull();
      for (const v of [
        { v: 'level', close: 100, level: 100, distPct: 0, closes: [100, 100, 100] },
        { v: 'ma200', close: 100, ma200: 100, closes: [100, 100] },
        { v: 'target', before: 200, after: 200 },
        { v: 'ma', fast: [5, 5], slow: [5, 5], crossAgo: 0 },
      ] as DailyVisual[]) { const p = picture(v); expect(p, v.v).not.toBeNull(); noNaN(p); }
    });
    it('a picture is aria-hidden, sits beside its text, and tips its fact\'s sentence', async () => {
      const SUP = { kind: 'level-below', date: AS_OF, text: 'Support as of Nov 12: $146.88, 2.1% below the last close; it held 6 times.', chip: { label: 'Support', value: '2.1% below' } };
      const r = await show({ card: card({ visual: { v: 'split', ret: -0.043, market: -0.004, sector: -0.008, specific: -0.031 }, visualAt: 1 }),
        watch: { kind: 'fact', fact: SUP, visual: { v: 'level', close: 150, level: 146.88, distPct: -2.1, closes: [149, 152, 150] } } });
      const svgs = r.el.querySelectorAll('svg.pt-daily-visual');
      expect(svgs).toHaveLength(2);
      for (const s of svgs) expect(s.getAttribute('aria-hidden')).toBe('true');
      expect(JSON.parse(svgs[0]!.getAttribute('data-tip')!)).toEqual({ Fact: MOVE.text });   // MOVE has no chip
      expect(JSON.parse(svgs[1]!.getAttribute('data-tip')!)).toEqual({ Support: SUP.text });
      expect(svgs[0]!.closest('.pt-daily-row')).not.toBeNull();
      expect(tipOf([MOVE], undefined)).toBeUndefined();
      expect(tipOf([MOVE], 3)).toBeUndefined();
    });
  });
});

describe('pt-daily 1.1: the final review\'s fixes', () => {
  const of = (p: Pic | null, k: string, c?: string) => (p?.shapes ?? []).filter((x) => x.k === k && (c === undefined || x.c === c)) as any[];
  const AS = '2026-11-12';
  const MOVE = { kind: 'day', date: AS, text: 'Last close (Nov 12): NVDA -4.3% = market (SPY) -0.4% + Technology sector -0.8% + NVDA on its own -3.1%.', chip: { label: 'Nov 12', value: '-4.3%' } };
  const TGT = { kind: 'targets', date: AS, text: 'Price targets published on Nov 12: Demo Bank $200.00.', chip: { label: 'New targets', value: '$200.00' } };
  const show = (o: object) => render(PtDaily, { ticker: 'NVDA' }, withData({ 'daily@1': { asOf: AS, ticker: 'NVDA', name: 'NVIDIA Corporation', facts: [], ...o } }));
  it('a picture\'s tooltip is the site\'s: JSON of its fact\'s label and sentence', async () => {
    const r = await show({ card: { session: AS, writtenAt: 'x', message: 'm', body: 'b', facts: [MOVE], visual: { v: 'split', ret: -0.043, market: -0.004, sector: -0.008, specific: -0.031 }, visualAt: 0 } });
    expect(JSON.parse(r.el.querySelector('svg.pt-daily-visual')!.getAttribute('data-tip')!)).toEqual({ 'Nov 12': MOVE.text });
  });
  it('the platform names the fact it drew: an event drawn from the new targets tips the targets, not the move', async () => {
    const r = await show({ card: { session: AS, writtenAt: 'x', message: 'm', body: 'b', facts: [MOVE, TGT], visual: { v: 'event', date: AS, closes: [{ t: '2026-11-11', c: 1 }, { t: AS, c: 2 }] }, visualAt: 1 } });
    expect(JSON.parse(r.el.querySelector('svg.pt-daily-visual')!.getAttribute('data-tip')!)).toEqual({ 'New targets': TGT.text });
  });
  it('a target\'s change is drawn at its size: 1% sits close, 20% spreads', () => {
    const gap = (before: number, after: number) => { const [a, b] = of(picture({ v: 'target', before, after }), 'dot'); return Math.abs(b.x - a.x) / 96; };
    expect(gap(208.1, 210.2)).toBeLessThan(0.12);
    expect(gap(200, 240)).toBeGreaterThan(0.6);
    expect(gap(240, 200)).toBeGreaterThan(0.6);
  });
  it('the move\'s split is a waterfall from zero: each part starts where the last ended, the total ends at the move, each labelled', () => {
    // PG's day: +1.1% = market -0.4% + sector +1.7% + its own -0.2%
    const p = picture({ v: 'split', ret: 0.011, market: -0.004, sector: 0.017, specific: -0.002 })!;
    const [m, s, own, total] = of(p, 'rect');
    const zero = of(p, 'rule', 'zero')[0].x1;
    expect(m.x + m.w).toBeCloseTo(zero, 0);                  // the market fell: its bar ends at zero
    expect(s.x).toBeCloseTo(m.x, 0);                         // the sector starts where the market ended
    expect(own.x).toBeCloseTo(s.x + s.w - own.w, 0);         // its own part falls back from the sector's end
    expect(total.x).toBeCloseTo(zero, 0);
    expect(total.x + total.w).toBeCloseTo(own.x, 0);         // the total ends where the own part ended: the move
    expect(own.c).toBe('neg');
    expect(total.c).toBe('total');
    expect(of(p, 'text').map((t) => t.t)).toEqual(['-0.4%', '+1.7%', '-0.2%', '+1.1%']);
  });
});

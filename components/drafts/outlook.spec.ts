import { render } from '../_spec';
import { CPI, FED, MSFT, OCTOBER, UPS, V_TONIGHT, WEEK } from './outlook-mock';
import { agendaSentence, card, cue, dayHeading, priceRange, PtCalOutlook, rangeText, record, usualMove, verdictOf, when, type CoEvent } from './pt-cal-outlook';

describe('pt-cal-outlook (draft): the earnings calendar with each event\'s possible outcome', () => {
  it('the usual move is the mean size of the last eight reactions, and needs four', () => {
    expect(usualMove([0.042, -0.061, 0.018, 0.075, -0.039, 0.045, 0.083, -0.012])).toBeCloseTo(0.046875, 9);
    expect(usualMove([0.5, 0.5, 0.042, -0.061, 0.018, 0.075, -0.039, 0.045, 0.083, -0.012])).toBeCloseTo(0.046875, 9);
    expect(usualMove([0.05, -0.05, 0.05])).toBeNull();
  });

  it('EPS against the estimate: beyond 2% a beat or a miss, in line within it (a loss estimate too)', () => {
    expect([verdictOf(1.71, 1.64), verdictOf(0.92, 0.91), verdictOf(1.29, 1.33), verdictOf(-0.12, -0.2), verdictOf(null, 1)])
      .toEqual(['beat', 'inline', 'miss', 'beat', null]);
    expect(record(MSFT.reactions)).toEqual({ n: 8, known: 8, beats: 7, ups: 5 });
  });

  it('before a report, one number in the row: the usual move, in dollars, the record, or the price range', () => {
    expect(cue(MSFT, 'move')).toEqual({ text: '±4.7%', tone: 'est' });
    expect(cue(MSFT, 'dollars')).toEqual({ text: '±$182B', tone: 'est' });
    expect(cue(MSFT, 'record')).toEqual({ text: '7/8 beat', tone: 'est' });
    expect(cue(MSFT, 'range')).toEqual({ text: '$498–547', tone: 'est' });
    expect(rangeText(priceRange(41.2, 0.031)!)).toBe('$39.9–42.5');
    const young = { ...MSFT, reactions: MSFT.reactions.slice(-3) };
    expect((['move', 'dollars', 'record', 'range'] as const).map((v) => cue(young, v).text)).toEqual(['', '', '', '']);
  });

  it('after it, what happened: a beat can still fall; tonight\'s report shows its verdict but no move yet', () => {
    expect(cue(UPS, 'move')).toEqual({ text: '-6.8%', tone: 'neg' });
    expect(cue(UPS, 'dollars')).toEqual({ text: '-$7.62B', tone: 'neg' });
    expect(cue(UPS, 'record')).toEqual({ text: 'Beat', tone: 'pos' });
    expect(cue(UPS, 'range')).toEqual({ text: '-6.8%', tone: 'neg' });
    expect(cue(V_TONIGHT, 'record')).toEqual({ text: 'Beat', tone: 'pos' });
    expect(cue(V_TONIGHT, 'move').text).toMatch(/^±\d/);
  });

  it('a macro date carries the market\'s usual move on its releases, then the market\'s move that session', () => {
    expect(cue(FED, 'dollars')).toEqual({ text: '±1.2%', tone: 'est' });
    expect(cue(CPI, 'move')).toEqual({ text: '-1.2%', tone: 'neg' });
  });

  it('the card: before a report, its usual move, the value and range it spans, the record, the bar and the run into it', () => {
    const c = card(MSFT, OCTOBER.normal);
    expect([c.big, c.says]).toEqual(['±4.7%', 'its usual move the session after a report (average of the last 8)']);
    expect(c.lines).toEqual(['≈ ±$182B of market value · $498–547 from $522', 'Beat the EPS estimate 7 of 8 times · the stock rose after 5 of 8']);
    expect(c.facts).toEqual([['The bar', 'EPS est. $3.68, +12% on a year ago · revenue est. $77.4B, +18% on a year ago'],
      ['Into it', '+6.2% in the last 20 sessions; the market +1.8%']]);
    expect(c.bars.bars).toHaveLength(8);
  });

  it('the card after a report: the move against the usual one, the figures, this reaction drawn last', () => {
    const c = card(UPS, OCTOBER.normal);
    expect([c.big, c.tone, c.says]).toEqual(['-6.8%', 'neg', 'the session after the report, 1.2× its usual ±5.8%']);
    expect(c.lines[0]).toBe('EPS $1.71 vs $1.64 expected: a beat (+4%) · revenue $22.4B vs $22.1B');
    expect(c.facts).toEqual([]);
    expect(c.bars.bars.map((b) => b.now)).toEqual([false, false, false, false, false, false, false, false, true]);
    const v = card(V_TONIGHT, OCTOBER.normal);
    expect(v.big).toMatch(/^±/);
    expect(card({ ...MSFT, reactions: MSFT.reactions.slice(-3) }, null).says).toBe('Not enough reports yet for a usual move (3 of the 4 it takes).');
  });

  it('the card of a macro date: the market against a normal day, the consensus, then the actual figure', () => {
    const f = card(FED, OCTOBER.normal);
    expect([f.big, f.says, f.lines, f.facts]).toEqual(['±1.2%', 'the market’s (SPY) usual move on its last 8 releases', ['1.8× a normal day (±0.7%)'],
      [['Expected', '3.50% · previous 3.75%']]]);
    const c = card(CPI, OCTOBER.normal);
    expect([c.big, c.says, c.facts]).toEqual(['-1.2%', 'the market (SPY) that session, 1.8× a normal day', [['Actual', '2.9% vs 2.8% expected · previous 2.9%']]]);
  });

  it('the card says which session trades the report, instead of BMO/AMC: the same one before the open, the next weekday after the close', () => {
    expect(when(MSFT)).toBe('Reports Wed, Oct 28 (confirmed), after the close · the stock reacts Thu, Oct 29');
    expect(when({ ...MSFT, date: '2026-10-30' })).toBe('Reports Fri, Oct 30 (confirmed), after the close · the stock reacts Mon, Nov 2');
    expect(when({ ...MSFT, date: '2026-10-29', time: 'bmo' })).toBe('Reports Thu, Oct 29 (confirmed), before the open · the stock reacts the same day');
    expect(when(UPS)).toBe('Reported Tue, Oct 27, before the open · the stock reacted the same day');
    expect(when(V_TONIGHT)).toBe('Reported Tue, Oct 27, after the close · the stock reacts Wed, Oct 28');
    expect(when({ ...MSFT, confirmed: false })).toBe('Expected around Wed, Oct 28, after the close (date not confirmed)');
    expect(when({ ...MSFT, time: null })).toBe('Reports Wed, Oct 28 (confirmed)');
    expect(when({ ...MSFT, time: null, confirmed: null })).toBe('Reports Wed, Oct 28');
  });

  it('what others expect, before a report: the analysts\' target and its last 30 days, how peers reacted this season, Polymarket\'s odds', () => {
    expect(card(MSFT, OCTOBER.normal).expect).toEqual([
      ['Analysts', 'Analysts’ average target is $625, 20% above the price (52 analysts); 9 raised it and 1 cut it in the last 30 days.'],
      ['Peers', '2 of 4 peers rose after reporting this season, moving ±5.6% on average: NOW +8.1%, META -5.8%, IBM -5.4%.'],
      ['Polymarket', '83% chance of EPS above the estimate: the price of a share that pays $1 if it happens ($12K traded).'],
    ]);
    const googl = OCTOBER.items.find((e): e is CoEvent => e.kind === 'earnings' && e.ticker === 'GOOGL')!;
    expect(card(googl, OCTOBER.normal).expect.find((f) => f[0] === 'Peers')![1])
      .toBe('0 of 3 peers rose after reporting this season, moving ±4.5% on average: META -5.8%, NFLX -5.2%, VZ -2.4%.');
    expect(card(FED, OCTOBER.normal).expect).toEqual([['Polymarket', '94% chance of a 0.25-point cut: the price of a share that pays $1 if it happens ($5.2M traded).']]);
  });

  it('what others expect needs enough of it, and stops once the report is out', () => {
    const thin = { ...MSFT, analysts: { target: 600, n: 2, raised: 0, cut: 0 }, peers: MSFT.peers.slice(0, 1), odds: { what: 'EPS above the estimate', p: 0.8, volume: 4_000 } };
    expect(card(thin, null).expect).toEqual([]);
    expect(card({ ...MSFT, analysts: { target: 500, n: 12, raised: 0, cut: 0 }, peers: [], odds: null }, null).expect)
      .toEqual([['Analysts', 'Analysts’ average target is $500, 4% below the price (12 analysts); none changed it in the last 30 days.']]);
    expect(card(UPS, OCTOBER.normal).expect).toEqual([]);
    expect(card(V_TONIGHT, OCTOBER.normal).expect).toEqual([]);
    expect(card(CPI, OCTOBER.normal).expect).toEqual([]);
  });

  it('the week: five sessions, a number in each row, the macro dates, every event in the agenda; hovering opens the card', async () => {
    const { f, el, text } = await render(PtCalOutlook, { data: WEEK, view: 'week' });
    expect(el.querySelectorAll('.pt-cal-dow')).toHaveLength(5);
    const msft = el.querySelector<HTMLElement>('.do-grid a[href="/stocks/msft/"]')!;
    expect(msft.textContent).toContain('±4.7%');
    expect(msft.textContent).not.toMatch(/amc|bmo/i);
    const summary = [...el.querySelectorAll('.do-agenda summary')].find((s) => s.textContent!.includes('Microsoft'))!;
    expect(summary.textContent).not.toMatch(/after the close|before the open/);
    expect(el.querySelector('.do-grid .pt-cal-macro')!.textContent).toContain('±1.2%');
    expect(el.querySelector('.pt-cal-asof')!.textContent).toContain('UPS');
    expect(el.querySelectorAll('.do-agenda details')).toHaveLength(WEEK.items.length);
    expect(el.querySelector('.do-pop')).toBeNull();
    msft.dispatchEvent(new Event('pointerenter'));
    f.detectChanges();
    expect(el.querySelector('.do-pop')!.textContent).toContain('its usual move the session after a report');
    expect(el.querySelector('.do-pop')!.textContent).toContain('What others expect');
    expect(el.querySelector('.do-pop .do-sub + .do-facts')!.textContent).toContain('83% chance of EPS above the estimate');
    msft.dispatchEvent(new Event('pointerleave'));
    f.detectChanges();
    expect(el.querySelector('.do-pop')).toBeNull();
    expect(text()).toContain('How big, not which way');
  });

  it('the month: its grid, the outcomes behind and the outlook ahead, a full day folded; the variant changes only the number', async () => {
    const { el } = await render(PtCalOutlook, { data: OCTOBER, variant: 'dollars' });
    expect(el.querySelectorAll('.pt-cal-day')).toHaveLength(35);
    expect(el.querySelector('.do-grid a[href="/stocks/msft/"]')!.textContent).toContain('±$182B');
    expect(el.querySelector('.do-grid a[href="/stocks/ups/"] .pt-t-neg')!.textContent).toBe('-$7.62B');
    expect(el.querySelector('.pt-cal-asof .pt-cal-more')!.textContent).toContain('+1 more');
  });

  it('every agenda row in a sentence: the date, confirmed or not, the session that reacts, the usual move; after it, the figures and the move', () => {
    expect(agendaSentence(MSFT, OCTOBER.normal)).toBe('Microsoft MSFT reports Wed, Oct 28 (confirmed), after the close; the stock reacts Thu, Oct 29. ' +
      'In the session after its last 8 reports it moved ±4.7% on average.');
    expect(agendaSentence(UPS, OCTOBER.normal)).toBe('UPS reported Tue, Oct 27, before the open: EPS $1.71 vs $1.64 expected, a beat (+4%). ' +
      'The stock moved -6.8% in the session that traded it, 1.2× its usual ±5.8%.');
    expect(agendaSentence(V_TONIGHT, OCTOBER.normal)).toMatch(/^Visa V reported Tue, Oct 27, after the close: EPS \$[\d.]+ vs \$[\d.]+ expected, [^;]+; the stock reacts Wed, Oct 28\. Its usual move after a report: ±\d+\.\d%\.$/);
    const cvx = OCTOBER.items.find((e): e is CoEvent => e.kind === 'earnings' && e.ticker === 'CVX')!;
    expect(agendaSentence(cvx, OCTOBER.normal)).toMatch(/^Chevron CVX is expected to report around Fri, Oct 30 \(date not confirmed\), before the open\. In the session after its last 8 reports it moved ±\d+\.\d% on average\.$/);
    expect(agendaSentence(FED, OCTOBER.normal)).toBe('Fed Interest Rate Decision is due Wed, Oct 28 (expected 3.50%, previous 3.75%). ' +
      'On its last 8 releases the market (SPY) moved ±1.2% on average, 1.8× a normal day.');
    expect(agendaSentence(CPI, OCTOBER.normal)).toBe('Inflation Rate YoY (Sep), released Wed, Oct 14: 2.9% vs 2.8% expected; the market (SPY) moved -1.2% that session.');
  });

  it('the agenda\'s days in the words people search: earnings today and tomorrow, for the session the page is read in, always with the date', () => {
    expect(dayHeading('2026-10-28', 3, '2026-10-27')).toBe('Earnings today · Wed, Oct 28');
    expect(dayHeading('2026-10-29', 5, '2026-10-27')).toBe('Earnings tomorrow · Thu, Oct 29');
    expect(dayHeading('2026-10-27', 4, '2026-10-27')).toBe('Tue, Oct 27');
    expect(dayHeading('2026-10-28', 0, '2026-10-27')).toBe('Today · Wed, Oct 28');
    expect(dayHeading('2026-11-02', 1, '2026-10-30')).toBe('Earnings today · Mon, Nov 2');
  });

  it('in the page: the week titled as searched, each row\'s sentence and a link that says where it goes; an unconfirmed date dotted in the grid', async () => {
    const { el, text } = await render(PtCalOutlook, { data: WEEK, view: 'week' });
    expect(el.querySelector('.pt-section-title')!.textContent).toBe('Earnings calendar this week · Oct 26–Oct 30, 2026');
    expect([...el.querySelectorAll('.do-agenda-day')].map((h) => h.textContent)).toEqual(expect.arrayContaining(['Earnings today · Wed, Oct 28', 'Earnings tomorrow · Thu, Oct 29']));
    expect(text()).toContain(agendaSentence(MSFT, WEEK.normal));
    expect(el.querySelector('.do-agenda a[href="/stocks/msft/"]')!.textContent).toBe('Microsoft earnings date\u00a0→');
    const cvx = el.querySelector('.do-grid a[href="/stocks/cvx/"]')!;
    expect(cvx.classList).toContain('do-unconf');
    expect(cvx.textContent).toContain('(date not confirmed)');
  });

  it('not available', async () => {
    const { el } = await render(PtCalOutlook, { data: null });
    expect(el.querySelector('.pt-na')).not.toBeNull();
  });
});

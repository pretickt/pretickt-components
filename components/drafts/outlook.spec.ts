import { render } from '../_spec';
import { CPI, FED, MSFT, OCTOBER, UPS, V_TONIGHT, WEEK } from './outlook-mock';
import { card, cue, priceRange, PtCalOutlook, rangeText, record, usualMove, verdictOf } from './pt-cal-outlook';

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
    expect(v.lines).toContain('Not traded yet: the stock trades on it at the next session.');
    expect(card({ ...MSFT, reactions: MSFT.reactions.slice(-3) }, null).says).toBe('Not enough reports yet for a usual move (3 of the 4 it takes).');
  });

  it('the card of a macro date: the market against a normal day, the consensus, then the actual figure', () => {
    const f = card(FED, OCTOBER.normal);
    expect([f.big, f.says, f.lines, f.facts]).toEqual(['±1.2%', 'the market’s (SPY) usual move on its last 8 releases', ['1.8× a normal day (±0.7%)'],
      [['Expected', '3.50% · previous 3.75%']]]);
    const c = card(CPI, OCTOBER.normal);
    expect([c.big, c.says, c.facts]).toEqual(['-1.2%', 'the market (SPY) that session, 1.8× a normal day', [['Actual', '2.9% vs 2.8% expected · previous 2.9%']]]);
  });

  it('the week: five sessions, a number in each row, the macro dates, every event in the agenda; hovering opens the card', async () => {
    const { f, el, text } = await render(PtCalOutlook, { data: WEEK, view: 'week' });
    expect(el.querySelectorAll('.pt-cal-dow')).toHaveLength(5);
    const msft = el.querySelector<HTMLElement>('.do-grid a[href="/stocks/msft/"]')!;
    expect(msft.textContent).toContain('±4.7%');
    expect(el.querySelector('.do-grid .pt-cal-macro')!.textContent).toContain('±1.2%');
    expect(el.querySelector('.pt-cal-asof')!.textContent).toContain('UPS');
    expect(el.querySelectorAll('.do-agenda details')).toHaveLength(WEEK.items.length);
    expect(el.querySelector('.do-pop')).toBeNull();
    msft.dispatchEvent(new Event('pointerenter'));
    f.detectChanges();
    expect(el.querySelector('.do-pop')!.textContent).toContain('its usual move the session after a report');
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

  it('not available', async () => {
    const { el } = await render(PtCalOutlook, { data: null });
    expect(el.querySelector('.pt-na')).not.toBeNull();
  });
});

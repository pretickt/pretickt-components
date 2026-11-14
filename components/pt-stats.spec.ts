import { statsDemo, type Stats } from '../src/typologies';
import { PtStats } from './pt-stats';
import { basics, render, withData } from './_spec';

const base = (o: Partial<Stats> = {}): Stats => ({ ...statsDemo({ ticker: 'NVDA' }), ...o });
const view = async (s: Stats) => {
  const r = await render(PtStats, { ticker: 'NVDA' }, withData({ 'stats@1': s }));
  return { ...r, words: r.el.textContent!.replace(/\s+/g, ' ') };
};

describe('pt-stats', () => {
  basics(PtStats, { ticker: 'NVDA' });

  it('four rows, each a question people search, with the company\'s common name', async () => {
    const { el } = await view(base());
    expect([...el.querySelectorAll('h3')].map((h) => h.textContent!.trim())).toEqual([
      'How much does Nvidia stock move?', 'Nvidia stock performance by year', 'Falls and rises of 30% or more', 'Will Nvidia stock go up?']);
  });

  it('how much it moves: a typical day beside SPY\'s, big days a year, beta, a typical month', async () => {
    const { words } = await view(base());
    expect(words).toContain('±2.1%');
    expect(words).toContain('S&P 500 ±0.6%');
    expect(words).toContain('38');
    expect(words).toContain('2.2×');
    expect(words).toContain('±20%');
  });

  it('beta without two years beside the market: a dash and why', async () => {
    const { words } = await view(base({ beta: null }));
    expect(words).toContain('—');
    expect(words).toContain('under two years of prices');
  });

  it('year by year: one bar per year, the last "so far", the totals in a sentence', async () => {
    const s = base(), { el, words } = await view(s);
    expect(el.querySelectorAll('.pt-stats-ybar')).toHaveLength(s.years.length);
    expect(el.querySelectorAll('.pt-stats-ytick')).toHaveLength(s.years.length);
    expect(words).toContain(`${s.years.at(-1)!.year} so far`);
    expect(words).toMatch(/In the last five years: Nvidia [+−-][\d.]+%, S&P 500 \+73\.0%\./);
  });

  it('falls and rises side by side: both cards with their counts, the threshold in the legend', async () => {
    const { el, words } = await view(base());
    const cards = [...el.querySelectorAll('.pt-stats-twin > div')];
    expect(cards.map((c) => c.querySelector('h4')!.textContent!.trim())).toEqual(['Falls of 30% or more', 'Rises of 30% or more']);
    expect(cards.map((c) => c.querySelector('dd')!.textContent!.trim())).toEqual(['3', '3']);
    expect(words).toContain('3 falls of 30% or more in the last five years, and 3 rises of 30% or more.');
    expect(el.querySelectorAll('.pt-stats-fall')).toHaveLength(3);
    expect(el.querySelectorAll('.pt-stats-rise')).toHaveLength(3);
  });

  it('no swing beyond the threshold: both cards say none, never one side alone', async () => {
    const { el, words } = await view(base({ swings: [] }));
    expect(el.querySelectorAll('.pt-stats-twin > div')).toHaveLength(2);
    expect(words).toContain('No fall of 30% or more');
    expect(words).toContain('No rise of 30% or more');
  });

  it('a shorter history says since when, not "the last five years", and its highest close since then', async () => {
    const { words, el } = await view(base({ fullWindow: false, since: '2023-06-01' }));
    expect(words).not.toContain('last five years');
    expect(words).not.toContain('5-year high');
    expect(words).toContain('Since Jun 1, 2023');
    expect(words).toContain('its highest close since Jun 1, 2023');
    expect(el.querySelector('.pt-stats-swing')!.getAttribute('aria-label')).toBe('Nvidia since Jun 1, 2023, with each fall and rise of 30% or more');
  });

  it('copy that holds as a fact: beta on average, a calm stock\'s big days "fewer than 1", the typical month without a made-up frequency', async () => {
    const { words, el } = await view(base({ bigDaysPerYear: 0.4 }));
    expect(words).toContain('Nvidia moved 2.2% on average');
    expect(el.querySelectorAll('.pt-stats-tile')[1]!.querySelector('.pt-stats-k')!.textContent!.trim()).toBe('fewer than 1');
    expect(words).not.toContain('8 months in 10');
    expect(words).toContain('Half the spread of its middle 80% of one-month moves');
    expect(el.querySelector('.pt-stats-swing')!.getAttribute('aria-label')).toBe('Nvidia in the last five years, with each fall and rise of 30% or more');
    expect(words).toContain('never under 10%');
  });

  it('how often it goes up: a square a month for the stock and SPY, the count in a sentence, no forecast', async () => {
    const s = base(), { el, words } = await view(s);
    const up = s.months.filter((m) => m.change > 0).length;
    expect(el.querySelectorAll('.pt-stats-units')[0]!.querySelectorAll('i')).toHaveLength(s.months.length);
    expect(el.querySelectorAll('.pt-stats-units')[1]!.querySelectorAll('i')).toHaveLength(s.spy!.months.length);
    expect(words).toContain(`closed a month higher ${up} times out of ${s.months.length}`);
    expect(words).toContain('pretickt does not forecast its direction');
  });

  it('without SPY\'s figures the comparisons go, the rows stay', async () => {
    const { el, words } = await view(base({ spy: null }));
    expect(el.querySelectorAll('h3')).toHaveLength(4);
    expect(words).not.toContain('S&P 500 ±');
    expect(el.querySelectorAll('.pt-stats-ytick')).toHaveLength(0);
  });

  it('tones only through classes: no colour written in a style', async () => {
    const { html } = await view(base());
    expect(html()).not.toMatch(/style="[^"]*(color|fill|stroke)/);
  });
});

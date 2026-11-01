import type { Screen, ScreenRow } from '../src/typologies';
import { saidText } from '../src/ds/format';
import { buildMap, mapSentence, megaCaps, PtLogoMap, sectorLabel, squarify, stepOf } from './pt-logo-map';
import { basics, render, withData } from './_spec';

const row = (ticker: string, sector: string, marketCap: number, chg1d: number | null, logo: string | null = null): ScreenRow => ({
  ticker, name: `${ticker} Inc.`, sector, logo, close: 100, chg1d, offHigh: -0.1, pe: 20, ptUpside: 0.1, marketCap, insiderNet: 0, volumeRatio: 1,
  spark: [], self: false });
const rows = [row('AAA', 'Technology', 4e12, 0.031, '/logos/aaa.png'), row('BBB', 'Technology', 2e12, -0.004), row('CCC', 'Financial Services', 1e12, -0.03),
  row('DDD', 'Healthcare', 6e11, 0.001), row('EEE', 'Financial Services', 4e11, 0.012)];

describe('squarify', () => {
  it('fills the box: each tile\'s area in proportion to its value, all inside, none overlapping', () => {
    const out = squarify([{ value: 6 }, { value: 3 }, { value: 2 }, { value: 1 }], { x: 0, y: 0, w: 120, h: 60 });
    expect(out.reduce((s, t) => s + t.w * t.h, 0)).toBeCloseTo(7200, 6);
    out.forEach((t, i) => expect(t.w * t.h).toBeCloseTo([3600, 1800, 1200, 600][i]!, 6));
    for (const t of out) { expect(t.x).toBeGreaterThanOrEqual(-1e-9); expect(t.y).toBeGreaterThanOrEqual(-1e-9); expect(t.x + t.w).toBeLessThanOrEqual(120 + 1e-9); expect(t.y + t.h).toBeLessThanOrEqual(60 + 1e-9); }
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      expect(a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9).toBe(true);
    }
  });
  it('nothing to lay out: no tiles', () => {
    expect(squarify([], { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
    expect(squarify([{ value: 0 }], { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
  });
});

describe('the map', () => {
  it('a day\'s move in five steps: flat within ±0.25%', () => {
    expect([0.03, 0.01, 0.001, -0.001, -0.01, -0.03, null].map(stepOf)).toEqual(['up2', 'up1', 'flat', 'flat', 'dn1', 'dn2', 'na']);
  });
  it('a block per sector, the largest first, with its market-value-weighted move; companies inside their sector\'s block', () => {
    const { blocks, tiles } = buildMap(rows, 1000, 560);
    expect(blocks.map((b) => b.sector)).toEqual(['Technology', 'Financial Services', 'Healthcare']);
    expect(blocks[0]!.move).toBeCloseTo((4 * 0.031 + 2 * -0.004) / 6, 9);
    for (const t of tiles) {
      const b = blocks.find((x) => x.sector === t.sector)!;
      expect(t.x).toBeGreaterThanOrEqual(b.x - 0.1);
      expect(t.y).toBeGreaterThanOrEqual(b.y + (b.head ? 18 : 0) - 0.1);
      expect(t.x + t.w).toBeLessThanOrEqual(b.x + b.w + 0.2);
    }
    expect(tiles.find((t) => t.ticker === 'AAA')).toMatchObject({ logo: '/logos/aaa.png', step: 'up2' });
  });
  it('a sector\'s name over its block only where it fits: with its move, shorter, bare, or none', () => {
    expect(sectorLabel('Financial Services', -0.018, 300)).toBe('FINANCIAL SERVICES -1.8%');
    expect(sectorLabel('Financial Services', -0.018, 120)).toBe('FINANCIALS -1.8%');
    expect(sectorLabel('Financial Services', -0.018, 80)).toBe('FINANCIALS');
    expect(sectorLabel('Financial Services', -0.018, 40)).toBeNull();
  });
  it('says the day in a dated sentence: the sectors that rose, the companies, the three largest, the biggest moves', () => {
    expect(saidText(mapSentence(rows, buildMap(rows, 1000, 560).blocks, '2026-10-23'))).toBe('As of Oct 23, 2026: 2 of 3 sectors rose, and 3 of the 5 largest companies. '
      + 'The three largest, AAA, BBB and CCC, moved +3.1%, -0.4% and -3.0%; the biggest moves were AAA +3.1% and CCC -3.0%.');
    const named = [{ ...rows[0]!, ticker: 'NVDA', name: 'NVIDIA Corporation' }, { ...rows[1]!, ticker: 'AAPL', name: 'Apple Inc.' }];
    expect(saidText(mapSentence(named, buildMap(named, 1000, 560).blocks, '2026-10-23'))).toBe('As of Oct 23, 2026: Technology moved +1.9%, and 1 of its 2 largest companies rose. '
      + 'The two largest, Nvidia NVDA and Apple AAPL, moved +3.1% and -0.4%; the biggest moves were Nvidia NVDA +3.1% and Apple AAPL -0.4%.');
  });
  it('mega caps: the companies worth $200 billion or more, named so in the sentence (Romeo, 2026-11-01)', () => {
    expect(megaCaps([...rows, row('FFF', 'Energy', 1.99e11, 0.01)]).map((r) => r.ticker)).toEqual(['AAA', 'BBB', 'CCC', 'DDD', 'EEE']);
    expect(saidText(mapSentence(rows, buildMap(rows, 1000, 560).blocks, '2026-10-23', 'mega'))).toBe('As of Oct 23, 2026: 2 of 3 sectors rose, and 3 of the 5 '
      + 'companies worth $200 billion or more. The three largest, AAA, BBB and CCC, moved +3.1%, -0.4% and -3.0%; the biggest moves were AAA +3.1% and CCC -3.0%.');
  });
});

describe('pt-logo-map', () => {
  basics(PtLogoMap, {});
  const view = (s: Screen | null) => render(PtLogoMap, {}, withData({ 'screen@1': s }));

  it('every company a link to its page with its numbers as tooltip rows, in a wide and a phone map', async () => {
    const r = await view({ asOf: '2026-10-23', rows });
    const wide = r.el.querySelector('svg.pt-lm-wide')!;
    expect([...wide.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/stocks/aaa/', '/stocks/bbb/', '/stocks/ccc/', '/stocks/eee/', '/stocks/ddd/']);
    expect(JSON.parse(wide.querySelector('a')!.getAttribute('data-tip')!)).toEqual({ AAA: 'AAA', Today: '+3.1%', 'Market value': '$4T' });
    expect(wide.querySelector('a')!.getAttribute('aria-label')).toBe('AAA, +3.1% today');
    expect(r.el.querySelector('svg.pt-lm-narrow')).toBeTruthy();
    expect(r.text()).toContain('size = market value · as of Oct 23, 2026');
    expect(wide.getAttribute('aria-label')).toBe('Stock market heat map: the 5 largest companies by sector, Oct 23, 2026');
    // the sentence names the companies as links with their logos: the card on hover, as on the tiles
    const said = [...r.el.querySelectorAll('.pt-lede a.pt-mention')];
    expect(said.map((a) => a.getAttribute('href'))).toEqual(['/stocks/aaa/', '/stocks/bbb/', '/stocks/ccc/', '/stocks/aaa/', '/stocks/ccc/']);
    expect(r.text()).toContain('Each tile is a company, sized by its market value and colored by the day’s move, grouped by sector.');
    expect(r.el.querySelector('.pt-lede')!.textContent).toMatch(/^As of Oct 23, 2026: /);
  });
  it('asks for the largest companies, of one sector when it is given', async () => {
    const all = await render(PtLogoMap, {});
    expect(Object.keys(all.record)).toEqual(['screen@1|{"limit":100,"scope":{"list":"largest"}}']);
    const tech = await render(PtLogoMap, { sector: 'Technology' });
    expect(Object.keys(tech.record)).toEqual(['screen@1|{"limit":100,"scope":{"list":"largest","sector":"Technology"}}']);
  });
  it('mega caps: the same map of the companies worth $200 billion or more, from the same list (Romeo, 2026-11-01)', async () => {
    const r = await render(PtLogoMap, { lens: 'mega' }, withData({ 'screen@1': { asOf: '2026-10-23', rows: [...rows, row('FFF', 'Energy', 1.99e11, 0.01)] } }));
    const wide = r.el.querySelector('svg.pt-lm-wide')!;
    expect([...wide.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/stocks/aaa/', '/stocks/bbb/', '/stocks/ccc/', '/stocks/eee/', '/stocks/ddd/']);
    expect(wide.getAttribute('aria-label')).toBe('Mega-cap stocks heat map: the 5 companies worth $200 billion or more, by sector, Oct 23, 2026');
    expect(r.el.querySelector('.pt-lede')!.textContent).toContain('3 of the 5 companies worth $200 billion or more.');
    expect(Object.keys((await render(PtLogoMap, { lens: 'mega' })).record)).toEqual(['screen@1|{"limit":100,"scope":{"list":"largest"}}']);
  });
  it('card: one landscape map of the 20 largest and its sentence, no legend — a card in a strip of sectors (Romeo, 2026-11-01)', async () => {
    const many = Array.from({ length: 30 }, (_, i) => row(`T${String(i).padStart(2, '0')}`, 'Technology', (30 - i) * 1e11, 0.01));
    const r = await render(PtLogoMap, { sector: 'Technology', form: 'card' }, withData({ 'screen@1': { asOf: '2026-10-23', rows: many } }));
    const svgs = [...r.el.querySelectorAll('svg.pt-lm-svg')];
    expect(svgs.map((x) => x.classList.contains('pt-lm-card'))).toEqual([true]);
    expect(svgs[0]!.getAttribute('viewBox')).toBe('0 0 360 270');
    // the map first, its sentence under it: in a strip every card's map starts level, whatever its sentence's length
    expect([...r.el.querySelector('figure.pt-lm')!.children].map((c) => c.tagName.toLowerCase())).toEqual(['svg', 'p']);
    expect(svgs[0]!.querySelectorAll('a')).toHaveLength(20);
    expect(r.el.querySelector('.pt-lede')!.textContent).toMatch(/^As of Oct 23, 2026: Technology moved/);
    expect(r.el.querySelector('.pt-lm-legend')).toBeNull();
  });
  it('news: tiles sized by the day\'s stories and colored by its move, without asking for the market\'s list (Romeo, 2026-11-01)', async () => {
    const att = { asOf: '2026-10-23', lens: 'news', rows: [
      { ticker: 'AAA', name: 'AAA Inc.', sector: 'Technology', logo: null, count: 46, usual: 9.2, chg1d: -0.286, marketCap: 2e11 },
      { ticker: 'BBB', name: 'BBB Inc.', sector: 'Technology', logo: null, count: 30, usual: 30, chg1d: 0.01, marketCap: 4e12 },
      { ticker: 'CCC', name: 'CCC Inc.', sector: 'Energy', logo: null, count: 12, usual: null, chg1d: null, marketCap: 1e11 }] };
    const r = await render(PtLogoMap, { lens: 'news' }, withData({ 'attention@1': att }));
    expect(Object.keys(r.record)).toEqual(['attention@1|{"lens":"news","limit":40}']);
    const wide = r.el.querySelector('svg.pt-lm-wide')!;
    expect(wide.getAttribute('aria-label')).toBe('News heat map: the 3 companies with the most news stories on Oct 23, 2026, by sector');
    const tile = (t: string) => wide.querySelector(`a[href="/stocks/${t}/"] rect`)!;
    const area = (t: string) => Number(tile(t).getAttribute('width')) * Number(tile(t).getAttribute('height'));
    expect(area('aaa')).toBeGreaterThan(area('bbb'));   // the most covered is the largest tile, whatever its market value
    expect(JSON.parse(wide.querySelector('a[href="/stocks/aaa/"]')!.getAttribute('data-tip')!)).toEqual({ AAA: 'AAA', Today: '-28.6%', Stories: '46, 5× its usual day' });
    expect(JSON.parse(wide.querySelector('a[href="/stocks/ccc/"]')!.getAttribute('data-tip')!)).toEqual({ CCC: 'CCC', Stories: '12' });
    expect(r.el.querySelector('.pt-lede')!.textContent).toBe('On Oct 23, 2026, the companies most in the news were AAA, with 46 stories (5× its usual day), BBB, 30, and CCC, 12.');
    expect(r.text()).toContain('size = news stories that day · as of Oct 23, 2026');
    expect(r.text()).toContain('Each tile is a company, sized by its news stories that day and colored by the day’s move, grouped by sector.');
  });
  it('social: tiles sized by the day\'s posts on Reddit and X, said so in the sentence, the details and the legend (Romeo, 2026-11-01)', async () => {
    const att = { asOf: '2026-10-23', lens: 'social', rows: [
      { ticker: 'AAA', name: 'AAA Inc.', sector: 'Technology', logo: null, count: 412, usual: 137.3, chg1d: 0.031, marketCap: 4e12 },
      { ticker: 'BBB', name: 'BBB Inc.', sector: 'Technology', logo: null, count: 90, usual: null, chg1d: -0.01, marketCap: 2e12 }] };
    const r = await render(PtLogoMap, { lens: 'social' }, withData({ 'attention@1': att }));
    expect(Object.keys(r.record)).toEqual(['attention@1|{"lens":"social","limit":40}']);
    const wide = r.el.querySelector('svg.pt-lm-wide')!;
    expect(wide.getAttribute('aria-label')).toBe('Social heat map: the 2 companies most talked about on Reddit and X on Oct 23, 2026, by sector');
    expect(JSON.parse(wide.querySelector('a[href="/stocks/aaa/"]')!.getAttribute('data-tip')!)).toEqual({ AAA: 'AAA', Today: '+3.1%', Posts: '412, 3× its usual day' });
    expect(r.el.querySelector('.pt-lede')!.textContent).toBe('On Oct 23, 2026, the companies most talked about on Reddit and X were AAA, with 412 posts (3× its usual day) and BBB, 90.');
    expect(r.text()).toContain('size = posts on Reddit and X that day · as of Oct 23, 2026');
    expect(r.text()).toContain('Each tile is a company, sized by its posts on Reddit and X that day and colored by the day’s move, grouped by sector.');
  });
  it('an empty list says so', async () => {
    expect((await view({ asOf: '2026-10-23', rows: [] })).text()).toContain('No companies to show');
  });
});

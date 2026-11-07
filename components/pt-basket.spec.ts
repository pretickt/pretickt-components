import { describe, expect, it } from 'vitest';
import { demoFor, type Basket, type SectorBasket } from '../src/typologies';
import { liveMoves, PtBasket } from './pt-basket';
import { basics, liveDay, press, render, settle, withData } from './_spec';

const demo = (t: string) => demoFor({ t: 'basket@1', params: { ticker: t } }) as Basket;
const mover = (ticker: string, name: string, weight: number, ret: number, headline = true): Basket['moves']['up'][number] => ({ ticker, name, logo: null, weight, ret, points: weight * ret, headline: headline ? { title: `${name} headline`, url: `https://example.com/${ticker}` } : null });
const SMH: Basket = { ...demo('SMH'), ret: -0.0275, moves: { sum: -0.02, up: [mover('AMD', 'Advanced Micro Devices, Inc.', 0.1, 0.01)], down: [mover('NVDA', 'NVIDIA Corporation', 0.205, -0.037), mover('MU', 'Micron Technology, Inc.', 0.09, -0.04, false)] },
  holdings: [{ ticker: 'NVDA', name: 'NVIDIA Corporation', logo: null, weight: 0.205, ret: -0.037, upside: 0.3, label: 'Strong Buy' }, { ticker: 'MU', name: 'Micron Technology, Inc.', logo: null, weight: 0.09, ret: -0.04, upside: 0.5, label: 'Buy' },
    { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', logo: null, weight: 0.1, ret: 0.01, upside: 0.2, label: 'Buy' }, { ticker: null, name: 'A Private Holding', logo: null, weight: 0.01, ret: null, upside: null, label: null }] };
const section = (s: string, b: Basket = SMH, o?: Parameters<typeof render>[3]) => render(PtBasket, { ticker: b.ticker, section: s }, withData({ 'basket@1': b }), o);
const LOW: Basket = { ...SMH, ticker: 'ARKW', state: 'low', coverage: 0.72, target: null, consensus: null, pe: null, questions: null, faq: [] };

describe('pt-basket', () => {
  for (const s of ['moves', 'holdings', 'analysts', 'questions', 'faq']) basics(PtBasket, { ticker: 'SMH', section: s });

  describe('why it moved', () => {
    it('the sentence names the fund\'s own move and the two largest behind it', async () => {
      expect((await section('moves')).text()).toContain('SMH fell 2.75%. Nvidia took off 0.76 points, Micron 0.36.');
    });
    it('says the fund\'s own price is the move, and what the gap from its companies is', async () => {
      const t = (await section('moves')).text();
      expect(t).toMatch(/the part we do not cover/);
      expect(t).toMatch(/fees/);
    });
    it('five slots a side whatever the data: the height never changes when live data arrives', async () => {
      const { el } = await section('moves');
      expect(el.querySelectorAll('.pt-bk-side')).toHaveLength(2);
      for (const side of el.querySelectorAll('.pt-bk-side')) expect(side.querySelectorAll('.pt-bk-mv')).toHaveLength(5);
      expect(el.querySelectorAll('.pt-bk-mv-empty')).toHaveLength(7);
    });
    it('each company links its why-moving page and shows weight, move, points and its headline', async () => {
      const { el } = await section('moves');
      const row = [...el.querySelectorAll('.pt-bk-mv')].find((r) => r.textContent!.includes('Nvidia'))!;
      expect(row.querySelector('a')!.getAttribute('href')).toBe('/stocks/nvda/why-moving/');
      expect(row.textContent).toContain('20.5%');
      expect(row.textContent).toContain('-3.7%');
      expect(row.textContent).toContain('-0.76');
      expect(row.textContent).toContain('NVIDIA Corporation headline');
    });
    it('with the market closed it dates the session and says no delay', async () => {
      const { text } = await section('moves');
      expect(text()).toContain('Sep 30, 2026');
      expect(text()).not.toContain('delayed');
    });
    const open = { session: '2026-10-01', prev: '2026-09-30', time: '11:30 AM ET', q: { SMH: { p: 1, pc: 1, r: 0.02, m: 0, s: null, x: null }, NVDA: { p: 1, pc: 1, r: 0.05, m: 0, s: null, x: null }, MU: { p: 1, pc: 1, r: -0.01, m: 0, s: null, x: null } } };
    const live = async (d: object) => { const r = await section('moves', SMH, { browser: true, providers: liveDay(d) }); await settle(r.f); await r.f.whenStable(); await settle(r.f); return r; };
    it('in a session newer than the data the points follow the delayed quotes and the label says 15-min delayed', async () => {
      const { text, el } = await live(open);
      expect(text()).toContain('SMH rose 2.00%. Nvidia added 1.03 points');
      expect(text()).toContain('11:30 AM ET, 15-min delayed');
      expect(el.querySelectorAll('.pt-bk-side .pt-bk-mv')).toHaveLength(10);
    });
    it('a side with no company says so in its first slot, and keeps its five', async () => {
      const { el } = await section('moves', { ...SMH, moves: { ...SMH.moves, up: [] } });
      const up = el.querySelector('.pt-bk-side')!;
      expect(up.querySelectorAll('.pt-bk-mv')).toHaveLength(5);
      expect(up.textContent).toContain('No holding added as much as 0.01 points.');
      expect(el.querySelectorAll('.pt-bk-side')[1]!.textContent).not.toContain('No holding');
    });
    it('at the delayed prices too, a holding whose part would read 0.00 points names no reason for the move', () => {
      const b: Basket = { ...SMH, holdings: [{ ticker: 'NVDA', name: 'NVIDIA Corporation', logo: null, weight: 0.5, ret: 0, upside: null, label: null }, { ticker: 'TINY', name: 'Tiny Inc.', logo: null, weight: 0.001, ret: 0, upside: null, label: null }] };
      const v = liveMoves(b, { NVDA: { r: 0.01 }, TINY: { r: 0.04 } }, {});
      expect(v.up.map((m) => m.ticker)).toEqual(['NVDA']);
    });
    it('a holding missing from the quotes keeps its last figures', async () => {
      const { el } = await live(open);
      const row = [...el.querySelectorAll('.pt-bk-mv')].find((r) => r.textContent!.includes('AMD'))!; // AMD is not in the quotes: +1.0% still
      expect(row.textContent).toContain('+1.0%');
    });
    it('the delayed prices keep a company with two share classes as one row, and its name once in the sentence', async () => {
      const al = (ticker: string, weight: number) => ({ ticker, name: 'Alphabet Inc.', logo: null, weight, ret: 0.01, upside: 0.1, label: 'Buy' });
      const b: Basket = { ...SMH, holdings: [al('GOOGL', 0.03), al('GOOG', 0.02)] };
      const q = { GOOGL: { p: 1, pc: 1, r: -0.05, m: 0, s: null, x: null }, GOOG: { p: 1, pc: 1, r: -0.05, m: 0, s: null, x: null } };
      const r = await section('moves', b, { browser: true, providers: liveDay({ ...open, q: { ...q, SMH: { p: 1, pc: 1, r: -0.01, m: 0, s: null, x: null } } }) });
      await settle(r.f); await r.f.whenStable(); await settle(r.f);
      expect(r.text().match(/Alphabet/g)!.length).toBe(2); // once in the sentence, once in its row
      expect(r.text()).toContain('Alphabet took off 0.25 points');
    });
    it('the sentence has room reserved, so a longer one does not push the rows down', async () => {
      expect((await section('moves')).el.querySelector('.pt-bk-moved')).not.toBeNull();
    });
    it('a session not newer than the data changes nothing', async () => {
      const { text } = await live({ ...open, session: SMH.asOf });
      expect(text()).toContain('SMH fell 2.75%');
    });
  });

  describe('holdings', () => {
    const many: Basket = { ...SMH, holdings: Array.from({ length: 30 }, (_, i) => ({ ticker: `T${i}`, name: `Company ${i}`, logo: null, weight: 0.03, ret: 0.01, upside: 0.1, label: 'Buy' })) };
    it('25 rows in the server\'s HTML; Show all N opens the rest', async () => {
      const r = await section('holdings', many);
      expect(r.el.querySelectorAll('tbody tr')).toHaveLength(25);
      await press(r.f, r.el, 'Show all 30');
      expect(r.el.querySelectorAll('tbody tr')).toHaveLength(30);
      expect([...r.el.querySelectorAll('button')].map((b) => b.textContent!.trim())).not.toContain('Show all 30');
    });
    it('no button when all fit', async () => expect((await section('holdings')).el.querySelector('button')).toBeNull());
    it('a company not on the site shows name and weight, no link', async () => {
      const row = [...(await section('holdings')).el.querySelectorAll('tbody tr')].at(-1)!;
      expect(row.textContent).toContain('A Private Holding');
      expect(row.textContent).toContain('1.0%');
      expect(row.querySelector('a')).toBeNull();
    });
    it('a line says how much we cover and how the weights are computed', async () => {
      expect((await section('holdings')).text()).toContain('We cover 99% of this fund. Weights recomputed at the last close.');
    });
    it('a fund that publishes rarely says so; one that does not, does not', async () => {
      expect((await section('holdings', { ...SMH, stale: true })).text()).toContain('This fund publishes its holdings less often; the list may be a few weeks old.');
      expect((await section('holdings')).text()).not.toContain('less often');
    });
    it('its note, when it has one', async () => {
      expect((await section('holdings', { ...SMH, note: 'Options, which the target does not see.' })).text()).toContain('Options, which the target does not see.');
    });
  });

  describe('target and consensus', () => {
    it('the figure with its coverage, the median beside it, three contributors, the consensus shares', async () => {
      const b: Basket = { ...SMH, target: { upside: 0.481, price: 747, share: 0.99, median: 0.21, top: [{ ticker: 'NVDA', name: 'NVIDIA Corporation', logo: null, weight: 0.2, upside: 0.3, points: 0.06 }] }, consensus: { buy: 0.57, hold: 0.37, sell: 0.06, n: 20021, label: 'Buy', share: 0.98 } };
      const t = (await section('analysts', b)).text();
      expect(t).toContain('$747.00');
      expect(t).toContain('+48.1%');
      expect(t).toContain('99% of the fund');
      expect(t).toContain('+21.0%');
      expect(t).toContain('Nvidia');
      expect(t).toContain('57% Buy of 20,021 ratings');
      expect(t).toContain('37% Hold');
      expect(t).toContain('6% Sell');
    });
    it('the method note is always visible: weighted, price only, targets have run high, with its source', async () => {
      const { text, el } = await section('analysts');
      expect(text()).toMatch(/Weighted by the fund/);
      expect(text()).toMatch(/no dividends or fees/);
      expect(text()).toMatch(/9\.7%/);
      expect(el.querySelector('a[href*="factset"]')).not.toBeNull();
    });
    it('what the target cannot see is said beside it (JEPI\'s options)', async () => {
      expect((await section('analysts', { ...SMH, note: 'Part of this fund\'s return comes from options, which the target does not see.' })).text()).toContain('which the target does not see');
    });
    it('under 80%: one line says how much we cover, and no figure', async () => {
      const t = (await section('analysts', LOW)).text();
      expect(t).toContain('We cover 72% of this fund');
      expect(t).not.toMatch(/\$\d|Buy of|ratings/);
    });
    it('no good file in 7 days: it says that instead', async () => {
      expect((await section('analysts', { ...LOW, coverage: 0.99 })).text()).toMatch(/no good read/);
    });
  });

  describe('is it a good buy', () => {
    it('six bars with their shares, the lead in facts, the fund\'s facts, the sentence that ends it', async () => {
      const { el, text } = await section('questions');
      expect(el.querySelectorAll('.pt-bk-q')).toHaveLength(6);
      expect(text()).toContain('67% strong');
      expect(text()).toMatch(/By weight, SMH's holdings are strong on \d+% of the questions about the business; weakest on \w+\./);
      expect(text()).toContain('0.35%');
      expect(text()).toMatch(/\$50(\.0+)?B/);
      expect(text().trim().endsWith('pretickt does not say whether to buy or sell.')).toBe(true);
    });
    it('each bar says how much of the fund it rests on, and who its rule leaves out', async () => {
      const { el, text } = await section('questions');
      expect(el.querySelector('.pt-bk-q')!.textContent).toContain('on 98% of the fund');
      expect(text()).toMatch(/Rests on at least 98% of the fund|rests on at least 98% of the fund/);
      expect(text()).toMatch(/utilities and real estate/i);
    });
    it('a question that does not read across the fund says so instead of 0%', async () => {
      const b: Basket = { ...SMH, questions: SMH.questions!.map((q) => (q.key === 'advantage' ? { ...q, pos: 0, flat: 0, neg: 0, comparable: false } : q)) };
      const { el } = await section('questions', b);
      const row = [...el.querySelectorAll('.pt-bk-q')].find((r) => r.textContent!.includes('Advantage'))!;
      expect(row.textContent).toContain('not comparable for this fund');
      expect(row.textContent).not.toContain('0%');
    });
    it('never a yes or a no, never buy or sell as advice', async () => {
      const t = (await section('questions')).text().replace('pretickt does not say whether to buy or sell.', '');
      expect(t).not.toMatch(/\b(yes|no\.|should|recommend|buy|sell)\b/i);
    });
    it('SPY is not compared with itself', async () => {
      const t = (await section('questions', { ...SMH, ticker: 'SPY' })).text();
      expect(t).not.toMatch(/SPY \+/);
    });
    it('under 80%: one line, and the fund\'s facts still', async () => {
      const r = await section('questions', LOW);
      expect(r.text()).toContain('We cover 72% of this fund');
      expect(r.el.querySelectorAll('.pt-bk-q')).toHaveLength(0);
      expect(r.text()).toContain('0.35%');
    });
  });

  it('two lines of one company in the holdings render as two rows, each with its ticker', async () => {
    const al = (ticker: string) => ({ ticker, name: 'Alphabet Inc.', logo: null, weight: 0.02, ret: 0.01, upside: 0.1, label: 'Buy' });
    expect((await section('holdings', { ...SMH, holdings: [al('GOOGL'), al('GOOG')] })).el.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('questions and answers are marked for the page\'s structured data', async () => {
    const { el } = await section('faq', { ...SMH, faq: [{ q: 'What does SMH hold?', a: 'It holds stocks.' }] });
    expect(el.querySelector('[data-faq] [data-faq-q]')!.textContent).toContain('What does SMH hold?');
    expect(el.querySelector('[data-faq] [data-faq-a]')!.textContent).toContain('It holds stocks.');
  });
  it('nothing says stock or company of a fund', async () => {
    for (const s of ['moves', 'analysts', 'questions']) expect((await section(s)).text()).not.toMatch(/\b(this|the) (stock|company)\b/i);
  });
});

describe('pt-basket, for a sector', () => {
  const co = (ticker: string, name: string, weight: number, ret: number | null = 0.01): SectorBasket['holdings'][number] => ({ ticker, name, logo: null, weight, ret, upside: 0.1, label: 'Buy', close: 100 });
  const base = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
  const TECH: SectorBasket = { ...base, ret: 0.012, value: 22.4e12, companies: 3,
    moves: { sum: 0.012, up: [mover('NVDA', 'NVIDIA Corporation', 0.2, 0.02)], down: [] },
    holdings: [co('NVDA', 'NVIDIA Corporation', 0.5), co('AAPL', 'Apple Inc.', 0.3), co('MSFT', 'Microsoft Corporation', 0.2)],
    target: { upside: 0.12, price: 25.1e12, share: 0.97, median: 0.1, top: [{ ticker: 'NVDA', name: 'NVIDIA Corporation', logo: null, weight: 0.5, upside: 0.2, points: 0.1 }] },
    consensus: { buy: 0.61, hold: 0.33, sell: 0.06, n: 2140, label: 'Buy', share: 0.99 } };
  const sec = (s: string, b: SectorBasket = TECH, o?: Parameters<typeof render>[3]) => render(PtBasket, { sector: b.sector, section: s }, withData({ 'sector@1': b }), o);

  for (const s of ['moves', 'holdings', 'analysts', 'questions', 'faq']) basics(PtBasket, { sector: 'Technology', section: s });

  it('the moves sentence names the sector; the note says its companies\' points add up to its move', async () => {
    const t = (await sec('moves')).text();
    expect(t).toContain('Technology rose 1.20%. Nvidia added 0.40 points.');
    expect(t).toMatch(/points add up to the sector's move/);
  });
  const open = { session: '2026-10-01', prev: '2026-09-30', time: '11:30 AM ET', q: { NVDA: { p: 1, pc: 1, r: 0.02, m: 0, s: null, x: null }, AAPL: { p: 1, pc: 1, r: -0.01, m: 0, s: null, x: null } } };
  it('live: the move is the weighted sum of the delayed quotes; a company not yet traded counts flat and has no row', () => {
    const v = liveMoves(TECH, { NVDA: { r: 0.02 }, AAPL: { r: -0.01 } }, {});
    expect(v.ret).toBeCloseTo(0.5 * 0.02 - 0.3 * 0.01, 9);
    expect([...v.up, ...v.down].map((m) => m.ticker)).toEqual(['NVDA', 'AAPL']);
  });
  it('live on the page: the sentence, five slots a side, 15-min delayed', async () => {
    const r = await sec('moves', TECH, { browser: true, providers: liveDay(open) });
    await settle(r.f); await r.f.whenStable(); await settle(r.f);
    expect(r.text()).toContain('Technology rose 0.70%. Nvidia added 1.00 points.');
    expect(r.text()).toContain('11:30 AM ET, 15-min delayed');
    for (const side of r.el.querySelectorAll('.pt-bk-side')) expect(side.querySelectorAll('.pt-bk-mv')).toHaveLength(5);
  });
  it("holdings: every company is in the server's HTML, those after the 25th hidden until Show all N", async () => {
    const many: SectorBasket = { ...TECH, holdings: Array.from({ length: 30 }, (_, i) => co(`T${i}`, `Company ${i}`, 1 / 30)) };
    const r = await sec('holdings', many);
    expect(r.el.querySelectorAll('tbody tr')).toHaveLength(30);
    expect(r.el.querySelectorAll('tbody tr.pt-bk-later')).toHaveLength(5);
    expect(r.el.querySelectorAll('tbody tr a[href="/stocks/t29/"]')).toHaveLength(1);
    expect(r.el.querySelector('.pt-bk-all')).toBeNull();
    await press(r.f, r.el, 'Show all 30');
    expect(r.el.querySelector('.pt-bk-all')).not.toBeNull();
    expect(r.el.querySelectorAll('tbody tr')).toHaveLength(30);
  });
  it('holdings: the note says how the sector is weighed; the column is the company', async () => {
    const r = await sec('holdings');
    expect(r.text()).toContain('Every Technology company on pretickt, weighted by market value at the last close. A company listed under two tickers counts once, split between them.');
    expect(r.el.querySelector('thead th')!.textContent).toBe('Company');
  });
  it('analysts: what the targets would put its companies at, on how much of the sector; the method note', async () => {
    const t = (await sec('analysts')).text();
    expect(t).toContain('$25.1T');
    expect(t).toContain('+12.0%');
    expect(t).toContain("What analysts' targets on 97% of the sector would put its companies at.");
    expect(t).toContain('61% Buy of 2,140 ratings');
    expect(t).toMatch(/on 99% of the sector/);
    expect(t).toMatch(/Weighted by market value/);
  });
  it('questions: not comparable for this sector instead of 0%; the sector\'s facts; the sentence that ends it', async () => {
    const fin = demoFor({ t: 'sector@1', params: { sector: 'Financial Services' } }) as SectorBasket;
    const r = await sec('questions', fin);
    const row = [...r.el.querySelectorAll('.pt-bk-q')].find((x) => x.textContent!.includes('Advantage'))!;
    expect(row.textContent).toContain('not comparable for this sector');
    expect(row.textContent).not.toContain('0%');
    const facts = [...r.el.querySelectorAll('.pt-bk-facts dt')].map((d) => d.textContent);
    expect(facts).toEqual(['Companies', 'Market value', 'Largest', 'Top 10']);
    expect(r.text()).toMatch(/By weight, Financial Services' companies are strong on/);
    expect(r.text().trim().endsWith('pretickt does not say whether to buy or sell.')).toBe(true);
  });
  it('nothing says fund, fee or holding of a sector', async () => {
    for (const s of ['moves', 'holdings', 'analysts', 'questions']) expect((await sec(s)).text(), s).not.toMatch(/\bfunds?\b|\bfees?\b|holding/i);
  });
});

it('pt-basket with neither a ticker nor a sector says the data is not available', async () => {
  expect((await render(PtBasket, { section: 'moves' })).el.querySelector('.pt-na')).not.toBeNull();
});

it("a sector's facts name its largest company with its classes merged, and its top 10 as companies", async () => {
  const base = demoFor({ t: 'sector@1', params: { sector: 'Communication Services' } }) as SectorBasket;
  const b: SectorBasket = { ...base, top: [{ ticker: 'GOOGL', name: 'Alphabet Inc.', logo: null, weight: 0.544 }, { ticker: 'META', name: 'Meta Platforms, Inc.', logo: null, weight: 0.244 }] };
  const r = await render(PtBasket, { sector: 'Communication Services', section: 'questions' }, withData({ 'sector@1': b }));
  const facts = Object.fromEntries([...r.el.querySelectorAll('.pt-bk-facts div')].map((d) => [d.querySelector('dt')!.textContent, d.querySelector('dd')!.textContent!.trim()]));
  expect(facts['Largest']).toBe('Alphabet 54.4%');
  expect(facts['Top 10']).toBe('79% of the sector');
});

it("a split on the session is no move of the sector: a company whose delayed price is off its close by more than half counts flat, with no row", () => {
  const base = demoFor({ t: 'sector@1', params: { sector: 'Technology' } }) as SectorBasket;
  const co = (ticker: string, weight: number) => ({ ticker, name: `${ticker} Inc.`, logo: null, weight, ret: 0.01, upside: 0.1, label: 'Buy', close: 100 });
  const b: SectorBasket = { ...base, holdings: [co('NVDA', 0.2), co('AAPL', 0.8)] };
  const v = liveMoves(b, { NVDA: { r: -0.9 }, AAPL: { r: 0.01 } }, {});
  expect(v.ret).toBeCloseTo(0.008, 9);
  expect([...v.up, ...v.down].map((m) => m.ticker)).toEqual(['AAPL']);
});

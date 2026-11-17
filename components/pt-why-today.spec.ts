import { moveBreakdownDemo, type MoveBreakdown } from '../src/typologies';
import { PtWhyToday } from './pt-why-today';
import { basics, liveDay, press, render, withData } from './_spec';

const base = (o: Partial<MoveBreakdown> = {}): MoveBreakdown => ({ ...moveBreakdownDemo({ ticker: 'NVDA', window: '1d' }), name: 'NVIDIA', sectorName: 'Technology',
  ret: -0.031, marketRet: -0.012, sectorRet: -0.02, market: -0.012, sector: -0.008, specific: -0.011, driver: 'market', ...o });
const html = async (m: MoveBreakdown) => (await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }))).html();
/** What the component says, its company named by a link (the words, not the markup). */
const text = async (m: MoveBreakdown) => (await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }))).el.textContent!.replace(/\s+/g, ' ');

describe('pt-why-today', () => {
  basics(PtWhyToday, { ticker: 'NVDA' });
  it('answers first, in one templated sentence, with the three parts', async () => {
    const out = await text(base());
    expect(out).toMatch(/Nvidia NVDA fell 3\.1% on Sep 30, 2026\./);
    expect(out).toContain('The market (SPY) fell 1.2%');
    // the sector page's «Technology −1.7%» weighs companies by value; this is the average company's move, and says so (www, 2026-11-15)
    expect(out).toContain('the average Technology stock fell 2.0%');
    expect((await html(base())).match(/class="pt-bd-row/g)).toHaveLength(4); // the three parts and the total
  });
  it('the sector\'s row says it is the sector beside the market: «Technology stocks fell 2.0%» above and «Technology sector -0.8%» below read as two figures for one thing (www, 2026-11-15)', async () => {
    const out = await text(base());
    expect(out).toContain('Technology vs market');
    expect(out).not.toContain('Technology sector');
    expect(await text(base({ sectorName: null as never }))).toContain('Sector vs market');
  });
  // www, AAPL on 2026-11-16: «Apple fell 1.0%», bars −1.9 −1.1 +2.1 (= −0.9) and «Most of the move is specific to Apple» beside a green bar
  // (Romeo, 2026-11-17: «perché in questa immagine vedo scritto Apple fell e poi nel grafico è salita?»)
  const AAPL = base({ ret: -0.00979594128048955, marketRet: -0.01911528825377462, sectorRet: -0.03059991169943731, market: -0.01911528825377462,
    sector: -0.01148462344566269, specific: 0.02080397041894776, driver: 'stock' });
  const rows = async (m: MoveBreakdown) => [...(await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }))).el.querySelectorAll('.pt-bd-row')]
    .map((r) => ({ k: r.querySelector('.pt-bd-k')!.textContent!.trim(), v: r.querySelector('.pt-bd-v')!.textContent!.trim(), bar: r.querySelector('.pt-bd-bar')!.getAttribute('style') }));
  it('ends on the total, and the parts as shown add up to it and to the sentence above (rounded through the running sums)', async () => {
    const r = await rows(AAPL);
    expect(r.map((x) => [x.k, x.v])).toEqual([['Market (SPY)', '-1.9%'], ['Technology vs market', '-1.2%'], ['NVDA specific', '+2.1%'], ['NVDA total', '-1.0%']]);
    const out = await text(AAPL);
    expect(out).toContain('The market (SPY) fell 1.9%; the average Technology stock fell 3.1%.');
    expect(out).toMatch(/fell 1\.0% on/);
  });
  it('draws a waterfall: each part starts where the one before ended, the total from zero', async () => {
    // from -3.1% to 0: market 0 → -1.9, sector -1.9 → -3.1, specific -3.1 → -1.0, total 0 → -1.0
    const r = await rows(AAPL);
    expect(r.map((x) => x.bar)).toEqual(['left: 38.7097%; width: 61.2903%;', 'left: 0%; width: 38.7097%;', 'left: 0%; width: 67.7419%;',
      'left: 67.7419%; width: 32.2581%;']);
  });
  it('never calls «most of the move» a part that went the other way', async () => {
    const out = await text(AAPL);
    expect(out).not.toContain('Most of the move');
    expect(out).toContain('did better than the average Technology stock: without its own +2.1% it would have fallen 3.1%.');
    const up = await text(base({ ret: 0.01, marketRet: 0.019, sectorRet: 0.031, market: 0.019, sector: 0.012, specific: -0.021, driver: 'stock' }));
    expect(up).toContain('did worse than the average Technology stock: without its own -2.1% it would have risen 3.1%.');
    const market = await text(base({ ret: -0.004, marketRet: 0.02, sectorRet: 0.015, market: 0.02, sector: -0.005, specific: -0.019, driver: 'market' }));
    expect(market).toContain('fell even though the market rose: its sector and its own move pulled it down.');
  });
  it('names the driver', async () => {
    expect(await text(base({ driver: 'stock' }))).toContain('Most of the move is specific to Nvidia NVDA');
    expect(await html(base({ driver: 'sector' }))).toContain('Most of the move came from its sector');
  });
  it('names the company as a link with its logo, its card on hover (the logo from the company, as the card at the top asks for it)', async () => {
    const co = { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', logo: '/logos/nvda-1.png' };
    const r = await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': base({ driver: 'stock' }), 'company@1': co }));
    const lead = r.el.querySelector('.pt-why-lead a.pt-mention')!;
    expect(lead.getAttribute('href')).toBe('/stocks/nvda/');
    expect(lead.querySelector('img')!.getAttribute('src')).toBe('/logos/nvda-1.png');
    expect(r.el.querySelectorAll('a.pt-mention')).toHaveLength(2); // the lead and "specific to Nvidia NVDA"
  });
  it('flags a news spike and lists the top stories', async () => {
    const out = await html(base({ news: { today: 9, avg30: 3, spike: true, top: [{ title: 'Probe <x>', site: 'R', url: 'https://x', sentiment: -0.6 }] } }));
    expect(out).toContain('9 stories, 3.0× the 30-day average');
    expect(out).toContain('Probe &lt;x&gt;');
    expect(out).toContain('pt-dot-neg');
  });
  it('does not quote an average it does not have', async () => {
    const out = await html(base({ news: { today: 7, avg30: 0, spike: false, top: [] } }));
    expect(out).toContain('7 stories on the day.');
    expect(out).not.toContain('30-day average');
  });
  it('offers 1D, 5D and 1M, the current one pressed; a press asks for that window', async () => {
    const r = await render(PtWhyToday, { ticker: 'NVDA' });
    expect(r.html()).toContain('<div class="pt-head">');
    expect([...r.el.querySelectorAll('.pt-toggles button')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`)).toEqual(['1D:true', '5D:false', '1M:false']);
    await press(r.f, r.el, '5D');
    expect(r.el.querySelector('.pt-why-lead')!.textContent).toContain('over the five sessions');
    expect(r.calls()).toBe(3); // the window's breakdown twice, the company once (its logo; the card at the top asks for the same)
  });
  it('without a window input it shows the day (the default)', async () => {
    const r = await render(PtWhyToday, { ticker: 'NVDA' });
    expect(r.el.querySelector('[aria-pressed="true"]')!.textContent).toBe('1D');
  });

  describe('while the market is open (today\'s file, prices 15 minutes late)', () => {
    const LIVE = { q: { NVDA: { p: 100, pc: 106.38, r: -0.06, m: 0.004, s: -0.002, x: -0.062 } },
      news: { NVDA: { n: 12, top: [{ title: 'Nvidia falls <b>', site: 'WSJ', url: 'https://wsj.com/a', at: '2026-10-01 10:31:00' }] } },
      earnings: { NVDA: { date: '2026-09-30', time: 'amc' as const, eps: 7.4, epsEst: 6.54, rev: 64601000000, revEst: 63343010000 } } };
    const live = async (d: Parameters<typeof liveDay>[0] = LIVE, m = base()) =>
      render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }), { browser: true, providers: liveDay(d) });

    it('tells today\'s move so far, split, with the results just reported and the news since the close', async () => {
      const r = await live();
      const out = r.html(), said = r.el.textContent!.replace(/\s+/g, ' ');
      expect(said).toContain('Nvidia NVDA is down 6.0% today, as of 11:30 AM ET.');
      expect(said).toContain('The market (SPY) is up 0.4%; the average Technology stock is up 0.2%. Most of the move is specific to Nvidia NVDA.');
      expect(said).toContain('Nvidia NVDA reported after the close on Sep 30, 2026: EPS $7.40 vs $6.54 expected (+13.1%); revenue $64.6B vs $63.34B (+2.0%).');
      expect(out).toContain('12 stories since the close on Sep 30, 2026.');
      expect(out).toContain('Nvidia falls &lt;b&gt;');
      expect(said).toContain('On Sep 30, 2026 Nvidia NVDA fell 3.1%.');
      expect(out).toContain('Prices 15 minutes delayed.');
      expect([...r.el.querySelectorAll('.pt-bd-v')].map((e) => e.textContent)).toEqual(['+0.4%', '-0.2%', '-6.2%', '-6.0%']);
      expect([...r.el.querySelectorAll('.pt-toggles button')].map((b) => b.textContent)).toEqual(['Today', '5D', '1M']);
    });
    it('says so when there is no company news since the close, and no results', async () => {
      const out = (await live({ q: LIVE.q })).html();
      expect(out).toContain('No company news since the close on Sep 30, 2026.');
      expect(out).not.toContain('reported');
    });
    it('5D and 1M stay on the end-of-day breakdown', async () => {
      const r = await live();
      await press(r.f, r.el, '5D');
      expect(r.el.querySelector('.pt-why-lead')!.textContent).toBe('Nvidia NVDA fell 3.1% on Sep 30, 2026.'); // the fixed 1D answer: what matters is "not today"
      expect(r.html()).not.toContain('since the close');
      expect(r.html()).not.toContain('reported');
    });
    it('a file no newer than the page\'s data, or without the company, changes nothing', async () => {
      const said = async (d: Parameters<typeof liveDay>[0]) => (await live(d)).el.textContent!.replace(/\s+/g, ' ');
      expect(await said({ ...LIVE, session: '2026-09-30' })).toContain('Nvidia NVDA fell 3.1% on Sep 30, 2026.');
      expect(await said({ q: {} })).toContain('Nvidia NVDA fell 3.1% on Sep 30, 2026.');
    });
  });
});

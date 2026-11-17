import { moveBreakdownDemo, type MoveBreakdown } from '../src/typologies';
import { PtWhyToday } from './pt-why-today';
import { basics, liveDay, press, render, withData } from './_spec';

const base = (o: Partial<MoveBreakdown> = {}): MoveBreakdown => ({ ...moveBreakdownDemo({ ticker: 'NVDA', window: '1d' }), name: 'NVIDIA', sectorName: 'Technology',
  ret: -0.031, marketRet: -0.012, sectorRet: -0.02, market: -0.012, sector: -0.008, specific: -0.011, driver: 'market', ...o });
const html = async (m: MoveBreakdown) => (await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }))).html();
/** What the component says, its company named by a link (the words, not the markup). */
const text = async (m: MoveBreakdown) => (await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }))).el.textContent!.replace(/\s+/g, ' ');

// www, AAPL on 2026-11-16: «Apple fell 1.0%», bars −1.9 −1.1 +2.1 and «Most of the move is specific to Apple» beside a green bar (Romeo, 2026-11-17:
// «perché in questa immagine vedo scritto Apple fell e poi nel grafico è salita?»)
const AAPL = base({ ret: -0.00979594128048955, marketRet: -0.01911528825377462, sectorRet: -0.03059991169943731, market: -0.01911528825377462,
  sector: -0.01148462344566269, specific: 0.02080397041894776, driver: 'stock' });
const rows = async (m: MoveBreakdown) => [...(await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': m }))).el.querySelectorAll('.pt-bd-row')]
  .map((r) => ({ k: r.querySelector('.pt-bd-k')!.textContent!.trim(), v: r.querySelector('.pt-bd-v')!.textContent!.trim(), bar: r.querySelector('.pt-bd-bar')!.getAttribute('style') }));

describe('pt-why-today', () => {
  basics(PtWhyToday, { ticker: 'NVDA' });
  it('answers first, then compares the move with the market\'s and the average stock of its sector, each drawn from zero', async () => {
    const out = await text(base());
    expect(out).toMatch(/Nvidia NVDA fell 3\.1% on Sep 30, 2026\./);
    expect(out).toContain('Nvidia NVDA fell 1.1 points more than the average Technology stock.');
    expect(await rows(base())).toEqual([{ k: 'NVDA', v: '-3.1%', bar: 'left: 0%; width: 100%;' }, { k: 'Market (SPY)', v: '-1.2%', bar: 'left: 61.2903%; width: 38.7097%;' },
      { k: 'Average Technology stock', v: '-2.0%', bar: 'left: 35.4839%; width: 64.5161%;' }]);
    // the sector page's «Technology −1.7%» weighs companies by value; this is the average company's move, and the note says so (www, 2026-11-15)
    expect(out).toContain('Average Technology stock = the equal-weight average of the tracked companies in the sector.');
  });
  it('no parts to add up: no «vs market», no «specific» (Romeo, 2026-11-17: «è ancora confusionario»)', async () => {
    const out = await text(AAPL);
    for (const s of ['vs market', 'specific', 'Most of the move', 'total']) expect(out).not.toContain(s);
    expect((await rows(base({ sectorRet: null }))).map((r) => r.k)).toEqual(['NVDA', 'Market (SPY)']);
  });
  it('a stock that fell less than its sector held up (www, AAPL on 2026-11-16: «fell 1.0%» beside a green +2.1% bar)', async () => {
    expect((await rows(AAPL)).map((r) => r.v)).toEqual(['-1.0%', '-1.9%', '-3.1%']);
    expect(await text(AAPL)).toContain('A bad day for Technology stocks: Nvidia NVDA held up 2.1 points better than the average one.');
  });
  it('says each case in words that compare real moves', async () => {
    const say = (o: Partial<MoveBreakdown>) => text(base(o));
    expect(await say({ ret: 0.01, marketRet: 0.019, sectorRet: 0.031 })).toContain('Nvidia NVDA rose 2.1 points less than the average Technology stock.');
    expect(await say({ ret: 0.05, marketRet: 0.019, sectorRet: 0.031 })).toContain('Nvidia NVDA rose 1.9 points more than the average Technology stock.');
    expect(await say({ ret: -0.004, marketRet: 0.02, sectorRet: 0.015 })).toContain('Nvidia NVDA fell while the market rose 2.0%: the drop is its own.');
    expect(await say({ ret: 0.012, marketRet: -0.019, sectorRet: -0.03 })).toContain('Nvidia NVDA rose while the market fell 1.9%.');
    expect(await say({ ret: -0.021, marketRet: -0.012, sectorRet: -0.02 })).toContain('Nvidia NVDA moved with its sector: the average Technology stock fell 2.0%.');
    expect(await say({ ret: -0.0001, marketRet: -0.012 })).toContain('Nvidia NVDA was flat while the market fell 1.2%.');
    expect(await say({ ret: -0.031, marketRet: -0.012, sectorRet: null })).toContain('Nvidia NVDA fell 1.9 points more than the market.');
  });
  it('names the company as a link with its logo, its card on hover (the logo from the company, as the card at the top asks for it)', async () => {
    const co = { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', logo: '/logos/nvda-1.png' };
    const r = await render(PtWhyToday, { ticker: 'NVDA' }, withData({ 'move-breakdown@1': base({ driver: 'stock' }), 'company@1': co }));
    const lead = r.el.querySelector('.pt-why-lead a.pt-mention')!;
    expect(lead.getAttribute('href')).toBe('/stocks/nvda/');
    expect(lead.querySelector('img')!.getAttribute('src')).toBe('/logos/nvda-1.png');
    expect(r.el.querySelectorAll('a.pt-mention')).toHaveLength(2); // the lead and the comparison
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
      expect(said).toContain('Nvidia NVDA is down while the market is up 0.4%: the drop is its own.');
      expect(said).toContain('Nvidia NVDA reported after the close on Sep 30, 2026: EPS $7.40 vs $6.54 expected (+13.1%); revenue $64.6B vs $63.34B (+2.0%).');
      expect(out).toContain('12 stories since the close on Sep 30, 2026.');
      expect(out).toContain('Nvidia falls &lt;b&gt;');
      expect(said).toContain('On Sep 30, 2026 Nvidia NVDA fell 3.1%.');
      expect(out).toContain('Prices 15 minutes delayed.');
      expect([...r.el.querySelectorAll('.pt-bd-v')].map((e) => e.textContent)).toEqual(['-6.0%', '+0.4%', '+0.2%']);
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

import type { LiveDay } from '@pretickt/components/context';
import type { FollowFile } from '@pretickt/components/typologies';
import { canFloat, liveChips, openFloating } from './pip';

const day = (q: LiveDay['q']): LiveDay => ({ session: '2026-11-16', prev: '2026-11-13', asOf: '2026-11-16T15:30:00Z', time: '10:30 AM ET', delayMin: 15, closed: false, q, news: {}, earnings: {} });
const FILE: FollowFile = { v: 1, asOf: '2026-11-13', companies: {
  NVDA: { name: 'NVIDIA Corporation', alerts: [{ kind: 'near-support', session: '2026-11-13', tone: 'flat', label: 'Support', value: '2.1% below', line: 'x 1', pic: null }], levels: { s: 180, r: 210 } },
  KO: { name: 'The Coca-Cola Company', alerts: [], levels: { s: 60 } } } };

describe('the floating window (part 3: Document Picture-in-Picture)', () => {
  it("the day's price lights a level: below support, above resistance, within 2% of either; a 5% move", () => {
    expect(liveChips({ p: 179, pc: 181 }, { s: 180, r: 210 })).toEqual([{ label: 'Below support', tone: 'neg' }]);
    expect(liveChips({ p: 182, pc: 181 }, { s: 180, r: 210 })).toEqual([{ label: 'Near support', tone: 'flat' }]);
    expect(liveChips({ p: 207, pc: 200 }, { s: 180, r: 210 })).toEqual([{ label: 'Near resistance', tone: 'flat' }]);
    expect(liveChips({ p: 212, pc: 200 }, { s: 180, r: 210 })).toEqual([{ label: '+6.0% today', tone: 'pos' }, { label: 'Above resistance', tone: 'pos' }]);
    expect(liveChips({ p: 195, pc: 196 }, { s: 180, r: 210 })).toEqual([]);
    expect(liveChips(null, { s: 180 })).toEqual([]);
  });
  it('only where the browser has the API (Chrome, Edge desktop)', () => {
    expect(canFloat({} as Window)).toBe(false);
    expect(canFloat({ documentPictureInPicture: { requestWindow: async () => ({}) } } as unknown as Window)).toBe(true);
  });
  it('one row per followed company: name, price, move, the night\'s alerts and the ones the day lights; a new one flashes', async () => {
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const pipWin = { document: pipDoc, addEventListener: () => {}, close: () => {} } as unknown as Window;
    const win = { documentPictureInPicture: { requestWindow: async () => pipWin }, location: { origin: 'https://www.pretickt.com' } } as unknown as Window;
    let q: LiveDay['q'] = { NVDA: { p: 182, pc: 186, r: -0.0215, m: null, s: null, x: null }, KO: { p: 70, pc: 70, r: 0, m: null, s: null, x: null } };
    const f = await openFloating(win, { follows: ['NVDA', 'KO'], file: FILE, load: async () => day(q), everyMs: 0 });
    const rows = [...pipDoc.querySelectorAll('.pt-pip-row')];
    expect(rows.map((r) => r.querySelector('.pt-pip-name')!.textContent)).toEqual(['Nvidia', 'Coca-Cola']);
    expect(rows[0]!.textContent).toContain('$182.00');
    expect(rows[0]!.textContent).toContain('-2.1%'); // the site's pct of -0.0215
    expect([...rows[0]!.querySelectorAll('.pt-pip-chip')].map((c) => c.textContent)).toEqual(['Support 2.1% below', 'Near support']);
    expect(pipDoc.querySelector('link[rel="stylesheet"]')!.getAttribute('href')).toBe('https://www.pretickt.com/ds.css');
    q = { ...q, NVDA: { ...q.NVDA!, p: 178 } };
    await f.refresh();
    const chips = [...pipDoc.querySelectorAll('.pt-pip-row')[0]!.querySelectorAll('.pt-pip-chip')];
    expect(chips.map((c) => c.textContent)).toEqual(['Support 2.1% below', 'Below support']);
    expect(chips[1]!.classList.contains('pt-pip-new')).toBe(true);
    f.stop();
  });
  it('the rows are the companies followed now: a follow made on the page shows at the next draw', async () => {
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const pipWin = { document: pipDoc, addEventListener: () => {}, close: () => {} } as unknown as Window;
    const win = { documentPictureInPicture: { requestWindow: async () => pipWin }, location: { origin: 'https://x' } } as unknown as Window;
    let follows = ['NVDA'];
    const f = await openFloating(win, { follows: () => follows, file: FILE, load: async () => null, everyMs: 0 });
    expect(pipDoc.querySelectorAll('.pt-pip-row')).toHaveLength(1);
    follows = ['NVDA', 'KO'];
    f.redraw();
    expect([...pipDoc.querySelectorAll('.pt-pip-name')].map((e) => e.textContent)).toEqual(['Nvidia', 'Coca-Cola']);
    f.stop();
  });
  describe('the polling', () => {
    afterEach(() => vi.useRealTimers());
    const open = async (closed: boolean, now: string) => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: new Date(now) });
      const pipDoc = document.implementation.createHTMLDocument('pip');
      const pipWin = { document: pipDoc, addEventListener: () => {}, close: () => {} } as unknown as Window;
      const win = { documentPictureInPicture: { requestWindow: async () => pipWin }, location: { origin: 'https://x' } } as unknown as Window;
      let loads = 0;
      const f = await openFloating(win, { follows: ['NVDA'], file: FILE, load: async () => { loads++; return { ...day({}), session: '2026-11-16', closed }; }, everyMs: 1000 });
      return { f, loads: () => loads };
    };
    it('during the session: every turn', async () => {
      const { f, loads } = await open(false, '2026-11-16T15:30:00Z');   // Monday 10:30 ET
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      expect(loads()).toBe(4);
      f.stop();
    });
    it('not once the day has closed, nor on a weekend', async () => {
      const a = await open(true, '2026-11-16T21:30:00Z');   // Monday 16:30 ET, the session closed
      vi.advanceTimersByTime(3000);
      expect(a.loads()).toBe(1);
      a.f.stop();
      vi.useRealTimers();
      const b = await open(false, '2026-11-15T15:30:00Z');   // Sunday
      vi.advanceTimersByTime(3000);
      expect(b.loads()).toBe(1);
      b.f.stop();
    });
  });
  it("the window opens at once (the click's permission is short); the night file comes after", async () => {
    const order: string[] = [];
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const pipWin = { document: pipDoc, addEventListener: () => {}, close: () => {} } as unknown as Window;
    const win = { documentPictureInPicture: { requestWindow: async () => { order.push('window'); return pipWin; } }, location: { origin: 'https://x' } } as unknown as Window;
    const f = await openFloating(win, { follows: ['NVDA'], file: async () => { order.push('file'); return FILE; }, load: async () => null, everyMs: 0 });
    expect(order).toEqual(['window', 'file']);
    expect(pipDoc.querySelector('.pt-pip-name')!.textContent).toBe('Nvidia');
    f.stop();
  });
});

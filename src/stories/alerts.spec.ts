import { ApplicationRef, createComponent, EnvironmentInjector, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CONDITION_IDS, CONDITIONS } from '../alerts/catalog';
import { stories as manage } from './alert-manage.stories';
import { storyProviders } from './story';
import { stories } from './alerts.stories';
import { MOCK_UNIVERSE } from '../alerts/mock';
import { mockSeries } from './fake-alerts';
import { stories as pages } from './pages.stories';

describe('the alerts in the stories (made-up data)', () => {
  it('every condition id has a card story, and the flow stories are there', () => {
    const names = stories.map((s) => s.name);
    for (const id of CONDITION_IDS) expect(names, id).toContain(`Card · ${CONDITIONS[id].name}`);
    for (const n of ['Editor · empty', 'Editor · from the movers', "Editor · Romeo's example", "Editor · from AMD's page: price target, then news",
      'Editor · saving fails', 'Editor · saved', 'Editor · Turnstile, invisible (test key: passes)', 'Editor · Turnstile asks for a tap (test key)',
      'Editor · Turnstile fails (test key: blocks)', 'Editor · over a limit', 'Editor · My portfolio, pasted']) expect(names).toContain(n);
  });

  it('the previews show the company page with its bells and the alert on top, and the alerts page', () => {
    const names = pages.map((s) => s.name);
    expect(names.some((n) => n?.startsWith('AMD with alerts'))).toBe(true);
    expect(names.some((n) => n?.startsWith('/alerts/'))).toBe(true);
  });

  it("every manage story shows its state as the stories app mounts it (under the page's injector), not the note for no link", async () => {
    for (const s of manage.filter((x) => x.name !== 'Without a link (the server)')) {
      const injector = Injector.create({ parent: TestBed.inject(Injector), providers: storyProviders(s as never) });
      const ref = createComponent(s.component, { environmentInjector: TestBed.inject(EnvironmentInjector), elementInjector: injector });
      TestBed.inject(ApplicationRef).attachView(ref.hostView);
      const el = ref.location.nativeElement as HTMLElement;
      const text = () => (el.textContent ?? '').trim();
      for (let i = 0; i < 80 && (!text() || /Loading|Open the link/.test(text())); i++) { TestBed.tick(); await new Promise((r) => setTimeout(r, 25)); }
      expect(text(), s.name).not.toBe('');
      expect(text(), s.name).not.toContain('Open the link in one of our emails');
      ref.destroy();
    }
  });

  it("the made-up closes end where the cards say: the last two are the row's, their 50-day average is the row's", () => {
    const amd = MOCK_UNIVERSE.rows.find((r) => r.ticker === 'AMD')!;
    const [series] = mockSeries({ tickers: ['AMD'], range: '1y' }) as { points: { c: number }[] }[];
    const cs = series!.points.map((p) => p.c);
    expect(cs.at(-1)).toBe(amd.close);
    expect(cs.at(-2)).toBe(amd.prevClose);
    const ma50 = cs.slice(-50).reduce((a, b) => a + b, 0) / 50;
    expect(Math.abs(ma50 / amd.ma50! - 1)).toBeLessThan(0.005);
  });
});

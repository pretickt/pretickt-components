import { TestBed } from '@angular/core/testing';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { demoFor } from '../typologies';
import { PT_PAGE, type PageModel } from './model';
import { PtPage } from './page';

async function page(model: PageModel) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: PT_PAGE, useValue: model },
    { provide: PT_STORE, useValue: new PtStore({ server: true, resolve: async (t, params) => demoFor({ t, params } as never) }) }] });
  const f = TestBed.createComponent(PtPage);
  f.detectChanges();
  for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r, 10)); await f.whenStable(); f.detectChanges(); }
  return f.nativeElement as HTMLElement;
}

describe('PtPage', () => {
  it('renders the sections: heading, the "see all" link named for screen readers, one island per placement', async () => {
    const el = await page({ buildId: 'b', api: '', sections: [
      { id: 'card', items: [{ c: 'pt-company-card', props: { ticker: 'NVDA' } }] },
      { id: 'fin', title: 'Financials', more: { href: '/x/', label: 'See all' }, items: [{ c: 'pt-financials', props: { ticker: 'NVDA' } }] },
    ] });
    expect([...el.querySelectorAll('section.pt-section')].map((s) => s.id)).toEqual(['card', 'fin']);
    expect(el.querySelector('#card h2')).toBeNull();
    expect(el.querySelector('#fin .pt-section-head h2.pt-section-title')!.textContent).toBe('Financials');
    const more = el.querySelector('#fin a.pt-section-more')!;
    expect([more.getAttribute('href'), more.getAttribute('aria-label'), more.textContent]).toEqual(['/x/', 'See all: Financials', 'See all →']);
    expect([...el.querySelectorAll('[data-island]')].map((d) => `${d.className}|${d.getAttribute('data-island')}`))
      .toEqual(['pt-island|pt-company-card@1.1.0', 'pt-island|pt-financials@2.2.0']);
  });
  it('a placement switched off by the build, or a tag it does not know, is a static "not available"', async () => {
    const el = await page({ buildId: 'b', api: '', sections: [{ id: 's', items: [{ c: 'pt-news', props: { ticker: 'NVDA' }, off: true }, { c: 'pt-unknown', props: {} }] }] });
    expect(el.querySelectorAll('[data-island]')).toHaveLength(0);
    expect(el.querySelectorAll('.pt-island > p.pt-na')).toHaveLength(2);
  });
  it('a prop the page does not give keeps the component\'s default (why-today: the day; financials: eight quarters)', async () => {
    const el = await page({ buildId: 'b', api: '', sections: [{ id: 's', items: [{ c: 'pt-why-today', props: { ticker: 'NVDA' } }, { c: 'pt-financials', props: { ticker: 'NVDA' } }] }] });
    expect(el.querySelector('pt-why-today [aria-pressed="true"]')!.textContent).toBe('1D');
    expect(el.querySelectorAll('pt-financials tr.pt-fin-q')).toHaveLength(8);
  });
});

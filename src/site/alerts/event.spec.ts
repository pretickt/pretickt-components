import { ApplicationRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PT_STORE, PtStore } from '@pretickt/components/context';
import { AE_AMD, AE_FIVE } from '../../alerts/event-mock';
import { demoFor } from '../../typologies';
import { PtAlertEvent, showEvent } from './event';

function render(event: unknown) {
  const f = TestBed.createComponent(PtAlertEvent);
  f.componentRef.setInput('event', event);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { el, text: () => el.textContent!.replace(/\s+/g, ' ') };
}
const ID = 'AbCdEf0123456789_-xy';
function page(resolve: (t: string, p: unknown) => Promise<unknown>) {
  TestBed.configureTestingModule({ providers: [{ provide: PT_STORE, useValue: new PtStore({ server: false, resolve }) }] });
  document.body.innerHTML = '<main><pt-page></pt-page></main>';
  return { appRef: TestBed.inject(ApplicationRef), env: TestBed.inject(EnvironmentInjector) };
}

describe('pt-alert-event: the alert that fired, at the top of the company page', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it("renders the headline with the company's common name, the day and the time", () => {
    const t = render(AE_AMD).text();
    expect(t).toContain('Your alert · Mega-cap drops');
    expect(t).toContain('AMD fell 7.9% in the session on Oct 30, fired at 3:45 PM ET');
  });

  it('one line per condition with its section link', () => {
    const { el } = render(AE_AMD);
    const items = [...el.querySelectorAll('.pt-alev-l li')];
    expect(items.map((li) => li.querySelector('span')!.textContent!.trim())).toEqual(['fell 7.9% in the session', 'trades 24% below its 50-day average']);
    expect(items.map((li) => li.querySelector('a')?.getAttribute('href'))).toEqual(['#why', '#technicals']);
    expect(items[0]!.querySelector('a')!.textContent).toContain('Why it moved');
  });

  it('a move seen during the session carries its time and price', () => {
    const seen = { ...AE_AMD, conditions: [{ ...AE_AMD.conditions[0]!, at: '9:31 AM ET', price: 151.07 }, ...AE_AMD.conditions.slice(1)] };
    const { el, text } = render(seen);
    expect(text()).toContain('AMD was down 7.9% at 9:31 AM ET ($151.07) on Oct 30, fired at 3:45 PM ET');
    expect(el.querySelector('.pt-alev-l li span')!.textContent!.trim()).toBe('was down 7.9% at 9:31 AM ET ($151.07)');
  });

  it('a condition the page does not show has no link', () => {
    const { el } = render(AE_FIVE);
    const social = [...el.querySelectorAll('.pt-alev-l li')].find((li) => li.textContent!.includes('Reddit'))!;
    expect(social.querySelector('a')).toBeNull();
  });

  it('null renders nothing', () => {
    expect(render(null).el.querySelector('.pt-alev')).toBeNull();
  });

  it("an alert email's link shows the alert that fired above the company page", async () => {
    const asked: unknown[] = [];
    const { appRef, env } = page(async (t, p) => { asked.push([t, p]); return demoFor({ t, params: p } as never); });
    await showEvent(document, appRef, env, `?alert=${ID}`, 'AMD');
    TestBed.tick();
    expect(asked).toEqual([['alert-event@1', { id: ID }]]);
    const card = document.querySelector('pt-alert-event .pt-alev')!;
    expect(card.textContent).toContain('Your alert · Mega-cap drops');
    expect(card.closest('pt-page')).toBeNull();
    expect(document.querySelector('pt-alert-event')!.nextElementSibling!.tagName).toBe('PT-PAGE');
  });

  it("another company's page, a failed call or a malformed link show nothing", async () => {
    const asked: unknown[] = [];
    const { appRef, env } = page(async (t, p) => { asked.push([t, p]); if (asked.length > 1) throw new Error('offline'); return demoFor({ t, params: p } as never); });
    await showEvent(document, appRef, env, `?alert=${ID}`, 'NVDA');
    await showEvent(document, appRef, env, `?alert=${ID.replace('A', 'B')}`, 'AMD');
    await showEvent(document, appRef, env, '?alert=bad', 'AMD');
    TestBed.tick();
    expect(asked).toHaveLength(2);
    expect(document.querySelector('pt-alert-event')).toBeNull();
  });
});

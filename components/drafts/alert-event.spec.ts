import { render } from '../_spec';
import { AE_AMD, AE_FIVE } from './alert-event-mock';
import { PtAlertEvent } from './pt-alert-event';

describe('pt-alert-event (draft): the alert that fired, at the top of the company page', () => {
  it("renders the headline with the company's common name, the day and the time", async () => {
    const { text } = await render(PtAlertEvent, { event: AE_AMD });
    const t = text().replace(/\s+/g, ' ');
    expect(t).toContain('Your alert · Mega-cap drops');
    expect(t).toContain('AMD fell 7.9% in the session on Oct 30, fired at 3:45 PM ET');
  });

  it('one line per condition with its section link', async () => {
    const { el } = await render(PtAlertEvent, { event: AE_AMD });
    const items = [...el.querySelectorAll('.pt-alev-l li')];
    expect(items.map((li) => li.querySelector('span')!.textContent!.trim())).toEqual(['fell 7.9% in the session', 'trades 24% below its 50-day average']);
    expect(items.map((li) => li.querySelector('a')?.getAttribute('href'))).toEqual(['#why', '#technicals']);
    expect(items[0]!.querySelector('a')!.textContent).toContain('Why it moved');
  });

  it('a condition the page does not show has no link', async () => {
    const { el } = await render(PtAlertEvent, { event: AE_FIVE });
    const social = [...el.querySelectorAll('.pt-alev-l li')].find((li) => li.textContent!.includes('Reddit'))!;
    expect(social.querySelector('a')).toBeNull();
  });

  it('null renders nothing', async () => {
    const { el } = await render(PtAlertEvent, { event: null });
    expect(el.querySelector('.pt-alev')).toBeNull();
  });
});

/** The email alerts on made-up data (Romeo, 2026-11-01): the editor in its states, then one card per condition (version A). */
import { Component, inject, input, type OnInit } from '@angular/core';
import { CONDITION_IDS, CONDITIONS } from '../alerts/catalog';
import { MOCK_BARS, MOCK_UNIVERSE } from '../alerts/mock';
import { condition, passCount, type Rule } from '../alerts/rule';
import { rowsOf } from '../alerts/rows';
import { PtAlerts } from '../alerts/service';
import type { AlertSource } from '../alerts/sources';
import { PtAlertCard } from '../site/alerts/card';
import { PtAlertEditor } from '../site/alerts/editor';
import { fakeAlerts, mockSeries } from './fake-alerts';
import { story } from './story';

/** The editor in place of a dialog, opened on the badges of the given bells. */
@Component({ selector: 'pt-alert-editor-story', imports: [PtAlertEditor], host: { class: 'pt-al-inline' }, template: '<pt-alert-editor />' })
export class PtAlertEditorStory implements OnInit {
  readonly bells = input<AlertSource[]>([]);
  private readonly alerts = inject(PtAlerts);
  ngOnInit(): void {
    const from = { tag: 'pt-movers', section: 'moves', path: '/' };
    for (const b of this.bells()) this.alerts.add(b, from);
    this.alerts.open();
  }
}

const EDITOR = 'Alerts · the editor (made-up data)';
const CARDS = 'Alerts · one card per condition (version A, made-up data)';
const data = { 'price-series@1': mockSeries };
/** Types an email and presses Save, a second after the story mounts. */
const saveAs = (email: string) => (_refresh: () => void, el: HTMLElement) => {
  const input = el.querySelector<HTMLInputElement>('.pt-al-email');
  if (!input) return;
  input.value = email;
  input.dispatchEvent(new Event('input'));
  setTimeout(() => el.querySelector<HTMLButtonElement>('.pt-al-save')?.click(), 50);
};

const rows = rowsOf(MOCK_UNIVERSE, null);
const amd = rows.find((r) => r.ticker === 'AMD')!;
const closes = (mockSeries({ tickers: ['AMD'], range: '2y' }) as { points: { t: string; c: number }[] }[])[0]!.points.map((p) => ({ t: p.t, c: p.c }));
const cardOf = (id: (typeof CONDITION_IDS)[number]) => {
  const rc = condition(id, id === 'one-stock' ? { ticker: 'AMD' } : undefined, amd);
  const rule: Rule = { v: 1, all: [rc] };
  return story(PtAlertCard, { name: `Card · ${CONDITIONS[id].name}`, group: CARDS,
    inputs: { rc, data: { row: amd, rows, bars: MOCK_BARS['AMD'], closes }, count: passCount(rule, 0, rows), ofLabel: 'stocks' } });
};

export const stories = [
  story(PtAlertEditorStory, { name: 'Editor · empty', providers: fakeAlerts(), data, group: EDITOR }),
  story(PtAlertEditorStory, { name: 'Editor · from the movers', inputs: { bells: [{ c: 'session-move' }] }, providers: fakeAlerts(), data, group: EDITOR }),
  story(PtAlertEditorStory, { name: "Editor · Romeo's example", inputs: { bells: [{ c: 'session-move', mega: true }, { c: 'below-average' }] },
    providers: fakeAlerts(), data, group: EDITOR }),
  story(PtAlertEditorStory, { name: "Editor · from AMD's page: price target, then news",
    inputs: { bells: [{ c: 'analyst-upside', ticker: 'AMD' }, { c: 'news-spike', ticker: 'AMD' }] }, providers: fakeAlerts(), data, group: EDITOR }),
  story(PtAlertEditorStory, { name: 'Editor · saving fails', inputs: { bells: [{ c: 'session-move', mega: true }] }, providers: fakeAlerts({ fail: 'network' }),
    data, group: EDITOR, run: saveAs('reader@example.com') }),
  story(PtAlertEditorStory, { name: 'Editor · saved', inputs: { bells: [{ c: 'session-move', mega: true }, { c: 'below-average' }] }, providers: fakeAlerts(),
    data, group: EDITOR, run: saveAs('reader@example.com') }),
  ...CONDITION_IDS.map(cardOf),
];

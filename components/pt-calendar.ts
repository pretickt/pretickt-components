import * as z from 'zod/mini';
import { defineComponent, type DataFor, type Helpers } from '../src/sdk';
import { Month, type EventItem, type Events } from '../src/typologies';

export const manifest = defineComponent({
  tag: 'pt-calendar',
  version: '1.0.0',
  need: {
    question: 'Which companies report earnings this month, and when?',
    evidence: [
      'DataForSEO: "earnings calendar" ~153k searches/month, SERP without AI overview (reports/Funzioni pretickt da tenere e aggiungere.md)',
      'beta: events-calendar month grid (pretickt-frontend/src/app/home/events-calendar.ts); stockanalysis.com earnings calendar',
    ],
  },
  params: z.object({ month: Month }),
  user: [],
  uses: [],
  needs: (p) => ({ events: { t: 'events@1', params: { scope: { by: 'universe', month: p.month }, kinds: ['earnings'] } } }),
});

export const samples = [{ month: '2026-10' }, { month: '2027-01' }];

const CAP = 4;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return iso(y!, m! - 1 + delta, 1).slice(0, 7);
}

export interface Cell { date: string; day: number; inMonth: boolean; isAsOf: boolean; items: EventItem[] }

/** Monday-first weeks for `month`; `asOf` (latest session) is highlighted instead of a clock-based "today". */
export function buildMonth(month: string, items: EventItem[], asOf: string) {
  const [y, m] = month.split('-').map(Number);
  const m0 = m! - 1;
  const byDay = new Map<string, EventItem[]>();
  for (const e of items) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const lead = (new Date(Date.UTC(y!, m0, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y!, m0 + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  const cells: Cell[] = Array.from({ length: total }, (_, i) => {
    const d = new Date(Date.UTC(y!, m0, 1 - lead + i));
    const date = d.toISOString().slice(0, 10);
    return { date, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m0, isAsOf: date === asOf, items: byDay.get(date) ?? [] };
  });
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, label: `${MONTHS[m0]} ${y}`, weeks };
}

type Data = DataFor<{ events: Events }>;
const time = (e: EventItem) => (e.kind === 'earnings' && e.meta.time ? e.meta.time.toUpperCase() : '');

function chip(e: EventItem, h: Helpers): string {
  const est = e.kind === 'earnings' && e.meta.epsEst != null ? h.num(e.meta.epsEst) : null;
  return `<a class="pt-cal-ev" href="/stocks/${h.esc(e.ticker.toLowerCase())}/" ${h.tip({ [e.ticker]: e.name, Date: h.date(e.date), Time: time(e) || null, 'EPS est.': est })}>` +
    `${h.esc(e.ticker)}<span class="pt-cal-time">${time(e)}</span></a>`;
}

export function renderStatic(data: Data, params: { month: string }, h: Helpers): string {
  if (!data.events) return h.na();
  const items = data.events.items.filter((e) => e.date.startsWith(params.month));
  const cal = buildMonth(params.month, items, data.events.asOf);
  const prev = shiftMonth(params.month, -1), next = shiftMonth(params.month, 1);
  const head = `<div class="pt-cal-head"><h2 class="pt-section-title">${cal.label}</h2><div class="pt-cal-nav">` +
    `<button type="button" data-set='{"month":"${prev}"}'>← ${h.esc(prev)}</button><button type="button" data-set='{"month":"${next}"}'>${h.esc(next)} →</button></div></div>`;
  const grid = DOW.map((d) => `<div class="pt-cal-dow">${d}</div>`).join('') + cal.weeks.flat().map((c) => {
    const cls = `pt-cal-day${c.inMonth ? '' : ' pt-cal-out'}${c.isAsOf ? ' pt-cal-asof' : ''}`;
    const more = c.items.length > CAP ? `<div class="pt-cal-more">+${c.items.length - CAP} more</div>` : '';
    return `<div class="${cls}"><div>${c.day}</div>${c.items.slice(0, CAP).map((e) => chip(e, h)).join('')}${more}</div>`;
  }).join('');
  const days = [...new Set(items.map((e) => e.date))].sort();
  const list = days.length
    ? `<ol class="pt-cal-list">${days.map((d) => `<li><span class="pt-cal-list-day">${h.date(d)}</span> ${items.filter((e) => e.date === d)
        .map((e) => `<a href="/stocks/${h.esc(e.ticker.toLowerCase())}/">${h.esc(e.name)} (${h.esc(e.ticker)})${time(e) ? ` ${time(e)}` : ''}</a>`).join(', ')}</li>`).join('')}</ol>`
    : `<p class="pt-lede">No earnings reports scheduled for ${cal.label} in the tracked universe yet.</p>`;
  return `<section class="pt-cal">${head}<div class="pt-cal-grid">${grid}</div>${list}</section>`;
}

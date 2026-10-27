/**
 * DRAFT · H4 Earnings next week + the crowd's odds (mock data, stories only): the week's earnings calendar, each company's logo
 * inside a ring as full as the chance Polymarket's traders give it of clearing its EPS bar. Its data (Polymarket markets matched
 * to tickers and report dates, with their volume) has no pipeline yet — and its terms of use come first — so it comes as an input.
 * @version 0.0.1
 */
import { Component, computed, input } from '@angular/core';
import { PtLogo } from '@pretickt/components/ds';
import { date, dayMonth, level, stockHref, tip, usd } from '@pretickt/components/format';

export interface OddsItem { ticker: string; name: string; logo: string | null; date: string; time: 'bmo' | 'amc' | null; question: string;
  prob: number; volume: number; url: string }
export interface Odds { asOf: string; from: string; to: string; items: OddsItem[] }

const R = 22, C = 2 * Math.PI * R;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** The tone of a chance: likely (60% or more), unlikely (40% or less), or a coin toss. */
export const oddsTone = (p: number) => (p >= 0.6 ? 'pos' : p <= 0.4 ? 'neg' : 'flat');
/** The ring's arc for a chance: its dash against the whole circle. */
export const arc = (p: number) => `${Math.round(C * Math.max(0, Math.min(1, p)) * 10) / 10} ${Math.round(C * 10) / 10}`;
/** The weekdays from `from` to `to`, each with its companies, the most traded first, at most `per` a day. */
export function oddsDays(o: Odds, per = 4) {
  const out: { iso: string; day: string; items: OddsItem[]; more: number }[] = [];
  for (let d = Date.parse(`${o.from}T00:00:00Z`); d <= Date.parse(`${o.to}T00:00:00Z`); d += 86400000) {
    const w = new Date(d).getUTCDay();
    if (w === 0 || w === 6) continue;
    const iso = new Date(d).toISOString().slice(0, 10);
    const all = o.items.filter((i) => i.date === iso).sort((a, b) => b.volume - a.volume);
    out.push({ iso, day: WEEKDAY[w]!, items: all.slice(0, per), more: Math.max(0, all.length - per) });
  }
  return out;
}

@Component({
  selector: 'pt-odds',
  imports: [PtLogo],
  template: `
    @let d = data();
    @if (d === null) {<p class="pt-na">Data not available</p>}
    @else {
      <figure class="dr-fig">
        <div class="dr-head"><b>Earnings next week · the crowd’s odds</b><span class="pt-meta">Polymarket · the chance its traders give of clearing the EPS bar</span></div>
        <div class="dr-cal">
          @for (day of days(); track day.iso) {
            <div class="dr-cal-day">
              <b class="dr-cal-h">{{ day.day }}<br><span class="pt-meta">{{ dayMonth(day.iso) }}</span></b>
              @for (i of day.items; track i.ticker) {
                <a class="dr-ring" [href]="stockHref(i.ticker)" [attr.data-tip]="itemTip(i)" [attr.aria-label]="i.name + ': ' + level(i.prob) + ' chance of ' + i.question">
                  <span class="dr-ring-box">
                    <svg viewBox="0 0 52 52" aria-hidden="true"><circle class="dr-ring-track" cx="26" cy="26" r="22" />
                      <circle [class]="'dr-ring-arc dr-ring-' + tone(i.prob)" cx="26" cy="26" r="22" [attr.stroke-dasharray]="arc(i.prob)" transform="rotate(-90 26 26)" /></svg>
                    <pt-logo [ticker]="i.ticker" [src]="i.logo" [size]="24" />
                  </span>
                  <span class="dr-ring-t">{{ i.ticker }} <b [class]="'pt-t-' + tone(i.prob)">{{ level(i.prob, 0) }}</b></span>
                </a>
              } @empty {<span class="pt-meta">no report</span>}
              @if (day.more) {<span class="pt-meta">+{{ day.more }} more</span>}
            </div>
          }
        </div>
        <figcaption class="pt-meta">A full ring: the crowd expects the company to clear its bar. Odds from Polymarket markets as of {{ date(d.asOf) }}; not a forecast of pretickt.</figcaption>
      </figure>
    }`,
})
export class PtOdds {
  readonly data = input.required<Odds | null>();
  protected readonly days = computed(() => { const d = this.data(); return d ? oddsDays(d) : []; });
  protected readonly itemTip = (i: OddsItem) => tip({ [i.ticker]: i.name, Reports: `${date(i.date)}${i.time ? (i.time === 'bmo' ? ', before the open' : ', after the close') : ''}`,
    Market: i.question, Chance: level(i.prob, 0), Traded: usd(i.volume, { compact: true }) });
  protected readonly tone = oddsTone;
  protected readonly arc = arc;
  protected readonly date = date;
  protected readonly dayMonth = dayMonth;
  protected readonly level = level;
  protected readonly stockHref = stockHref;
}

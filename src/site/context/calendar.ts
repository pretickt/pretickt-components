import { Component, computed, input } from '@angular/core';
import { PtLogo } from '../../ds/pt-logo';
import { PtSay } from '../../ds/pt-mention';
import type { CalendarCtx } from '../../context/click';

/**
 * The calendar's row as the reader saw it (kinds `earnings` and `dividend`): the row's head (logo, name, the usual move or the move,
 * when, the last eight bars, the hint), its sentence, its estimates and the company's earnings or dividend page. The hover card over
 * a calendar chip shows the same, so the two never disagree.
 */
@Component({
  selector: 'pt-ctx-calendar',
  imports: [PtLogo, PtSay],
  template: `
    @let r = d();
    <div class="pt-cal-pop-row">
      <pt-logo [ticker]="r.ticker" [src]="r.logo" [size]="32" />
      <span class="pt-cal-row-who"><b>{{ r.title }}</b></span>
      <b [class]="'pt-cal-row-cue ' + (r.cueTone === 'est' ? 'pt-cal-row-est' : 'pt-t-' + r.cueTone)">{{ r.cue }}</b>
      <span class="pt-cal-row-when">{{ r.when }}</span>
      @if (r.bars; as mb) {
        <svg class="pt-cal-row-bars" [attr.viewBox]="'0 0 ' + mb.w + ' 22'" [attr.width]="mb.w" height="22" aria-hidden="true">
          <line x1="0" [attr.x2]="mb.w" y1="11" y2="11" />
          @for (b of mb.bars; track $index) {<rect [attr.x]="b.x" [attr.y]="b.y" width="4" [attr.height]="b.h" rx="1" [class]="'pt-t-' + b.tone" />}
        </svg>
      }
      <span class="pt-cal-row-hint">{{ r.hint }}</span>
    </div>
    <div class="pt-ctx-more">
      <p class="pt-cal-row-say"><pt-say [parts]="r.said" /></p>
      @if (r.facts) {<p class="pt-meta">{{ r.facts }}</p>}
      @if (page(); as pg) {<p class="pt-cal-row-link"><a [href]="pg.href">{{ pg.label }} →</a></p>}
    </div>`,
})
export class PtCtxCalendar {
  readonly d = input.required<CalendarCtx>();
  /** The page the reader landed on: a link to it is not drawn. */
  readonly land = input('');
  protected readonly page = computed(() => { const p = this.d().page; return p && p.href !== this.land() ? p : null; });
}

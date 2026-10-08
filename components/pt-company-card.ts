/**
 * How does this company look at a glance: price over the last 60 sessions, 52-week range, analysts, and its key numbers?
 * @version 1.1.0
 * @evidence beta: the company page header and the hover mini-card (CompanyHoverCard), asked back by Romeo on 2026-10-06
 */
import { Component, computed, inject, input, signal } from '@angular/core';
import { Pt } from '@pretickt/components/context';
import { PtBadge, PtLogo } from '@pretickt/components/ds';
import { date, money, pct, tone, usd } from '@pretickt/components/format';
import { METRIC_KEYS, type MetricKey } from '@pretickt/components/typologies';

/** The tags before "Show all": fundamentals, then technicals. */
export const CARD_KEYS: readonly MetricKey[] = ['pe_vs_own', 'pe_vs_sector', 'pt_upside', 'off_high', 'insider_net', 'fcf_yield', 'earnings_in',
  'trend', 'sector_trend', 'rsi14', 'ma_cross', 'volume_ratio', 'support', 'resistance'];
/** Items the card's body already shows: never repeated as tags. */
const IN_BODY = new Set<string>(['market_cap', 'consensus', 'range_52w']);
export const SESSIONS = 60;
const SPARK_W = 120, SPARK_H = 32;

@Component({
  selector: 'pt-company-card',
  imports: [PtBadge, PtLogo],
  template: `
    @if (ready().settled && !ready().available) {<p class="pt-na">Data not available</p>}
    @else if (ready().settled) {
      <section [class]="'pt-card pt-card-' + size()">
        <div class="pt-card-id">
          <pt-logo [ticker]="ticker()" [src]="co.value()?.logo ?? null" [size]="size() === 'wide' ? 40 : 32" />
          <div class="pt-card-who">
            <div class="pt-card-name">{{ co.value()?.name ?? ticker() }}</div>
            <div class="pt-meta">{{ ticker() }}{{ mcap() != null ? ' · ' + usd(mcap(), { compact: true }) : '' }}</div>
          </div>
        </div>
        @if (close() != null) {
          <div class="pt-card-price">
            <span class="pt-card-close">{{ money(close()) }}</span>
            @if (spark(); as s) {<svg class="pt-card-spark" [attr.viewBox]="'0 0 ' + SPARK_W + ' ' + SPARK_H" aria-hidden="true"><polyline [attr.points]="s" /></svg>}
            @if (change() != null) {<span [class]="'pt-t-' + tone(change())">{{ pct(change()) }}</span>}
            @if (asOf(); as d) {<span class="pt-meta pt-card-asof">last {{ SESSIONS }} sessions · close {{ date(d) }}</span>}
          </div>
        }
        @if (range()?.range; as r) {
          <div class="pt-card-range">
            <span class="pt-meta">{{ money(r.lo) }}</span>
            <span class="pt-card-bar" aria-hidden="true">@if (rangeAt(); as at) {<span class="pt-card-dot" [style.left]="at"></span>}</span>
            <span class="pt-meta">{{ money(r.hi) }}</span>
            <span class="pt-meta pt-card-asof">52 weeks</span>
          </div>
        }
        @if (consensus() || target() != null) {
          <div class="pt-card-analysts">
            @if (consensus()?.text; as text) {<span [class]="'pt-t-' + consensus()!.tone">{{ text }} · {{ consensus()!.value }} analysts</span>}
            @if (target() != null && upside() != null) {<span [class]="'pt-card-pt pt-tone-' + tone(upside())">PT {{ money(target()) }} {{ pct(upside()) }}</span>}
          </div>
        }
        @if (main().length) {<ul class="pt-badges pt-card-tags">@for (m of main(); track m.key) {<li [ptBadge]="m" size="mini"></li>}</ul>}
        @if (rest().length) {
          <ul class="pt-badges pt-card-more" [style.display]="open() ? null : 'none'">@for (m of rest(); track m.key) {<li [ptBadge]="m" size="mini"></li>}</ul>
          <button type="button" class="pt-abtn pt-card-all" (click)="open.set(!open())">{{ open() ? 'Show less' : 'Show all (' + rest().length + ')' }}</button>
        }
        @if (footer().length) {<div class="pt-card-foot">@for (r of footer(); track r[0]) {<div><b>{{ r[0] }}</b> {{ r[1] }}</div>}</div>}
      </section>
    }`,
})
export class PtCompanyCard {
  private readonly pt = inject(Pt);
  readonly ticker = input.required<string>();
  readonly size = input<'wide' | 'compact'>('wide');
  /** The link's tooltip rows (hover card): its footer. */
  readonly extra = input<Record<string, unknown> | null>(null);

  protected readonly co = this.pt.company(() => ({ ticker: this.ticker() }));
  protected readonly metrics = this.pt.metric(() => ({ ticker: this.ticker(), metrics: [...METRIC_KEYS] }));
  protected readonly series = this.pt.priceSeries(() => ({ tickers: [this.ticker()], range: '3m' }));
  /** Whether the three calls have answered, and whether any of them has something to show (the hover card waits for it). */
  readonly ready = computed(() => {
    const vs = [this.co.value(), this.metrics.value(), this.series.value()];
    return { settled: vs.every((v) => v !== undefined), available: vs.some((v) => v != null) };
  });
  protected readonly open = signal(false);
  protected readonly SESSIONS = SESSIONS;
  protected readonly SPARK_W = SPARK_W;
  protected readonly SPARK_H = SPARK_H;
  protected readonly money = money;
  protected readonly pct = pct;
  protected readonly tone = tone;
  protected readonly usd = usd;
  protected readonly date = date;

  private readonly byKey = computed(() => new Map((this.metrics.value() ?? []).map((m) => [m.key, m])));
  private readonly points = computed(() => (this.series.value()?.[0]?.points ?? []).slice(-SESSIONS));
  protected readonly range = computed(() => this.byKey().get('range_52w'));
  protected readonly close = computed(() => this.points().at(-1)?.c ?? this.range()?.value ?? null);
  protected readonly asOf = computed(() => this.points().at(-1)?.t ?? null);
  protected readonly change = computed(() => { const p = this.points(); return p.length > 1 ? p.at(-1)!.c / p[0]!.c - 1 : null; });
  protected readonly spark = computed(() => {
    const p = this.points();
    if (p.length < 2) return null;
    const cs = p.map((x) => x.c), lo = Math.min(...cs), hi = Math.max(...cs), span = hi - lo || 1;
    return cs.map((c, i) => `${((i / (cs.length - 1)) * SPARK_W).toFixed(1)},${(SPARK_H - ((c - lo) / span) * SPARK_H).toFixed(1)}`).join(' ');
  });
  protected readonly mcap = computed(() => this.byKey().get('market_cap')?.value);
  protected readonly consensus = computed(() => this.byKey().get('consensus'));
  protected readonly upside = computed(() => this.byKey().get('pt_upside')?.value);
  protected readonly target = computed(() => { const c = this.close(), u = this.upside(); return c != null && u != null ? c * (1 + u) : null; });
  protected readonly rangeAt = computed(() => {
    const r = this.range();
    return r?.range && r.value != null && r.range.hi > r.range.lo
      ? `${Math.min(100, Math.max(0, ((r.value - r.range.lo) / (r.range.hi - r.range.lo)) * 100)).toFixed(1)}%` : null;
  });
  protected readonly main = computed(() => CARD_KEYS.flatMap((k) => this.byKey().get(k) ?? []));
  // everything else the payload holds — keys added to the catalogue later included — behind "Show all"
  protected readonly rest = computed(() => (this.metrics.value() ?? []).filter((m) => !CARD_KEYS.includes(m.key as MetricKey) && !IN_BODY.has(m.key)));
  // the link's tooltip rows, minus the company row (the header says it) and the empty ones
  protected readonly footer = computed(() => Object.entries(this.extra() ?? {}).filter(([k, v]) => k !== this.ticker() && v != null && v !== '').map(([k, v]) => [k, String(v)] as const));
}
